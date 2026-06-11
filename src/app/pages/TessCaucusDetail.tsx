import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { CollapsibleText } from "../components/CollapsibleText";
import { GraduationCap, MoreHorizontal, Save, X, Users as UsersIcon, Send, Pencil, Trash2, LogOut, UserPlus } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { ReactionEmoji, ReactionsSummary, ReactionsBar, addReactionToSummary, removeReactionFromSummary } from "../components/ReactionsBar";
import { ThreadedComments, ThreadComment } from "../components/ThreadedComments";
import { SecureAvatar } from "../components/SecureAvatar";
import { formatConstituency } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { OrganizationLettersInbox } from "../components/OrganizationLettersInbox";
import { ContributionButton } from "../components/ContributionButton";
import { profilePath } from "../utils/profileRoute";
import { getCurrentUser } from "../utils/currentUser";
import { TeacherAddMembersPopover, MemberCandidate } from "../components/TeacherAddMembersPopover";
import { AttachmentList, AttachmentPicker, DiscussionAttachment, parseDiscussionAttachments } from "../components/DiscussionAttachments";
import { VerticalMenuPlacement, verticalMenuPlacementClass, verticalMenuPlacementForButton } from "../utils/menuPlacement";

type MembershipRole = "member" | "chair" | "co_chair" | "ranking_member";

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  party: string | null;
  constituency_name: string | null;
  avatar_url: string | null;
  role?: string | null;
  organization_role?: MembershipRole | null;
};

type Announcement = {
  id: string;
  caucus_id: string;
  author_user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
  attachments?: DiscussionAttachment[];
  author?: ProfileLite | null;
};

type Comment = {
  id: string;
  announcement_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
  parent_comment_id?: string | null;
  attachments?: DiscussionAttachment[];
  author?: ProfileLite | null;
};

function displayAuthorName(author: ProfileLite | null | undefined, fallback = "Unknown") {
  const name = author?.display_name ?? fallback;
  return author?.role === "teacher" ? `${name} (Teacher)` : name;
}

