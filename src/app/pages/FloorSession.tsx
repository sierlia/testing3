import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, ChevronLeft, ChevronRight, ExternalLink, MessageSquare, Minus, MonitorUp, Pencil, Plus, Search, Send, Trash2, Trophy, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { fetchCalendaredBillsForCurrentClass, getCurrentProfileClass } from "../services/bills";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { AttachmentList, AttachmentPicker, DiscussionAttachment, parseDiscussionAttachments } from "../components/DiscussionAttachments";
import { SecureAvatar } from "../components/SecureAvatar";

type VoteChoice = "yea" | "nay" | "present";
type FloorMode = "election" | "bills" | "discussion";
type PresentationMode = "agenda" | "debate" | "speaker_for" | "speaker_against" | "vote" | "previous_question" | "results" | "recess";
type CalendarItem = Awaited<ReturnType<typeof fetchCalendaredBillsForCurrentClass>>[number];
type ManualCounts = { yea: number; nay: number; present: number; not_voted: number };
type SessionRow = {
  id: string;
  bill_id: string;
  status: "open" | "closed";
  opened_at: string | null;
  closed_at: string | null;
  manual_counts?: ManualCounts | null;
  posted_result?: "passed" | "failed" | null;
  results_posted_at?: string | null;
};
type VoteRow = { session_id: string; bill_id: string; user_id: string; vote: VoteChoice };
type SpeakerCandidate = { id: string; name: string; party?: string | null; constituency?: string | null };
type SpeakerVoteRow = { class_id: string; voter_user_id: string; candidate_user_id: string };
type PresidentVoteRow = { class_id: string; voter_user_id: string; candidate_user_id: string };
type SpeakerOptOutRow = { class_id: string; user_id: string };
type FloorSpeakerRow = { bill_id: string; user_id: string; side: "for" | "against"; status: "pending" | "approved" | "rejected"; speaker_role: "speaker" | "opposition_leader"; name: string; party?: string | null; constituency?: string | null };
type PreviousQuestionVoteRow = { bill_id: string; user_id: string; vote: "yea" | "nay" };
type DiscussionArea = { id: string; class_id: string; title: string; prompt: string | null; visibility?: "live" | "archive" | "invisible"; is_active: boolean; created_by: string | null; created_at: string };
type DiscussionAuthor = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url?: string | null };
type DiscussionPost = { id: string; discussion_id: string; class_id: string; author_user_id: string; body: string; created_at: string; attachments?: DiscussionAttachment[]; author?: DiscussionAuthor | null };
type DiscussionComment = { id: string; post_id: string; discussion_id: string; class_id: string; author_user_id: string; body: string; created_at: string; attachments?: DiscussionAttachment[]; author?: DiscussionAuthor | null };
type DiscussionReaction = { id: string; post_id: string; class_id: string; user_id: string; emoji: "thumbs_up" };

const DISCUSSION_REACTIONS: Array<{ id: DiscussionReaction["emoji"]; label: string }> = [
  { id: "thumbs_up", label: "👍" },
];

async function fetchFloorSpeakersForClass(classId: string): Promise<FloorSpeakerRow[]> {
  const { data: rows, error } = await supabase
    .from("bill_floor_speakers")
    .select("bill_id,user_id,side,status,speaker_role")
    .eq("class_id", classId);
  if (error) throw error;

  const userIds = Array.from(new Set(((rows ?? []) as any[]).map((row) => row.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id,display_name,party,constituency_name").in("user_id", userIds)
    : ({ data: [] } as any);
  const profilesById = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile]));

  return ((rows ?? []) as any[]).map((row) => {
    const profile = profilesById.get(row.user_id) as any;
    return {
      bill_id: row.bill_id,
      user_id: row.user_id,
      side: row.side,
      status: row.status ?? "approved",
      speaker_role: row.speaker_role ?? "speaker",
      name: profile?.display_name ?? "Member",
      party: profile?.party ?? null,
      constituency: profile?.constituency_name ?? null,
    };
  });
}

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function sessionLabel(session: SessionRow | null) {
  if (!session) return "Vote unopened";
  if (session.status === "open") return "Vote open";
  return "Vote closed";
}

