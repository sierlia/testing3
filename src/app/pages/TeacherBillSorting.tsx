import { type ReactNode, useEffect, useMemo, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { FileText, BookOpen, GripVertical, Check, Search } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

interface Bill {
  id: string;
  number: string;
  title: string;
  text: string;
  assignedCommittee?: string;
}

interface Committee {
  id: string;
  name: string;
}

interface DragItem {
  id: string;
  type: string;
}

function DraggableBill({ bill, onViewText, assigned = false }: { bill: Bill; onViewText: (bill: Bill) => void; assigned?: boolean }) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: "bill",
    item: { id: bill.id, type: "bill" },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <div ref={preview} className={`rounded-md border ${assigned ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"} p-2.5 transition-all hover:border-blue-200 hover:bg-blue-50 ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div ref={drag} className="cursor-move">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-900">
            <span className="font-mono font-semibold">{bill.number}</span>
            <span className="text-gray-500"> - </span>
            <span>{bill.title}</span>
          </div>
        </div>
        <button
          onClick={() => onViewText(bill)}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <BookOpen className="w-3 h-3" />
          Read
        </button>
      </div>
    </div>
  );
}

function CommitteeDropZone({
  committee,
  bills,
  onDrop,
  onViewText,
}: {
  committee: Committee;
  bills: Bill[];
  onDrop: (billId: string, committeeId: string) => void;
  onViewText: (bill: Bill) => void;
}) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem) => onDrop(item.id, committee.id),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const assignedBills = bills.filter((b) => b.assignedCommittee === committee.id);

  return (
    <div ref={drop} className={`rounded-lg border bg-white p-4 shadow-sm transition-all min-h-[280px] ${isOver ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">{committee.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{assignedBills.length} bill{assignedBills.length !== 1 ? "s" : ""} assigned</p>
      </div>

      <div className="space-y-3">
        {assignedBills.length > 0 ? (
          assignedBills.map((bill) => <DraggableBill key={bill.id} bill={bill} onViewText={onViewText} assigned />)
        ) : (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Drag bills here to assign</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UnassignedDropZone({ count, onDrop }: { count: number; onDrop: (billId: string) => void }) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem) => onDrop(item.id),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  return (
    <div ref={drop} className={`mt-4 rounded-lg border-2 border-dashed p-3 text-xs text-gray-600 ${isOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
      Drop here to unassign • {count} unassigned
    </div>
  );
}

function UnassignedBillsPanel({ count, onDrop, children }: { count: number; onDrop: (billId: string) => void; children: ReactNode }) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem) => onDrop(item.id),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  return (
    <div ref={drop} className={`max-h-[70vh] space-y-2 overflow-y-auto p-4 transition-colors ${isOver ? "bg-blue-50" : ""}`}>
      {children}
      <div className={`rounded-lg border-2 border-dashed p-3 text-xs text-gray-600 ${isOver ? "border-blue-400 bg-blue-100" : "border-gray-200 bg-gray-50"}`}>
        Drop here to unassign - {count} unassigned
      </div>
    </div>
  );
}

export function TeacherBillSorting() {
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        const { data: prof, error: pErr } = await supabase.from("profiles").select("class_id,role").eq("user_id", uid).maybeSingle();
        if (pErr) throw pErr;
        const cid = (prof as any)?.class_id ?? null;
        setClassId(cid);
        if (!cid) return;
        if ((prof as any)?.role !== "teacher") {
          toast.error("Only teachers can sort bills into committees");
          return;
        }

        const [{ data: committeeRows, error: cErr }, { data: billRows, error: bErr }, { data: referralRows, error: rErr }] = await Promise.all([
          supabase.from("committees").select("id,name").eq("class_id", cid).order("created_at", { ascending: true }),
          supabase.from("bill_display").select("id,hr_label,title,legislative_text").eq("class_id", cid).neq("status", "draft").order("bill_number", { ascending: true }),
          supabase.from("bill_referrals").select("bill_id,committee_id").eq("class_id", cid),
        ]);
        if (cErr) throw cErr;
        if (bErr) throw bErr;
        if (rErr) throw rErr;

        const referralMap = new Map((referralRows ?? []).map((r: any) => [r.bill_id, r.committee_id]));
        setCommittees((committeeRows ?? []) as any);
        setBills(
          (billRows ?? []).map((b: any) => ({
            id: b.id,
            number: b.hr_label,
            title: b.title,
            text: b.legislative_text,
            assignedCommittee: referralMap.get(b.id) ?? undefined,
          })),
        );
      } catch (e: any) {
        toast.error(e.message || "Could not load bills/committees");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleDrop = (billId: string, committeeId: string) => setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, assignedCommittee: committeeId } : b)));
  const handleDropUnassigned = (billId: string) => setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, assignedCommittee: undefined } : b)));
  const handleViewText = (bill: Bill) => setSelectedBill(bill);
  const handleConfirm = () => setShowConfirmModal(true);

  const confirmAssignments = async () => {
    if (!classId) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;

      const assigned = bills.filter((b) => b.assignedCommittee);
      const assignedBillIds = new Set(assigned.map((b) => b.id));

      const { data: existing, error: exErr } = await supabase.from("bill_referrals").select("bill_id").eq("class_id", classId);
      if (exErr) throw exErr;
      const toDelete = (existing ?? []).map((r: any) => r.bill_id).filter((id: string) => !assignedBillIds.has(id));
      if (toDelete.length) {
        const { error: dErr } = await supabase.from("bill_referrals").delete().eq("class_id", classId).in("bill_id", toDelete);
        if (dErr) throw dErr;
        await supabase.from("bills").update({ status: "submitted" } as any).eq("class_id", classId).in("id", toDelete);
      }

      if (assigned.length) {
        const rows = assigned.map((b) => ({
          bill_id: b.id,
          class_id: classId,
          committee_id: b.assignedCommittee,
          referred_by: uid,
          referred_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("bill_referrals").upsert(rows as any, { onConflict: "bill_id" });
        if (error) throw error;
        await supabase.from("bills").update({ status: "in_committee" } as any).eq("class_id", classId).in("id", assigned.map((b) => b.id));
      }

      toast.success("Bill referrals saved");
      setShowConfirmModal(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save referrals");
    }
  };

  const unassignedBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bills.filter((b) => {
      if (b.assignedCommittee) return false;
      if (!query) return true;
      return b.number.toLowerCase().includes(query) || b.title.toLowerCase().includes(query);
    });
  }, [bills, searchQuery]);
  const hasAssignments = bills.some((b) => b.assignedCommittee);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Sort Bills into Committees</h1>
              <p className="text-gray-600">Assign introduced bills to the committee that should review them.</p>
            </div>
            {hasAssignments && (
              <button onClick={handleConfirm} className="flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-white hover:bg-green-700 transition-colors font-medium">
                <Check className="w-5 h-5" />
                Save referrals
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden sticky top-8">
                <div className="border-b border-gray-200 p-4">
                  <h2 className="text-lg font-semibold text-gray-900">Unassigned Bills</h2>
                  <p className="text-sm text-gray-500 mt-1">{unassignedBills.length} bill{unassignedBills.length !== 1 ? "s" : ""}</p>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search bills..."
                      className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <UnassignedBillsPanel count={unassignedBills.length} onDrop={handleDropUnassigned}>
                  {loading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : unassignedBills.length > 0 ? (
                    unassignedBills.map((bill) => <DraggableBill key={bill.id} bill={bill} onViewText={handleViewText} />)
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">All bills assigned!</p>
                    </div>
                  )}
                </UnassignedBillsPanel>
              </div>
            </div>

            <div>
              <div className="grid gap-4 xl:grid-cols-2">
                {loading ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : committees.length === 0 ? (
                  <div className="text-sm text-gray-500">No committees configured.</div>
                ) : (
                  committees.map((committee) => (
                    <CommitteeDropZone key={committee.id} committee={committee} bills={bills} onDrop={handleDrop} onViewText={handleViewText} />
                  ))
                )}
              </div>
            </div>
          </div>
        </main>

        {selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="border-b border-gray-200 p-5">
                <span className="font-mono text-sm font-bold text-gray-900">{selectedBill.number}</span>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">{selectedBill.title}</h2>
                {selectedBill.assignedCommittee && (
                  <p className="mt-2 text-sm text-gray-600">Assigned to {committees.find((c) => c.id === selectedBill.assignedCommittee)?.name}</p>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedBill.text }} />
              </div>
              <div className="flex items-center justify-end border-t border-gray-200 bg-gray-50 p-4">
                <button onClick={() => setSelectedBill(null)} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Confirm referrals</h3>
                <p className="mt-1 text-sm text-gray-600">Save these bill assignments to committee records?</p>
              </div>
              <div className="px-5 py-4">
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {bills
                    .filter((b) => b.assignedCommittee)
                    .map((bill) => (
                      <div key={bill.id} className="rounded-md bg-gray-50 p-3 text-sm">
                        <span className="font-semibold">{bill.number}</span> →{" "}
                        <span className="text-blue-600">{committees.find((c) => c.id === bill.assignedCommittee)?.name}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4">
                <button onClick={() => setShowConfirmModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white hover:text-gray-900">
                  Cancel
                </button>
                <button onClick={() => void confirmAssignments()} className="flex items-center gap-2 rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700">
                  <Check className="h-4 w-4" />
                  Save referrals
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
