import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight, FileText, Pencil, Save, Send, Sparkles, Vote, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import { SecureAvatar } from "../components/SecureAvatar";
import { CommitteeTabs, committeeNameStorageKey, markCommitteeSeenIds, readCommitteeSeenIds, updateCommitteeTabCounts } from "../components/CommitteeTabs";
import { closeCommitteeVote, finalizeCommitteeVote, postCommitteeProgress, proposeBillForCommitteeVote, submitCommitteeReport } from "../services/bills";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { formatConstituency } from "../utils/constituency";
import { profilePath } from "../utils/profileRoute";
import { getCurrentUser } from "../utils/currentUser";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { committeeDisplayName } from "../utils/committeeNames";

type BillRow = {
  id: string;
  bill_number: number | null;
  title: string;
  legislative_text: string;
  author_user_id: string;
  status: string;
};
type Subcommittee = { id: string; name: string };
type WorkspaceBill = { id: string; number: string; title: string; sponsor: string; sponsorId: string; sponsorParty: string | null; sponsorConstituency: string | null; legislativeHtml: string; status: string; subcommitteeId: string | null; subcommitteeName: string | null };
type VoteChoice = "yea" | "nay" | "present";
type VoteRow = { user_id: string; vote: VoteChoice; voterName: string };

const workspaceCache = new Map<
  string,
  {
    classId: string | null;
    committeeName: string;
    myCommitteeRole: string | null;
    bills: WorkspaceBill[];
    selectedBillId: string | null;
  }
>();

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function sponsorDescriptor(bill: Pick<WorkspaceBill, "sponsorParty" | "sponsorConstituency">) {
  return `(Rep.-${partyAbbr(bill.sponsorParty)}-${formatConstituency(bill.sponsorConstituency) || "N/A"})`;
}

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
  const tone = choice === "yea" ? "green" : choice === "nay" ? "red" : "gray";
  const activeClass = tone === "green"
    ? "border-green-300 bg-green-50 text-green-800"
    : tone === "red"
      ? "border-red-300 bg-red-50 text-red-800"
      : "border-gray-300 bg-gray-100 text-gray-800";
  const normalClass = tone === "green"
    ? "border-gray-200 bg-white text-green-700 hover:bg-green-50"
    : tone === "red"
      ? "border-gray-200 bg-white text-red-700 hover:bg-red-50"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
  return (
    <div className="group relative">
      <button type="button" disabled={disabled} onClick={onVote} className={`w-full rounded-md border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? activeClass : normalClass}`}>
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-xs font-medium capitalize">{choice}</div>
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-48 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-left text-xs text-gray-700 shadow-lg group-hover:block">
        {names.length ? names.map((name) => <div key={name} className="truncate py-0.5">{name}</div>) : <div className="text-gray-500">No votes yet</div>}
      </div>
    </div>
  );
}

