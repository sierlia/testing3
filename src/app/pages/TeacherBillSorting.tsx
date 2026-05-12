import { type ReactNode, useEffect, useMemo, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { BookOpen, Check, FileText, GripVertical, Search } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { supabase } from "../utils/supabase";
import { sanitizeHtml } from "../utils/sanitizeHtml";

interface Bill {
  id: string;
  number: string;
  title: string;
  text: string;
  assignedTargets: string[];
}

interface Committee {
  id: string;
  name: string;
}

interface Subcommittee {
  id: string;
  committee_id: string;
  name: string;
}

interface ReferralTarget {
  id: string;
  label: string;
  committeeId: string;
  subcommitteeId: string | null;
  subcommittee: boolean;
}

interface DragItem {
  id: string;
  type: string;
}

const committeeTargetId = (committeeId: string) => `committee:${committeeId}`;
const subcommitteeTargetId = (subcommitteeId: string) => `subcommittee:${subcommitteeId}`;
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

function DraggableBill({ bill, onViewText, compact = false }: { bill: Bill; onViewText: (bill: Bill) => void; compact?: boolean }) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: "bill",
    item: { id: bill.id, type: "bill" },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <div ref={preview} className={`rounded-md border border-gray-200 bg-white ${compact ? "p-2" : "p-2.5"} transition-all hover:border-blue-200 hover:bg-blue-50 ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div ref={drag} className="cursor-move">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-900">
            <span className="font-mono font-semibold">{bill.number}</span>
            <span className="text-gray-500"> - </span>
            <span>{bill.title}</span>
          </div>
        </div>
        <button onClick={() => onViewText(bill)} className="rounded-md p-1.5 text-blue-700 hover:bg-blue-100" aria-label={`Read ${bill.number}`}>
          <BookOpen className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DropArea({
  target,
  bills,
  allBills,
  onDrop,
  onViewText,
  children,
}: {
  target: ReferralTarget;
  bills: Bill[];
  allBills: Bill[];
  onDrop: (billId: string, target: ReferralTarget) => void;
  onViewText: (bill: Bill) => void;
  children: ReactNode;
}) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem, monitor) => {
      if (monitor.didDrop()) return;
      onDrop(item.id, target);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  });
  const assigned = bills.filter((bill) => bill.assignedTargets.includes(target.id));

  return (
    <div ref={drop} className={`min-w-0 overflow-hidden rounded-md border p-2 transition-colors ${isOver ? "border-blue-500 bg-blue-50" : target.subcommittee ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"}`}>
      {children}
      {assigned.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {assigned.map((bill) => <DraggableBill key={bill.id} bill={allBills.find((item) => item.id === bill.id) ?? bill} onViewText={onViewText} compact />)}
        </div>
      )}
    </div>
  );
}

