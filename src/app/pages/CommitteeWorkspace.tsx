import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";

type BillRow = {
  id: string;
  hr_label: string;
  title: string;
  legislative_text: string;
  author_user_id: string;
};

export function CommitteeWorkspace() {
  const { id } = useParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState<string>("Committee");

  const [bills, setBills] = useState<Array<{ id: string; number: string; title: string; sponsor: string; legislativeHtml: string }>>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        // Derive the class from the committee so deep-links/reloads still have a working my_class_id().
        const { data: committee, error: cErr } = await supabase.from("committees").select("name,class_id").eq("id", committeeId).maybeSingle();
        if (cErr) throw cErr;
        const cid = (committee as any)?.class_id ?? null;
        setCommitteeName((committee as any)?.name ?? "Committee");
        setClassId(cid);
        if (cid) {
          const desiredRole = (auth.user?.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
          await supabase.from("profiles").upsert({ user_id: uid, class_id: cid, role: desiredRole, display_name: auth.user?.user_metadata?.name ?? null } as any);
        }
        if (!cid) return;

        const { data: refs, error: rErr } = await supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId);
        if (rErr) throw rErr;
        const billIds = (refs ?? []).map((r: any) => r.bill_id);
        if (!billIds.length) {
          setBills([]);
          setSelectedBillId(null);
          return;
        }

        const { data: billRows, error: bErr } = await supabase
          .from("bill_display")
          .select("id,hr_label,title,legislative_text,author_user_id")
          .in("id", billIds)
          .order("bill_number", { ascending: true });
        if (bErr) throw bErr;

        const sponsorIds = Array.from(new Set((billRows ?? []).map((b: any) => b.author_user_id)));
        const { data: sponsors } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", sponsorIds.length ? sponsorIds : ["00000000-0000-0000-0000-000000000000"]);
        const sponsorMap = new Map((sponsors ?? []).map((s: any) => [s.user_id, s.display_name]));

        const mapped = (billRows as any[]).map((b: BillRow) => ({
          id: b.id,
          number: b.hr_label,
          title: b.title,
          sponsor: sponsorMap.get(b.author_user_id) ?? "Member",
          legislativeHtml: b.legislative_text,
        }));
        setBills(mapped);
        setSelectedBillId(mapped[0]?.id ?? null);
      } catch (e: any) {
        toast.error(e.message || "Could not load committee workspace");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [committeeId]);

  const selected = bills.find((b) => b.id === selectedBillId) ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeName} Workspace</h1>
          <p className="text-gray-600">Live, collaborative bill text editing</p>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No bills have been referred to this committee yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Referred Bills</div>
                <div className="text-xs text-gray-500">{bills.length} total</div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {bills.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBillId(b.id)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                      selectedBillId === b.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-mono text-sm font-semibold text-gray-900">{b.number}</div>
                    <div className="text-sm text-gray-700 line-clamp-2">{b.title}</div>
                    <div className="text-xs text-gray-500 mt-1">Sponsor: {b.sponsor}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {selected && classId ? (
                <>
                  <div className="p-5 border-b border-gray-200">
                    <div className="font-mono text-sm font-semibold text-gray-900">{selected.number}</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{selected.title}</div>
                    <div className="text-sm text-gray-600 mt-1">Sponsor: {selected.sponsor}</div>
                  </div>
                  <div className="p-5">
                    <CollaborativeBillEditor
                      classId={classId}
                      committeeId={committeeId}
                      billId={selected.id}
                      initialHtml={selected.legislativeHtml}
                      editable
                    />
                    <div className="text-xs text-gray-500 mt-3">
                      Changes sync live to other committee members and are persisted in Supabase.
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-sm text-gray-600">Select a bill.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
