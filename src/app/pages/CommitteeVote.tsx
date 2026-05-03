import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { CheckCircle2, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { CommitteeTabs } from "../components/CommitteeTabs";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import { supabase } from "../utils/supabase";
import { reportBillFromCommittee } from "../services/bills";

type BillRow = {
  id: string;
  hr_label: string;
  title: string;
  legislative_text: string;
  author_user_id: string;
  status: string;
};

type CommitteeBill = {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  legislativeHtml: string;
  status: string;
};

type VoteChoice = "yea" | "nay" | "present";

export function CommitteeVote() {
  const { id } = useParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [myCommitteeRole, setMyCommitteeRole] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState("Committee");
  const [bills, setBills] = useState<CommitteeBill[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Array<{ user_id: string; vote: VoteChoice; voterName: string }>>([]);
  const [voting, setVoting] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        setMeId(uid);

        const { data: committee, error: cErr } = await supabase.from("committees").select("name,class_id").eq("id", committeeId).maybeSingle();
        if (cErr) throw cErr;
        const cid = (committee as any)?.class_id ?? null;
        setCommitteeName((committee as any)?.name ?? "Committee");
        setClassId(cid);
        if (!cid) return;

        const { data: myMembership } = await supabase
          .from("committee_members")
          .select("role")
          .eq("committee_id", committeeId)
          .eq("user_id", uid)
          .maybeSingle();
        setMyCommitteeRole((myMembership as any)?.role ?? null);

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
          .select("id,hr_label,title,legislative_text,author_user_id,status")
          .in("id", billIds)
          .eq("status", "committee_vote")
          .order("bill_number", { ascending: true });
        if (bErr) throw bErr;

        const sponsorIds = Array.from(new Set((billRows ?? []).map((b: any) => b.author_user_id)));
        const { data: sponsors } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", sponsorIds.length ? sponsorIds : ["00000000-0000-0000-0000-000000000000"]);
        const sponsorMap = new Map((sponsors ?? []).map((s: any) => [s.user_id, s.display_name]));

        const mapped = ((billRows ?? []) as BillRow[]).map((bill) => ({
          id: bill.id,
          number: bill.hr_label,
          title: bill.title,
          sponsor: sponsorMap.get(bill.author_user_id) ?? "Member",
          legislativeHtml: bill.legislative_text,
          status: bill.status,
        }));
        setBills(mapped);
        setSelectedBillId(mapped[0]?.id ?? null);
      } catch (e: any) {
        toast.error(e.message || "Could not load committee vote");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [committeeId]);

  const selected = bills.find((bill) => bill.id === selectedBillId) ?? null;

  useEffect(() => {
    if (!selectedBillId || !classId) {
      setVotes([]);
      return;
    }
    let cancelled = false;
    const loadVotes = async () => {
      try {
        const { data, error } = await supabase
          .from("bill_committee_votes")
          .select("user_id,vote")
          .eq("committee_id", committeeId)
          .eq("bill_id", selectedBillId);
        if (error) throw error;
        const voterIds = [...new Set((data ?? []).map((vote: any) => vote.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", voterIds.length ? voterIds : ["00000000-0000-0000-0000-000000000000"]);
        const nameMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
        if (!cancelled) {
          setVotes((data ?? []).map((vote: any) => ({ user_id: vote.user_id, vote: vote.vote, voterName: nameMap.get(vote.user_id) ?? "Member" })));
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Could not load committee votes");
      }
    };
    void loadVotes();
    return () => {
      cancelled = true;
    };
  }, [classId, committeeId, selectedBillId]);

  const castCommitteeVote = async (vote: VoteChoice) => {
    if (!selected || !classId || !meId) return;
    if (selected.status !== "committee_vote") {
      toast.error("This bill has not been proposed for committee vote");
      return;
    }

    setVoting(true);
    try {
      const { error } = await supabase.from("bill_committee_votes").upsert(
        {
          bill_id: selected.id,
          committee_id: committeeId,
          class_id: classId,
          user_id: meId,
          vote,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "bill_id,committee_id,user_id" },
      );
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", meId).maybeSingle();
      setVotes((prev) => [
        ...prev.filter((row) => row.user_id !== meId),
        { user_id: meId, vote, voterName: (profile as any)?.display_name ?? "You" },
      ]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    } finally {
      setVoting(false);
    }
  };

  const reportSelectedBill = async () => {
    if (!selected) return;
    setReporting(true);
    try {
      await reportBillFromCommittee(selected.id);
      setBills((prev) => {
        const next = prev.filter((bill) => bill.id !== selected.id);
        setSelectedBillId(next[0]?.id ?? null);
        return next;
      });
      toast.success("Bill reported from committee");
    } catch (e: any) {
      toast.error(e.message || "Could not report bill");
    } finally {
      setReporting(false);
    }
  };

  const voteCounts = votes.reduce(
    (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
    { yea: 0, nay: 0, present: 0 } as Record<VoteChoice, number>,
  );
  const myVote = meId ? votes.find((vote) => vote.user_id === meId)?.vote ?? null : null;
  const canReportBill = myCommitteeRole === "chair" || myCommitteeRole === "co_chair" || myCommitteeRole === "ranking_member";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeName} Vote</h1>
          <p className="text-gray-600">Vote on bills that have been proposed by committee leadership.</p>
        </div>
        <div className="mb-6">
          <CommitteeTabs committeeId={committeeId} active="vote" />
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : bills.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            No bills have been proposed for committee vote.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">Proposed Bills</div>
                <div className="text-xs text-gray-500">{bills.length} total</div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {bills.map((bill) => (
                  <button
                    key={bill.id}
                    type="button"
                    onClick={() => setSelectedBillId(bill.id)}
                    className={`w-full border-b border-gray-100 p-4 text-left hover:bg-gray-50 ${selectedBillId === bill.id ? "bg-blue-50" : ""}`}
                  >
                    <div className="font-mono text-sm font-semibold text-gray-900">{bill.number}</div>
                    <div className="line-clamp-2 text-sm text-gray-700">{bill.title}</div>
                    <div className="mt-1 text-xs text-gray-500">Sponsor: {bill.sponsor}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:col-span-2">
              {selected && classId ? (
                <>
                  <div className="border-b border-gray-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{selected.number}</div>
                        <div className="mt-1 text-xl font-bold text-gray-900">{selected.title}</div>
                        <div className="mt-1 text-sm text-gray-600">Sponsor: {selected.sponsor}</div>
                      </div>
                      {canReportBill && (
                        <button
                          type="button"
                          onClick={() => void reportSelectedBill()}
                          disabled={reporting}
                          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {reporting ? "Reporting" : "Report bill"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 p-5">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Committee Vote</h3>
                          <p className="text-sm text-gray-600">Members can vote yea, nay, or present.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(["yea", "nay", "present"] as VoteChoice[]).map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              disabled={voting}
                              onClick={() => void castCommitteeVote(choice)}
                              className={`rounded-md px-3 py-2 text-sm font-medium capitalize ${
                                myVote === choice ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              } disabled:opacity-50`}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded bg-white p-3">
                          <div className="text-xl font-bold text-green-700">{voteCounts.yea}</div>
                          <div className="text-xs text-gray-600">Yea</div>
                        </div>
                        <div className="rounded bg-white p-3">
                          <div className="text-xl font-bold text-red-700">{voteCounts.nay}</div>
                          <div className="text-xs text-gray-600">Nay</div>
                        </div>
                        <div className="rounded bg-white p-3">
                          <div className="text-xl font-bold text-gray-700">{voteCounts.present}</div>
                          <div className="text-xs text-gray-600">Present</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-900">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        Edited Bill Text
                      </div>
                      <CollaborativeBillEditor
                        classId={classId}
                        committeeId={committeeId}
                        billId={selected.id}
                        initialHtml={selected.legislativeHtml}
                        editable={false}
                      />
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
