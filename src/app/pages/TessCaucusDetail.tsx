import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { GraduationCap, Save, X, Users as UsersIcon, Send, Pencil, Trash2, LogOut, UserPlus } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { ReactionEmoji, ReactionsSummary, ReactionsBar } from "../components/ReactionsBar";
import { ThreadedComments, ThreadComment } from "../components/ThreadedComments";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

type MembershipRole = "member" | "chair" | "co_chair" | "ranking_member";

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  party: string | null;
  constituency_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

type Announcement = {
  id: string;
  caucus_id: string;
  author_user_id: string;
  title: string;
  body: string;
  created_at: string;
  author?: ProfileLite | null;
};

type Comment = {
  id: string;
  announcement_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  parent_comment_id?: string | null;
  author?: ProfileLite | null;
};

function displayAuthorName(author: ProfileLite | null | undefined, fallback = "Unknown") {
  const name = author?.display_name ?? fallback;
  return author?.role === "teacher" ? `${name} (Teacher)` : name;
}

function authorLinkClass(author: ProfileLite | null | undefined) {
  return author?.role === "teacher" ? "text-green-700 hover:underline" : "text-blue-600 hover:underline";
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
  const [myRole, setMyRole] = useState<MembershipRole | null>(null);
  const [viewerRole, setViewerRole] = useState<"teacher" | "student" | null>(null);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");

  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, ThreadComment[]>>({});
  const [newComment, setNewComment] = useState("");

  const [announcementReactions, setAnnouncementReactions] = useState<Record<string, ReactionsSummary | undefined>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionsSummary | undefined>>({});

  const [announcementsSplitPct, setAnnouncementsSplitPct] = useState(40);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "election">("dashboard");
  const [classSettings, setClassSettings] = useState<any>({});

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
          profile: (pMap.get(m.user_id) as ProfileLite) ?? null,
        }));
        setMembers(mappedMembers);
        setMyRole(me ? ((mRows ?? []).find((r: any) => r.user_id === me)?.role as any) ?? null : null);

        const { data: aRows, error: aErr } = await supabase
          .from("caucus_announcements")
          .select("id,caucus_id,author_user_id,title,body,created_at")
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
          author: (aAuthorMap.get(a.author_user_id) as ProfileLite) ?? null,
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
            .select("id,announcement_id,author_user_id,body,created_at,parent_comment_id")
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
            const comment: ThreadComment = { ...(row as any), author: (cAuthorMap.get((row as any).author_user_id) as any) ?? null };
            grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
          }
          setCommentsByAnnouncement(grouped);

          const { data: arRows, error: arErr } = await supabase
            .from("caucus_announcement_reactions")
            .select("announcement_id,user_id,emoji")
            .in("announcement_id", announcementIds);
          if (arErr) throw arErr;

          const announcementSummary: Record<string, ReactionsSummary> = {};
          const seenAnnouncementReactions = new Set<string>();
          for (const r of arRows ?? []) {
            const id = (r as any).announcement_id as string;
            const emoji = (r as any).emoji as ReactionEmoji;
            const uid = (r as any).user_id as string;
            const key = `${id}:${uid}:${emoji}`;
            if (seenAnnouncementReactions.has(key)) continue;
            seenAnnouncementReactions.add(key);
            const prev = announcementSummary[id] ?? { counts: { "👍": 0, "👎": 0, "🎉": 0 }, mine: new Set<ReactionEmoji>() };
            prev.counts[emoji] = (prev.counts[emoji] ?? 0) + 1;
            if (uid === me) prev.mine.add(emoji);
            announcementSummary[id] = prev;
          }
          setAnnouncementReactions(announcementSummary);

          const commentIds = (cRows ?? []).map((r: any) => r.id);
          if (commentIds.length) {
            const { data: crRows, error: crErr } = await supabase
              .from("caucus_comment_reactions")
              .select("comment_id,user_id,emoji")
              .in("comment_id", commentIds);
            if (crErr) throw crErr;
            const commentSummary: Record<string, ReactionsSummary> = {};
            const seenCommentReactions = new Set<string>();
            for (const r of crRows ?? []) {
              const id = (r as any).comment_id as string;
              const emoji = (r as any).emoji as ReactionEmoji;
              const uid = (r as any).user_id as string;
              const key = `${id}:${uid}:${emoji}`;
              if (seenCommentReactions.has(key)) continue;
              seenCommentReactions.add(key);
              const prev = commentSummary[id] ?? { counts: { "👍": 0, "👎": 0, "🎉": 0 }, mine: new Set<ReactionEmoji>() };
              prev.counts[emoji] = (prev.counts[emoji] ?? 0) + 1;
              if (uid === me) prev.mine.add(emoji);
              commentSummary[id] = prev;
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
          setAnnouncementReactions((prev) => {
            const cur = prev[announcementId] ?? { counts: { "👍": 0, "👎": 0, "🎉": 0 }, mine: new Set<ReactionEmoji>() };
            const mine = new Set(cur.mine);
            if (uid === meId) mine.add(emoji);
            return { ...prev, [announcementId]: { counts: { ...cur.counts, [emoji]: (cur.counts[emoji] ?? 0) + 1 }, mine } };
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
          setAnnouncementReactions((prev) => {
            const cur = prev[announcementId];
            if (!cur) return prev;
            const mine = new Set(cur.mine);
            if (uid === meId) mine.delete(emoji);
            return {
              ...prev,
              [announcementId]: { counts: { ...cur.counts, [emoji]: Math.max(0, (cur.counts[emoji] ?? 0) - 1) }, mine },
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
          setCommentReactions((prev) => {
            const cur = prev[commentId] ?? { counts: { "👍": 0, "👎": 0, "🎉": 0 }, mine: new Set<ReactionEmoji>() };
            const mine = new Set(cur.mine);
            if (uid === meId) mine.add(emoji);
            return { ...prev, [commentId]: { counts: { ...cur.counts, [emoji]: (cur.counts[emoji] ?? 0) + 1 }, mine } };
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
          setCommentReactions((prev) => {
            const cur = prev[commentId];
            if (!cur) return prev;
            const mine = new Set(cur.mine);
            if (uid === meId) mine.delete(emoji);
            return { ...prev, [commentId]: { counts: { ...cur.counts, [emoji]: Math.max(0, (cur.counts[emoji] ?? 0) - 1) }, mine } };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caucusId]);

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
      const { error } = await supabase.from("caucus_members").update({ role }).eq("caucus_id", caucusId).eq("user_id", userId);
      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
    } catch (e: any) {
      toast.error(e.message || "Could not update role");
    }
  };

  const requestMemberRole = (member: { user_id: string; role: MembershipRole; profile: ProfileLite | null }, role: MembershipRole) => {
    if (!isTeacher || member.role === role) return;
    setConfirmDialog({
      title: "Change member role?",
      message: `Set ${member.profile?.display_name ?? "this member"} to ${leadershipLabel(role)} for ${caucus?.title ?? "this caucus"}?`,
      confirmLabel: "Change role",
      onConfirm: () => setMemberRole(member.user_id, role),
    });
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
      });
      if (error) throw error;
      setNewAnnouncement("");
      toast.success("Posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const submitComment = async (body: string, parentCommentId: string | null) => {
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
        })
        .select("id,announcement_id,author_user_id,body,created_at,parent_comment_id")
        .single();
      if (error) throw error;

      const comment: ThreadComment = { ...(inserted as any), author: (meProfile as any) ?? null };
      setCommentsByAnnouncement((prev) => {
        const cur = prev[comment.announcement_id] ?? [];
        if (cur.some((c) => c.id === comment.id)) return prev;
        return { ...prev, [comment.announcement_id]: [...cur, comment] };
      });
      if (!parentCommentId) setNewComment("");
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    }
  };

  const postComment = async () => submitComment(newComment, null);

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

  const toggleAnnouncementReaction = async (announcementId: string, emoji: ReactionEmoji) => {
    if (!meId) return;
    const mine = announcementReactions[announcementId]?.mine?.has(emoji) ?? false;
    // optimistic UI
    setAnnouncementReactions((prev) => {
      const cur = prev[announcementId] ?? { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
      const nextMine = new Set(cur.mine);
      const nextCounts = { ...cur.counts };
      if (mine) {
        nextMine.delete(emoji);
        nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) - 1);
      } else {
        nextMine.add(emoji);
        nextCounts[emoji] = (nextCounts[emoji] ?? 0) + 1;
      }
      return { ...prev, [announcementId]: { counts: nextCounts, mine: nextMine } };
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
      // rollback by reloading optimistic flip
      setAnnouncementReactions((prev) => {
        const cur = prev[announcementId] ?? { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
        const nextMine = new Set(cur.mine);
        const nextCounts = { ...cur.counts };
        if (!mine) {
          // we tried to add; remove
          nextMine.delete(emoji);
          nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) - 1);
        } else {
          // we tried to remove; add back
          nextMine.add(emoji);
          nextCounts[emoji] = (nextCounts[emoji] ?? 0) + 1;
        }
        return { ...prev, [announcementId]: { counts: nextCounts, mine: nextMine } };
      });
      toast.error(e.message || "Could not react");
    }
  };

  const toggleCommentReaction = async (commentId: string, emoji: ReactionEmoji) => {
    if (!meId) return;
    const mine = commentReactions[commentId]?.mine?.has(emoji) ?? false;
    setCommentReactions((prev) => {
      const cur = prev[commentId] ?? { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
      const nextMine = new Set(cur.mine);
      const nextCounts = { ...cur.counts };
      if (mine) {
        nextMine.delete(emoji);
        nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) - 1);
      } else {
        nextMine.add(emoji);
        nextCounts[emoji] = (nextCounts[emoji] ?? 0) + 1;
      }
      return { ...prev, [commentId]: { counts: nextCounts, mine: nextMine } };
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
        const cur = prev[commentId] ?? { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
        const nextMine = new Set(cur.mine);
        const nextCounts = { ...cur.counts };
        if (!mine) {
          nextMine.delete(emoji);
          nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) - 1);
        } else {
          nextMine.add(emoji);
          nextCounts[emoji] = (nextCounts[emoji] ?? 0) + 1;
        }
        return { ...prev, [commentId]: { counts: nextCounts, mine: nextMine } };
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
                  <Link to={`/profile/${chairMember.user_id}`} className="text-blue-600 hover:underline">
                    {chairMember.profile?.display_name ?? "Member"}
                  </Link>
                ) : (
                  "N/A"
                )}{" "}
                • Co-Chair:{" "}
                {coChairMember?.user_id ? (
                  <Link to={`/profile/${coChairMember.user_id}`} className="text-blue-600 hover:underline">
                    {coChairMember.profile?.display_name ?? "Member"}
                  </Link>
                ) : (
                  "N/A"
                )}{" "}
                • {members.length} members
              </p>
            </div>
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
          {(["dashboard", "election"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            {activeTab === "dashboard" ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                    <div className="mt-3 flex justify-end">
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
                          <Link to={`/profile/${a.author_user_id}`} className={authorLinkClass(a.author)}>
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
                        <div className="text-sm text-gray-900 whitespace-pre-line">{selectedAnnouncement.body}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          <Link to={`/profile/${selectedAnnouncement.author_user_id}`} className={authorLinkClass(selectedAnnouncement.author)}>
                            {displayAuthorName(selectedAnnouncement.author)}
                          </Link>{" "}
                          • {new Date(selectedAnnouncement.created_at).toLocaleString()}
                        </div>
                        <div className="mt-3">
                          <ReactionsBar
                            size="md"
                            summary={announcementReactions[selectedAnnouncement.id]}
                            onToggle={(emoji) => toggleAnnouncementReaction(selectedAnnouncement.id, emoji)}
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
                        <Link to={`/profile/${m.user_id}`} className={`truncate text-sm font-medium ${m.profile?.role === "teacher" ? "text-green-700 hover:underline" : "text-blue-600 hover:underline"}`}>
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
            <div className="flex items-center gap-2 mb-4">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
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
                  <div key={m.user_id} className="flex items-center gap-3">
                    {m.profile?.avatar_url ? (
                      <img src={m.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <DefaultAvatar className="w-10 h-10" iconClassName="w-5 h-5 text-gray-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link to={`/profile/${m.user_id}`} className={m.profile?.role === "teacher" ? "text-green-700 hover:underline" : "text-blue-600 hover:underline"}>
                          {m.profile?.display_name ?? "Member"}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        Rep.-{partyAbbr(m.profile?.party)}-{formatConstituency(m.profile?.constituency_name) || "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTeacher ? (
                        <select
                          value={m.role}
                          onChange={(event) => requestMemberRole(m, event.target.value as MembershipRole)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        >
                          <option value="member">Member</option>
                          <option value="chair">Chair</option>
                          <option value="co_chair">Co-chair</option>
                          <option value="ranking_member">Ranking member</option>
                        </select>
                      ) : m.role !== "member" ? (
                        <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{m.role.replace("_", " ")}</div>
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
