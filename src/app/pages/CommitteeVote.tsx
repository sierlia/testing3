import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle2, ExternalLink, FileText, Maximize2, Move, Pencil, Save, Send, Sparkles, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { CommitteeTabs, markCommitteeSeenIds, updateCommitteeTabCounts } from "../components/CommitteeTabs";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import { supabase } from "../utils/supabase";
import { closeCommitteeVote, finalizeCommitteeVote, submitCommitteeReport } from "../services/bills";

type BillRow = {
  id: string;
  bill_number: number | null;
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
type VoteRow = { user_id: string; vote: VoteChoice; voterName: string };

const votePageCache = new Map<
  string,
  {
    classId: string | null;
    committeeName: string;
    myCommitteeRole: string | null;
    bills: CommitteeBill[];
    selectedBillId: string | null;
  }
>();

function namesForVote(votes: VoteRow[], choice: VoteChoice) {
  return votes.filter((row) => row.vote === choice).map((row) => row.voterName).sort((a, b) => a.localeCompare(b));
}

function VoteTotal({
  choice,
  count,
  names,
  active,
  disabled,
  onVote,
}: {
  choice: VoteChoice;
  count: number;
  names: string[];
  active: boolean;
  disabled: boolean;
  onVote: () => void;
}) {
  const color = choice === "yea" ? "green" : choice === "nay" ? "red" : "gray";
  const activeClass =
    color === "green"
      ? "border-green-300 bg-green-50 text-green-800"
      : color === "red"
        ? "border-red-300 bg-red-50 text-red-800"
        : "border-gray-300 bg-gray-100 text-gray-800";
  const normalClass =
    color === "green"
      ? "border-gray-200 bg-white text-green-700 hover:bg-green-50"
      : color === "red"
        ? "border-gray-200 bg-white text-red-700 hover:bg-red-50"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onVote}
        className={`w-full rounded-md border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? activeClass : normalClass}`}
      >
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-xs font-medium capitalize">{choice}</div>
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-48 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-left text-xs text-gray-700 shadow-lg group-hover:block">
        {names.length ? names.map((name) => <div key={name} className="truncate py-0.5">{name}</div>) : <div className="text-gray-500">No votes yet</div>}
      </div>
    </div>
  );
}

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
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [voteClosedAt, setVoteClosedAt] = useState<string | null>(null);
  const [reportSubmittedAt, setReportSubmittedAt] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [textView, setTextView] = useState<"edited" | "clean" | "original">("edited");
  const [reportPoppedOut, setReportPoppedOut] = useState(false);
  const [reportWindowPos, setReportWindowPos] = useState({ x: 120, y: 120 });

  useEffect(() => {
    const load = async () => {
      const cached = votePageCache.get(committeeId);
      if (cached) {
        setClassId(cached.classId);
        setCommitteeName(cached.committeeName);
        setMyCommitteeRole(cached.myCommitteeRole);
        setBills(cached.bills);
        setSelectedBillId((prev) => prev ?? cached.selectedBillId);
        setLoading(false);
      } else {
        setLoading(true);
      }
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
          .from("bills")
          .select("id,bill_number,title,legislative_text,author_user_id,status")
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
          number: `H.R. ${bill.bill_number ?? ""}`.trim(),
          title: bill.title,
          sponsor: sponsorMap.get(bill.author_user_id) ?? "Member",
          legislativeHtml: bill.legislative_text,
          status: bill.status,
        }));
        setBills(mapped);
        const nextSelectedBillId = selectedBillId && mapped.some((bill) => bill.id === selectedBillId) ? selectedBillId : mapped[0]?.id ?? null;
        setSelectedBillId(nextSelectedBillId);
        votePageCache.set(committeeId, {
          classId: cid,
          committeeName: (committee as any)?.name ?? "Committee",
          myCommitteeRole: (myMembership as any)?.role ?? null,
          bills: mapped,
          selectedBillId: nextSelectedBillId,
        });
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
    if (!selectedBillId) return;
    markCommitteeSeenIds(committeeId, "vote", [selectedBillId]);
  }, [committeeId, selectedBillId]);

  const loadVotes = async (billId: string) => {
    const { data, error } = await supabase
      .from("bill_committee_votes")
      .select("user_id,vote")
      .eq("committee_id", committeeId)
      .eq("bill_id", billId);
    if (error) throw error;
    const voterIds = [...new Set((data ?? []).map((vote: any) => vote.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", voterIds.length ? voterIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
    setVotes((data ?? []).map((vote: any) => ({ user_id: vote.user_id, vote: vote.vote, voterName: nameMap.get(vote.user_id) ?? "Member" })));
  };

  const loadDocState = async (billId: string) => {
    const { data, error } = await supabase
      .from("committee_bill_docs")
      .select("committee_vote_closed_at,committee_report_submitted_at")
      .eq("committee_id", committeeId)
      .eq("bill_id", billId)
      .maybeSingle();
    if (error) throw error;
    setVoteClosedAt((data as any)?.committee_vote_closed_at ?? null);
    setReportSubmittedAt((data as any)?.committee_report_submitted_at ?? null);
  };

  useEffect(() => {
    if (!selectedBillId || !classId) {
      setVotes([]);
      setVoteClosedAt(null);
      setReportSubmittedAt(null);
      return;
    }

    let cancelled = false;
    const refreshVotes = async () => {
      try {
        await loadVotes(selectedBillId);
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Could not load committee votes");
      }
    };
    const refreshDoc = async () => {
      try {
        await loadDocState(selectedBillId);
      } catch {
        if (!cancelled) {
          setVoteClosedAt(null);
          setReportSubmittedAt(null);
        }
      }
    };
    void refreshVotes();
    void refreshDoc();

    const voteChannel = supabase
      .channel(`committee-votes:${committeeId}:${selectedBillId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_committee_votes", filter: `bill_id=eq.${selectedBillId}` }, () => void refreshVotes())
      .subscribe();
    const docChannel = supabase
      .channel(`committee-vote-doc:${committeeId}:${selectedBillId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_bill_docs", filter: `bill_id=eq.${selectedBillId}` }, () => void refreshDoc())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(voteChannel);
      void supabase.removeChannel(docChannel);
    };
  }, [classId, committeeId, selectedBillId]);

  const voteCounts = votes.reduce(
    (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
    { yea: 0, nay: 0, present: 0 } as Record<VoteChoice, number>,
  );
  const myVote = meId ? votes.find((vote) => vote.user_id === meId)?.vote ?? null : null;
  const voteLocked = Boolean(voteClosedAt);

  const castCommitteeVote = async (vote: VoteChoice) => {
    if (!selected || !classId || !meId) return;
    if (voteLocked) {
      toast.error("Voting is closed");
      return;
    }
    if (selected.status !== "committee_vote") {
      toast.error("This bill has not been proposed for committee vote");
      return;
    }

    setVoting(true);
    try {
      if (myVote === vote) {
        const { error } = await supabase
          .from("bill_committee_votes")
          .delete()
          .eq("bill_id", selected.id)
          .eq("committee_id", committeeId)
          .eq("user_id", meId);
        if (error) throw error;
        await loadVotes(selected.id);
        return;
      }
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
      await loadVotes(selected.id);
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    } finally {
      setVoting(false);
    }
  };

  const withdrawCommitteeVote = async () => {
    if (!selected || !meId) return;
    if (voteLocked) {
      toast.error("Voting is closed");
      return;
    }
    setVoting(true);
    try {
      const { error } = await supabase
        .from("bill_committee_votes")
        .delete()
        .eq("bill_id", selected.id)
        .eq("committee_id", committeeId)
        .eq("user_id", meId);
      if (error) throw error;
      await loadVotes(selected.id);
    } catch (e: any) {
      toast.error(e.message || "Could not withdraw vote");
    } finally {
      setVoting(false);
    }
  };

  const submitReport = async () => {
    if (!selected) return;
    setSubmittingReport(true);
    try {
      await submitCommitteeReport(selected.id, committeeId);
      setReportSubmittedAt(new Date().toISOString());
      toast.success("Committee report submitted");
    } catch (e: any) {
      toast.error(e.message || "Could not submit report");
    } finally {
      setSubmittingReport(false);
    }
  };

  const closeSelectedVote = async () => {
    if (!selected) return;
    setClosing(true);
    try {
      await closeCommitteeVote(selected.id, committeeId);
      setVoteClosedAt(new Date().toISOString());
      toast.success("Vote closed");
    } catch (e: any) {
      toast.error(e.message || "Could not close vote");
    } finally {
      setClosing(false);
    }
  };

  const finalizeSelectedBill = async () => {
    if (!selected) return;
    if (!voteClosedAt) {
      toast.error("Close the vote before finalizing");
      return;
    }
    if (!reportSubmittedAt) {
      toast.error("Submit the committee report before finalizing");
      return;
    }
    const approved = voteCounts.yea > voteCounts.nay;
    setFinalizing(true);
    try {
      await finalizeCommitteeVote(selected.id, committeeId, approved);
      setBills((prev) => {
        const next = prev.filter((bill) => bill.id !== selected.id);
        setSelectedBillId(next[0]?.id ?? null);
        const cached = votePageCache.get(committeeId);
        if (cached) votePageCache.set(committeeId, { ...cached, bills: next, selectedBillId: next[0]?.id ?? null });
        updateCommitteeTabCounts(committeeId, (current) => {
          const voteIds = current.ids.vote.filter((id) => id !== selected.id);
          return {
            counts: { ...current.counts, vote: voteIds.length },
            ids: { ...current.ids, vote: voteIds },
          };
        });
        return next;
      });
      toast.success(approved ? "Bill reported to the calendar queue" : "Bill rejected");
    } catch (e: any) {
      toast.error(e.message || "Could not finalize bill");
    } finally {
      setFinalizing(false);
    }
  };

  const beginReportDrag = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = reportWindowPos;
    const onMove = (move: globalThis.MouseEvent) => {
      setReportWindowPos({
        x: Math.max(12, start.x + move.clientX - startX),
        y: Math.max(12, start.y + move.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const reportEditor = selected && classId ? (
    <CollaborativeBillEditor
      classId={classId}
      committeeId={committeeId}
      billId={selected.id}
      documentId={`${selected.id}:report`}
      storageColumn="committee_report_ydoc_base64"
      initialHtml="<p></p>"
      editable={!reportSubmittedAt}
      trackDeletes={false}
    />
  ) : null;

  const finalizeDisabled = finalizing || !voteClosedAt || !reportSubmittedAt;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeName}</h1>
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
                    onClick={() => {
                      setSelectedBillId(bill.id);
                      const cached = votePageCache.get(committeeId);
                      if (cached) votePageCache.set(committeeId, { ...cached, selectedBillId: bill.id });
                      markCommitteeSeenIds(committeeId, "vote", [bill.id]);
                    }}
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
                      <button
                        type="button"
                        onClick={() => void finalizeSelectedBill()}
                        disabled={finalizeDisabled}
                        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {finalizing ? "Finalizing" : "Finalize"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 p-5">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Committee Vote</h3>
                          <p className="text-sm text-gray-600">{voteLocked ? `Closed ${new Date(voteClosedAt!).toLocaleString()}` : "Click a total to cast, change, or undo your vote."}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void withdrawCommitteeVote()}
                            disabled={voting || voteLocked || !myVote}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Withdraw vote
                          </button>
                          <button
                            type="button"
                            onClick={() => void closeSelectedVote()}
                            disabled={closing || voteLocked}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            {closing ? "Closing" : voteLocked ? "Vote closed" : "Close vote"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {(["yea", "nay", "present"] as VoteChoice[]).map((choice) => (
                          <VoteTotal
                            key={choice}
                            choice={choice}
                            count={voteCounts[choice]}
                            names={namesForVote(votes, choice)}
                            active={myVote === choice}
                            disabled={voting || voteLocked}
                            onVote={() => void castCommitteeVote(choice)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 bg-white/95 py-2 backdrop-blur">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          Bill Text
                        </div>
                        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setTextView("edited")}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                              textView === "edited" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Pencil className="w-4 h-4" />
                            Edited
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextView("clean")}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                              textView === "clean" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Sparkles className="w-4 h-4" />
                            Clean
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextView("original")}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                              textView === "original" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            Original
                          </button>
                        </div>
                      </div>
                      <div className={textView === "original" ? "hidden" : ""}>
                        <CollaborativeBillEditor
                          classId={classId}
                          committeeId={committeeId}
                          billId={selected.id}
                          initialHtml={selected.legislativeHtml}
                          editable={false}
                          displayMode={textView === "clean" ? "clean" : "tracked"}
                          allowRestoreDeleted={false}
                        />
                      </div>
                      {textView === "original" && (
                        <div className="prose max-w-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-gray-50">
                          <div dangerouslySetInnerHTML={{ __html: selected.legislativeHtml || "<p></p>" }} />
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-5">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Committee Report</h3>
                          {reportSubmittedAt && <div className="text-xs text-gray-500">Submitted {new Date(reportSubmittedAt).toLocaleString()}</div>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/committee/${committeeId}/reports/${selected.id}`} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <ExternalLink className="h-4 w-4" />
                            Open page
                          </Link>
                          <button type="button" onClick={() => setReportPoppedOut(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <Maximize2 className="h-4 w-4" />
                            Pop out
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitReport()}
                            disabled={submittingReport || Boolean(reportSubmittedAt)}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {submittingReport ? "Submitting" : reportSubmittedAt ? "Submitted" : "Submit report"}
                          </button>
                        </div>
                      </div>
                      {!reportPoppedOut && reportEditor}
                      {reportPoppedOut && <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Report is open in a draggable window.</div>}
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

      {reportPoppedOut && selected && classId && (
        <div
          className="fixed z-50 rounded-lg border border-gray-300 bg-white shadow-2xl"
          style={{
            left: reportWindowPos.x,
            top: reportWindowPos.y,
            width: "min(760px, calc(100vw - 24px))",
            height: "min(760px, calc(100vh - 24px))",
            minWidth: 420,
            minHeight: 360,
            resize: "both",
            overflow: "hidden",
          }}
        >
          <div onMouseDown={beginReportDrag} className="flex cursor-move items-center justify-between gap-3 rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
              <Move className="h-4 w-4 flex-shrink-0 text-gray-500" />
              <span className="truncate">Committee Report - {selected.number}</span>
            </div>
            <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={() => setReportPoppedOut(false)} className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-42px)] overflow-y-auto p-4">
            {reportEditor}
          </div>
        </div>
      )}
    </div>
  );
}
