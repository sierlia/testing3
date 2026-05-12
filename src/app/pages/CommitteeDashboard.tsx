import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { CollapsibleText } from "../components/CollapsibleText";
import { supabase } from "../utils/supabase";
import { GraduationCap, LogOut, MoreHorizontal, Users, Send, Pencil, Save, X, UserPlus, Trash2, UserX } from "lucide-react";
import { ReactionEmoji, ReactionsSummary, ReactionsBar, addReactionToSummary, removeReactionFromSummary } from "../components/ReactionsBar";
import { ThreadedComments, ThreadComment } from "../components/ThreadedComments";
import { SecureAvatar } from "../components/SecureAvatar";
import { formatConstituency } from "../utils/constituency";
import { CommitteeTabs, committeeNameStorageKey, markCommitteeSeenIds } from "../components/CommitteeTabs";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { SubcommitteeRolesPanel } from "../components/SubcommitteeRolesPanel";
import { OrganizationLettersInbox } from "../components/OrganizationLettersInbox";
import { ContributionButton } from "../components/ContributionButton";
import { TeacherAddMembersPopover, MemberCandidate } from "../components/TeacherAddMembersPopover";
import { profilePath } from "../utils/profileRoute";
import { committeeDisplayName } from "../utils/committeeNames";
import { AttachmentList, AttachmentPicker, DiscussionAttachment, parseDiscussionAttachments } from "../components/DiscussionAttachments";

type MembershipRole = "member" | "chair" | "co_chair" | "ranking_member";
type Subcommittee = { id: string; committee_id: string; class_id: string; name: string; description: string | null; created_at: string };
type ProfileLite = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null; role?: string | null; organization_role?: MembershipRole | null };

type Announcement = { id: string; committee_id: string; author_user_id: string; title: string; body: string; created_at: string; updated_at?: string | null; attachments?: DiscussionAttachment[]; author?: ProfileLite | null };
type Comment = { id: string; announcement_id: string; author_user_id: string; body: string; created_at: string; updated_at?: string | null; parent_comment_id?: string | null; attachments?: DiscussionAttachment[]; author?: ProfileLite | null };

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function memberDescriptor(profile: ProfileLite | null) {
  const district = formatConstituency(profile?.constituency_name);
  return `Rep.-${partyAbbr(profile?.party)}-${district || "N/A"}`;
}

function memberParty(member: { profile: ProfileLite | null }) {
  return String(member.profile?.party ?? "Independent").trim() || "Independent";
}

function displayAuthorName(author: ProfileLite | null | undefined, fallback = "Unknown") {
  const name = author?.display_name ?? fallback;
  return author?.role === "teacher" ? `${name} (Teacher)` : name;
}

function leadershipLabel(role: MembershipRole) {
  if (role === "chair") return "Chair";
  if (role === "co_chair") return "Co-chair";
  if (role === "ranking_member") return "Ranking member";
  return "";
}

function authorLinkClass(author: ProfileLite | null | undefined) {
  if (author?.role === "teacher") return "text-green-700 hover:underline";
  if (author?.organization_role && author.organization_role !== "member") return "text-purple-700 hover:underline";
  return "text-blue-600 hover:underline";
}

const dashboardCache = new Map<
  string,
  {
    committee: { id: string; class_id: string; name: string; description: string | null; created_at: string } | null;
    members: Array<{ user_id: string; role: MembershipRole; profile: ProfileLite | null }>;
    myRole: MembershipRole | null;
    viewerRole: "teacher" | "student" | null;
    allowSelfJoin: boolean;
    subcommittees: Subcommittee[];
    announcements: Announcement[];
    selectedAnnouncementId: string | null;
    commentsByAnnouncement: Record<string, ThreadComment[]>;
    announcementReactions: Record<string, ReactionsSummary | undefined>;
    commentReactions: Record<string, ReactionsSummary | undefined>;
  }
>();