function CommitteeDropZone({
  committee,
  subcommittees,
  targets,
  bills,
  onDrop,
  onViewText,
}: {
  committee: Committee;
  subcommittees: Subcommittee[];
  targets: Map<string, ReferralTarget>;
  bills: Bill[];
  onDrop: (billId: string, target: ReferralTarget) => void;
  onViewText: (bill: Bill) => void;
}) {
  const mainTarget = targets.get(committeeTargetId(committee.id));
  if (!mainTarget) return null;
  const committeeAssigned = bills.filter((bill) => bill.assignedTargets.some((targetId) => targets.get(targetId)?.committeeId === committee.id)).length;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <DropArea target={mainTarget} bills={bills} allBills={bills} onDrop={onDrop} onViewText={onViewText}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold text-gray-900">{committee.name}</h3>
            <p className="text-xs text-gray-500">{committeeAssigned} bill{committeeAssigned === 1 ? "" : "s"}</p>
          </div>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Main</span>
        </div>
      </DropArea>
      {subcommittees.length > 0 && (
        <div className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
          {subcommittees.map((subcommittee) => {
            const target = targets.get(subcommitteeTargetId(subcommittee.id));
            if (!target) return null;
            return (
              <DropArea key={subcommittee.id} target={target} bills={bills} allBills={bills} onDrop={onDrop} onViewText={onViewText}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 break-words text-xs font-medium text-gray-700">{subcommittee.name}</div>
                  <span className="text-[11px] text-gray-400">Sub</span>
                </div>
              </DropArea>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnassignedBillsPanel({ isLoading, count, onDrop, children }: { isLoading: boolean; count: number; onDrop: (billId: string) => void; children: ReactNode }) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem) => onDrop(item.id),
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  });

  return (
    <div ref={drop} className={`max-h-[70vh] space-y-2 overflow-y-auto p-4 transition-colors ${isOver ? "bg-blue-50" : ""}`}>
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : count > 0 ? (
        children
      ) : (
        <div className="py-12 text-center text-gray-400">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" />
          <p className="text-sm">All bills assigned.</p>
        </div>
      )}
    </div>
  );
}

export function TeacherBillSorting() {
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<Record<string, string[]>>({});
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [subcommittees, setSubcommittees] = useState<Subcommittee[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subcommitteeReferralsAvailable, setSubcommitteeReferralsAvailable] = useState(true);

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

        const [{ data: committeeRows, error: cErr }, { data: billRows, error: bErr }] = await Promise.all([
          supabase.from("committees").select("id,name").eq("class_id", cid).order("created_at", { ascending: true }),
          supabase.from("bill_display").select("id,hr_label,title,legislative_text").eq("class_id", cid).neq("status", "draft").neq("status", "deleted").order("bill_number", { ascending: true }),
        ]);
        if (cErr) throw cErr;
        if (bErr) throw bErr;
        let nextSubcommitteeReferralsAvailable = true;
        let { data: referralRows, error: rErr } = await supabase.from("bill_referrals").select("bill_id,committee_id,subcommittee_id").eq("class_id", cid);
        if (rErr && String(rErr.message ?? "").toLowerCase().includes("subcommittee_id")) {
          const fallback = await supabase.from("bill_referrals").select("bill_id,committee_id").eq("class_id", cid);
          referralRows = fallback.data;
          rErr = fallback.error;
          nextSubcommitteeReferralsAvailable = false;
        }
        setSubcommitteeReferralsAvailable(nextSubcommitteeReferralsAvailable);
        if (rErr) throw rErr;

        const committeeList = (committeeRows ?? []) as Committee[];
        const committeeIds = committeeList.map((committee) => committee.id);
        let subRows: any[] = [];
        if (nextSubcommitteeReferralsAvailable && committeeIds.length) {
          const { data, error: sErr } = await supabase.from("subcommittees").select("id,committee_id,name").in("committee_id", committeeIds).order("name", { ascending: true });
          if (sErr) {
            nextSubcommitteeReferralsAvailable = false;
            setSubcommitteeReferralsAvailable(false);
          } else {
            subRows = data ?? [];
          }
        }

        const referralMap = new Map<string, string[]>();
        for (const row of referralRows ?? []) {
          const targetId = (row as any).subcommittee_id ? subcommitteeTargetId((row as any).subcommittee_id) : committeeTargetId((row as any).committee_id);
          referralMap.set((row as any).bill_id, [...(referralMap.get((row as any).bill_id) ?? []), targetId]);
        }
        const nextBills = (billRows ?? []).map((b: any) => ({
          id: b.id,
          number: b.hr_label,
          title: b.title,
          text: b.legislative_text,
          assignedTargets: referralMap.get(b.id) ?? [],
        }));
        setCommittees(committeeList);
        setSubcommittees(nextSubcommitteeReferralsAvailable ? subRows as Subcommittee[] : []);
        setBills(nextBills);
        setInitialAssignments(Object.fromEntries(nextBills.map((bill) => [bill.id, [...bill.assignedTargets]])));
      } catch (e: any) {
        toast.error(e.message || "Could not load bills/committees");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const targets = useMemo(() => {
    const map = new Map<string, ReferralTarget>();
    for (const committee of committees) {
      map.set(committeeTargetId(committee.id), { id: committeeTargetId(committee.id), label: committee.name, committeeId: committee.id, subcommitteeId: null, subcommittee: false });
    }
    for (const subcommittee of subcommittees) {
      const committeeName = committees.find((committee) => committee.id === subcommittee.committee_id)?.name ?? "Committee";
      map.set(subcommitteeTargetId(subcommittee.id), { id: subcommitteeTargetId(subcommittee.id), label: `${committeeName}: ${subcommittee.name}`, committeeId: subcommittee.committee_id, subcommitteeId: subcommittee.id, subcommittee: true });
    }
    return map;
  }, [committees, subcommittees]);

  const subcommitteesByCommittee = useMemo(() => {
    const grouped = new Map<string, Subcommittee[]>();
    for (const subcommittee of subcommittees) grouped.set(subcommittee.committee_id, [...(grouped.get(subcommittee.committee_id) ?? []), subcommittee]);
    return grouped;
  }, [subcommittees]);

  const changedBills = useMemo(() => bills.filter((bill) => !sameSet(bill.assignedTargets, initialAssignments[bill.id] ?? [])), [bills, initialAssignments]);

  const handleDrop = (billId: string, target: ReferralTarget) => {
    setBills((prev) => prev.map((bill) => {
      if (bill.id !== billId) return bill;
      const otherCommittees = bill.assignedTargets.filter((targetId) => targets.get(targetId)?.committeeId !== target.committeeId);
      return { ...bill, assignedTargets: [...otherCommittees, target.id] };
    }));
  };
  const handleDropUnassigned = (billId: string) => setBills((prev) => prev.map((bill) => (bill.id === billId ? { ...bill, assignedTargets: [] } : bill)));
  const handleViewText = (bill: Bill) => setSelectedBill(bill);

  const confirmAssignments = async () => {
    if (!classId) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const now = new Date().toISOString();

      for (const bill of changedBills) {
        const { error: deleteError } = await supabase.from("bill_referrals").delete().eq("class_id", classId).eq("bill_id", bill.id);
        if (deleteError) throw deleteError;
      const rows = bill.assignedTargets.map((targetId) => {
          const target = targets.get(targetId);
          if (!target) return null;
          const row: Record<string, any> = {
            bill_id: bill.id,
            class_id: classId,
            committee_id: target.committeeId,
            referred_by: uid,
            referred_at: now,
          };
          if (subcommitteeReferralsAvailable) row.subcommittee_id = target.subcommitteeId;
          return row;
        }).filter(Boolean);
        if (rows.length) {
          const { error: insertError } = await supabase.from("bill_referrals").insert(rows as any);
          if (insertError) throw insertError;
        }
      }

      const assignedBillIds = changedBills.filter((bill) => bill.assignedTargets.length).map((bill) => bill.id);
      const unassignedBillIds = changedBills.filter((bill) => !bill.assignedTargets.length).map((bill) => bill.id);
      if (assignedBillIds.length) await supabase.from("bills").update({ status: "in_committee" } as any).eq("class_id", classId).in("id", assignedBillIds);
      if (unassignedBillIds.length) await supabase.from("bills").update({ status: "submitted" } as any).eq("class_id", classId).in("id", unassignedBillIds);

      setInitialAssignments(Object.fromEntries(bills.map((bill) => [bill.id, [...bill.assignedTargets]])));
      toast.success("Bill referrals saved");
      setShowConfirmModal(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save referrals");
    }
  };

  const unassignedBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bills.filter((bill) => {
      if (bill.assignedTargets.length) return false;
      if (!query) return true;
      return bill.number.toLowerCase().includes(query) || bill.title.toLowerCase().includes(query);
    });
  }, [bills, searchQuery]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
          <BackButton className="mb-4" />
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Sort Bills into Committees</h1>
              <p className="text-gray-600">Drag bills to a committee or directly to a subcommittee.</p>
            </div>
            {changedBills.length > 0 && (
              <button onClick={() => setShowConfirmModal(true)} className="flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-green-700">
                <Check className="h-5 w-5" />
                Save referrals
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-8 lg:self-start">
              <div className="border-b border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Unassigned Bills</h2>
                <p className="mt-1 text-sm text-gray-500">{unassignedBills.length} bill{unassignedBills.length === 1 ? "" : "s"}</p>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search bills..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <UnassignedBillsPanel isLoading={loading} count={unassignedBills.length} onDrop={handleDropUnassigned}>
                {unassignedBills.map((bill) => <DraggableBill key={bill.id} bill={bill} onViewText={handleViewText} />)}
              </UnassignedBillsPanel>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : committees.length === 0 ? (
                <div className="text-sm text-gray-500">No committees configured.</div>
              ) : (
                committees.map((committee) => (
                  <CommitteeDropZone
                    key={committee.id}
                    committee={committee}
                    subcommittees={subcommitteesByCommittee.get(committee.id) ?? []}
                    targets={targets}
                    bills={bills}
                    onDrop={handleDrop}
                    onViewText={handleViewText}
                  />
                ))
              )}
            </div>
          </div>
        </main>

        {selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="border-b border-gray-200 p-5">
                <span className="font-mono text-sm font-bold text-gray-900">{selectedBill.number}</span>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">{selectedBill.title}</h2>
                {selectedBill.assignedTargets.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    Assigned to {selectedBill.assignedTargets.map((targetId) => targets.get(targetId)?.label).filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedBill.text) }} />
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
                <h3 className="text-lg font-semibold text-gray-900">Confirm referral changes</h3>
                <p className="mt-1 text-sm text-gray-600">Only changed bills will be saved.</p>
              </div>
              <div className="px-5 py-4">
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {changedBills.map((bill) => (
                    <div key={bill.id} className="rounded-md bg-gray-50 p-3 text-sm">
                      <span className="font-semibold">{bill.number}</span>
                      <span> - </span>
                      <span className="text-blue-600">{bill.assignedTargets.length ? bill.assignedTargets.map((targetId) => targets.get(targetId)?.label).filter(Boolean).join(", ") : "Unassigned"}</span>
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