function authorLinkClass(author: ProfileLite | null | undefined) {
  if (author?.role === "teacher") return "text-green-700 hover:underline";
  if (author?.organization_role && author.organization_role !== "member") return "text-purple-700 hover:underline";
  return "text-blue-600 hover:underline";
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

function leadershipLabel(role: MembershipRole) {
  if (role === "chair") return "Chair";
  if (role === "co_chair") return "Co-chair";
  if (role === "ranking_member") return "Ranking member";
  return "Member";
}

export function TessCaucusDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const caucusId = id!;

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [meProfile, setMeProfile] = useState<ProfileLite | null>(null);

  const [caucus, setCaucus] = useState<{ id: string; class_id: string; title: string; description: string; created_at: string } | null>(null);
  const [members, setMembers] = useState<Array<{ user_id: string; role: MembershipRole; profile: ProfileLite | null }>>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"role" | "name" | "party">("role");
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [myRole, setMyRole] = useState<MembershipRole | null>(null);
  const [viewerRole, setViewerRole] = useState<"teacher" | "student" | null>(null);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newAnnouncementAttachments, setNewAnnouncementAttachments] = useState<DiscussionAttachment[]>([]);

  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, ThreadComment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [newCommentAttachments, setNewCommentAttachments] = useState<DiscussionAttachment[]>([]);

  const [announcementReactions, setAnnouncementReactions] = useState<Record<string, ReactionsSummary | undefined>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionsSummary | undefined>>({});

  const [announcementsSplitPct, setAnnouncementsSplitPct] = useState(40);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "letters" | "election">("dashboard");
  const [classSettings, setClassSettings] = useState<any>({});
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [memberMenuPlacement, setMemberMenuPlacement] = useState<VerticalMenuPlacement>("down");

  const isLeader = myRole === "chair" || myRole === "co_chair";
  const isChair = myRole === "chair";
  const isTeacher = viewerRole === "teacher";
  const canPostAnnouncements = isLeader || isTeacher;
  const canComment = Boolean(myRole) || isTeacher;

  const selectedAnnouncement = useMemo(
    () => announcements.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );
  const electionOpen = classSettings?.elections?.caucusOpenById?.[caucusId] ?? Boolean(classSettings?.elections?.open);
  const electionConcluded = Boolean(classSettings?.elections?.caucusConcludedById?.[caucusId]);

  const setCaucusElectionOpen = async (open: boolean) => {
    if (!caucus || !isTeacher || electionConcluded) return;
    const nextSettings = {
      ...classSettings,
      elections: {
        ...(classSettings.elections ?? {}),
        caucusOpenById: { ...(classSettings.elections?.caucusOpenById ?? {}), [caucus.id]: open },
      },
    };
    const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", caucus.class_id);
    if (error) return toast.error(error.message || "Could not update election");
    setClassSettings(nextSettings);
    toast.success(open ? "Caucus election opened" : "Caucus election closed");
  };

  const postCaucusElectionResults = async () => {
    if (!caucus || !isTeacher) return;
    const nextSettings = {
      ...classSettings,
      elections: {
        ...(classSettings.elections ?? {}),
        caucusConcludedById: { ...(classSettings.elections?.caucusConcludedById ?? {}), [caucus.id]: true },
        caucusOpenById: { ...(classSettings.elections?.caucusOpenById ?? {}), [caucus.id]: false },
      },
    };
    const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", caucus.class_id);
    if (error) return toast.error(error.message || "Could not post results");
    setClassSettings(nextSettings);
    toast.success("Election results posted");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const me = (await getCurrentUser())?.id ?? null;
        setMeId(me);
        if (me) {
          const { data: mp } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("user_id", me)
            .maybeSingle();
          setMeProfile((mp as any) ?? null);
          setViewerRole(((mp as any)?.role ?? null) as any);
        } else {
          setMeProfile(null);
          setViewerRole(null);
        }

        const { data: c, error: cErr } = await supabase
          .from("caucuses")
          .select("id,class_id,title,description,created_at")
          .eq("id", caucusId)
          .single();
        if (cErr) throw cErr;
        setCaucus(c);
        setAboutDraft(c.description ?? "");
        setNameDraft(c.title ?? "Caucus");
        const { data: classRow } = await supabase.from("classes").select("settings").eq("id", c.class_id).maybeSingle();
        setClassSettings((classRow as any)?.settings ?? {});

        const { data: mRows, error: mErr } = await supabase
          .from("caucus_members")
          .select("user_id,role")
          .eq("caucus_id", caucusId);
        if (mErr) throw mErr;

        const memberIds = [...new Set((mRows ?? []).map((m: any) => m.user_id))];
        const { data: pRows } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
        const pMap = new Map((pRows ?? []).map((p: any) => [p.user_id, p]));

        const mappedMembers = (mRows ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role as MembershipRole,
          profile: pMap.get(m.user_id) ? ({ ...(pMap.get(m.user_id) as ProfileLite), organization_role: m.role as MembershipRole }) : null,
        }));
        const memberRoleMap = new Map(mappedMembers.map((member) => [member.user_id, member.role]));
        setMembers(mappedMembers);
        const viewerIsTeacher = me ? (await supabase.from("profiles").select("role").eq("user_id", me).maybeSingle()).data?.role === "teacher" : false;
        if (viewerIsTeacher) {
          const memberIdSet = new Set(memberIds);
          const { data: candidateRows } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url,role")
            .eq("class_id", c.class_id)
            .order("display_name", { ascending: true });
          const candidateUserIds = ((candidateRows ?? []) as any[]).map((row) => row.user_id);
          const { data: lobbyistRows } = await supabase.from("lobbyist_group_members").select("user_id").in("user_id", candidateUserIds.length ? candidateUserIds : ["00000000-0000-0000-0000-000000000000"]);
          const lobbyistUserIds = new Set(((lobbyistRows ?? []) as any[]).map((row) => row.user_id));
          setMemberCandidates(((candidateRows ?? []) as any[]).filter((row) => !memberIdSet.has(row.user_id)).map((row) => ({
            user_id: row.user_id,
            display_name: row.display_name,
            party: row.party,
            constituency_name: row.constituency_name,
            avatar_url: row.avatar_url,
            role: row.role,
            membershipNote: row.party ? `Party: ${row.party}` : null,
            disabledReason: lobbyistUserIds.has(row.user_id) ? "Already in a lobbyist group." : null,
          })));
        } else {
          setMemberCandidates([]);
        }
        setMyRole(me ? ((mRows ?? []).find((r: any) => r.user_id === me)?.role as any) ?? null : null);

        const { data: aRows, error: aErr } = await supabase
          .from("caucus_announcements")
          .select("id,caucus_id,author_user_id,title,body,created_at,updated_at,attachments")
          .eq("caucus_id", caucusId)
          .order("created_at", { ascending: false });
        if (aErr) throw aErr;

        const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
        const { data: aAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
        const aAuthorMap = new Map((aAuthors ?? []).map((p: any) => [p.user_id, p]));

        const mappedAnnouncements: Announcement[] = (aRows ?? []).map((a: any) => ({
          ...a,
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

        // Load comments for announcements (initial)
        const announcementIds = mappedAnnouncements.map((a) => a.id);
        if (announcementIds.length) {
          const { data: cRows, error: ccErr } = await supabase
            .from("caucus_comments")
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
            .from("caucus_announcement_reactions")
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
          if (commentIds.length) {
            const { data: crRows, error: crErr } = await supabase
              .from("caucus_comment_reactions")
              .select("comment_id,user_id,emoji")
              .in("comment_id", commentIds);
            if (crErr) throw crErr;
            const commentReactionUserIds = [...new Set((crRows ?? []).map((r: any) => r.user_id as string))];
            const { data: commentReactionProfiles } = await supabase
              .from("profiles")
              .select("user_id,display_name")
              .in("user_id", commentReactionUserIds.length ? commentReactionUserIds : ["00000000-0000-0000-0000-000000000000"]);
            const commentReactionNames = new Map((commentReactionProfiles ?? []).map((p: any) => [p.user_id, p.display_name ?? "Member"]));
            const commentSummary: Record<string, ReactionsSummary> = {};
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
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load caucus");
      } finally {
        setLoading(false);
      }
    };

    if (!caucusId) return;
    void load();
  }, [caucusId, searchParams]);

  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (e: MouseEvent) => {
      const container = document.getElementById("announcement-board-split");
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
    if (!caucusId) return;

    const channel = supabase
      .channel(`caucus:${caucusId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "caucus_announcements", filter: `caucus_id=eq.${caucusId}` },
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
        { event: "INSERT", schema: "public", table: "caucus_comments" },
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
        { event: "INSERT", schema: "public", table: "caucus_announcement_reactions", filter: `caucus_id=eq.${caucusId}` },
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
        { event: "DELETE", schema: "public", table: "caucus_announcement_reactions", filter: `caucus_id=eq.${caucusId}` },
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
        { event: "INSERT", schema: "public", table: "caucus_comment_reactions" },
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
        { event: "DELETE", schema: "public", table: "caucus_comment_reactions" },
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
  }, [caucusId, meId]);

  useEffect(() => {
    if (!memberMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-caucus-member-menu]")) return;
      setMemberMenuOpen(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [memberMenuOpen]);

  const joinLeave = async () => {
    if (!meId) return;
    if (myRole) {
      setConfirmDialog({
        title: "Leave caucus?",
        message: `Leave ${caucus?.title ?? "this caucus"}?`,
        confirmLabel: "Leave",
        danger: true,
        onConfirm: updateCaucusMembership,
      });
      return;
    }
    await updateCaucusMembership();
  };

  const updateCaucusMembership = async () => {
    if (!meId) return;
    try {
      if (myRole) {
        const { error } = await supabase.from("caucus_members").delete().eq("caucus_id", caucusId).eq("user_id", meId);
        if (error) throw error;
        setMyRole(null);
        setMembers((prev) => prev.filter((m) => m.user_id !== meId));
      } else {
        const { data: lobbyMembership } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", meId).limit(1);
        if ((lobbyMembership ?? []).length) {
          toast.error("Lobbyist group members cannot join caucuses");
          return;
        }
        const { error } = await supabase.from("caucus_members").insert({ caucus_id: caucusId, user_id: meId, role: "member" });
        if (error) throw error;
        setMyRole("member");
        setMembers((prev) => [...prev, { user_id: meId, role: "member", profile: null }]);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not update membership");
    }
  };

  const saveAbout = async () => {
    if (!caucus) return;
    try {
      const { error } = await supabase.from("caucuses").update({ description: aboutDraft }).eq("id", caucus.id);
      if (error) throw error;
      setCaucus({ ...caucus, description: aboutDraft });
      setEditingAbout(false);
      toast.success("Updated caucus description");
    } catch (e: any) {
      toast.error(e.message || "Could not update description");
    }
  };

  const saveName = async () => {
    if (!caucus || !nameDraft.trim()) return;
    try {
      const { error } = await supabase.from("caucuses").update({ title: nameDraft.trim() }).eq("id", caucus.id);
      if (error) throw error;
      setCaucus({ ...caucus, title: nameDraft.trim() });
      setEditingName(false);
      toast.success("Caucus renamed");
    } catch (e: any) {
      toast.error(e.message || "Could not rename caucus");
    }
  };

  const setMemberRole = async (userId: string, role: MembershipRole) => {
    if (electionConcluded && !isTeacher) return;
    try {
      if (role === "chair") {
        const currentChair = members.find((member) => member.role === "chair" && member.user_id !== userId);
        if (currentChair) {
          const { error: demoteError } = await supabase.from("caucus_members").update({ role: "member" }).eq("caucus_id", caucusId).eq("user_id", currentChair.user_id);
          if (demoteError) throw demoteError;
        }
      }
      const { error } = await supabase.from("caucus_members").update({ role }).eq("caucus_id", caucusId).eq("user_id", userId);
      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : role === "chair" && m.role === "chair" ? { ...m, role: "member" } : m)));
      setMemberMenuOpen(null);
    } catch (e: any) {
      toast.error(e.message || "Could not update role");
    }
  };

  const requestMemberRole = (member: { user_id: string; role: MembershipRole; profile: ProfileLite | null }, role: MembershipRole) => {
    if (!isTeacher || member.role === role) return;
    const currentChair = role === "chair" ? members.find((m) => m.role === "chair" && m.user_id !== member.user_id) : null;
    setConfirmDialog({
      title: "Change member role?",
      message: `Set ${member.profile?.display_name ?? "this member"} to ${leadershipLabel(role)} for ${caucus?.title ?? "this caucus"}?${currentChair ? ` ${currentChair.profile?.display_name ?? "The current chair"} will be moved back to Member.` : ""}`,
      confirmLabel: "Change role",
      onConfirm: () => setMemberRole(member.user_id, role),
    });
  };

  const removeMember = async (userId: string) => {
    if (!isTeacher) return;
    const removed = members.find((member) => member.user_id === userId);
    try {
      const { error } = await supabase.from("caucus_members").delete().eq("caucus_id", caucusId).eq("user_id", userId);
      if (error) throw error;
      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
      if (removed?.profile) {
        setMemberCandidates((prev) => [...prev, { user_id, display_name: removed.profile?.display_name ?? "Member", party: removed.profile?.party, constituency_name: removed.profile?.constituency_name, avatar_url: removed.profile?.avatar_url, role: removed.profile?.role ?? "student" }]);
      }
      if (userId === meId) setMyRole(null);
      setMemberMenuOpen(null);
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e.message || "Could not remove member");
    }
  };

  const requestRemoveMember = (member: { user_id: string; role: MembershipRole; profile: ProfileLite | null }) => {
    if (!isTeacher) return;
    setConfirmDialog({
      title: "Remove member?",
      message: `Remove ${member.profile?.display_name ?? "this member"} from ${caucus?.title ?? "this caucus"}?`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => removeMember(member.user_id),
    });
  };

  const addMemberToCaucus = async (candidate: MemberCandidate) => {
    if (!isTeacher) return;
    const { error } = await supabase.from("caucus_members").insert({ caucus_id: caucusId, user_id: candidate.user_id, role: "member" } as any);
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
    toast.success("Member added");
  };

  const postAnnouncement = async () => {
    if (!meId) return;
    if (!newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("caucus_announcements").insert({
        caucus_id: caucusId,
        author_user_id: meId,
        title: "",
        body: newAnnouncement.trim(),
        attachments: newAnnouncementAttachments,
      });
      if (error) throw error;
      setNewAnnouncement("");
      setNewAnnouncementAttachments([]);
      toast.success("Posted");
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
        .from("caucus_comments")
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
      const { error } = await supabase.from("caucus_announcements").delete().eq("id", announcementId);
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
      const { error } = await supabase.from("caucus_comments").delete().eq("id", commentId);
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
    const { error } = await supabase.from("caucus_comments").update({ body: body.trim(), updated_at: updatedAt } as any).eq("id", commentId);
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
          .from("caucus_announcement_reactions")
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        await supabase
          .from("caucus_announcement_reactions")
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        const { error } = await supabase.from("caucus_announcement_reactions").insert({
          caucus_id: caucusId,
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
          .from("caucus_comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        await supabase
          .from("caucus_comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", meId)
          .eq("emoji", emoji);
        const { error } = await supabase.from("caucus_comment_reactions").insert({
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

  if (loading || !caucus) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 py-10 text-gray-600">Loading...</main>
      </div>
    );
  }

  const visibleComments = selectedAnnouncementId ? commentsByAnnouncement[selectedAnnouncementId] ?? [] : [];
  const chairMember = members.find((m) => m.role === "chair");
  const coChairMember = members.find((m) => m.role === "co_chair");
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-2xl font-bold text-gray-900" />
                  <button type="button" onClick={() => void saveName()} className="rounded-md p-1 text-blue-600 hover:bg-blue-50"><Save className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{caucus.title}</h1>
                  {isTeacher && <button type="button" onClick={() => setEditingName(true)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>}
                </div>
              )}
              <p className="text-sm text-gray-600">
                Chair:{" "}
                {chairMember?.user_id ? (
                  <Link to={profilePath(chairMember.user_id)} className="text-blue-600 hover:underline">
                    {chairMember.profile?.display_name ?? "Member"}
                  </Link>
                ) : (
                  "N/A"
                )}{" "}
                • Co-Chair:{" "}
                {coChairMember?.user_id ? (
                  <Link to={profilePath(coChairMember.user_id)} className="text-blue-600 hover:underline">
                    {coChairMember.profile?.display_name ?? "Member"}
                  </Link>
                ) : (
                  "N/A"
                )}{" "}
                • {members.length} members
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ContributionButton recipientType="caucus" recipientId={caucus.id} recipientName={caucus.title} />
              {!isTeacher && (
                <button
                  onClick={joinLeave}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                    myRole ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {myRole ? <LogOut className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {myRole ? "Leave" : "Join"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                {(isLeader || isTeacher) && !editingAbout && (
                  <button onClick={() => setEditingAbout(true)} className="text-blue-600 hover:text-blue-700 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingAbout ? (
                <div className="space-y-3">
                  <textarea
                    value={aboutDraft}
                    onChange={(e) => setAboutDraft(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void saveAbout()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingAbout(false);
                        setAboutDraft(caucus.description ?? "");
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-line">{caucus.description || "No description yet."}</p>
              )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          {(["dashboard", "letters", "election"] as const).map((tab) => {
            const inactiveElection = tab === "election" && !electionOpen;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  inactiveElection
                    ? activeTab === tab ? "bg-gray-100 text-gray-500" : "text-gray-400 hover:bg-gray-50"
                    : activeTab === tab ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {inactiveElection ? "Election (inactive)" : tab}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            {activeTab === "letters" ? (
              <OrganizationLettersInbox organizationType="caucus" organizationId={caucusId} organizationName={caucus.title} memberIds={members.map((member) => member.user_id)} />
            ) : activeTab === "dashboard" ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
              </div>

              {canPostAnnouncements && (
                <div className="p-6 border-b border-gray-200">
                  <div className="rounded-md border border-gray-300 bg-white p-3 focus-within:ring-2 focus-within:ring-blue-500">
                    <textarea
                      value={newAnnouncement}
                      onChange={(e) => setNewAnnouncement(e.target.value)}
                      placeholder="Post an announcement..."
                      rows={3}
                      className="w-full resize-y border-0 p-0 text-sm outline-none"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <AttachmentPicker value={newAnnouncementAttachments} onChange={setNewAnnouncementAttachments} />
                    <button
                      onClick={() => void postAnnouncement()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                      disabled={!newAnnouncement.trim()}
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                    </div>
                  </div>
                </div>
              )}

              <div id="announcement-board-split" className="flex flex-col md:flex-row">
                <div
                  className="border-r border-gray-200 max-h-[520px] overflow-y-auto md:block"
                  style={{ width: `calc(${announcementsSplitPct}% - 4px)` }}
                >
                  {announcements.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No announcements yet.</div>
                  ) : (
                    announcements.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnnouncementId(a.id)}
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
                        <CollapsibleText text={selectedAnnouncement.body} limit={500} className="text-sm text-gray-900" />
                        <AttachmentList attachments={selectedAnnouncement.attachments} />
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
                        {isTeacher && (
                          <div className="mt-3 flex justify-end">
                            <button type="button" onClick={() => void deleteAnnouncement(selectedAnnouncement.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
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
                            <button
                              onClick={() => void postComment()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                              disabled={!newComment.trim()}
                            >
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Caucus Leadership Election</h2>
                    <p className="text-sm text-gray-500">{electionConcluded ? "Winners are final." : electionOpen ? "Voting is open." : "Voting is closed."}</p>
                  </div>
                  {isTeacher && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                        <button
                          type="button"
                          onClick={() => void setCaucusElectionOpen(true)}
                          disabled={electionConcluded}
                          className={`px-3 py-2 text-sm font-medium disabled:opacity-50 ${electionOpen ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => void setCaucusElectionOpen(false)}
                          disabled={electionConcluded}
                          className={`border-l border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 ${!electionOpen ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                          Close
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void postCaucusElectionResults()}
                        disabled={electionConcluded}
                        className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Post results
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {visibleMembers.map((m) => (
                    <div key={`election:${m.user_id}`} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                      <div className="min-w-0">
                        <Link to={profilePath(m.user_id)} className={`truncate text-sm font-medium ${m.profile?.role === "teacher" ? "text-green-700 hover:underline" : m.role !== "member" ? "text-purple-700 hover:underline" : "text-blue-600 hover:underline"}`}>
                          {m.profile?.display_name ?? "Member"}
                        </Link>
                        <div className="truncate text-xs text-gray-500">Rep.-{partyAbbr(m.profile?.party)}-{formatConstituency(m.profile?.constituency_name) || "N/A"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.role !== "member" && <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{m.role.replace("_", " ")}</span>}
                        {isChair && electionOpen && !electionConcluded && m.role !== "chair" && (
                          <button
                            type="button"
                            onClick={() => void setMemberRole(m.user_id, m.role === "co_chair" ? "member" : "co_chair")}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {m.role === "co_chair" ? "Withdraw" : "Vote"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Members</h2>
              </div>
              {isTeacher ? <TeacherAddMembersPopover candidates={memberCandidates} onAdd={addMemberToCaucus} /> : null}
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
              {visibleMembers
                .map((m) => (
                  <div key={m.user_id} className="relative flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                    <SecureAvatar src={m.profile?.avatar_url} alt={m.profile?.display_name ?? "Member"} className="w-10 h-10 rounded-full object-cover" fallbackClassName="w-10 h-10" iconClassName="w-5 h-5 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link to={profilePath(m.user_id)} className={m.profile?.role === "teacher" ? "text-green-700 hover:underline" : m.role !== "member" ? "text-purple-700 hover:underline" : "text-blue-600 hover:underline"}>
                          {m.profile?.display_name ?? "Member"}
                        </Link>
                      </div>
                      {m.profile?.role !== "teacher" && <div className="text-xs text-gray-500 truncate">
                        Rep.-{partyAbbr(m.profile?.party)}-{formatConstituency(m.profile?.constituency_name) || "N/A"}
                      </div>}
                      {m.role !== "member" && <div className="mt-1 inline-flex rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{leadershipLabel(m.role)}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isTeacher ? (
                        <div className="relative" data-caucus-member-menu onPointerDown={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(event) => {
                              setMemberMenuPlacement(verticalMenuPlacementForButton(event.currentTarget));
                              setMemberMenuOpen((open) => (open === m.user_id ? null : m.user_id));
                            }}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            aria-label="Member actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {memberMenuOpen === m.user_id && (
                            <div className={`absolute right-0 z-20 w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg ${verticalMenuPlacementClass(memberMenuPlacement)}`}>
                              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Modify position</div>
                              {(["member", "chair", "co_chair"] as MembershipRole[]).map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => requestMemberRole(m, role)}
                                  disabled={m.role === role}
                                  className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                  <span>{leadershipLabel(role)}</span>
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
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        ) : null}
                      {isChair && !isTeacher && m.role !== "chair" && (
                        <button
                          type="button"
                          onClick={() => void setMemberRole(m.user_id, m.role === "co_chair" ? "member" : "co_chair")}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                          title={m.role === "co_chair" ? "Demote to member" : "Promote to co-chair"}
                        >
                          {m.role === "co_chair" ? "Demote" : "Promote"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