export function CommitteeWorkspace() {
  const { id } = useParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [myCommitteeRole, setMyCommitteeRole] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState<string>(() => window.localStorage.getItem(committeeNameStorageKey(committeeId)) || "Committee");

  const [bills, setBills] = useState<WorkspaceBill[]>([]);
  const [subcommittees, setSubcommittees] = useState<Subcommittee[]>([]);
  const [subcommitteeReferralsAvailable, setSubcommitteeReferralsAvailable] = useState(true);
  const [mySubcommitteeIds, setMySubcommitteeIds] = useState<Set<string>>(new Set());
  const [isTeacher, setIsTeacher] = useState(false);
  const [paidReviewAccess, setPaidReviewAccess] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<{ id: string; started_at: string; started_by: string } | null>(null);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [seenBillIds, setSeenBillIds] = useState<Set<string>>(() => new Set());
  const [textView, setTextView] = useState<"edited" | "clean" | "original">("edited");
  const [billListOpen, setBillListOpen] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [voteClosedAt, setVoteClosedAt] = useState<string | null>(null);
  const [reportSubmittedAt, setReportSubmittedAt] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [activeEditors, setActiveEditors] = useState<
    Array<{ id: string; name: string; color: string; avatar_url: string | null }>
  >([]);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      const cached = workspaceCache.get(committeeId);
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
        const user = await getCurrentUser();
        const uid = user?.id;
        if (!uid) return;
        setMeId(uid);

        // Derive the class from the committee so deep-links/reloads still have a working my_class_id().
        const { data: committee, error: cErr } = await supabase.from("committees").select("name,class_id").eq("id", committeeId).maybeSingle();
        if (cErr) throw cErr;
        const cid = (committee as any)?.class_id ?? null;
        const nextCommitteeName = (committee as any)?.name ?? window.localStorage.getItem(committeeNameStorageKey(committeeId)) ?? "Committee";
        setCommitteeName(nextCommitteeName);
        window.localStorage.setItem(committeeNameStorageKey(committeeId), nextCommitteeName);
        setClassId(cid);
        if (cid) {
          const desiredRole = (user?.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
          await supabase.from("profiles").upsert({ user_id: uid, class_id: cid, role: desiredRole, display_name: user?.user_metadata?.name ?? null } as any);
        }
        if (!cid) return;

        const [{ data: myMembership }, { data: profile }, { data: subRows }, { data: paidAccess }, { data: meeting }] = await Promise.all([
          supabase
          .from("committee_members")
          .select("role")
          .eq("committee_id", committeeId)
            .eq("user_id", uid)
            .maybeSingle(),
          supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle(),
          supabase.from("subcommittees").select("id,name").eq("committee_id", committeeId).order("created_at", { ascending: true }),
          supabase.from("committee_paid_access").select("access_type").eq("committee_id", committeeId).eq("user_id", uid).eq("access_type", "review").maybeSingle(),
          supabase.from("committee_meetings").select("id,started_at,started_by").eq("committee_id", committeeId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        setMyCommitteeRole((myMembership as any)?.role ?? null);
        setIsTeacher((profile as any)?.role === "teacher");
        setPaidReviewAccess(Boolean(paidAccess));
        setActiveMeeting((meeting as any) ?? null);
        setSubcommittees((subRows ?? []) as Subcommittee[]);
        const subIds = (subRows ?? []).map((row: any) => row.id);
        const { data: mySubRows } = subIds.length
          ? await supabase.from("subcommittee_members").select("subcommittee_id").in("subcommittee_id", subIds).eq("user_id", uid)
          : ({ data: [] } as any);
        setMySubcommitteeIds(new Set((mySubRows ?? []).map((row: any) => row.subcommittee_id)));

        let { data: refs, error: rErr } = await supabase.from("bill_referrals").select("bill_id,subcommittee_id").eq("committee_id", committeeId);
        if (rErr && String(rErr.message ?? "").toLowerCase().includes("subcommittee_id")) {
          const fallback = await supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId);
          refs = fallback.data;
          rErr = fallback.error;
          setSubcommitteeReferralsAvailable(false);
        } else {
          setSubcommitteeReferralsAvailable(true);
        }
        if (rErr) throw rErr;
        const referredSubcommitteeIds = [...new Set((refs ?? []).map((r: any) => r.subcommittee_id).filter(Boolean))];
        const { data: referredSubcommittees } = referredSubcommitteeIds.length
          ? await supabase.from("subcommittees").select("id,name").in("id", referredSubcommitteeIds)
          : ({ data: [] } as any);
        const referredSubcommitteeNameById = new Map((referredSubcommittees ?? []).map((row: any) => [row.id, row.name]));
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
          .in("status", ["in_committee", "committee_vote"])
          .order("bill_number", { ascending: true });
        if (bErr) throw bErr;

        const sponsorIds = Array.from(new Set((billRows ?? []).map((b: any) => b.author_user_id)));
        const { data: sponsors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name")
          .in("user_id", sponsorIds.length ? sponsorIds : ["00000000-0000-0000-0000-000000000000"]);
        const sponsorMap = new Map((sponsors ?? []).map((s: any) => [s.user_id, s]));
        const refMap = new Map((refs ?? []).map((ref: any) => [ref.bill_id, ref]));

        const mapped = (billRows as any[]).map((b: BillRow) => {
          const sponsor = sponsorMap.get(b.author_user_id) as any;
          return ({
          id: b.id,
          number: `H.R. ${b.bill_number ?? ""}`.trim(),
          title: b.title,
          sponsor: sponsor?.display_name ?? "Member",
          sponsorId: b.author_user_id,
          sponsorParty: sponsor?.party ?? null,
          sponsorConstituency: sponsor?.constituency_name ?? null,
          legislativeHtml: b.legislative_text,
          status: b.status,
          subcommitteeId: refMap.get(b.id)?.subcommittee_id ?? null,
          subcommitteeName: refMap.get(b.id)?.subcommittee_id ? referredSubcommitteeNameById.get(refMap.get(b.id)?.subcommittee_id) ?? null : null,
          });
        });
        setBills(mapped);
        const nextSelectedBillId = selectedBillId && mapped.some((bill) => bill.id === selectedBillId) ? selectedBillId : mapped[0]?.id ?? null;
        setSelectedBillId(nextSelectedBillId);
        workspaceCache.set(committeeId, {
          classId: cid,
          committeeName: nextCommitteeName,
          myCommitteeRole: (myMembership as any)?.role ?? null,
          bills: mapped,
          selectedBillId: nextSelectedBillId,
        });
      } catch (e: any) {
        toast.error(e.message || "Could not load committee workspace");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [committeeId]);

  const selected = bills.find((b) => b.id === selectedBillId) ?? null;
  const selectedInVote = selected?.status === "committee_vote";
  const voteCounts = votes.reduce(
    (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
    { yea: 0, nay: 0, present: 0 } as Record<VoteChoice, number>,
  );
  const myVote = meId ? votes.find((vote) => vote.user_id === meId)?.vote ?? null : null;
  const textViewControls = (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
      <button
        type="button"
        onClick={() => setTextView("edited")}
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors ${
          textView === "edited" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edited
      </button>
      <button
        type="button"
        onClick={() => setTextView("clean")}
        className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2 py-1.5 text-xs font-medium transition-colors ${
          textView === "clean" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Clean
      </button>
      <button
        type="button"
        onClick={() => setTextView("original")}
        className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2 py-1.5 text-xs font-medium transition-colors ${
          textView === "original" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Original
      </button>
    </div>
  );

  useEffect(() => {
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  }, [committeeId]);

  useEffect(() => {
    if (!selectedBillId) return;
    markCommitteeSeenIds(committeeId, "review", [selectedBillId]);
    if (selectedInVote) markCommitteeSeenIds(committeeId, "vote", [selectedBillId]);
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  }, [committeeId, selectedBillId, selectedInVote]);

  const selectBill = (billId: string) => {
    const bill = bills.find((item) => item.id === billId);
    if (bill?.subcommitteeId && !mySubcommitteeIds.has(bill.subcommitteeId) && !isTeacher) return;
    setSelectedBillId(billId);
    const cached = workspaceCache.get(committeeId);
    if (cached) workspaceCache.set(committeeId, { ...cached, selectedBillId: billId });
    markCommitteeSeenIds(committeeId, "review", [billId]);
    if (bill?.status === "committee_vote") markCommitteeSeenIds(committeeId, "vote", [billId]);
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  };

  const canOpenBill = (bill: typeof bills[number]) => paidReviewAccess || !bill.subcommitteeId || mySubcommitteeIds.has(bill.subcommitteeId) || isTeacher;
  const canReferSubcommittee = subcommitteeReferralsAvailable && (isTeacher || ["chair", "co_chair", "ranking_member"].includes(String(myCommitteeRole ?? "")));
  const canManageMeeting = isTeacher || ["chair", "co_chair", "ranking_member"].includes(String(myCommitteeRole ?? ""));
  const billsEditable = Boolean(activeMeeting) && selected?.status === "in_committee" && !paidReviewAccess;

  const startCommitteeMeeting = async () => {
    if (!classId || !canManageMeeting) return;
    setMeetingBusy(true);
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from("committee_meetings")
        .insert({ class_id: classId, committee_id: committeeId, started_by: user?.id } as any)
        .select("id,started_at,started_by")
        .single();
      if (error) throw error;
      setActiveMeeting((data as any) ?? null);
      toast.success("Committee meeting started");
    } catch (error: any) {
      toast.error(error.message || "Could not start meeting");
    } finally {
      setMeetingBusy(false);
    }
  };

  const endCommitteeMeeting = async () => {
    if (!activeMeeting || !canManageMeeting) return;
    setMeetingBusy(true);
    try {
      let postedProgress = false;
      if (selected && selected.status === "in_committee") {
        const { data: docState } = await supabase
          .from("committee_bill_docs")
          .select("updated_at")
          .eq("bill_id", selected.id)
          .eq("committee_id", committeeId)
          .maybeSingle();
        const updatedAt = (docState as any)?.updated_at ? new Date((docState as any).updated_at).getTime() : 0;
        const meetingStartedAt = new Date(activeMeeting.started_at).getTime();
        if (updatedAt > meetingStartedAt) {
          await postCommitteeProgress(selected.id, committeeId);
          postedProgress = true;
        }
      }
      const { error } = await supabase.from("committee_meetings").update({ ended_at: new Date().toISOString() } as any).eq("id", activeMeeting.id);
      if (error) throw error;
      setActiveMeeting(null);
      toast.success(postedProgress ? "Committee meeting ended and progress posted" : "Committee meeting ended");
    } catch (error: any) {
      toast.error(error.message || "Could not end meeting");
    } finally {
      setMeetingBusy(false);
    }
  };

  const updateReferralSubcommittee = async (billId: string, subcommitteeId: string | null) => {
    try {
      const { error } = await supabase
        .from("bill_referrals")
        .update({ subcommittee_id: subcommitteeId } as any)
        .eq("bill_id", billId)
        .eq("committee_id", committeeId);
      if (error) throw error;
      const subcommitteeName = subcommittees.find((item) => item.id === subcommitteeId)?.name ?? null;
      setBills((prev) => {
        const next = prev.map((bill) => (bill.id === billId ? { ...bill, subcommitteeId, subcommitteeName } : bill));
        const cached = workspaceCache.get(committeeId);
        if (cached) workspaceCache.set(committeeId, { ...cached, bills: next });
        return next;
      });
      if (subcommitteeId && selectedBillId === billId && !mySubcommitteeIds.has(subcommitteeId) && !isTeacher) setSelectedBillId(null);
      toast.success(subcommitteeId ? "Bill referred to subcommittee" : "Bill reported back to committee");
    } catch (error: any) {
      toast.error(error.message || "Could not update referral");
    }
  };

  const proposeSelectedBillForVote = async () => {
    if (!selected) return;
    if (selected.subcommitteeId && !activeMeeting) {
      toast.error("Open a committee meeting before starting a subcommittee vote");
      return;
    }
    setProposing(true);
    try {
      await proposeBillForCommitteeVote(selected.id);
      setBills((prev) => {
        const next = prev.map((bill) => (bill.id === selected.id ? { ...bill, status: "committee_vote" } : bill));
        const cached = workspaceCache.get(committeeId);
        if (cached) workspaceCache.set(committeeId, { ...cached, bills: next, selectedBillId: selected.id });
        updateCommitteeTabCounts(committeeId, (current) => {
          const reviewIds = current.ids.review.filter((id) => id !== selected.id);
          const voteIds = Array.from(new Set([...current.ids.vote, selected.id]));
          return {
            counts: { ...current.counts, review: reviewIds.length, vote: voteIds.length },
            ids: { ...current.ids, review: reviewIds, vote: voteIds },
          };
        });
        return next;
      });
      toast.success("Bill proposed for committee vote");
    } catch (e: any) {
      toast.error(e.message || "Could not propose bill for vote");
    } finally {
      setProposing(false);
    }
  };

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
    if (!selectedBillId || !classId || !selectedInVote) {
      setVotes([]);
      setVoteClosedAt(null);
      setReportSubmittedAt(null);
      return;
    }
    let cancelled = false;
    const refreshVotes = async () => {
      try {
        await loadVotes(selectedBillId);
      } catch (error: any) {
        if (!cancelled) toast.error(error.message || "Could not load committee votes");
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
      .channel(`committee-markup-votes:${committeeId}:${selectedBillId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_committee_votes", filter: `bill_id=eq.${selectedBillId}` }, () => void refreshVotes())
      .subscribe();
    const docChannel = supabase
      .channel(`committee-markup-doc:${committeeId}:${selectedBillId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_bill_docs", filter: `bill_id=eq.${selectedBillId}` }, () => void refreshDoc())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(voteChannel);
      void supabase.removeChannel(docChannel);
    };
  }, [classId, committeeId, selectedBillId, selectedInVote]);

  const castCommitteeVote = async (vote: VoteChoice) => {
    if (!selected || !classId || !meId) return;
    if (selected.subcommitteeId && !activeMeeting) {
      toast.error("Voting is available only while a committee meeting is open");
      return;
    }
    if (voteClosedAt) {
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
    } catch (error: any) {
      toast.error(error.message || "Could not record vote");
    } finally {
      setVoting(false);
    }
  };

  const closeSelectedVote = async () => {
    if (!selected) return;
    if (selected.subcommitteeId && !activeMeeting) {
      toast.error("Open a committee meeting before closing a subcommittee vote");
      return;
    }
    setClosing(true);
    try {
      await closeCommitteeVote(selected.id, committeeId);
      setVoteClosedAt(new Date().toISOString());
      toast.success("Vote closed");
    } catch (error: any) {
      toast.error(error.message || "Could not close vote");
    } finally {
      setClosing(false);
    }
  };

  const reopenSelectedVote = async () => {
    if (!selected) return;
    if (selected.subcommitteeId && !activeMeeting) {
      toast.error("Open a committee meeting before reopening a subcommittee vote");
      return;
    }
    setReopening(true);
    try {
      const { error } = await supabase
        .from("committee_bill_docs")
        .update({ committee_vote_closed_at: null } as any)
        .eq("bill_id", selected.id)
        .eq("committee_id", committeeId);
      if (error) throw error;
      setVoteClosedAt(null);
      toast.success("Vote reopened");
    } catch (error: any) {
      toast.error(error.message || "Could not reopen vote");
    } finally {
      setReopening(false);
    }
  };

  const submitReport = async () => {
    if (!selected) return;
    setSubmittingReport(true);
    try {
      await submitCommitteeReport(selected.id, committeeId);
      setReportSubmittedAt(new Date().toISOString());
      toast.success("Committee report submitted");
    } catch (error: any) {
      toast.error(error.message || "Could not submit report");
    } finally {
      setSubmittingReport(false);
    }
  };

  const reportSelectedBillBack = async () => {
    if (!selected?.subcommitteeId || !classId) return;
    if (!voteClosedAt || !reportSubmittedAt) {
      toast.error("Close the vote and submit the report before reporting back");
      return;
    }
    setFinalizing(true);
    try {
      const { data: existingDoc } = await supabase
        .from("committee_bill_docs")
        .select("subcommittee_reports")
        .eq("bill_id", selected.id)
        .eq("committee_id", committeeId)
        .maybeSingle();
      const existingReports = Array.isArray((existingDoc as any)?.subcommittee_reports) ? (existingDoc as any).subcommittee_reports : [];
      const nextReports = [
        ...existingReports.filter((report: any) => report?.subcommitteeId !== selected.subcommitteeId),
        {
          subcommitteeId: selected.subcommitteeId,
          subcommitteeName: selected.subcommitteeName,
          submittedAt: reportSubmittedAt,
          voteClosedAt,
          votes: { yea: voteCounts.yea, nay: voteCounts.nay, present: voteCounts.present },
        },
      ];
      await updateReferralSubcommittee(selected.id, null);
      const { error } = await supabase.from("bills").update({ status: "in_committee" } as any).eq("id", selected.id).eq("class_id", classId);
      if (error) throw error;
      await supabase.from("bill_committee_votes").delete().eq("bill_id", selected.id).eq("committee_id", committeeId);
      await supabase
        .from("committee_bill_docs")
        .update({ committee_vote_closed_at: null, committee_report_submitted_at: null, committee_vote_finalized_at: null, subcommittee_reports: nextReports } as any)
        .eq("bill_id", selected.id)
        .eq("committee_id", committeeId);
      setBills((prev) => {
        const next = prev.map((bill) => (bill.id === selected.id ? { ...bill, status: "in_committee", subcommitteeId: null, subcommitteeName: null } : bill));
        const cached = workspaceCache.get(committeeId);
        if (cached) workspaceCache.set(committeeId, { ...cached, bills: next });
        return next;
      });
      updateCommitteeTabCounts(committeeId, (current) => {
        const voteIds = current.ids.vote.filter((id) => id !== selected.id);
        const reviewIds = Array.from(new Set([...current.ids.review, selected.id]));
        return {
          counts: { ...current.counts, vote: voteIds.length, review: reviewIds.length },
          ids: { ...current.ids, vote: voteIds, review: reviewIds },
        };
      });
      toast.success("Bill reported back to the main committee");
    } catch (error: any) {
      toast.error(error.message || "Could not report bill back");
    } finally {
      setFinalizing(false);
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
        const cached = workspaceCache.get(committeeId);
        if (cached) workspaceCache.set(committeeId, { ...cached, bills: next, selectedBillId: next[0]?.id ?? null });
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
    } catch (error: any) {
      toast.error(error.message || "Could not finalize bill");
    } finally {
      setFinalizing(false);
    }
  };

  useEffect(() => {
    if (!classId || !selectedBillId) {
      setActiveEditors([]);
      return;
    }

    let cancelled = false;
    const setupPresence = async () => {
      try {
        const user = await getCurrentUser();
        const uid = user?.id;
        if (!uid) return;

        const { data: profile } = await supabase.from("profiles").select("display_name,avatar_url,role").eq("user_id", uid).maybeSingle();
        const baseName = String((profile as any)?.display_name ?? user?.user_metadata?.name ?? "").trim() || "Member";
        const normalizedName = (profile as any)?.role === "teacher" ? `${baseName} (Teacher)` : baseName;

        let color = "#2563eb";
        const { data: existingColor } = await supabase
          .from("committee_member_colors")
          .select("color")
          .eq("committee_id", committeeId)
          .eq("user_id", uid)
          .maybeSingle();
        if ((existingColor as any)?.color) {
          color = (existingColor as any).color;
        } else {
          const { data: assigned } = await supabase.rpc("ensure_committee_member_color", { target_committee: committeeId } as any);
          if (typeof assigned === "string" && assigned) color = assigned;
        }

        const self = {
          id: uid,
          name: normalizedName,
          color,
          avatar_url: (profile as any)?.avatar_url ?? null,
          online_at: new Date().toISOString(),
        };
        if (cancelled) return;
        if (!cancelled) setActiveEditors([self]);

        const channel = supabase.channel(`bill-presence:${committeeId}:${selectedBillId}`, {
          config: { presence: { key: uid } },
        });

        const syncPresence = () => {
          const state = channel.presenceState() as Record<string, Array<any>>;
          const editors = Object.values(state)
            .flat()
            .map((payload: any) => ({
              id: payload.id as string,
              name: String(payload.name || "").trim() || "Member",
              color: (payload.color as string) || "#2563eb",
              avatar_url: (payload.avatar_url as string | null | undefined) ?? null,
              online_at: payload.online_at as string | undefined,
            }))
            .filter((payload) => payload.id);

          const byUser = new Map<string, (typeof editors)[number]>();
          for (const editor of editors) byUser.set(editor.id, editor);
          const list = Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) setActiveEditors(list.length ? list : [self]);
        };

        channel
          .on("presence", { event: "sync" }, syncPresence)
          .on("presence", { event: "join" }, syncPresence)
          .on("presence", { event: "leave" }, syncPresence)
          .subscribe(async (status) => {
            if (status !== "SUBSCRIBED" || cancelled) return;
            await channel.track(self);
            syncPresence();
          });

        presenceChannelRef.current = channel;
      } catch {
        if (!cancelled) setActiveEditors([]);
      }
    };

    void setupPresence();
    return () => {
      cancelled = true;
      const channel = presenceChannelRef.current;
      presenceChannelRef.current = null;
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [classId, committeeId, selectedBillId]);

  const mainCommitteeBills = bills.filter((bill) => !bill.subcommitteeId);
  const subcommitteeBillGroups = subcommittees.map((subcommittee) => ({
    subcommittee,
    bills: bills.filter((bill) => bill.subcommitteeId === subcommittee.id),
  }));

  const renderBillListButton = (bill: WorkspaceBill) => {
    const accessible = canOpenBill(bill);
    return (
      <button
        key={bill.id}
        onClick={() => selectBill(bill.id)}
        disabled={!accessible}
        className={`w-full border-b border-gray-100 p-4 text-left ${
          accessible ? "hover:bg-gray-50" : "cursor-not-allowed bg-gray-50 opacity-60"
        } ${
          selectedBillId === bill.id ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex items-start gap-2">
          {!seenBillIds.has(bill.id) && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" aria-label="New bill" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/bills/${bill.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="font-mono text-sm font-semibold text-blue-700 hover:underline"
              >
                {bill.number}
              </Link>
              {bill.status === "committee_vote" && <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Voting</span>}
            </div>
            <Link
              to={`/bills/${bill.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="block text-sm text-gray-700 line-clamp-2 hover:text-blue-700 hover:underline"
            >
              {bill.title}
            </Link>
            <div className="mt-1 text-xs text-gray-500">
              Sponsor:{" "}
              <Link to={profilePath(bill.sponsorId)} onClick={(event) => event.stopPropagation()} className="text-blue-600 hover:underline">
                {bill.sponsor}
              </Link>{" "}
              {sponsorDescriptor(bill)}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeDisplayName(committeeName)}</h1>
        </div>
        <div className="mb-6">
          <CommitteeTabs committeeId={committeeId} active="review" />
        </div>
        {!loading && bills.length > 0 && (
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm shadow-sm ${activeMeeting ? "border-blue-200 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-700"}`}>
            <div>
              <div className="font-semibold">{activeMeeting ? "Committee meeting open" : "Committee meeting required for editing"}</div>
              <div className="text-xs opacity-80">{activeMeeting ? `Opened ${new Date(activeMeeting.started_at).toLocaleString()}. Referred bills are editable while the meeting is open.` : "A chair, co-chair, ranking member, or teacher must start a meeting before bill text can be revised."}</div>
            </div>
            {canManageMeeting && (
              activeMeeting ? (
                <button type="button" onClick={() => void endCommitteeMeeting()} disabled={meetingBusy} className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">End meeting</button>
              ) : (
                <button type="button" onClick={() => void startCommitteeMeeting()} disabled={meetingBusy} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Start meeting</button>
              )
            )}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No bills have been referred to this committee yet.
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${billListOpen ? "lg:grid-cols-3" : "lg:grid-cols-[auto_1fr]"}`}>
            {billListOpen ? (
            <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">Referred Bills</div>
                  <button type="button" onClick={() => setBillListOpen(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-500">{bills.length} total</div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">General Committee</div>
                {mainCommitteeBills.length ? mainCommitteeBills.map(renderBillListButton) : <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-400">No bills in the main committee list.</div>}
                {subcommitteeBillGroups.map(({ subcommittee, bills: groupBills }) => (
                  <div key={subcommittee.id}>
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{subcommittee.name}</div>
                    {groupBills.length ? groupBills.map(renderBillListButton) : <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-400">No referred bills.</div>}
                  </div>
                ))}
              </div>
            </div>
            ) : (
              <button
                type="button"
                onClick={() => setBillListOpen(true)}
                className="h-fit rounded-lg border border-gray-200 bg-white p-3 text-gray-600 shadow-sm hover:bg-gray-50"
                aria-label="Open referred bills"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            <div className={`${billListOpen ? "lg:col-span-2" : ""} bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden`}>
              {selected && classId ? (
                <>
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <Link to={`/bills/${selected.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold text-blue-700 hover:underline">{selected.number}</Link>
                        <Link to={`/bills/${selected.id}`} target="_blank" rel="noopener noreferrer" className="block text-xl font-bold text-gray-900 mt-1 hover:text-blue-700 hover:underline">{selected.title}</Link>
                        <div className="text-sm text-gray-600 mt-1">
                          Sponsor: <Link to={profilePath(selected.sponsorId)} className="text-blue-600 hover:underline">{selected.sponsor}</Link> {sponsorDescriptor(selected)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>Subcommittee:</span>
                          {canReferSubcommittee && subcommittees.length ? (
                            <Select value={selected.subcommitteeId ?? "main"} onValueChange={(value) => void updateReferralSubcommittee(selected.id, value === "main" ? null : value)}>
                              <SelectTrigger className="h-8 w-52 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-[140]">
                                <SelectItem value="main">Main committee</SelectItem>
                                {subcommittees.map((subcommittee) => (
                                  <SelectItem key={subcommittee.id} value={subcommittee.id}>{subcommittee.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{selected.subcommitteeName ?? "Main committee"}</span>
                          )}
                        </div>
                      </div>
                      <div className="sticky top-0 z-20 flex flex-col items-end gap-2 rounded-md bg-white/95 p-1 backdrop-blur">
                        {activeEditors.length > 0 && (
                          <div className="flex items-center gap-1.5 justify-end">
                            {activeEditors.map((u) => (
                              <Link
                                key={u.id}
                                to={profilePath(u.id)}
                                className="presence-avatar"
                                data-tooltip={u.name}
                                style={{ ["--presence-color" as any]: u.color }}
                              >
                                <SecureAvatar src={u.avatar_url} alt={u.name} className="w-8 h-8 rounded-full border-2 object-cover" fallbackClassName="w-8 h-8 border-2" iconClassName="w-4 h-4 text-gray-500" style={{ borderColor: u.color }} />
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="flex w-full flex-wrap justify-end gap-2">
                          {selected.status === "in_committee" && (
                            <button
                              type="button"
                              onClick={() => void proposeSelectedBillForVote()}
                              disabled={proposing}
                              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Vote className="w-4 h-4" />
                              {proposing ? "Proposing" : "Propose Vote"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-6">
                    {selectedInVote && (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">Committee Vote</h3>
                            <p className="text-sm text-gray-600">{voteClosedAt ? `Closed ${new Date(voteClosedAt).toLocaleString()}` : "Click a total to cast, change, or undo your vote."}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void closeSelectedVote()}
                              disabled={closing || Boolean(voteClosedAt) || Boolean(selected.subcommitteeId && !activeMeeting)}
                              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                              {closing ? "Closing" : voteClosedAt ? "Vote closed" : "Close vote"}
                            </button>
                            {voteClosedAt && (
                              <button
                                type="button"
                                onClick={() => void reopenSelectedVote()}
                                disabled={reopening || Boolean(selected.subcommitteeId && !activeMeeting)}
                                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              >
                                {reopening ? "Reopening" : "Reopen vote"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void submitReport()}
                              disabled={submittingReport || Boolean(reportSubmittedAt)}
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                              {submittingReport ? "Submitting" : reportSubmittedAt ? "Report submitted" : "Submit report"}
                            </button>
                            <button
                              type="button"
                              onClick={() => selected.subcommitteeId ? void reportSelectedBillBack() : void finalizeSelectedBill()}
                              disabled={finalizing || !voteClosedAt || !reportSubmittedAt}
                              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Send className="h-4 w-4" />
                              {finalizing ? "Saving" : selected.subcommitteeId ? "Report back" : "Finalize"}
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
                              disabled={voting || Boolean(voteClosedAt) || Boolean(selected.subcommitteeId && !activeMeeting)}
                              onVote={() => void castCommitteeVote(choice)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className={textView === "original" ? "hidden" : ""}>
                        <CollaborativeBillEditor
                          classId={classId}
                          committeeId={committeeId}
                          billId={selected.id}
                          initialHtml={selected.legislativeHtml}
                          editable={textView === "edited" && billsEditable}
                          displayMode={textView === "clean" ? "clean" : "tracked"}
                          toolbarControls={textViewControls}
                        />
                      </div>
                      {textView === "original" && (
                        <div>
                          <div className="flex flex-wrap items-center justify-end rounded-t-md border border-b-0 border-gray-200 bg-gray-50 px-2 py-2">
                            {textViewControls}
                          </div>
                          <div className="prose prose-a:text-blue-700 prose-a:underline max-w-none min-h-[420px] p-4 rounded-b-md border border-gray-200 bg-gray-50">
                            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.legislativeHtml || "<p></p>") }} />
                          </div>
                        </div>
                      )}
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