export function FloorSession() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [classSettings, setClassSettings] = useState<any>({});
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [speakerVote, setSpeakerVote] = useState<string | null>(null);
  const [speakerCandidates, setSpeakerCandidates] = useState<SpeakerCandidate[]>([]);
  const [speakerVotes, setSpeakerVotes] = useState<SpeakerVoteRow[]>([]);
  const [presidentVote, setPresidentVote] = useState<string | null>(null);
  const [presidentVotes, setPresidentVotes] = useState<PresidentVoteRow[]>([]);
  const [presidentSearch, setPresidentSearch] = useState("");
  const [presidentPartyFilter, setPresidentPartyFilter] = useState("all");
  const [speakerOptOuts, setSpeakerOptOuts] = useState<SpeakerOptOutRow[]>([]);
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [speakerPartyFilter, setSpeakerPartyFilter] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [manualCounts, setManualCounts] = useState<ManualCounts>({ yea: 0, nay: 0, present: 0, not_voted: 0 });
  const [resultMode, setResultMode] = useState<"counts" | "decision">("counts");
  const [manualDecision, setManualDecision] = useState<"passed" | "failed">("passed");
  const [presentationMode, setPresentationMode] = useState<PresentationMode>("agenda");
  const [presentationNote, setPresentationNote] = useState("Floor is coming to order.");
  const [floorSpeakers, setFloorSpeakers] = useState<FloorSpeakerRow[]>([]);
  const [previousQuestionVotes, setPreviousQuestionVotes] = useState<PreviousQuestionVoteRow[]>([]);
  const [discussionAreas, setDiscussionAreas] = useState<DiscussionArea[]>([]);
  const [discussionPosts, setDiscussionPosts] = useState<DiscussionPost[]>([]);
  const [discussionComments, setDiscussionComments] = useState<DiscussionComment[]>([]);
  const [discussionReactions, setDiscussionReactions] = useState<DiscussionReaction[]>([]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [discussionListCollapsed, setDiscussionListCollapsed] = useState(false);
  const [expandedReplyRails, setExpandedReplyRails] = useState<Record<string, boolean>>({});
  const [expandedDiscussionPosts, setExpandedDiscussionPosts] = useState<Record<string, boolean>>({});
  const [creatingDiscussion, setCreatingDiscussion] = useState(false);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionPrompt, setNewDiscussionPrompt] = useState("");
  const [newDiscussionPost, setNewDiscussionPost] = useState("");
  const [newDiscussionPostAttachments, setNewDiscussionPostAttachments] = useState<DiscussionAttachment[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentAttachments, setCommentAttachments] = useState<Record<string, DiscussionAttachment[]>>({});
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(null);
  const [editingDiscussionTitle, setEditingDiscussionTitle] = useState("");
  const [editingDiscussionPrompt, setEditingDiscussionPrompt] = useState("");
  const [draggingDiscussionId, setDraggingDiscussionId] = useState<string | null>(null);
  const [discussionDragTarget, setDiscussionDragTarget] = useState<{ visibility: NonNullable<DiscussionArea["visibility"]>; index: number } | null>(null);

  const loadDiscussions = async (targetClassId: string) => {
    const { data: areaRows, error: areaError } = await supabase
      .from("floor_discussion_areas")
      .select("id,class_id,title,prompt,visibility,is_active,created_by,created_at")
      .eq("class_id", targetClassId)
      .order("created_at", { ascending: false });
    if (areaError) throw areaError;
    const areas = ((areaRows ?? []) as any[]) as DiscussionArea[];
    setDiscussionAreas(areas);
    const areaIds = areas.map((area) => area.id);
    if (!areaIds.length) {
      setDiscussionPosts([]);
      setDiscussionComments([]);
      setDiscussionReactions([]);
      setSelectedDiscussionId(null);
      return;
    }

    const [postRows, commentRows, reactionRows] = await Promise.all([
      supabase.from("floor_discussion_posts").select("id,discussion_id,class_id,author_user_id,body,created_at,attachments").in("discussion_id", areaIds).order("created_at", { ascending: true }),
      supabase.from("floor_discussion_comments").select("id,post_id,discussion_id,class_id,author_user_id,body,created_at,attachments").in("discussion_id", areaIds).order("created_at", { ascending: true }),
      supabase.from("floor_discussion_reactions").select("id,post_id,class_id,user_id,emoji").eq("class_id", targetClassId),
    ]);
    if (postRows.error) throw postRows.error;
    if (commentRows.error) throw commentRows.error;
    if (reactionRows.error) throw reactionRows.error;

    const posts = ((postRows.data ?? []) as any[]) as DiscussionPost[];
    const comments = ((commentRows.data ?? []) as any[]) as DiscussionComment[];
    const userIds = Array.from(new Set([...posts.map((post) => post.author_user_id), ...comments.map((comment) => comment.author_user_id)].filter(Boolean)));
    const { data: profileRows } = userIds.length
      ? await supabase.from("profiles").select("user_id,display_name,party,constituency_name,avatar_url").in("user_id", userIds)
      : ({ data: [] } as any);
    const profileMap = new Map(((profileRows ?? []) as any[]).map((profile) => [profile.user_id, profile as DiscussionAuthor]));
    setDiscussionPosts(posts.map((post) => ({ ...post, attachments: parseDiscussionAttachments((post as any).attachments), author: profileMap.get(post.author_user_id) ?? null })));
    setDiscussionComments(comments.map((comment) => ({ ...comment, attachments: parseDiscussionAttachments((comment as any).attachments), author: profileMap.get(comment.author_user_id) ?? null })));
    setDiscussionReactions(((reactionRows.data ?? []) as any[]) as DiscussionReaction[]);
    setSelectedDiscussionId((current) => (current && areaIds.includes(current) ? current : areas.find((area) => area.is_active)?.id ?? areas[0]?.id ?? null));
  };

  const load = async () => {
    setLoading(true);
    try {
      const current = await getCurrentProfileClass();
      setRole(current.profile.role ?? null);
      setMeId(current.userId);
      setClassId(current.classId);
      const [calendarRows, sessionRows, voteRows, directory, classRow, speakerVoteRows, presidentVoteRows, speakerOptOutRows, floorSpeakerRows, previousQuestionRows] = await Promise.all([
        fetchCalendaredBillsForCurrentClass(),
        supabase.from("bill_floor_sessions").select("id,bill_id,status,opened_at,closed_at,manual_counts,posted_result,results_posted_at").eq("class_id", current.classId),
        supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", current.classId),
        supabase.rpc("class_directory", { target_class: current.classId } as any),
        supabase.from("classes").select("settings").eq("id", current.classId).maybeSingle(),
        supabase.from("class_speaker_votes").select("class_id,voter_user_id,candidate_user_id").eq("class_id", current.classId),
        supabase.from("class_president_votes").select("class_id,voter_user_id,candidate_user_id").eq("class_id", current.classId),
        supabase.from("class_speaker_opt_outs").select("class_id,user_id").eq("class_id", current.classId),
        fetchFloorSpeakersForClass(current.classId),
        supabase.from("bill_previous_question_votes").select("bill_id,user_id,vote").eq("class_id", current.classId),
      ]);
      if (sessionRows.error) throw sessionRows.error;
      if (voteRows.error) throw voteRows.error;
      if (classRow.error) throw classRow.error;
      if (speakerVoteRows.error) throw speakerVoteRows.error;
      if (presidentVoteRows.error) throw presidentVoteRows.error;
      if (speakerOptOutRows.error) throw speakerOptOutRows.error;
      const students = ((directory.data ?? []) as any[]).filter((person) => person.role !== "teacher");
      setItems([...calendarRows].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
      setSessions((sessionRows.data ?? []) as any);
      setVotes((voteRows.data ?? []) as any);
      setStudentCount(students.length);
      setClassSettings((classRow.data as any)?.settings ?? {});
      setSpeakerCandidates(students.map((student) => ({ id: student.user_id, name: student.display_name ?? "Student", party: student.party, constituency: student.constituency_name })));
      setFloorSpeakers(floorSpeakerRows);
      setPreviousQuestionVotes((previousQuestionRows.data ?? []) as any);
      const nextSpeakerVotes = (speakerVoteRows.data ?? []) as any[];
      setSpeakerVotes(nextSpeakerVotes);
      setSpeakerVote(nextSpeakerVotes.find((row) => row.voter_user_id === current.userId)?.candidate_user_id ?? null);
      const nextPresidentVotes = (presidentVoteRows.data ?? []) as any[];
      setPresidentVotes(nextPresidentVotes);
      setPresidentVote(nextPresidentVotes.find((row) => row.voter_user_id === current.userId)?.candidate_user_id ?? null);
      setSpeakerOptOuts((speakerOptOutRows.data ?? []) as any[]);
      await loadDiscussions(current.classId);
    } catch (e: any) {
      toast.error(e.message || "Could not load floor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`speaker-votes:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_speaker_votes", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as SpeakerVoteRow | undefined;
          const oldRow = payload.old as SpeakerVoteRow | undefined;
          setSpeakerVotes((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.voter_user_id !== oldRow.voter_user_id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.voter_user_id !== nextRow.voter_user_id), nextRow];
          });
          if (nextRow?.voter_user_id === meId) setSpeakerVote(nextRow.candidate_user_id);
          if (payload.eventType === "DELETE" && oldRow?.voter_user_id === meId) setSpeakerVote(null);
        },
      )
      .subscribe();
    const optOutChannel = supabase
      .channel(`speaker-opt-outs:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_speaker_opt_outs", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as SpeakerOptOutRow | undefined;
          const oldRow = payload.old as SpeakerOptOutRow | undefined;
          setSpeakerOptOuts((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.user_id !== oldRow.user_id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.user_id !== nextRow.user_id), nextRow];
          });
        },
      )
      .subscribe();
    const presidentChannel = supabase
      .channel(`president-votes:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_president_votes", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as PresidentVoteRow | undefined;
          const oldRow = payload.old as PresidentVoteRow | undefined;
          setPresidentVotes((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.voter_user_id !== oldRow.voter_user_id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.voter_user_id !== nextRow.voter_user_id), nextRow];
          });
          if (nextRow?.voter_user_id === meId) setPresidentVote(nextRow.candidate_user_id);
          if (payload.eventType === "DELETE" && oldRow?.voter_user_id === meId) setPresidentVote(null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(optOutChannel);
      void supabase.removeChannel(presidentChannel);
    };
  }, [classId, meId]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`floor:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_floor_sessions", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as SessionRow | undefined;
          const oldRow = payload.old as SessionRow | undefined;
          setSessions((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.id !== oldRow.id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.id !== nextRow.id), nextRow];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_floor_votes", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as VoteRow | undefined;
          const oldRow = payload.old as VoteRow | undefined;
          setVotes((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => !(row.session_id === oldRow.session_id && row.user_id === oldRow.user_id));
            if (!nextRow) return prev;
            return [...prev.filter((row) => !(row.session_id === nextRow.session_id && row.user_id === nextRow.user_id)), nextRow];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_floor_speakers", filter: `class_id=eq.${classId}` },
        () => {
          void fetchFloorSpeakersForClass(classId)
            .then(setFloorSpeakers)
            .catch((error) => toast.error(error.message || "Could not load floor speakers"));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`floor-discussions:${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_discussion_areas", filter: `class_id=eq.${classId}` }, () => {
        void loadDiscussions(classId).catch((error) => toast.error(error.message || "Could not load discussions"));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_discussion_posts", filter: `class_id=eq.${classId}` }, () => {
        void loadDiscussions(classId).catch((error) => toast.error(error.message || "Could not load discussions"));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_discussion_comments", filter: `class_id=eq.${classId}` }, () => {
        void loadDiscussions(classId).catch((error) => toast.error(error.message || "Could not load discussions"));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_discussion_reactions", filter: `class_id=eq.${classId}` }, () => {
        void loadDiscussions(classId).catch((error) => toast.error(error.message || "Could not load discussions"));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId]);

  const speakerConcluded = Boolean(classSettings?.elections?.speakerConcluded);
  const speakerOpen = classSettings?.elections?.speakerOpen ?? Boolean(classSettings?.elections?.open);
  const floorMode = (classSettings?.floor?.mode as FloorMode | undefined) ?? (loading ? "bills" : speakerConcluded ? "bills" : "election");
  const routeMode = searchParams.get("mode");
  const displayFloorMode: FloorMode =
    routeMode === "discussion" || routeMode === "bills" || routeMode === "election" ? routeMode : floorMode;
  const shouldShowFloorSwitcher = role === "teacher" && (displayFloorMode !== "discussion" || floorMode === "discussion");
  const shouldShowFloorHeader = displayFloorMode !== "discussion" || shouldShowFloorSwitcher;
  const activeItem = useMemo(() => {
    if (items.length === 0) return null;
    const now = Date.now();
    const openOrDue = items.find((item) => {
      const session = sessions.find((row) => row.bill_id === item.bill_id);
      return session?.status === "open" || (new Date(item.scheduled_at).getTime() <= now && session?.status !== "closed");
    });
    return openOrDue ?? items.find((item) => sessions.find((row) => row.bill_id === item.bill_id)?.status !== "closed") ?? items[0];
  }, [items, sessions]);
  const activeSession = activeItem ? sessions.find((s) => s.bill_id === activeItem.bill_id) ?? null : null;
  const nextItems = activeItem ? items.filter((item) => item.bill_id !== activeItem.bill_id).slice(0, 8) : items.slice(0, 8);
  const sessionVotes = activeSession ? votes.filter((v) => v.session_id === activeSession.id) : [];
  const myVote = meId ? sessionVotes.find((v) => v.user_id === meId)?.vote ?? null : null;
  const liveCounts = useMemo(
    () =>
      sessionVotes.reduce(
        (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
        { yea: 0, nay: 0, present: 0 } as Record<VoteChoice, number>,
      ),
    [sessionVotes],
  );
  const displayedCounts = activeSession?.manual_counts ?? liveCounts;
  const counts = { yea: displayedCounts.yea ?? 0, nay: displayedCounts.nay ?? 0, present: displayedCounts.present ?? 0 };
  const displayedNotVoted = activeSession?.manual_counts?.not_voted ?? Math.max(0, studentCount - counts.yea - counts.nay - counts.present);
  const totalVoted = counts.yea + counts.nay + counts.present;
  const displayedEligible = Math.max(studentCount, totalVoted + displayedNotVoted);
  const activeFloorSpeakers = activeItem ? floorSpeakers.filter((row) => row.bill_id === activeItem.bill_id && row.status === "approved") : [];
  const floorSpeakersFor = activeFloorSpeakers.filter((row) => row.side === "for");
  const floorSpeakersAgainst = activeFloorSpeakers.filter((row) => row.side === "against");
  const pendingFloorSpeakers = activeItem ? floorSpeakers.filter((row) => row.bill_id === activeItem.bill_id && row.status === "pending") : [];
  const previousQuestionForBill = activeItem ? previousQuestionVotes.filter((row) => row.bill_id === activeItem.bill_id) : [];
  const myPreviousQuestionVote = meId ? previousQuestionForBill.find((row) => row.user_id === meId)?.vote ?? null : null;
  const previousQuestionCounts = {
    yea: previousQuestionForBill.filter((row) => row.vote === "yea").length,
    nay: previousQuestionForBill.filter((row) => row.vote === "nay").length,
  };
  const previousQuestionVoters = (vote: "yea" | "nay") => {
    const names = previousQuestionForBill
      .filter((row) => row.vote === vote)
      .map((row) => speakerCandidates.find((candidate) => candidate.id === row.user_id)?.name ?? "Member")
      .sort((a, b) => a.localeCompare(b));
    return names.length ? names.join("\n") : `No ${vote} votes`;
  };
  const speakerParties = useMemo(
    () => [...new Set(speakerCandidates.map((candidate) => candidate.party || "No party"))].sort((a, b) => a.localeCompare(b)),
    [speakerCandidates],
  );
  const speakerOptedOut = (candidateId: string) => speakerOptOuts.some((row) => row.user_id === candidateId);
  const speakerVoteCount = (candidateId: string) => speakerOptedOut(candidateId) ? 0 : speakerVotes.filter((row) => row.candidate_user_id === candidateId).length;
  const visibleSpeakerCandidates = useMemo(() => {
    const query = speakerSearch.trim().toLowerCase();
    return speakerCandidates.filter((candidate) => {
      const party = candidate.party || "No party";
      const district = formatConstituency(candidate.constituency);
      return (!query || candidate.name.toLowerCase().includes(query) || party.toLowerCase().includes(query) || district.toLowerCase().includes(query)) && (speakerPartyFilter === "all" || party === speakerPartyFilter);
    }).sort((a, b) => speakerVoteCount(b.id) - speakerVoteCount(a.id) || a.name.localeCompare(b.name));
  }, [speakerCandidates, speakerPartyFilter, speakerSearch, speakerVotes, speakerOptOuts]);
  const speakerWinner = useMemo(() => {
    const [winner] = [...speakerCandidates].sort((a, b) => speakerVoteCount(b.id) - speakerVoteCount(a.id) || a.name.localeCompare(b.name));
    return winner && speakerVoteCount(winner.id) > 0 ? winner : null;
  }, [speakerCandidates, speakerVotes, speakerOptOuts]);
  const executiveSettings = classSettings?.executive ?? {};
  const executiveEnabled = Boolean(executiveSettings.enabled);
  const presidentSelectionMode = (executiveSettings.selectionMode ?? executiveSettings.presidentSelectionMode ?? "student-vote") as "student-vote" | "teacher-assigned";
  const presidentOpen = Boolean(executiveSettings.presidentOpen ?? executiveSettings.open);
  const presidentConcluded = Boolean(executiveSettings.presidentConcluded);
  const assignedPresident = speakerCandidates.find((candidate) => candidate.id === executiveSettings.presidentUserId) ?? null;
  const presidentVoteCount = (candidateId: string) => presidentVotes.filter((row) => row.candidate_user_id === candidateId).length;
  const visiblePresidentCandidates = useMemo(() => {
    const query = presidentSearch.trim().toLowerCase();
    return speakerCandidates.filter((candidate) => {
      const party = candidate.party || "No party";
      const district = formatConstituency(candidate.constituency);
      return (!query || candidate.name.toLowerCase().includes(query) || party.toLowerCase().includes(query) || district.toLowerCase().includes(query)) && (presidentPartyFilter === "all" || party === presidentPartyFilter);
    }).sort((a, b) => presidentVoteCount(b.id) - presidentVoteCount(a.id) || a.name.localeCompare(b.name));
  }, [presidentPartyFilter, presidentSearch, presidentVotes, speakerCandidates]);
  const presidentWinner = useMemo(() => {
    const [winner] = [...speakerCandidates].sort((a, b) => presidentVoteCount(b.id) - presidentVoteCount(a.id) || a.name.localeCompare(b.name));
    return winner && presidentVoteCount(winner.id) > 0 ? winner : null;
  }, [presidentVotes, speakerCandidates]);
  const currentPresident = assignedPresident ?? (presidentConcluded ? presidentWinner : null);
  const visibleDiscussionAreas = useMemo(() => discussionAreas.filter((area) => role === "teacher" || area.visibility !== "invisible"), [discussionAreas, role]);
  const liveDiscussion = visibleDiscussionAreas.find((area) => area.visibility === "live" || area.is_active) ?? null;
  const selectedDiscussion = visibleDiscussionAreas.find((area) => area.id === selectedDiscussionId) ?? visibleDiscussionAreas.find((area) => area.visibility === "live" || area.is_active) ?? visibleDiscussionAreas[0] ?? null;
  const selectedDiscussionCanPost = Boolean(selectedDiscussion && (selectedDiscussion.visibility === "live" || selectedDiscussion.is_active));
  const discussionSections = useMemo<Array<{ id: NonNullable<DiscussionArea["visibility"]>; label: string }>>(
    () => [
      { id: "live", label: "Live" },
      { id: "archive", label: "Archive" },
      ...(role === "teacher" ? [{ id: "invisible" as const, label: "Invisible" }] : []),
    ],
    [role],
  );
  const discussionAreasByVisibility = useMemo(() => {
    const grouped: Record<NonNullable<DiscussionArea["visibility"]>, DiscussionArea[]> = { live: [], archive: [], invisible: [] };
    for (const area of visibleDiscussionAreas) {
      const visibility = area.visibility ?? (area.is_active ? "live" : "archive");
      grouped[visibility].push(area);
    }
    return grouped;
  }, [visibleDiscussionAreas]);
  const selectedDiscussionPosts = selectedDiscussion ? discussionPosts.filter((post) => post.discussion_id === selectedDiscussion.id) : [];
  const discussionCommentsByPost = useMemo(() => {
    const map = new Map<string, DiscussionComment[]>();
    for (const comment of discussionComments) {
      map.set(comment.post_id, [...(map.get(comment.post_id) ?? []), comment]);
    }
    return map;
  }, [discussionComments]);
  const discussionReactionsByPost = useMemo(() => {
    const map = new Map<string, DiscussionReaction[]>();
    for (const reaction of discussionReactions) {
      map.set(reaction.post_id, [...(map.get(reaction.post_id) ?? []), reaction]);
    }
    return map;
  }, [discussionReactions]);

  useEffect(() => {
    if (!activeSession) {
      setManualCounts({ yea: liveCounts.yea, nay: liveCounts.nay, present: liveCounts.present, not_voted: Math.max(0, studentCount - liveCounts.yea - liveCounts.nay - liveCounts.present) });
      return;
    }
    const nextCounts = activeSession.manual_counts ?? { yea: liveCounts.yea, nay: liveCounts.nay, present: liveCounts.present, not_voted: Math.max(0, studentCount - liveCounts.yea - liveCounts.nay - liveCounts.present) };
    setManualCounts({
      yea: Number(nextCounts.yea ?? 0),
      nay: Number(nextCounts.nay ?? 0),
      present: Number(nextCounts.present ?? 0),
      not_voted: Number(nextCounts.not_voted ?? 0),
    });
    if (activeSession.posted_result) setManualDecision(activeSession.posted_result);
  }, [activeSession?.id, activeSession?.manual_counts, activeSession?.posted_result, liveCounts.yea, liveCounts.nay, liveCounts.present, studentCount]);

  const setFloorMode = async (mode: FloorMode) => {
    if (!classId || role !== "teacher" || floorMode === mode) return;
    setBusy(true);
    try {
      const nextSettings = { ...classSettings, floor: { ...(classSettings.floor ?? {}), mode } };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success(`Floor set to ${mode === "election" ? "Speaker election" : mode === "discussion" ? "discussion" : "bills"}`);
    } catch (e: any) {
      toast.error(e.message || "Could not update floor mode");
    } finally {
      setBusy(false);
    }
  };

  const confirmFloorMode = (mode: FloorMode) => {
    const label = mode === "election" ? "Speaker Election" : mode === "discussion" ? "Discussion" : "Bills";
    setConfirmDialog({
      title: `Switch floor to ${label}?`,
      message: `Students will see the ${label.toLowerCase()} area on the floor page.`,
      confirmLabel: "Switch",
      onConfirm: () => setFloorMode(mode),
    });
  };

  const postSpeakerResults = async () => {
    if (!classId || role !== "teacher") return;
    setBusy(true);
    try {
      const nextSettings = {
        ...classSettings,
        elections: { ...(classSettings.elections ?? {}), speakerConcluded: true, speakerOpen: false },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success("Speaker election results posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post Speaker results");
    } finally {
      setBusy(false);
    }
  };

  const setSpeakerElectionOpen = async (open: boolean) => {
    if (!classId || role !== "teacher" || speakerConcluded) return;
    setBusy(true);
    try {
      const nextSettings = { ...classSettings, elections: { ...(classSettings.elections ?? {}), speakerOpen: open } };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success(open ? "Speaker election opened" : "Speaker election closed");
    } catch (e: any) {
      toast.error(e.message || "Could not update Speaker election");
    } finally {
      setBusy(false);
    }
  };

  const toggleSpeakerOptOut = async () => {
    if (!classId || !meId || role === "teacher" || speakerConcluded || !speakerOpen) return;
    const optedOut = speakerOptedOut(meId);
    setBusy(true);
    try {
      if (optedOut) {
        const { error } = await supabase.from("class_speaker_opt_outs").delete().eq("class_id", classId).eq("user_id", meId);
        if (error) throw error;
        setSpeakerOptOuts((prev) => prev.filter((row) => row.user_id !== meId));
        toast.success("Opt-out removed");
      } else {
        const [{ error: optError }, { error: voteError }] = await Promise.all([
          supabase.from("class_speaker_opt_outs").upsert({ class_id: classId, user_id: meId } as any, { onConflict: "class_id,user_id" }),
          supabase.from("class_speaker_votes").delete().eq("class_id", classId).eq("candidate_user_id", meId),
        ]);
        if (optError || voteError) throw optError ?? voteError;
        setSpeakerOptOuts((prev) => [...prev.filter((row) => row.user_id !== meId), { class_id: classId, user_id: meId }]);
        setSpeakerVotes((prev) => prev.filter((row) => row.candidate_user_id !== meId));
        setSpeakerVote((prev) => (prev === meId ? null : prev));
        toast.success("Opted out");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not update opt-out");
    } finally {
      setBusy(false);
    }
  };

  const castSpeakerVote = async (candidateId: string) => {
    if (!classId || !meId || role === "teacher" || !speakerOpen || speakerConcluded || speakerOptedOut(candidateId)) return;
    setBusy(true);
    try {
      if (speakerVote === candidateId) {
        const { error } = await supabase.from("class_speaker_votes").delete().eq("class_id", classId).eq("voter_user_id", meId);
        if (error) throw error;
        setSpeakerVote(null);
        setSpeakerVotes((prev) => prev.filter((row) => row.voter_user_id !== meId));
        return;
      }
      const { error } = await supabase.from("class_speaker_votes").upsert(
        { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId, updated_at: new Date().toISOString() } as any,
        { onConflict: "class_id,voter_user_id" },
      );
      if (error) throw error;
      setSpeakerVote(candidateId);
      setSpeakerVotes((prev) => [...prev.filter((row) => row.voter_user_id !== meId), { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId }]);
    } catch (e: any) {
      toast.error(e.message || "Could not record speaker vote");
    } finally {
      setBusy(false);
    }
  };

  const setPresidentElectionOpen = async (open: boolean) => {
    if (!classId || role !== "teacher" || presidentConcluded) return;
    setBusy(true);
    try {
      const nextSettings = {
        ...classSettings,
        executive: {
          ...(classSettings.executive ?? {}),
          enabled: true,
          selectionMode: "student-vote",
          presidentSelectionMode: "student-vote",
          presidentOpen: open,
        },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success(open ? "President election opened" : "President election closed");
    } catch (e: any) {
      toast.error(e.message || "Could not update President election");
    } finally {
      setBusy(false);
    }
  };

  const postPresidentResults = async () => {
    if (!classId || role !== "teacher") return;
    setBusy(true);
    try {
      const winnerId = presidentWinner?.id ?? executiveSettings.presidentUserId ?? null;
      const nextSettings = {
        ...classSettings,
        executive: {
          ...(classSettings.executive ?? {}),
          enabled: true,
          selectionMode: "student-vote",
          presidentSelectionMode: "student-vote",
          presidentConcluded: true,
          presidentOpen: false,
          presidentUserId: winnerId,
        },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success(winnerId ? "President election results posted" : "President election closed without a winner");
    } catch (e: any) {
      toast.error(e.message || "Could not post President results");
    } finally {
      setBusy(false);
    }
  };

  const castPresidentVote = async (candidateId: string) => {
    if (!classId || !meId || role === "teacher" || !executiveEnabled || presidentSelectionMode !== "student-vote" || !presidentOpen || presidentConcluded) return;
    setBusy(true);
    try {
      if (presidentVote === candidateId) {
        const { error } = await supabase.from("class_president_votes").delete().eq("class_id", classId).eq("voter_user_id", meId);
        if (error) throw error;
        setPresidentVote(null);
        setPresidentVotes((prev) => prev.filter((row) => row.voter_user_id !== meId));
        return;
      }
      const { error } = await supabase.from("class_president_votes").upsert(
        { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId, updated_at: new Date().toISOString() } as any,
        { onConflict: "class_id,voter_user_id" },
      );
      if (error) throw error;
      setPresidentVote(candidateId);
      setPresidentVotes((prev) => [...prev.filter((row) => row.voter_user_id !== meId), { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId }]);
    } catch (e: any) {
      toast.error(e.message || "Could not record president vote");
    } finally {
      setBusy(false);
    }
  };

  const openVote = async () => {
    if (!activeItem || !classId || !meId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_sessions").upsert(
        {
          class_id: classId,
          bill_id: activeItem.bill_id,
          calendar_id: activeItem.id,
          status: "open",
          opened_by: meId,
          opened_at: new Date().toISOString(),
          closed_at: null,
        } as any,
        { onConflict: "class_id,bill_id" },
      );
      if (error) throw error;
      await supabase.from("bills").update({ status: "floor" } as any).eq("id", activeItem.bill_id).eq("class_id", classId);
      toast.success("Floor vote opened");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not open vote");
    } finally {
      setBusy(false);
    }
  };

  const closeVote = async () => {
    if (!activeSession || !activeItem || !classId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_sessions").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", activeSession.id);
      if (error) throw error;
      toast.success("Floor vote closed");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not close vote");
    } finally {
      setBusy(false);
    }
  };

  const postFloorResults = async () => {
    if (!activeItem || !classId || !meId) return;
    setBusy(true);
    try {
      const result = resultMode === "decision" ? manualDecision : manualCounts.yea > manualCounts.nay ? "passed" : "failed";
      const sessionPayload: any = {
        class_id: classId,
        bill_id: activeItem.bill_id,
        calendar_id: activeItem.id,
        status: "closed",
        closed_at: new Date().toISOString(),
        manual_counts: resultMode === "counts" ? manualCounts : null,
        posted_result: result,
        results_posted_at: new Date().toISOString(),
      };
      if (!activeSession) {
        sessionPayload.opened_by = meId;
        sessionPayload.opened_at = new Date().toISOString();
      }
      const { error } = await supabase.from("bill_floor_sessions").upsert(sessionPayload, { onConflict: "class_id,bill_id" });
      if (error) throw error;
      const nextBillStatus = result === "passed" && classSettings?.senate?.enabled ? "senate" : result;
      const { error: billError } = await supabase.from("bills").update({ status: nextBillStatus } as any).eq("id", activeItem.bill_id).eq("class_id", classId);
      if (billError) throw billError;
      toast.success(nextBillStatus === "senate" ? "Floor results posted: bill sent to Senate" : `Floor results posted: bill ${result}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post floor results");
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (vote: VoteChoice) => {
    if (!activeSession || !activeItem || !classId || !meId || activeSession.status !== "open" || myVote) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_votes").insert({
        session_id: activeSession.id,
        bill_id: activeItem.bill_id,
        class_id: classId,
        user_id: meId,
        vote,
      } as any);
      if (error) throw error;
      setVotes((prev) => [...prev, { session_id: activeSession.id, bill_id: activeItem.bill_id, user_id: meId, vote }]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    } finally {
      setBusy(false);
    }
  };

  const publishPresentation = (mode = presentationMode, note = presentationNote) => {
    const payload = {
      mode,
      note: note.trim() || "Floor is in session.",
      billId: activeItem?.bill_id ?? null,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem("gavel:floorPresentation", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("gavel:floor-presentation"));
    toast.success("Presentation screen updated");
  };

  const quickPresentation = (mode: PresentationMode, note: string) => {
    setPresentationMode(mode);
    setPresentationNote(note);
    publishPresentation(mode, note);
  };

  const speakerDisplayName = (speaker: FloorSpeakerRow) => `${speaker.name} (Rep.-${partyAbbr(speaker.party)}-${formatConstituency(speaker.constituency) || "N/A"})`;

  const publishSpeaker = (speaker: FloorSpeakerRow) => {
    const mode = speaker.side === "for" ? "speaker_for" : "speaker_against";
    quickPresentation(mode, speakerDisplayName(speaker));
  };

  const approveSpeaker = async (speaker: FloorSpeakerRow, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase.from("bill_floor_speakers").update({ status } as any).eq("bill_id", speaker.bill_id).eq("user_id", speaker.user_id);
      if (error) throw error;
      setFloorSpeakers((prev) => prev.map((row) => row.bill_id === speaker.bill_id && row.user_id === speaker.user_id ? { ...row, status } : row));
    } catch (e: any) {
      toast.error(e.message || "Could not update speaker");
    }
  };

  const makeOppositionLeader = async (speaker: FloorSpeakerRow) => {
    try {
      await supabase.from("bill_floor_speakers").update({ speaker_role: "speaker" } as any).eq("bill_id", speaker.bill_id).eq("side", "against");
      const { error } = await supabase.from("bill_floor_speakers").update({ speaker_role: "opposition_leader", status: "approved" } as any).eq("bill_id", speaker.bill_id).eq("user_id", speaker.user_id);
      if (error) throw error;
      setFloorSpeakers((prev) => prev.map((row) => row.bill_id === speaker.bill_id ? { ...row, speaker_role: row.user_id === speaker.user_id ? "opposition_leader" : "speaker", status: row.user_id === speaker.user_id ? "approved" : row.status } : row));
    } catch (e: any) {
      toast.error(e.message || "Could not set opposition leader");
    }
  };

  const castPreviousQuestionVote = async (vote: "yea" | "nay") => {
    if (!activeItem || !classId || !meId || role === "teacher") return;
    try {
      if (myPreviousQuestionVote === vote) {
        const { error } = await supabase
          .from("bill_previous_question_votes")
          .delete()
          .eq("bill_id", activeItem.bill_id)
          .eq("user_id", meId);
        if (error) throw error;
        setPreviousQuestionVotes((prev) => prev.filter((row) => !(row.bill_id === activeItem.bill_id && row.user_id === meId)));
        return;
      }
      const { error } = await supabase.from("bill_previous_question_votes").upsert({ class_id: classId, bill_id: activeItem.bill_id, user_id: meId, vote, updated_at: new Date().toISOString() } as any, { onConflict: "bill_id,user_id" });
      if (error) throw error;
      setPreviousQuestionVotes((prev) => [...prev.filter((row) => !(row.bill_id === activeItem.bill_id && row.user_id === meId)), { bill_id: activeItem.bill_id, user_id: meId, vote }]);
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    }
  };

  const createDiscussionArea = async () => {
    if (!classId || !meId || role !== "teacher" || !newDiscussionTitle.trim()) return;
    setBusy(true);
    try {
      const shouldActivate = discussionAreas.length === 0;
      const { data, error } = await supabase
        .from("floor_discussion_areas")
        .insert({
          class_id: classId,
          title: newDiscussionTitle.trim(),
          prompt: newDiscussionPrompt.trim(),
          is_active: shouldActivate,
          visibility: shouldActivate ? "live" : "archive",
          created_by: meId,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      setNewDiscussionTitle("");
      setNewDiscussionPrompt("");
      setCreatingDiscussion(false);
      setSelectedDiscussionId((data as any)?.id ?? null);
      await loadDiscussions(classId);
      toast.success("Discussion area created");
    } catch (e: any) {
      toast.error(e.message || "Could not create discussion");
    } finally {
      setBusy(false);
    }
  };

  const activateDiscussionArea = async (discussionId: string) => {
    if (!classId || role !== "teacher") return;
    setBusy(true);
    try {
      const { error: clearError } = await supabase.from("floor_discussion_areas").update({ is_active: false, visibility: "archive" } as any).eq("class_id", classId).neq("id", discussionId);
      if (clearError) throw clearError;
      const { error } = await supabase.from("floor_discussion_areas").update({ is_active: true, visibility: "live", updated_at: new Date().toISOString() } as any).eq("id", discussionId);
      if (error) throw error;
      setDiscussionAreas((prev) => prev.map((area) => ({ ...area, is_active: area.id === discussionId, visibility: area.id === discussionId ? "live" : area.visibility === "live" ? "archive" : area.visibility })));
      toast.success("Discussion is live on the floor");
    } catch (e: any) {
      toast.error(e.message || "Could not activate discussion");
    } finally {
      setBusy(false);
    }
  };

  const showDiscussionOnFloor = async (discussionId: string) => {
    setSelectedDiscussionId(discussionId);
    await activateDiscussionArea(discussionId);
    await setFloorMode("discussion");
  };

  const updateDiscussionVisibility = async (discussionId: string, visibility: DiscussionArea["visibility"]) => {
    if (!classId || role !== "teacher" || !visibility) return;
    try {
      if (visibility === "live") await supabase.from("floor_discussion_areas").update({ is_active: false, visibility: "archive" } as any).eq("class_id", classId).neq("id", discussionId);
      const { error } = await supabase.from("floor_discussion_areas").update({ visibility, is_active: visibility === "live", updated_at: new Date().toISOString() } as any).eq("id", discussionId);
      if (error) throw error;
      setDiscussionAreas((prev) => prev.map((area) => ({ ...area, visibility: area.id === discussionId ? visibility : visibility === "live" ? (area.visibility === "live" ? "archive" : area.visibility) : area.visibility, is_active: area.id === discussionId ? visibility === "live" : visibility === "live" ? false : area.is_active })));
    } catch (e: any) {
      toast.error(e.message || "Could not move discussion");
    }
  };

  const updateDiscussionDetails = async () => {
    if (!editingDiscussionId || role !== "teacher" || !editingDiscussionTitle.trim()) return;
    const { error } = await supabase.from("floor_discussion_areas").update({ title: editingDiscussionTitle.trim(), prompt: editingDiscussionPrompt.trim(), updated_at: new Date().toISOString() } as any).eq("id", editingDiscussionId);
    if (error) return toast.error(error.message || "Could not update discussion");
    setDiscussionAreas((prev) => prev.map((area) => area.id === editingDiscussionId ? { ...area, title: editingDiscussionTitle.trim(), prompt: editingDiscussionPrompt.trim() } : area));
    setEditingDiscussionId(null);
  };

  const submitDiscussionPost = async () => {
    if (!classId || !meId || !selectedDiscussion || !newDiscussionPost.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("floor_discussion_posts").insert({
        discussion_id: selectedDiscussion.id,
        class_id: classId,
        author_user_id: meId,
        body: newDiscussionPost.trim(),
        attachments: newDiscussionPostAttachments,
      } as any);
      if (error) throw error;
      setNewDiscussionPost("");
      setNewDiscussionPostAttachments([]);
      await loadDiscussions(classId);
    } catch (e: any) {
      toast.error(e.message || "Could not post discussion");
    } finally {
      setBusy(false);
    }
  };

  const submitDiscussionComment = async (postId: string) => {
    if (!classId || !meId || !selectedDiscussion) return;
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("floor_discussion_comments").insert({
        post_id: postId,
        discussion_id: selectedDiscussion.id,
        class_id: classId,
        author_user_id: meId,
        body,
        attachments: commentAttachments[postId] ?? [],
      } as any);
      if (error) throw error;
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setCommentAttachments((prev) => ({ ...prev, [postId]: [] }));
      await loadDiscussions(classId);
    } catch (e: any) {
      toast.error(e.message || "Could not add reply");
    } finally {
      setBusy(false);
    }
  };

  const toggleDiscussionReaction = async (postId: string, emoji: DiscussionReaction["emoji"]) => {
    if (!classId || !meId) return;
    const existing = discussionReactions.some((reaction) => reaction.post_id === postId && reaction.user_id === meId && reaction.emoji === emoji);
    try {
      if (existing) {
        const { error } = await supabase.from("floor_discussion_reactions").delete().eq("post_id", postId).eq("user_id", meId).eq("emoji", emoji);
        if (error) throw error;
        setDiscussionReactions((prev) => prev.filter((reaction) => !(reaction.post_id === postId && reaction.user_id === meId && reaction.emoji === emoji)));
        return;
      }
      const { data, error } = await supabase
        .from("floor_discussion_reactions")
        .insert({ post_id: postId, class_id: classId, user_id: meId, emoji } as any)
        .select("id,post_id,class_id,user_id,emoji")
        .single();
      if (error) throw error;
      setDiscussionReactions((prev) => [...prev, data as DiscussionReaction]);
    } catch (e: any) {
      toast.error(e.message || "Could not update reaction");
    }
  };

  const deleteDiscussionPost = async (post: DiscussionPost) => {
    if (!meId || (role !== "teacher" && post.author_user_id !== meId)) return;
    try {
      const { error } = await supabase.from("floor_discussion_posts").delete().eq("id", post.id);
      if (error) throw error;
      setDiscussionPosts((prev) => prev.filter((row) => row.id !== post.id));
    } catch (e: any) {
      toast.error(e.message || "Could not delete post");
    }
  };

  const deleteDiscussionComment = async (comment: DiscussionComment) => {
    if (!meId || (role !== "teacher" && comment.author_user_id !== meId)) return;
    try {
      const { error } = await supabase.from("floor_discussion_comments").delete().eq("id", comment.id);
      if (error) throw error;
      setDiscussionComments((prev) => prev.filter((row) => row.id !== comment.id));
    } catch (e: any) {
      toast.error(e.message || "Could not delete reply");
    }
  };

  const authorLabel = (author: DiscussionAuthor | null | undefined) => {
    if (!author) return "Member";
    return `${author.display_name ?? "Member"} (Rep.-${partyAbbr(author.party)}-${formatConstituency(author.constituency_name) || "N/A"})`;
  };

  const beginCreateDiscussion = () => {
    setCreatingDiscussion(true);
    setEditingDiscussionId(null);
    setNewDiscussionTitle("");
    setNewDiscussionPrompt("");
  };

  const selectDiscussion = (discussionId: string) => {
    setCreatingDiscussion(false);
    setEditingDiscussionId(null);
    setSelectedDiscussionId(discussionId);
  };

  const setDiscussionDropTarget = (visibility: NonNullable<DiscussionArea["visibility"]>, index: number) => {
    if (draggingDiscussionId) {
      const currentVisibility = (visibleDiscussionAreas.find((area) => area.id === draggingDiscussionId)?.visibility ?? "archive") as NonNullable<DiscussionArea["visibility"]>;
      const currentIndex = discussionAreasByVisibility[currentVisibility].findIndex((area) => area.id === draggingDiscussionId);
      if (currentVisibility === visibility && (index === currentIndex || index === currentIndex + 1)) {
        setDiscussionDragTarget(null);
        return;
      }
    }
    setDiscussionDragTarget({ visibility, index });
  };

  const discussionBoard = (
    <>
    <div className={`grid min-h-[calc(100vh-12rem)] gap-4 ${discussionListCollapsed ? "lg:grid-cols-[3rem_minmax(0,1fr)]" : "lg:grid-cols-[18rem_minmax(0,1fr)]"}`}>
      <aside className={`min-w-0 ${discussionListCollapsed ? "" : "border-r border-gray-200 pr-3"}`}>
        <div className={`mb-4 flex items-center ${discussionListCollapsed ? "justify-center" : "justify-between gap-3"}`}>
          {!discussionListCollapsed && (
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Discussion Areas</h2>
            </div>
          )}
          <div className="flex items-center gap-1">
            {role === "teacher" && !discussionListCollapsed && (
              <button type="button" onClick={beginCreateDiscussion} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Create discussion area">
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setDiscussionListCollapsed((collapsed) => !collapsed)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label={discussionListCollapsed ? "Show discussion areas" : "Hide discussion areas"}
              title={discussionListCollapsed ? "Show discussion areas" : "Hide discussion areas"}
            >
              {discussionListCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {discussionListCollapsed ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <MessageSquare className="h-5 w-5" />
            <div className="text-xs font-semibold">{visibleDiscussionAreas.length}</div>
          </div>
        ) : (
        <div className="space-y-4">
          {discussionSections.map((section) => {
            const areas = discussionAreasByVisibility[section.id];
            const endTargeted = draggingDiscussionId && discussionDragTarget?.visibility === section.id && discussionDragTarget.index === areas.length;
            return (
              <div
                key={section.id}
                onDragOver={(event) => {
                  if (role !== "teacher") return;
                  event.preventDefault();
                  setDiscussionDropTarget(section.id, areas.length);
                }}
                onDrop={(event) => {
                  if (role !== "teacher") return;
                  event.preventDefault();
                  const discussionId = event.dataTransfer.getData("text/plain") || draggingDiscussionId;
                  if (discussionId) void updateDiscussionVisibility(discussionId, section.id);
                  setDraggingDiscussionId(null);
                  setDiscussionDragTarget(null);
                }}
              >
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.label}</div>
                <div className="min-h-8 space-y-1">
                  {areas.length ? areas.map((area, index) => {
                    const targetedBefore = draggingDiscussionId && discussionDragTarget?.visibility === section.id && discussionDragTarget.index === index;
                    return (
                      <div key={area.id}>
                        {targetedBefore ? <div className="my-1 h-0.5 bg-blue-500" /> : null}
                        <button
                          type="button"
                          draggable={role === "teacher"}
                          onDragStart={(event) => {
                            setDraggingDiscussionId(area.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", area.id);
                          }}
                          onDragOver={(event) => {
                            if (role !== "teacher") return;
                            event.preventDefault();
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const nextIndex = event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
                            setDiscussionDropTarget(section.id, nextIndex);
                          }}
                          onDragEnd={() => {
                            setDraggingDiscussionId(null);
                            setDiscussionDragTarget(null);
                          }}
                          onDrop={(event) => {
                            if (role !== "teacher") return;
                            event.preventDefault();
                            event.stopPropagation();
                            const discussionId = event.dataTransfer.getData("text/plain") || draggingDiscussionId;
                            if (discussionId) void updateDiscussionVisibility(discussionId, section.id);
                            setDraggingDiscussionId(null);
                            setDiscussionDragTarget(null);
                          }}
                          onClick={() => selectDiscussion(area.id)}
                          className={`w-full px-2 py-1.5 text-left text-sm transition-colors ${selectedDiscussion?.id === area.id && !creatingDiscussion ? "border-l-2 border-blue-600 bg-blue-50 pl-2 text-blue-900" : "text-gray-700 hover:bg-gray-50"} ${draggingDiscussionId === area.id ? "opacity-50" : ""}`}
                        >
                          <span className="block font-semibold">{area.title}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{new Date(area.created_at).toLocaleDateString()}</span>
                        </button>
                      </div>
                    );
                  }) : <div className="px-2 py-2 text-xs text-gray-400">None</div>}
                  {endTargeted ? <div className="my-1 h-0.5 bg-blue-500" /> : null}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </aside>
      <section className="min-w-0">
        {selectedDiscussion ? (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-gray-900">{selectedDiscussion.title}</h2>
                {selectedDiscussion.prompt && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-gray-600">{selectedDiscussion.prompt}</p>}
              </div>
              {role === "teacher" && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDiscussionId(selectedDiscussion.id);
                      setEditingDiscussionTitle(selectedDiscussion.title);
                      setEditingDiscussionPrompt(selectedDiscussion.prompt ?? "");
                    }}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  {!selectedDiscussionCanPost && (
                    <button type="button" onClick={() => void showDiscussionOnFloor(selectedDiscussion.id)} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      Make live
                    </button>
                  )}
                </div>
              )}
            </div>
            {selectedDiscussionCanPost ? (
              <div className="mb-5 border-b border-gray-200 pb-4">
                <textarea
                  value={newDiscussionPost}
                  onChange={(event) => setNewDiscussionPost(event.target.value)}
                  placeholder="Add a text post..."
                  rows={4}
                  className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <AttachmentPicker value={newDiscussionPostAttachments} onChange={setNewDiscussionPostAttachments} />
                  <button type="button" onClick={() => void submitDiscussionPost()} disabled={busy || !newDiscussionPost.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                    Post
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {selectedDiscussion.visibility === "invisible" ? "This discussion is invisible to students." : "This discussion is archived and can only be viewed."}
              </div>
            )}
            {selectedDiscussionPosts.length ? (
              <div className="space-y-4">
                {selectedDiscussionPosts.map((post) => {
                  const postComments = discussionCommentsByPost.get(post.id) ?? [];
                  const postReactions = discussionReactionsByPost.get(post.id) ?? [];
                  const repliesExpanded = Boolean(expandedReplyRails[post.id]);
                  const postExpanded = Boolean(expandedDiscussionPosts[post.id]);
                  const postHasOverflow = post.body.length > 700 || post.body.split(/\r?\n/).length > 8;
                  const replyRailHasOverflow = postComments.length > 3 || postComments.some((comment) => comment.body.length > 220 || (comment.attachments?.length ?? 0) > 0);
                  return (
                    <article key={post.id} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
                      <div className="min-w-0">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <SecureAvatar src={post.author?.avatar_url} alt={post.author?.display_name ?? "Member"} className="h-9 w-9 rounded-full object-cover" fallbackClassName="h-9 w-9 rounded-full" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">{authorLabel(post.author)}</div>
                              <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                          {(role === "teacher" || post.author_user_id === meId) && (
                            <button type="button" onClick={() => void deleteDiscussionPost(post)} className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete post">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <p className={`whitespace-pre-wrap text-sm leading-6 text-gray-800 ${postHasOverflow && !postExpanded ? "max-h-40 overflow-hidden" : ""}`}>{post.body}</p>
                          {postHasOverflow && !postExpanded ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-white/0" /> : null}
                        </div>
                        {postHasOverflow ? (
                          <button
                            type="button"
                            onClick={() => setExpandedDiscussionPosts((prev) => ({ ...prev, [post.id]: !postExpanded }))}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {postExpanded ? "Show less" : "Show more"}
                          </button>
                        ) : null}
                        <AttachmentList attachments={post.attachments} />
                        <div className="mt-4 flex flex-wrap gap-2">
                          {DISCUSSION_REACTIONS.map((reaction) => {
                            const count = postReactions.filter((row) => row.emoji === reaction.id).length;
                            const selected = postReactions.some((row) => row.emoji === reaction.id && row.user_id === meId);
                            return (
                              <button
                                key={reaction.id}
                                type="button"
                                onClick={() => void toggleDiscussionReaction(post.id, reaction.id)}
                                disabled={!selectedDiscussionCanPost}
                                className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${selected ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                              >
                                {reaction.label} {count}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <aside className={`flex min-h-0 flex-col border-t border-gray-100 pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0 ${repliesExpanded ? "max-h-[34rem]" : "max-h-72"}`}>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Replies ({postComments.length})</div>
                        <div className="relative min-h-0 flex-1">
                          <div className={`min-h-0 space-y-2 overflow-y-auto pr-1 ${repliesExpanded ? "max-h-[25rem] pb-2" : "max-h-44 pb-9"}`}>
                            {postComments.length ? postComments.map((comment) => (
                              <div key={comment.id} className="rounded-md bg-gray-50 p-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-start gap-2">
                                    <SecureAvatar src={comment.author?.avatar_url} alt={comment.author?.display_name ?? "Member"} className="h-7 w-7 rounded-full object-cover" fallbackClassName="h-7 w-7 rounded-full" />
                                    <div className="min-w-0 text-xs font-semibold text-gray-900">{authorLabel(comment.author)}</div>
                                  </div>
                                  {(role === "teacher" || comment.author_user_id === meId) && (
                                    <button type="button" onClick={() => void deleteDiscussionComment(comment)} className="rounded p-0.5 text-gray-400 hover:text-red-600" aria-label="Delete reply">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-gray-700">{comment.body}</p>
                                <AttachmentList attachments={comment.attachments} />
                              </div>
                            )) : <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">No replies yet.</div>}
                          </div>
                          {!repliesExpanded && replyRailHasOverflow && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/95 to-white/0" />}
                          {replyRailHasOverflow && (
                            <button
                              type="button"
                              onClick={() => setExpandedReplyRails((prev) => ({ ...prev, [post.id]: !repliesExpanded }))}
                              className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                            >
                              {repliesExpanded ? "Show less" : "Show more"}
                            </button>
                          )}
                        </div>
                        {selectedDiscussionCanPost && (
                          <div className="mt-2 flex items-center gap-2">
                            <AttachmentPicker compact value={commentAttachments[post.id] ?? []} onChange={(next) => setCommentAttachments((prev) => ({ ...prev, [post.id]: next }))} />
                            <input
                              value={commentDrafts[post.id] ?? ""}
                              onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void submitDiscussionComment(post.id);
                                }
                              }}
                              placeholder="Reply..."
                              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </aside>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No posts in this discussion yet.</div>
            )}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Create a discussion area to start the floor board.</div>
        )}
      </section>
    </div>
    {creatingDiscussion && role === "teacher" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">New discussion</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <input
              value={newDiscussionTitle}
              onChange={(event) => setNewDiscussionTitle(event.target.value)}
              placeholder="Discussion title"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newDiscussionPrompt}
              onChange={(event) => setNewDiscussionPrompt(event.target.value)}
              placeholder="Prompt or directions"
              rows={5}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={() => setCreatingDiscussion(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="button" onClick={() => void createDiscussionArea()} disabled={busy || !newDiscussionTitle.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              Create discussion
            </button>
          </div>
        </div>
      </div>
    )}
    {editingDiscussionId && role === "teacher" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Edit discussion</h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <input
              value={editingDiscussionTitle}
              onChange={(event) => setEditingDiscussionTitle(event.target.value)}
              placeholder="Discussion title"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={editingDiscussionPrompt}
              onChange={(event) => setEditingDiscussionPrompt(event.target.value)}
              placeholder="Prompt or directions"
              rows={5}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={() => setEditingDiscussionId(null)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button type="button" onClick={() => void updateDiscussionDetails()} disabled={!editingDiscussionTitle.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );

  return (
    <div className={`min-h-screen ${displayFloorMode === "discussion" ? "bg-white" : "bg-gray-50"}`}>
      <Navigation />
      <main className={displayFloorMode === "discussion" ? "px-3 py-4 sm:px-4 lg:px-6" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}>
        {shouldShowFloorHeader && <div className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Floor</h1>
              <p className="text-gray-600">Speaker election, active floor text, discussions, and floor votes.</p>
            </div>
            {shouldShowFloorSwitcher && (
              <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
                {([
                  ["election", "Speaker Election"],
                  ["bills", "Bills"],
                  ["discussion", "Discussions"],
                ] as Array<[FloorMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => confirmFloorMode(mode)}
                    disabled={busy || floorMode === mode}
                    className={`rounded px-3 py-1.5 text-sm font-semibold transition ${floorMode === mode ? "bg-[#4163f2] text-white shadow-sm" : "text-gray-700 hover:bg-blue-50 hover:text-blue-800"} disabled:opacity-80`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading floor...</div>
        ) : displayFloorMode === "election" ? (
          <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Speaker of the House Election</h2>
                </div>
                <p className="text-sm text-gray-600">{speakerOpen ? "Voting is open." : "Voting is closed."}</p>
              </div>
              {role === "teacher" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
                    <button type="button" onClick={() => void setSpeakerElectionOpen(true)} disabled={busy} className={`rounded px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${speakerOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}>
                      Open
                    </button>
                    <button type="button" onClick={() => void setSpeakerElectionOpen(false)} disabled={busy} className={`rounded px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${!speakerOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}>
                      Close
                    </button>
                  </div>
                  <button type="button" onClick={() => void postSpeakerResults()} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    Post results
                  </button>
                </div>
              )}
            </div>
            {speakerCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No student candidates are available yet.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="text-sm text-gray-700">Leader: <span className="font-semibold text-gray-900">{speakerWinner?.name ?? "No votes yet"}</span></div>
                  {role !== "teacher" && (
                    <button
                      type="button"
                      onClick={() => void toggleSpeakerOptOut()}
                      disabled={busy || !speakerOpen}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${meId && speakerOptedOut(meId) ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"} disabled:opacity-50`}
                    >
                      {meId && speakerOptedOut(meId) ? "Opted out" : "Opt out"}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={speakerSearch}
                      onChange={(event) => setSpeakerSearch(event.target.value)}
                      placeholder="Search candidates..."
                      className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select value={speakerPartyFilter} onChange={(event) => setSpeakerPartyFilter(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="all">All parties</option>
                    {speakerParties.map((party) => <option key={party} value={party}>{party}</option>)}
                  </select>
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                {visibleSpeakerCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => void castSpeakerVote(candidate.id)}
                    disabled={busy || role === "teacher" || !speakerOpen || speakerOptedOut(candidate.id)}
                    className={`flex w-full items-center justify-between gap-4 border-b border-gray-200 p-4 text-left transition-colors last:border-b-0 disabled:cursor-default ${
                      speakerVote === candidate.id ? "bg-blue-50" : speakerOptedOut(candidate.id) ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{candidate.name}</div>
                      <div className="text-sm text-gray-500">
                        {partyAbbr(candidate.party)}-{formatConstituency(candidate.constituency) || "N/A"}
                        {speakerOptedOut(candidate.id) ? " - Opted out" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">{speakerVoteCount(candidate.id)}</div>
                      <div className="text-xs text-gray-500">{speakerVote === candidate.id ? "Selected" : speakerOptedOut(candidate.id) ? "opted out" : "votes"}</div>
                    </div>
                  </button>
                ))}
                {visibleSpeakerCandidates.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No candidates match the filters.</div>}
                </div>
              </div>
            )}
          </div>
          {executiveEnabled && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-xl font-semibold text-gray-900">President Election</h2>
                  </div>
                  <p className="text-sm text-gray-600">
                    {presidentSelectionMode === "teacher-assigned" ? "The president is assigned by the teacher." : presidentOpen ? "Voting is open." : "Voting is closed."}
                  </p>
                </div>
                {role === "teacher" && presidentSelectionMode === "student-vote" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
                      <button type="button" onClick={() => void setPresidentElectionOpen(true)} disabled={busy || presidentConcluded} className={`rounded px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${presidentOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}>
                        Open
                      </button>
                      <button type="button" onClick={() => void setPresidentElectionOpen(false)} disabled={busy || presidentConcluded} className={`rounded px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${!presidentOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}>
                        Close
                      </button>
                    </div>
                    <button type="button" onClick={() => void postPresidentResults()} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      Post results
                    </button>
                  </div>
                )}
              </div>
              {presidentSelectionMode === "teacher-assigned" ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  President: <span className="font-semibold text-gray-900">{currentPresident?.name ?? "No president assigned"}</span>
                </div>
              ) : speakerCandidates.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No student candidates are available yet.</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    Leader: <span className="font-semibold text-gray-900">{presidentWinner?.name ?? currentPresident?.name ?? "No votes yet"}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={presidentSearch}
                        onChange={(event) => setPresidentSearch(event.target.value)}
                        placeholder="Search candidates..."
                        className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select value={presidentPartyFilter} onChange={(event) => setPresidentPartyFilter(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="all">All parties</option>
                      {speakerParties.map((party) => <option key={party} value={party}>{party}</option>)}
                    </select>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    {visiblePresidentCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => void castPresidentVote(candidate.id)}
                        disabled={busy || role === "teacher" || !presidentOpen || presidentConcluded}
                        className={`flex w-full items-center justify-between gap-4 border-b border-gray-200 p-4 text-left transition-colors last:border-b-0 disabled:cursor-default ${presidentVote === candidate.id ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{partyAbbr(candidate.party)}-{formatConstituency(candidate.constituency) || "N/A"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-700">{presidentVoteCount(candidate.id)}</div>
                          <div className="text-xs text-gray-500">{presidentVote === candidate.id ? "Selected" : "votes"}</div>
                        </div>
                      </button>
                    ))}
                    {visiblePresidentCandidates.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No candidates match the filters.</div>}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        ) : displayFloorMode === "discussion" ? (
          discussionBoard
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No calendared bills are ready for floor session.</div>
        ) : activeItem ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              {role === "teacher" && (
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MonitorUp className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Screen Share Display</h2>
                    </div>
                    <a href="#/floor/presentation" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <ExternalLink className="h-4 w-4" />
                      Open display
                    </a>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <select value={presentationMode} onChange={(event) => setPresentationMode(event.target.value as PresentationMode)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="agenda">Agenda</option>
                      <option value="debate">Debate</option>
                      <option value="speaker_for">Speaker in favor</option>
                      <option value="speaker_against">Speaker in opposition</option>
                      <option value="vote">Vote</option>
                      <option value="previous_question">Previous question</option>
                      <option value="results">Results</option>
                      <option value="recess">Recess</option>
                    </select>
                    <input value={presentationNote} onChange={(event) => setPresentationNote(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="What should the shared screen show?" />
                    <button type="button" onClick={() => publishPresentation()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Update</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => quickPresentation("debate", "Floor debate is open")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Debate</button>
                    <button type="button" onClick={() => quickPresentation("speaker_for", "Speaker in favor")} className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100">For speaker</button>
                    <button type="button" onClick={() => quickPresentation("speaker_against", "Speaker in opposition")} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">Against speaker</button>
                    <button type="button" onClick={() => quickPresentation("vote", "Vote now")} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100">Vote live count</button>
                    <button type="button" onClick={() => quickPresentation("previous_question", "Motion for the previous question")} className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100">Previous question</button>
                    <button type="button" onClick={() => quickPresentation("results", "Results posted")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Results</button>
                    <button type="button" onClick={() => quickPresentation("recess", "Debate is closed")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Close</button>
                    <button type="button" onClick={() => quickPresentation("recess", "The House stands in recess")} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Recess</button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-green-700">For speaker</div>
                      {floorSpeakersFor.length ? floorSpeakersFor.map((speaker) => (
                        <button key={speaker.user_id} type="button" onClick={() => publishSpeaker(speaker)} className="block w-full rounded px-2 py-1.5 text-left text-sm text-green-900 hover:bg-green-100">{speakerDisplayName(speaker)}</button>
                      )) : <div className="text-sm text-green-700">No approved speakers</div>}
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Against speaker</div>
                      {floorSpeakersAgainst.length ? floorSpeakersAgainst.map((speaker) => (
                        <div key={speaker.user_id} className="flex items-center gap-2">
                          <button type="button" onClick={() => publishSpeaker(speaker)} className="min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm text-red-900 hover:bg-red-100">{speaker.speaker_role === "opposition_leader" ? "Opposition leader: " : ""}{speakerDisplayName(speaker)}</button>
                          <button type="button" onClick={() => void makeOppositionLeader(speaker)} className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Leader</button>
                        </div>
                      )) : <div className="text-sm text-red-700">No approved speakers</div>}
                    </div>
                  </div>
                  {pendingFloorSpeakers.length > 0 && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Speaker requests</div>
                      {pendingFloorSpeakers.map((speaker) => (
                        <div key={speaker.user_id} className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-amber-900">
                          <span>{speaker.name} - {speaker.side === "for" ? "in favor" : "in opposition"}</span>
                          <span className="flex gap-2">
                            <button type="button" onClick={() => void approveSpeaker(speaker, "approved")} className="rounded bg-white px-2 py-1 text-xs font-medium text-green-700">Approve</button>
                            <button type="button" onClick={() => void approveSpeaker(speaker, "rejected")} className="rounded bg-white px-2 py-1 text-xs font-medium text-red-700">Reject</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-gray-900">{activeItem.bill.hr_label}</div>
                    <Link to={`/bills/${activeItem.bill_id}`} className="text-2xl font-bold text-gray-900 hover:text-blue-600">{activeItem.bill.title}</Link>
                    <div className="mt-1 text-sm text-gray-600">
                      Scheduled {activeItem.duration_minutes === 0 ? new Date(activeItem.scheduled_at).toLocaleDateString() : new Date(activeItem.scheduled_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`rounded px-3 py-1 text-sm font-medium ${activeSession?.status === "open" ? "bg-green-100 text-green-700" : activeSession?.status === "closed" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-700"}`}>
                    {sessionLabel(activeSession)}
                  </span>
                </div>
                <div className="mb-5 overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-sm">
                  <div className="bg-blue-600 p-6 text-white">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Vote className="h-6 w-6" />
                      <h2 className="text-xl font-semibold">Floor Vote</h2>
                    </div>
                    {role === "teacher" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex overflow-hidden rounded-md border border-white/30">
                          <button type="button" onClick={() => void openVote()} disabled={busy || activeSession?.status === "open"} className={`px-3 py-2 text-sm font-medium disabled:opacity-50 ${activeSession?.status === "open" ? "bg-white text-blue-700" : "bg-blue-500 text-white hover:bg-blue-400"}`}>Open</button>
                          <button type="button" onClick={() => void closeVote()} disabled={busy || activeSession?.status !== "open"} className={`border-l border-white/30 px-3 py-2 text-sm font-medium disabled:opacity-50 ${activeSession?.status === "closed" ? "bg-white text-blue-700" : "bg-blue-500 text-white hover:bg-blue-400"}`}>Close</button>
                        </div>
                        <button type="button" onClick={() => void postFloorResults()} disabled={busy} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Post results</button>
                      </div>
                    )}
                  </div>
                  {activeSession?.status === "open" && role !== "teacher" ? (
                    <div className="grid grid-cols-3 gap-4">
                      <button type="button" onClick={() => void castVote("yea")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "yea" ? "bg-green-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Check className="mx-auto mb-2 h-6 w-6" />Yea</button>
                      <button type="button" onClick={() => void castVote("nay")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "nay" ? "bg-red-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><X className="mx-auto mb-2 h-6 w-6" />Nay</button>
                      <button type="button" onClick={() => void castVote("present")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "present" ? "bg-gray-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Minus className="mx-auto mb-2 h-6 w-6" />Present</button>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-blue-100">
                      {activeSession?.status === "closed" ? "This floor vote is closed." : activeSession?.status === "open" ? "Teacher controls are active." : "Vote has not opened yet."}
                    </div>
                  )}
                  {myVote && <div className="mt-4 text-center text-sm">Your vote: <strong>{myVote.toUpperCase()}</strong></div>}
                  </div>
                  <div className="bg-gray-50 p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900">{activeSession?.manual_counts ? "Posted Results" : "Live Results"}</h3>
                      {activeSession?.posted_result && <span className={`rounded px-2 py-1 text-xs font-semibold ${activeSession.posted_result === "passed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>Bill {activeSession.posted_result}</span>}
                    </div>
                    <div className="mb-6 grid grid-cols-4 gap-4">
                      <div className="text-center"><div className="text-3xl font-bold text-green-600">{counts.yea}</div><div className="text-sm text-gray-600">Yea</div></div>
                      <div className="text-center"><div className="text-3xl font-bold text-red-600">{counts.nay}</div><div className="text-sm text-gray-600">Nay</div></div>
                      <div className="text-center"><div className="text-3xl font-bold text-gray-600">{counts.present}</div><div className="text-sm text-gray-600">Present</div></div>
                      <div className="text-center"><div className="text-3xl font-bold text-gray-400">{displayedNotVoted}</div><div className="text-sm text-gray-600">Not Voted</div></div>
                    </div>
                    {role === "teacher" && (
                      <div className="mb-5 rounded-md border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900">Teacher result entry</div>
                          <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                            <button type="button" onClick={() => setResultMode("counts")} className={`px-3 py-1.5 text-sm font-medium ${resultMode === "counts" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Counts</button>
                            <button type="button" onClick={() => setResultMode("decision")} className={`border-l border-gray-300 px-3 py-1.5 text-sm font-medium ${resultMode === "decision" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Pass/fail</button>
                          </div>
                        </div>
                        {resultMode === "counts" ? (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {(["yea", "nay", "present", "not_voted"] as const).map((key) => (
                              <label key={key} className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{key === "not_voted" ? "Not voted" : key}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={manualCounts[key]}
                                  onChange={(event) => setManualCounts((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                            <button type="button" onClick={() => setManualDecision("passed")} className={`px-4 py-2 text-sm font-semibold ${manualDecision === "passed" ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Pass</button>
                            <button type="button" onClick={() => setManualDecision("failed")} className={`border-l border-gray-300 px-4 py-2 text-sm font-semibold ${manualDecision === "failed" ? "bg-red-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Fail</button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-3 rounded-full bg-blue-600" style={{ width: `${displayedEligible ? (totalVoted / displayedEligible) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-2 text-right text-xs text-gray-500">{totalVoted} / {displayedEligible} votes cast</div>
                  </div>
                </div>
                <div className="mb-5 rounded-lg border border-purple-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Motion for the Previous Question</h2>
                      <p className="mt-1 text-sm text-gray-600">A yea vote ends debate and moves toward final consideration.</p>
                    </div>
                    {role === "teacher" && (
                      <button type="button" onClick={() => quickPresentation("previous_question", "Motion for the previous question")} className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100">Show live count</button>
                    )}
                  </div>
                  <div className={`grid gap-3 ${role === "teacher" ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-2"}`}>
                    <button
                      type="button"
                      onClick={() => void castPreviousQuestionVote("yea")}
                      disabled={role === "teacher"}
                      title={previousQuestionVoters("yea")}
                      className={`rounded-md bg-green-50 p-3 text-center transition-colors disabled:cursor-default ${role !== "teacher" ? "hover:bg-green-100" : ""} ${myPreviousQuestionVote === "yea" ? "ring-2 ring-green-500" : ""}`}
                    >
                      <div className="text-2xl font-bold text-green-700">{previousQuestionCounts.yea}</div>
                      <div className="text-xs font-medium text-green-700">Yea</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void castPreviousQuestionVote("nay")}
                      disabled={role === "teacher"}
                      title={previousQuestionVoters("nay")}
                      className={`rounded-md bg-red-50 p-3 text-center transition-colors disabled:cursor-default ${role !== "teacher" ? "hover:bg-red-100" : ""} ${myPreviousQuestionVote === "nay" ? "ring-2 ring-red-500" : ""}`}
                    >
                      <div className="text-2xl font-bold text-red-700">{previousQuestionCounts.nay}</div>
                      <div className="text-xs font-medium text-red-700">Nay</div>
                    </button>
                    {role === "teacher" ? (
                      <button type="button" onClick={() => quickPresentation("recess", "Previous question ordered")} className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Push through</button>
                    ) : null}
                  </div>
                </div>
                <div className="prose max-w-none rounded-md border border-gray-200 bg-white p-5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeItem.bill.legislative_text || "<p><em>No legislative text</em></p>") }} />
              </div>
            </div>

            <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Next bills</h2>
              <div className="space-y-4 border-l border-gray-200 pl-4">
                {nextItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No additional bills queued.</div>
                ) : (
                  nextItems.map((item) => (
                    <Link key={item.id} to={`/bills/${item.bill_id}`} className="block rounded-md p-2 hover:bg-gray-50">
                      <div className="text-xs text-gray-500">{item.duration_minutes === 0 ? new Date(item.scheduled_at).toLocaleDateString() : new Date(item.scheduled_at).toLocaleString()}</div>
                      <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                      <div className="line-clamp-2 text-sm text-gray-700">{item.bill.title}</div>
                    </Link>
                  ))
                )}
              </div>
            </aside>
          </div>
        ) : null}
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