export function CommitteeDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [meProfile, setMeProfile] = useState<ProfileLite | null>(null);
  const [committee, setCommittee] = useState<{ id: string; class_id: string; name: string; description: string | null; created_at: string } | null>(null);

  const [members, setMembers] = useState<Array<{ user_id: string; role: MembershipRole; profile: ProfileLite | null }>>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"role" | "name" | "party">("role");
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [myRole, setMyRole] = useState<MembershipRole | null>(null);
  const [viewerRole, setViewerRole] = useState<"teacher" | "student" | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [allowSelfJoin, setAllowSelfJoin] = useState(false);
  const [committeeCapacity, setCommitteeCapacity] = useState(0);
  const [moneySettings, setMoneySettings] = useState<any>({});
  const [paidAccess, setPaidAccess] = useState<Set<string>>(new Set());
  const [myLobbyGroupId, setMyLobbyGroupId] = useState<string | null>(null);
  const [subcommittees, setSubcommittees] = useState<Subcommittee[]>([]);
  const [newSubcommitteeName, setNewSubcommitteeName] = useState("");

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newAnnouncementAttachments, setNewAnnouncementAttachments] = useState<DiscussionAttachment[]>([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementBody, setEditingAnnouncementBody] = useState("");
  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, ThreadComment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [newCommentAttachments, setNewCommentAttachments] = useState<DiscussionAttachment[]>([]);

  const [announcementReactions, setAnnouncementReactions] = useState<Record<string, ReactionsSummary | undefined>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionsSummary | undefined>>({});

  const [announcementsSplitPct, setAnnouncementsSplitPct] = useState(40);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);

  const isLeader = myRole === "chair" || myRole === "co_chair" || myRole === "ranking_member";
  const isTeacher = viewerRole === "teacher";
  const canPostAnnouncements = isLeader || isTeacher;
  const canViewDashboard = Boolean(myRole) || isTeacher || paidAccess.has("dashboard");
  const canComment = Boolean(myRole) || isTeacher;
  const canJoinSubcommittees = isTeacher || (Boolean(myRole) && allowSelfJoin);
  const requestedPanel = searchParams.get("tab");
  const activePanel = requestedPanel === "letters" ? requestedPanel : "dashboard";

  const selectedAnnouncement = useMemo(
    () => announcements.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );
  const majorityParty = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members) counts.set(memberParty(member), (counts.get(memberParty(member)) ?? 0) + 1);
    const entries = [...counts.entries()];
    if (!entries.length) return null;
    if (new Set(entries.map(([, count]) => count)).size === 1) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > (sorted[1]?.[1] ?? 0) ? sorted[0][0] : null;
  }, [members]);

  useEffect(() => {
    const load = async () => {
      const cached = dashboardCache.get(committeeId);
      if (cached) {
        setCommittee(cached.committee);
        setAboutDraft(cached.committee?.description ?? "");
        setNameDraft(cached.committee?.name ?? "Committee");
        setMembers(cached.members);
        setMyRole(cached.myRole);
        setViewerRole(cached.viewerRole);
        setAllowSelfJoin(cached.allowSelfJoin);
        setSubcommittees(cached.subcommittees);
        setAnnouncements(cached.announcements);
        setSelectedAnnouncementId((prev) => prev ?? cached.selectedAnnouncementId);
        setCommentsByAnnouncement(cached.commentsByAnnouncement);
        setAnnouncementReactions(cached.announcementReactions);
        setCommentReactions(cached.commentReactions);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id ?? null;
        setMeId(me);
        if (me) {
          const { data: mp } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("user_id", me)
            .maybeSingle();
          setMeProfile((mp as any) ?? null);
        } else {
          setMeProfile(null);
        }

        const { data: c, error: cErr } = await supabase
          .from("committees")
          .select("id,class_id,name,description,created_at")
          .eq("id", committeeId)
          .single();
        if (cErr) throw cErr;
        setCommittee(c as any);
        window.localStorage.setItem(committeeNameStorageKey(committeeId), (c as any).name ?? "Committee");
        setAboutDraft((c as any).description ?? "");
        setNameDraft((c as any).name ?? "Committee");

        const { data: prof } = await supabase.from("profiles").select("class_id,role").eq("user_id", me ?? "").maybeSingle();
        const classId = (prof as any)?.class_id ?? null;
        setViewerRole(((prof as any)?.role ?? null) as any);
        let nextAllowSelfJoin = false;
        if ((c as any).class_id) {
          const { data: cls } = await supabase.from("classes").select("settings").eq("id", (c as any).class_id).maybeSingle();
          const settings = (cls as any)?.settings ?? {};
          setMoneySettings(settings?.money ?? {});
          nextAllowSelfJoin = !!settings?.committees?.allowSelfJoin || settings?.committees?.assignmentMode === "self-join";
          setCommitteeCapacity(Number(settings?.committees?.capacities?.[committeeId] ?? settings?.committees?.capacitiesByName?.[(c as any).name] ?? 0));
          if ((prof as any)?.role === "teacher" && settings?.committees?.subcommitteesEnabled) {
            const configuredRows = ((settings?.committees?.enabledSubcommittees ?? []) as string[])
              .filter((key) => key.startsWith(`${(c as any).name}::`))
              .map((key) => ({
                committee_id: committeeId,
                class_id: (c as any).class_id,
                name: key.split("::").slice(1).join("::"),
                description: "",
              }));
            if (configuredRows.length) await supabase.from("subcommittees").upsert(configuredRows as any, { onConflict: "committee_id,name" });
          }
        }
        setAllowSelfJoin(nextAllowSelfJoin);
        const { data: subRows } = await supabase
          .from("subcommittees")
          .select("id,committee_id,class_id,name,description,created_at")
          .eq("committee_id", committeeId)
          .order("created_at", { ascending: true });
        setSubcommittees((subRows ?? []) as Subcommittee[]);

        const { data: mRows, error: mErr } = await supabase
          .from("committee_members")
          .select("user_id,role")
          .eq("committee_id", committeeId);
        if (mErr) throw mErr;

        const memberIds = [...new Set((mRows ?? []).map((m: any) => m.user_id))];
        const { data: pRows } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
        const pMap = new Map((pRows ?? []).map((p: any) => [p.user_id, p]));

        const nextMembers = (mRows ?? []).map((m: any) => ({
            user_id: m.user_id,
            role: m.role as MembershipRole,
            profile: pMap.get(m.user_id) ? ({ ...(pMap.get(m.user_id) as ProfileLite), organization_role: m.role as MembershipRole }) : null,
          }));
        const memberRoleMap = new Map(nextMembers.map((member) => [member.user_id, member.role]));
        setMembers(nextMembers);
        if ((prof as any)?.role === "teacher") {
          const memberIdSet = new Set(memberIds);
          const { data: candidateRows } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("class_id", (c as any).class_id)
            .order("display_name", { ascending: true });
          const candidateUserIds = ((candidateRows ?? []) as any[]).map((row) => row.user_id);
          const { data: lobbyistRows } = await supabase.from("lobbyist_group_members").select("user_id").in("user_id", candidateUserIds.length ? candidateUserIds : ["00000000-0000-0000-0000-000000000000"]);
          const lobbyistUserIds = new Set(((lobbyistRows ?? []) as any[]).map((row) => row.user_id));
          setMemberCandidates(((candidateRows ?? []) as any[]).filter((row) => !memberIdSet.has(row.user_id)).map((row) => ({ user_id: row.user_id, display_name: row.display_name, party: row.party, constituency_name: row.constituency_name, avatar_url: row.avatar_url, role: row.role, disabledReason: lobbyistUserIds.has(row.user_id) ? "Already in a lobbyist group." : null })));
        } else {
          setMemberCandidates([]);
        }
        const nextMyRole = me ? ((mRows ?? []).find((r: any) => r.user_id === me)?.role as any) ?? null : null;
        setMyRole(nextMyRole);
        if (me) {
          const [{ data: accessRows }, { data: lobbyRows }] = await Promise.all([
            supabase.from("committee_paid_access").select("access_type").eq("committee_id", committeeId).eq("user_id", me),
            supabase.from("lobbyist_group_members").select("group_id").eq("user_id", me).limit(1),
          ]);
          setPaidAccess(new Set(((accessRows ?? []) as any[]).map((row) => row.access_type)));
          setMyLobbyGroupId(((lobbyRows ?? []) as any[])[0]?.group_id ?? null);
        }

        const { data: aRows, error: aErr } = await supabase
          .from("committee_announcements")
          .select("id,committee_id,author_user_id,title,body,created_at,updated_at,attachments")
          .eq("committee_id", committeeId)
          .order("created_at", { ascending: false });
        if (aErr) throw aErr;

        const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
        const { data: aAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
        const aAuthorMap = new Map((aAuthors ?? []).map((p: any) => [p.user_id, p]));

        const mappedAnnouncements: Announcement[] = (aRows ?? []).map((a: any) => ({
          ...(a as any),
          attachments: parseDiscussionAttachments(a.attachments),
          author: aAuthorMap.get(a.author_user_id)
            ? ({ ...(aAuthorMap.get(a.author_user_id) as ProfileLite), organization_role: memberRoleMap.get(a.author_user_id) ?? null })
            : null,
        }));
        setAnnouncements(mappedAnnouncements);
        const requestedAnnouncement = searchParams.get("announcement");
        setSelectedAnnouncementId(
          requestedAnnouncement && mappedAnnouncements.some((a) => a.id === requestedAnnouncement)
            ? requestedAnnouncement
            : mappedAnnouncements[0]?.id ?? null,
        );

        const announcementIds = mappedAnnouncements.map((a) => a.id);
        if (announcementIds.length) {
          const { data: cRows, error: ccErr } = await supabase
            .from("committee_comments")
            .select("id,announcement_id,author_user_id,body,created_at,updated_at,parent_comment_id,attachments")
            .in("announcement_id", announcementIds)
            .order("created_at", { ascending: true });
          if (ccErr) throw ccErr;

          const commentAuthorIds = [...new Set((cRows ?? []).map((r: any) => r.author_user_id))];
          const { data: cAuthors } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
          const cAuthorMap = new Map((cAuthors ?? []).map((p: any) => [p.user_id, p]));

          const grouped: Record<string, ThreadComment[]> = {};
          for (const row of cRows ?? []) {
            const author = cAuthorMap.get((row as any).author_user_id) as ProfileLite | undefined;
            const comment: ThreadComment = {
              ...(row as any),
              attachments: parseDiscussionAttachments((row as any).attachments),
              author: author ? ({ ...author, organization_role: memberRoleMap.get((row as any).author_user_id) ?? null } as any) : null,
            };
            grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
          }
          setCommentsByAnnouncement(grouped);

          const { data: arRows, error: arErr } = await supabase
            .from("committee_announcement_reactions")
            .select("announcement_id,user_id,emoji")
            .in("announcement_id", announcementIds);
          if (arErr) throw arErr;

          const announcementReactionUserIds = [...new Set((arRows ?? []).map((r: any) => r.user_id as string))];
          const { data: announcementReactionProfiles } = await supabase
            .from("profiles")
            .select("user_id,display_name")
            .in("user_id", announcementReactionUserIds.length ? announcementReactionUserIds : ["00000000-0000-0000-0000-000000000000"]);
          const announcementReactionNames = new Map((announcementReactionProfiles ?? []).map((p: any) => [p.user_id, p.display_name ?? "Member"]));
          const announcementSummary: Record<string, ReactionsSummary> = {};
          const seenAnnouncementReactions = new Set<string>();
          for (const r of arRows ?? []) {
            const id = (r as any).announcement_id as string;
            const emoji = (r as any).emoji as ReactionEmoji;
            const uid = (r as any).user_id as string;
            const key = `${id}:${uid}:${emoji}`;
            if (seenAnnouncementReactions.has(key)) continue;
            seenAnnouncementReactions.add(key);
            announcementSummary[id] = addReactionToSummary(announcementSummary[id], emoji, uid, uid === me ? "You" : announcementReactionNames.get(uid) ?? "Member", me);
          }
          setAnnouncementReactions(announcementSummary);

          const commentIds = (cRows ?? []).map((r: any) => r.id);
          let commentSummary: Record<string, ReactionsSummary> = {};
          if (commentIds.length) {
            const { data: crRows, error: crErr } = await supabase
              .from("committee_comment_reactions")
              .select("comment_id,user_id,emoji")
              .in("comment_id", commentIds);
            if (crErr) throw crErr;
            const commentReactionUserIds = [...new Set((crRows ?? []).map((r: any) => r.user_id as string))];
            const { data: commentReactionProfiles } = await supabase
              .from("profiles")
              .select("user_id,display_name")
              .in("user_id", commentReactionUserIds.length ? commentReactionUserIds : ["00000000-0000-0000-0000-000000000000"]);
            const commentReactionNames = new Map((commentReactionProfiles ?? []).map((p: any) => [p.user_id, p.display_name ?? "Member"]));
            const seenCommentReactions = new Set<string>();
            for (const r of crRows ?? []) {
              const id = (r as any).comment_id as string;
              const emoji = (r as any).emoji as ReactionEmoji;
              const uid = (r as any).user_id as string;
              const key = `${id}:${uid}:${emoji}`;
              if (seenCommentReactions.has(key)) continue;
              seenCommentReactions.add(key);
              commentSummary[id] = addReactionToSummary(commentSummary[id], emoji, uid, uid === me ? "You" : commentReactionNames.get(uid) ?? "Member", me);
            }
            setCommentReactions(commentSummary);
          }
          dashboardCache.set(committeeId, {
            committee: c as any,
            members: nextMembers,
            myRole: nextMyRole,
            viewerRole: ((prof as any)?.role ?? null) as any,
            allowSelfJoin: nextAllowSelfJoin,
            subcommittees: (subRows ?? []) as Subcommittee[],
            announcements: mappedAnnouncements,
            selectedAnnouncementId:
              requestedAnnouncement && mappedAnnouncements.some((a) => a.id === requestedAnnouncement)
                ? requestedAnnouncement
                : mappedAnnouncements[0]?.id ?? null,
            commentsByAnnouncement: grouped,
            announcementReactions: announcementSummary,
            commentReactions: commentSummary,
          });
        } else {
          dashboardCache.set(committeeId, {
            committee: c as any,
            members: nextMembers,
            myRole: nextMyRole,
            viewerRole: ((prof as any)?.role ?? null) as any,
            allowSelfJoin: nextAllowSelfJoin,
            subcommittees: (subRows ?? []) as Subcommittee[],
            announcements: mappedAnnouncements,
            selectedAnnouncementId:
              requestedAnnouncement && mappedAnnouncements.some((a) => a.id === requestedAnnouncement)
                ? requestedAnnouncement
                : mappedAnnouncements[0]?.id ?? null,
            commentsByAnnouncement: {},
            announcementReactions: {},
            commentReactions: {},
          });
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load committee");
      } finally {
        setLoading(false);
      }
    };

    if (!committeeId) return;
    void load();
  }, [committeeId, searchParams]);

  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (e: MouseEvent) => {
      const container = document.getElementById("committee-announcement-board-split");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setAnnouncementsSplitPct(Math.min(70, Math.max(25, pct)));
    };
    const onUp = () => setDraggingSplit(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingSplit]);

  useEffect(() => {
    if (!memberMenuOpen) return;
    const close = () => setMemberMenuOpen(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [memberMenuOpen]);

  useEffect(() => {
    if (!committeeId) return;

    const channel = supabase
      .channel(`committee:${committeeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "committee_announcements", filter: `committee_id=eq.${committeeId}` },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("user_id", row.author_user_id)
            .maybeSingle();
          setAnnouncements((prev) => [{ ...(row as any), author: (author as any) ?? null }, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "committee_comments" },
        async (payload) => {
          const row = payload.new as any;
          const { data: author } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("user_id", row.author_user_id)
            .maybeSingle();
          const comment: ThreadComment = { ...(row as any), author: (author as any) ?? null };
          setCommentsByAnnouncement((prev) => ({
            ...prev,
            [comment.announcement_id]: (prev[comment.announcement_id] ?? []).some((c) => c.id === comment.id)
              ? (prev[comment.announcement_id] ?? [])
              : [...(prev[comment.announcement_id] ?? []), comment],
          }));

          // notifications are handled server-side
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "committee_announcement_reactions", filter: `committee_id=eq.${committeeId}` },
        (payload) => {
          const row = payload.new as any;
          const announcementId = row.announcement_id as string;
          const emoji = row.emoji as ReactionEmoji;
          const uid = row.user_id as string;
          if (uid === meId) return;
          setAnnouncementReactions((prev) => {
            return { ...prev, [announcementId]: addReactionToSummary(prev[announcementId], emoji, uid, "Member", meId) };
          });

          // notifications are handled server-side
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "committee_announcement_reactions", filter: `committee_id=eq.${committeeId}` },
        (payload) => {
          const row = payload.old as any;
          const announcementId = row.announcement_id as string;
          const emoji = row.emoji as ReactionEmoji;
          const uid = row.user_id as string;
          if (uid === meId) return;
          setAnnouncementReactions((prev) => {
            return {
              ...prev,
              [announcementId]: removeReactionFromSummary(prev[announcementId], emoji, uid, meId),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "committee_comment_reactions" },
        (payload) => {
          const row = payload.new as any;
          const commentId = row.comment_id as string;
          const emoji = row.emoji as ReactionEmoji;
          const uid = row.user_id as string;
          if (uid === meId) return;
          setCommentReactions((prev) => {
            return { ...prev, [commentId]: addReactionToSummary(prev[commentId], emoji, uid, "Member", meId) };
          });

          // notifications are handled server-side
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "committee_comment_reactions" },
        (payload) => {
          const row = payload.old as any;
          const commentId = row.comment_id as string;
          const emoji = row.emoji as ReactionEmoji;
          const uid = row.user_id as string;
          if (uid === meId) return;
          setCommentReactions((prev) => {
            return { ...prev, [commentId]: removeReactionFromSummary(prev[commentId], emoji, uid, meId) };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [committeeId, meId]);

  const saveAbout = async () => {
    if (!committee) return;
    try {
      const { error } = await supabase.from("committees").update({ description: aboutDraft }).eq("id", committee.id);
      if (error) throw error;
      setCommittee({ ...committee, description: aboutDraft });
      setEditingAbout(false);
      toast.success("Updated committee description");
    } catch (e: any) {
      toast.error(e.message || "Could not update description");
    }
  };

  const saveName = async () => {
    if (!committee || !nameDraft.trim()) return;
    try {
      const { error } = await supabase.from("committees").update({ name: nameDraft.trim() } as any).eq("id", committeeId);
      if (error) throw error;
      setCommittee({ ...committee, name: nameDraft.trim() });
      setEditingName(false);
      toast.success("Committee renamed");
    } catch (e: any) {
      toast.error(e.message || "Could not rename committee");
    }
  };

  const addSubcommittee = async () => {
    if (!committee || !newSubcommitteeName.trim()) return;
    const { data, error } = await supabase
      .from("subcommittees")
      .insert({
        committee_id: committee.id,
        class_id: committee.class_id,
        name: newSubcommitteeName.trim(),
        description: "",
      } as any)
      .select("id,committee_id,class_id,name,description,created_at")
      .single();
    if (error) return toast.error(error.message || "Could not create subcommittee");
    const next = [...subcommittees, data as Subcommittee];
    setSubcommittees(next);
    setNewSubcommitteeName("");
    const cached = dashboardCache.get(committeeId);
    if (cached) dashboardCache.set(committeeId, { ...cached, subcommittees: next });
  };

  const deleteSubcommittee = async (subcommitteeId: string) => {
    const { error } = await supabase.from("subcommittees").delete().eq("id", subcommitteeId);
    if (error) return toast.error(error.message || "Could not delete subcommittee");
    const next = subcommittees.filter((item) => item.id !== subcommitteeId);
    setSubcommittees(next);
    const cached = dashboardCache.get(committeeId);
    if (cached) dashboardCache.set(committeeId, { ...cached, subcommittees: next });
  };

  const postAnnouncement = async () => {
    if (!meId) return;
    if (!newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("committee_announcements").insert({
        committee_id: committeeId,
        author_user_id: meId,
        title: "",
        body: newAnnouncement.trim(),
        attachments: newAnnouncementAttachments,
      });
      if (error) throw error;
      setNewAnnouncement("");
      setNewAnnouncementAttachments([]);
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const submitComment = async (body: string, parentCommentId: string | null, attachments: DiscussionAttachment[] = []) => {
    if (!meId) return;
    if (!selectedAnnouncementId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      const { data: inserted, error } = await supabase
        .from("committee_comments")
        .insert({
          announcement_id: selectedAnnouncementId,
          author_user_id: meId,
          body: trimmed,
          parent_comment_id: parentCommentId,
          attachments,
        })
        .select("id,announcement_id,author_user_id,body,created_at,updated_at,parent_comment_id,attachments")
        .single();
      if (error) throw error;

      const comment: ThreadComment = { ...(inserted as any), attachments: parseDiscussionAttachments((inserted as any).attachments), author: (meProfile as any) ?? null };
      setCommentsByAnnouncement((prev) => {
        const cur = prev[comment.announcement_id] ?? [];
        if (cur.some((c) => c.id === comment.id)) return prev;
        return { ...prev, [comment.announcement_id]: [...cur, comment] };
      });
      if (!parentCommentId) {
        setNewComment("");
        setNewCommentAttachments([]);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    }
  };

  const postComment = async () => submitComment(newComment, null, newCommentAttachments);

  const editAnnouncement = async () => {
    if (!selectedAnnouncement || !editingAnnouncementBody.trim()) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("committee_announcements").update({ body: editingAnnouncementBody.trim(), updated_at: updatedAt } as any).eq("id", selectedAnnouncement.id);
    if (error) return toast.error(error.message || "Could not edit announcement");
    setAnnouncements((prev) => prev.map((announcement) => announcement.id === selectedAnnouncement.id ? { ...announcement, body: editingAnnouncementBody.trim(), updated_at: updatedAt } : announcement));
    setEditingAnnouncementId(null);
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!isTeacher) return;
    setConfirmDialog({
      title: "Delete announcement?",
      message: "This announcement and its comments will be removed for everyone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => deleteAnnouncementConfirmed(announcementId),
    });
  };

  const deleteAnnouncementConfirmed = async (announcementId: string) => {
    try {
      const { error } = await supabase.from("committee_announcements").delete().eq("id", announcementId);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== announcementId));
      setCommentsByAnnouncement((prev) => {
        const next = { ...prev };
        delete next[announcementId];
        return next;
      });
      setSelectedAnnouncementId((prev) => (prev === announcementId ? announcements.find((announcement) => announcement.id !== announcementId)?.id ?? null : prev));
      toast.success("Announcement deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete announcement");
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!isTeacher || !selectedAnnouncementId) return;
    setConfirmDialog({
      title: "Delete comment?",
      message: "This comment will be removed for everyone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => deleteCommentConfirmed(commentId),
    });
  };

  const deleteCommentConfirmed = async (commentId: string) => {
    if (!selectedAnnouncementId) return;
    try {
      const { error } = await supabase.from("committee_comments").delete().eq("id", commentId);
      if (error) throw error;
      setCommentsByAnnouncement((prev) => ({
        ...prev,
        [selectedAnnouncementId]: (prev[selectedAnnouncementId] ?? []).filter((comment) => comment.id !== commentId && comment.parent_comment_id !== commentId),
      }));
      toast.success("Comment deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete comment");
    }
  };

  const editComment = async (commentId: string, body: string) => {
    if (!selectedAnnouncementId || !body.trim()) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("committee_comments").update({ body: body.trim(), updated_at: updatedAt } as any).eq("id", commentId);
    if (error) return toast.error(error.message || "Could not edit comment");
    setCommentsByAnnouncement((prev) => ({
      ...prev,
      [selectedAnnouncementId]: (prev[selectedAnnouncementId] ?? []).map((comment) => comment.id === commentId ? { ...comment, body: body.trim(), updated_at: updatedAt } : comment),
    }));
  };

  const toggleAnnouncementReaction = async (announcementId: string, emoji: ReactionEmoji) => {
    if (!meId || !canComment) return;
    const mine = announcementReactions[announcementId]?.mine?.has(emoji) ?? false;
    setAnnouncementReactions((prev) => {
      return {
        ...prev,
        [announcementId]: mine
          ? removeReactionFromSummary(prev[announcementId], emoji, meId, meId)
          : addReactionToSummary(prev[announcementId], emoji, meId, "You", meId),
      };
    });
    try {
      if (mine) {
        const { error } = await supabase
          .from("committee_announcement_reactions")
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        await supabase
          .from("committee_announcement_reactions")
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        const { error } = await supabase.from("committee_announcement_reactions").insert({
          committee_id: committeeId,
          announcement_id: announcementId,
          user_id: meId,
          emoji,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setAnnouncementReactions((prev) => {
        return {
          ...prev,
          [announcementId]: mine
            ? addReactionToSummary(prev[announcementId], emoji, meId, "You", meId)
            : removeReactionFromSummary(prev[announcementId], emoji, meId, meId),
        };
      });
      toast.error(e.message || "Could not react");
    }
  };

  const toggleCommentReaction = async (commentId: string, emoji: ReactionEmoji) => {
    if (!meId || !canComment) return;
    const mine = commentReactions[commentId]?.mine?.has(emoji) ?? false;
    setCommentReactions((prev) => {
      return {
        ...prev,
        [commentId]: mine
          ? removeReactionFromSummary(prev[commentId], emoji, meId, meId)
          : addReactionToSummary(prev[commentId], emoji, meId, "You", meId),
      };
    });
    try {
      if (mine) {
        const { error } = await supabase
          .from("committee_comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        await supabase
          .from("committee_comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        const { error } = await supabase.from("committee_comment_reactions").insert({
          comment_id: commentId,
          user_id: meId,
          emoji,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setCommentReactions((prev) => {
        return {
          ...prev,
          [commentId]: mine
            ? addReactionToSummary(prev[commentId], emoji, meId, "You", meId)
            : removeReactionFromSummary(prev[commentId], emoji, meId, meId),
        };
      });
      toast.error(e.message || "Could not react");
    }
  };

  const join = async () => {
    if (!meId) return;
    if (!allowSelfJoin) return;
    if (committeeCapacity > 0 && members.length >= committeeCapacity) {
      toast.error("This committee is full");
      return;
    }
    const { data: lobbyMembership } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", meId).limit(1);
    if ((lobbyMembership ?? []).length) {
      toast.error("Lobbyist group members cannot join committees");
      return;
    }
    setJoining(true);
    try {
      const { error } = await supabase
        .from("committee_members")
        .upsert({ committee_id: committeeId, user_id: meId, role: "member" } as any, { onConflict: "committee_id,user_id" });
      if (error) throw error;
      setMyRole("member");
      setMembers((prev) => (prev.some((m) => m.user_id === meId) ? prev : [...prev, { user_id: meId, role: "member", profile: meProfile }]));
      const cached = dashboardCache.get(committeeId);
      if (cached) {
        dashboardCache.set(committeeId, {
          ...cached,
          myRole: "member",
          members: cached.members.some((m) => m.user_id === meId) ? cached.members : [...cached.members, { user_id: meId, role: "member", profile: meProfile }],
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Could not update membership");
    } finally {
      setJoining(false);
    }
  };

  const buyCommitteeAccess = async (accessType: "dashboard" | "review") => {
    if (!meId || !committee) return;
    if (accessType === "review" && !myLobbyGroupId) return;
    const amount = accessType === "dashboard" ? Number(moneySettings?.committeeDashboardAccessPrice ?? 100) : Number(moneySettings?.committeeReviewAccessPrice ?? 250);
    const accessLabel = accessType === "dashboard" ? "Message board" : "Markup area";
    const { error } = await supabase.from("committee_paid_access").insert({
      committee_id: committeeId,
      user_id: meId,
      access_type: accessType,
      group_id: myLobbyGroupId,
      amount,
    } as any);
    if (error) return toast.error(error.message || "Could not buy access");
    await supabase.from("lobbyist_contributions").insert({
      class_id: committee.class_id,
      group_id: myLobbyGroupId,
      from_user_id: meId,
      recipient_type: "committee",
      recipient_id: committeeId,
      amount,
      note: `${accessLabel} access`,
    } as any);
    setPaidAccess((current) => new Set(current).add(accessType));
    toast.success("Access granted");
  };

  const leave = async () => {
    if (!meId || !myRole) return;
    setConfirmDialog({
      title: "Leave committee?",
      message: `You will lose access to member-only areas of ${committee?.name ?? "this committee"}.`,
      confirmLabel: "Leave",
      danger: true,
      onConfirm: leaveConfirmed,
    });
  };

  const leaveConfirmed = async () => {
    if (!meId || !myRole) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("committee_members")
        .delete()
        .eq("committee_id", committeeId)
        .eq("user_id", meId);
      if (error) throw error;
      setMyRole(null);
      setMembers((prev) => prev.filter((member) => member.user_id !== meId));
      const cached = dashboardCache.get(committeeId);
      if (cached) {
        dashboardCache.set(committeeId, {
          ...cached,
          myRole: null,
          members: cached.members.filter((member) => member.user_id !== meId),
        });
      }
      toast.success("Left committee");
      navigate("/committees");
    } catch (e: any) {
      toast.error(e.message || "Could not leave committee");
    } finally {
      setLeaving(false);
    }
  };

  const requestRoleChange = (member: { user_id: string; role: MembershipRole; profile: ProfileLite | null }, nextRole: MembershipRole) => {
    if (!isTeacher || member.role === nextRole) return;
    if (nextRole === "chair" && majorityParty && memberParty(member) !== majorityParty) {
      toast.error("Committee chairs must be members of the majority party.");
      return;
    }
    if (nextRole === "ranking_member" && majorityParty && memberParty(member) === majorityParty) {
      toast.error("Ranking members must be from a minority party.");
      return;
    }
    const existingHolder = nextRole === "chair" || nextRole === "ranking_member"
      ? members.find((m) => m.role === nextRole && m.user_id !== member.user_id)
      : null;
    setConfirmDialog({
      title: "Change member role?",
      message: `Set ${member.profile?.display_name ?? "this member"} to ${leadershipLabel(nextRole) || "Member"} for ${committee?.name ?? "this committee"}?${existingHolder ? ` ${existingHolder.profile?.display_name ?? "The current role holder"} will be moved back to Member.` : ""}`,
      confirmLabel: "Change role",
      onConfirm: () => updateMemberRole(member.user_id, nextRole),
    });
  };

  const updateMemberRole = async (userId: string, nextRole: MembershipRole) => {
    if (nextRole === "chair" || nextRole === "ranking_member") {
      const existingHolder = members.find((member) => member.role === nextRole && member.user_id !== userId);
      if (existingHolder) {
        const { error: demoteError } = await supabase.from("committee_members").update({ role: "member" } as any).eq("committee_id", committeeId).eq("user_id", existingHolder.user_id);
        if (demoteError) return toast.error(demoteError.message || "Could not update role");
      }
    }
    const { error } = await supabase.from("committee_members").update({ role: nextRole } as any).eq("committee_id", committeeId).eq("user_id", userId);
    if (error) return toast.error(error.message || "Could not update role");
    setMembers((prev) => prev.map((member) => (member.user_id === userId ? { ...member, role: nextRole } : (nextRole === "chair" || nextRole === "ranking_member") && member.role === nextRole ? { ...member, role: "member" } : member)));
    const cached = dashboardCache.get(committeeId);
    if (cached) {
      dashboardCache.set(committeeId, {
        ...cached,
        members: cached.members.map((member) => (member.user_id === userId ? { ...member, role: nextRole } : (nextRole === "chair" || nextRole === "ranking_member") && member.role === nextRole ? { ...member, role: "member" } : member)),
      });
    }
    setMemberMenuOpen(null);
    toast.success("Role updated");
  };

  const requestRemoveMember = (member: { user_id: string; role: MembershipRole; profile: ProfileLite | null }) => {
    if (!isTeacher) return;
    setConfirmDialog({
      title: "Remove committee member?",
      message: `Remove ${member.profile?.display_name ?? "this member"} from ${committee?.name ?? "this committee"}? They will lose access to member-only committee areas.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => removeMember(member.user_id),
    });
  };

  const removeMember = async (userId: string) => {
    const removed = members.find((member) => member.user_id === userId);
    const { error } = await supabase.from("committee_members").delete().eq("committee_id", committeeId).eq("user_id", userId);
    if (error) return toast.error(error.message || "Could not remove member");
    setMembers((prev) => prev.filter((member) => member.user_id !== userId));
    if (removed?.profile) {
      setMemberCandidates((prev) => [...prev, { user_id: userId, display_name: removed.profile?.display_name ?? "Member", party: removed.profile?.party, constituency_name: removed.profile?.constituency_name, avatar_url: removed.profile?.avatar_url, role: removed.profile?.role ?? "student" }]);
    }
    if (userId === meId) setMyRole(null);
    const cached = dashboardCache.get(committeeId);
    if (cached) {
      dashboardCache.set(committeeId, {
        ...cached,
        myRole: userId === meId ? null : cached.myRole,
        members: cached.members.filter((member) => member.user_id !== userId),
      });
    }
    toast.success("Member removed");
  };

  const addMemberToCommittee = async (candidate: MemberCandidate) => {
    if (!isTeacher) return;
    const { error } = await supabase
      .from("committee_members")
      .upsert({ committee_id: committeeId, user_id: candidate.user_id, role: "member" } as any, { onConflict: "committee_id,user_id" });
    if (error) return toast.error(error.message || "Could not add member");
    const profile: ProfileLite = {
      user_id: candidate.user_id,
      display_name: candidate.display_name,
      party: candidate.party ?? null,
      constituency_name: candidate.constituency_name ?? null,
      avatar_url: candidate.avatar_url ?? null,
      role: candidate.role ?? null,
      organization_role: "member",
    };
    setMembers((prev) => (prev.some((member) => member.user_id === candidate.user_id) ? prev : [...prev, { user_id: candidate.user_id, role: "member", profile }]));
    setMemberCandidates((prev) => prev.filter((row) => row.user_id !== candidate.user_id));
    const cached = dashboardCache.get(committeeId);
    if (cached && !cached.members.some((member) => member.user_id === candidate.user_id)) {
      dashboardCache.set(committeeId, {
        ...cached,
        members: [...cached.members, { user_id: candidate.user_id, role: "member", profile }],
      });
    }
    toast.success("Member added");
  };

  if (loading || !committee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 py-10 text-gray-600">Loading...</main>
      </div>
    );
  }

  const visibleComments = selectedAnnouncementId ? commentsByAnnouncement[selectedAnnouncementId] ?? [] : [];
  const visibleMembers = members
    .filter((m) => {
      const query = memberSearch.toLowerCase().trim();
      if (!query) return true;
      return (
        (m.profile?.display_name ?? "Member").toLowerCase().includes(query) ||
        (m.profile?.party ?? "").toLowerCase().includes(query) ||
        formatConstituency(m.profile?.constituency_name).toLowerCase().includes(query) ||
        m.role.replace("_", " ").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (memberSort === "name") return (a.profile?.display_name ?? "Member").localeCompare(b.profile?.display_name ?? "Member");
      if (memberSort === "party") return (a.profile?.party ?? "").localeCompare(b.profile?.party ?? "");
      const rank = { chair: 0, co_chair: 1, ranking_member: 2, member: 3 } as Record<MembershipRole, number>;
      return rank[a.role] - rank[b.role] || (a.profile?.display_name ?? "").localeCompare(b.profile?.display_name ?? "");
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-3xl font-bold text-gray-900" />
                <button type="button" onClick={() => void saveName()} className="rounded-md p-2 text-blue-600 hover:bg-blue-50"><Save className="h-5 w-5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeDisplayName(committee.name)}</h1>
                {isTeacher && <button type="button" onClick={() => setEditingName(true)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><Pencil className="h-5 w-5" /></button>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ContributionButton recipientType="committee" recipientId={committee.id} recipientName={committee.name} />
            {myRole && viewerRole !== "teacher" && (
              <button
                onClick={() => void leave()}
                disabled={leaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 bg-red-100 text-red-700 hover:bg-red-200"
              >
                <LogOut className="w-4 h-4" />
                {leaving ? "Leaving" : "Leave"}
              </button>
            )}
            {!myRole && allowSelfJoin && viewerRole === "student" && (
              <button
                onClick={() => void join()}
                disabled={joining || (committeeCapacity > 0 && members.length >= committeeCapacity)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                {committeeCapacity > 0 && members.length >= committeeCapacity ? "Full" : joining ? "Joining" : "Join"}
              </button>
            )}
          </div>
        </div>

        <CommitteeTabs committeeId={committeeId} active={activePanel} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            {activePanel === "letters" ? (
              <OrganizationLettersInbox organizationType="committee" organizationId={committeeId} organizationName={committee?.name ?? "committee"} memberIds={members.map((member) => member.user_id)} />
            ) : (
            <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(12rem,16rem)]">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">About</h2>
                  {editingAbout ? (
                    <div className="mt-2 space-y-3">
                      <textarea value={aboutDraft} onChange={(e) => setAboutDraft(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                      <div className="flex items-center gap-2">
                        <button onClick={() => void saveAbout()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingAbout(false);
                            setAboutDraft(committee.description ?? "");
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-700 whitespace-pre-line">{committee.description || "No description yet."}</p>
                  )}
                </div>
                <div className="mt-8 w-4">
                  {(isLeader || isTeacher) && !editingAbout && (
                    <button onClick={() => setEditingAbout(true)} className="text-blue-600 hover:text-blue-700 transition-colors" aria-label="Edit about">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto border-l border-gray-300 pl-3 text-left">
                    <div className="mb-1 text-xs font-semibold text-gray-700">Subcommittees</div>
                    {(isLeader || isTeacher) && (
                      <div className="flex gap-1.5">
                        <input
                          value={newSubcommitteeName}
                          onChange={(event) => setNewSubcommitteeName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void addSubcommittee();
                          }}
                          placeholder="New subcommittee name"
                          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => void addSubcommittee()} disabled={!newSubcommitteeName.trim()} className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                          Add
                        </button>
                      </div>
                    )}
                    {canJoinSubcommittees && subcommittees.length ? (
                      <div className="mt-2">
                        <SubcommitteeRolesPanel committeeId={committeeId} compact embedded allowMemberRoleSelection />
                      </div>
                    ) : subcommittees.length ? (
                      <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 text-xs text-gray-600">
                        {subcommittees.map((subcommittee, index) => (
                          <span key={subcommittee.id} className="inline-flex max-w-full items-center gap-1 break-words">
                            <button type="button" onClick={() => void deleteSubcommittee(subcommittee.id)} disabled={!(isLeader || isTeacher)} className="inline-flex items-center gap-1 text-left disabled:cursor-default">
                              <span className="break-words">{subcommittee.name}</span>
                              {(isLeader || isTeacher) ? <X className="h-3 w-3 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700" /> : null}
                            </button>
                            {index < subcommittees.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-500">N/A</div>
                    )}
                </div>
              </div>
            </div>

            {canViewDashboard ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
              </div>

              {canPostAnnouncements && (
                <div className="p-6 border-b border-gray-200">
                  <div className="rounded-md border border-gray-300 bg-white p-3 focus-within:ring-2 focus-within:ring-blue-500">
                    <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="Post an announcement..." rows={3} className="w-full resize-y border-0 p-0 text-sm outline-none" />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <AttachmentPicker value={newAnnouncementAttachments} onChange={setNewAnnouncementAttachments} />
                    <button onClick={() => void postAnnouncement()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50" disabled={!newAnnouncement.trim()}>
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                    </div>
                  </div>
                </div>
              )}

              <div id="committee-announcement-board-split" className="flex flex-col md:flex-row">
                <div className="border-r border-gray-200 max-h-[520px] overflow-y-auto" style={{ width: `calc(${announcementsSplitPct}% - 4px)` }}>
                  {announcements.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No announcements yet.</div>
                  ) : (
                    announcements.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedAnnouncementId(a.id);
                          const cached = dashboardCache.get(committeeId);
                          if (cached) dashboardCache.set(committeeId, { ...cached, selectedAnnouncementId: a.id });
                          markCommitteeSeenIds(committeeId, "dashboard", [a.id]);
                        }}
                        className={`relative w-full text-left p-4 border-b border-gray-100 bg-white hover:bg-gray-50 ${
                          selectedAnnouncementId === a.id ? `border-l-4 ${a.author?.role === "teacher" ? "border-l-green-500" : "border-l-blue-500"}` : ""
                        }`}
                      >
                        {a.author?.role === "teacher" && <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
                        <div className="text-sm text-gray-900 font-medium line-clamp-2">{a.body}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <Link to={profilePath(a.author_user_id)} className={authorLinkClass(a.author)}>
                            {displayAuthorName(a.author)}
                          </Link>{" "}
                          • {new Date(a.created_at).toLocaleString()}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div
                  className="hidden md:block w-2 cursor-col-resize bg-gray-100 hover:bg-gray-200 active:bg-gray-300"
                  onMouseDown={() => setDraggingSplit(true)}
                  title="Drag to resize"
                />

                <div className="p-4 max-h-[520px] overflow-y-auto flex-1">
                  {selectedAnnouncement ? (
                    <div className="space-y-4">
                      <div className="relative border border-gray-200 rounded-md p-4 bg-white">
                        {selectedAnnouncement.author?.role === "teacher" && <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
                        {editingAnnouncementId === selectedAnnouncement.id ? (
                          <div className="space-y-2">
                            <textarea value={editingAnnouncementBody} onChange={(event) => setEditingAnnouncementBody(event.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => void editAnnouncement()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                              <button type="button" onClick={() => setEditingAnnouncementId(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <CollapsibleText text={selectedAnnouncement.body} limit={500} className="text-sm text-gray-900" />
                            <AttachmentList attachments={selectedAnnouncement.attachments} />
                          </>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          <Link to={profilePath(selectedAnnouncement.author_user_id)} className={authorLinkClass(selectedAnnouncement.author)}>
                            {displayAuthorName(selectedAnnouncement.author)}
                          </Link>{" "}
                          • {new Date(selectedAnnouncement.created_at).toLocaleString()}
                        </div>
                        <div className="mt-3">
                          <ReactionsBar
                            size="md"
                            summary={announcementReactions[selectedAnnouncement.id]}
                            onToggle={(emoji) => toggleAnnouncementReaction(selectedAnnouncement.id, emoji)}
                            canReact={canComment}
                          />
                        </div>
                        {(isTeacher || selectedAnnouncement.author_user_id === meId) && (
                          <div className="mt-3 flex justify-end gap-2">
                            {selectedAnnouncement.author_user_id === meId && editingAnnouncementId !== selectedAnnouncement.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAnnouncementId(selectedAnnouncement.id);
                                  setEditingAnnouncementBody(selectedAnnouncement.body);
                                }}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                              >
                                Edit
                              </button>
                            )}
                            {isTeacher && (
                            <button type="button" onClick={() => void deleteAnnouncement(selectedAnnouncement.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                        <ThreadedComments
                          comments={visibleComments}
                          meId={canComment ? meId : null}
                          reactionsByCommentId={commentReactions}
                          onToggleReaction={(commentId, emoji) => toggleCommentReaction(commentId, emoji)}
                          onSubmitComment={submitComment}
                          canDeleteComments={isTeacher}
                          onDeleteComment={deleteComment}
                          canEditComment={(comment) => comment.author_user_id === meId}
                          onEditComment={editComment}
                        />
                      </div>

                      {canComment && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-start gap-2">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              rows={2}
                              placeholder="Write a comment..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                            <button onClick={() => void postComment()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50" disabled={!newComment.trim()}>
                              Send
                            </button>
                          </div>
                          <div className="mt-2">
                            <AttachmentPicker value={newCommentAttachments} onChange={setNewCommentAttachments} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Select an announcement.</div>
                  )}
                </div>
              </div>
            </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
                <p className="mt-2 text-sm text-gray-600">Announcement boards are channels of communication between members of a committee. Lobbyists and members not in the committee can pay a one-time fee for permanent viewing access to the message board. Lobbyists may also pay a fee to gain viewing access to the committee's markup area, where referred bills are amended and voted on.</p>
                {moneySettings?.enabled && !paidAccess.has("dashboard") && (
                  <button type="button" onClick={() => void buyCommitteeAccess("dashboard")} className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
                    Pay ${Number(moneySettings?.committeeDashboardAccessPrice ?? 100).toLocaleString()} for message board access
                  </button>
                )}
                {myLobbyGroupId && moneySettings?.enabled && !paidAccess.has("review") && (
                  <button type="button" onClick={() => void buyCommitteeAccess("review")} className="ml-2 mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
                    Pay ${Number(moneySettings?.committeeReviewAccessPrice ?? 250).toLocaleString()} for markup area access
                  </button>
                )}
              </div>
            )}
            </>
            )}
          </div>

          <div className="self-start bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Members ({committeeCapacity > 0 ? `${members.length}/${committeeCapacity}` : members.length})</h2>
              </div>
              {isTeacher ? <TeacherAddMembersPopover candidates={memberCandidates} onAdd={addMemberToCommittee} /> : null}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="min-w-0 flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
              <select value={memberSort} onChange={(e) => setMemberSort(e.target.value as any)} className="px-2 py-2 text-sm border border-gray-300 rounded-md">
                <option value="role">Role</option>
                <option value="name">Name</option>
                <option value="party">Party</option>
              </select>
            </div>
            <div className="space-y-3">
              {visibleMembers.map((m) => (
                <div key={m.user_id} className="relative flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                  <SecureAvatar src={m.profile?.avatar_url} alt={m.profile?.display_name ?? "Member"} className="w-10 h-10 rounded-full object-cover" fallbackClassName="w-10 h-10" iconClassName="w-5 h-5 text-gray-500" />
                    <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link to={profilePath(m.user_id)} className={m.profile?.role === "teacher" ? "text-green-700 hover:underline" : m.role !== "member" ? "text-purple-700 hover:underline" : "text-blue-600 hover:underline"}>
                        {m.profile?.display_name ?? "Member"}
                      </Link>
                    </div>
                    {m.profile?.role !== "teacher" && <div className="text-xs text-gray-500 truncate">{memberDescriptor(m.profile)}</div>}
                    {m.role !== "member" && <div className="mt-1 inline-flex rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{leadershipLabel(m.role)}</div>}
                  </div>
                  {isTeacher ? (
                    <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMemberMenuOpen((open) => (open === m.user_id ? null : m.user_id))}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        aria-label="Member actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {memberMenuOpen === m.user_id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Modify position</div>
                          {(["member", "chair", "ranking_member"] as MembershipRole[]).map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                setMemberMenuOpen(null);
                                requestRoleChange(m, role);
                              }}
                              disabled={m.role === role}
                              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              <span>{leadershipLabel(role) || "Member"}</span>
                              {m.role === role && <span className="text-xs">Current</span>}
                            </button>
                          ))}
                          <div className="my-1 border-t border-gray-100" />
                          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other</div>
                          <button
                            type="button"
                            onClick={() => {
                              setMemberMenuOpen(null);
                              requestRemoveMember(m);
                            }}
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <UserX className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {visibleMembers.length === 0 && <div className="text-sm text-gray-500">No members found.</div>}
            </div>
          </div>
        </div>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
