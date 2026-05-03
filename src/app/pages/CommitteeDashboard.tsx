import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { LogOut, Users, Send, Pencil, Save, X, UserPlus } from "lucide-react";
import { ReactionEmoji, ReactionsSummary, ReactionsBar } from "../components/ReactionsBar";
import { ThreadedComments, ThreadComment } from "../components/ThreadedComments";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";
import { CommitteeTabs, markCommitteeSeenIds } from "../components/CommitteeTabs";

type MembershipRole = "member" | "chair" | "co_chair" | "ranking_member";
type ProfileLite = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null };

type Announcement = { id: string; committee_id: string; author_user_id: string; title: string; body: string; created_at: string; author?: ProfileLite | null };
type Comment = { id: string; announcement_id: string; author_user_id: string; body: string; created_at: string; parent_comment_id?: string | null; author?: ProfileLite | null };

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
  return `${partyAbbr(profile?.party)}-${district || "N/A"}`;
}

function leadershipLabel(role: MembershipRole) {
  if (role === "chair") return "Chair";
  if (role === "co_chair") return "Co-chair";
  if (role === "ranking_member") return "Ranking member";
  return "";
}

const dashboardCache = new Map<
  string,
  {
    committee: { id: string; class_id: string; name: string; description: string | null; created_at: string } | null;
    members: Array<{ user_id: string; role: MembershipRole; profile: ProfileLite | null }>;
    myRole: MembershipRole | null;
    viewerRole: "teacher" | "student" | null;
    allowSelfJoin: boolean;
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
  const [myRole, setMyRole] = useState<MembershipRole | null>(null);
  const [viewerRole, setViewerRole] = useState<"teacher" | "student" | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [allowSelfJoin, setAllowSelfJoin] = useState(false);

  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, ThreadComment[]>>({});
  const [newComment, setNewComment] = useState("");

  const [announcementReactions, setAnnouncementReactions] = useState<Record<string, ReactionsSummary | undefined>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionsSummary | undefined>>({});

  const [announcementsSplitPct, setAnnouncementsSplitPct] = useState(40);
  const [draggingSplit, setDraggingSplit] = useState(false);

  const isLeader = myRole === "chair" || myRole === "co_chair" || myRole === "ranking_member";

  const selectedAnnouncement = useMemo(
    () => announcements.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );

  useEffect(() => {
    const load = async () => {
      const cached = dashboardCache.get(committeeId);
      if (cached) {
        setCommittee(cached.committee);
        setAboutDraft(cached.committee?.description ?? "");
        setMembers(cached.members);
        setMyRole(cached.myRole);
        setViewerRole(cached.viewerRole);
        setAllowSelfJoin(cached.allowSelfJoin);
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
            .select("user_id,display_name,party,constituency_name,avatar_url")
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
        setAboutDraft((c as any).description ?? "");

        const { data: prof } = await supabase.from("profiles").select("class_id,role").eq("user_id", me ?? "").maybeSingle();
        const classId = (prof as any)?.class_id ?? null;
        setViewerRole(((prof as any)?.role ?? null) as any);
        let nextAllowSelfJoin = false;
        if ((c as any).class_id) {
          const { data: cls } = await supabase.from("classes").select("settings").eq("id", (c as any).class_id).maybeSingle();
          const settings = (cls as any)?.settings ?? {};
          nextAllowSelfJoin = !!settings?.committees?.allowSelfJoin || settings?.committees?.assignmentMode === "self-join";
        }
        setAllowSelfJoin(nextAllowSelfJoin);

        const { data: mRows, error: mErr } = await supabase
          .from("committee_members")
          .select("user_id,role")
          .eq("committee_id", committeeId);
        if (mErr) throw mErr;

        const memberIds = [...new Set((mRows ?? []).map((m: any) => m.user_id))];
        const { data: pRows } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
        const pMap = new Map((pRows ?? []).map((p: any) => [p.user_id, p]));

        const nextMembers = (mRows ?? []).map((m: any) => ({
            user_id: m.user_id,
            role: m.role as MembershipRole,
            profile: (pMap.get(m.user_id) as ProfileLite) ?? null,
          }));
        setMembers(nextMembers);
        const nextMyRole = me ? ((mRows ?? []).find((r: any) => r.user_id === me)?.role as any) ?? null : null;
        setMyRole(nextMyRole);

        const { data: aRows, error: aErr } = await supabase
          .from("committee_announcements")
          .select("id,committee_id,author_user_id,title,body,created_at")
          .eq("committee_id", committeeId)
          .order("created_at", { ascending: false });
        if (aErr) throw aErr;

        const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
        const { data: aAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
        const aAuthorMap = new Map((aAuthors ?? []).map((p: any) => [p.user_id, p]));

        const mappedAnnouncements: Announcement[] = (aRows ?? []).map((a: any) => ({
          ...(a as any),
          author: (aAuthorMap.get(a.author_user_id) as ProfileLite) ?? null,
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
            .select("id,announcement_id,author_user_id,body,created_at,parent_comment_id")
            .in("announcement_id", announcementIds)
            .order("created_at", { ascending: true });
          if (ccErr) throw ccErr;

          const commentAuthorIds = [...new Set((cRows ?? []).map((r: any) => r.author_user_id))];
          const { data: cAuthors } = await supabase
            .from("profiles")
            .select("user_id,display_name,party,constituency_name,avatar_url")
            .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
          const cAuthorMap = new Map((cAuthors ?? []).map((p: any) => [p.user_id, p]));

          const grouped: Record<string, ThreadComment[]> = {};
          for (const row of cRows ?? []) {
            const comment: ThreadComment = { ...(row as any), author: (cAuthorMap.get((row as any).author_user_id) as any) ?? null };
            grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
          }
          setCommentsByAnnouncement(grouped);

          const { data: arRows, error: arErr } = await supabase
            .from("committee_announcement_reactions")
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
          let commentSummary: Record<string, ReactionsSummary> = {};
          if (commentIds.length) {
            const { data: crRows, error: crErr } = await supabase
              .from("committee_comment_reactions")
              .select("comment_id,user_id,emoji")
              .in("comment_id", commentIds);
            if (crErr) throw crErr;
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
          dashboardCache.set(committeeId, {
            committee: c as any,
            members: nextMembers,
            myRole: nextMyRole,
            viewerRole: ((prof as any)?.role ?? null) as any,
            allowSelfJoin: nextAllowSelfJoin,
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
            .select("user_id,display_name,party,constituency_name,avatar_url")
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
            .select("user_id,display_name,party,constituency_name,avatar_url")
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
        { event: "DELETE", schema: "public", table: "committee_announcement_reactions", filter: `committee_id=eq.${committeeId}` },
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
        { event: "INSERT", schema: "public", table: "committee_comment_reactions" },
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
        { event: "DELETE", schema: "public", table: "committee_comment_reactions" },
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
  }, [committeeId]);

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

  const postAnnouncement = async () => {
    if (!meId) return;
    if (!newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("committee_announcements").insert({
        committee_id: committeeId,
        author_user_id: meId,
        title: "",
        body: newAnnouncement.trim(),
      });
      if (error) throw error;
      setNewAnnouncement("");
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
        .from("committee_comments")
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

  const toggleAnnouncementReaction = async (announcementId: string, emoji: ReactionEmoji) => {
    if (!meId) return;
    const mine = announcementReactions[announcementId]?.mine?.has(emoji) ?? false;
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
        const cur = prev[announcementId] ?? { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
        const nextMine = new Set(cur.mine);
        const nextCounts = { ...cur.counts };
        if (!mine) {
          nextMine.delete(emoji);
          nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) - 1);
        } else {
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

  const join = async () => {
    if (!meId) return;
    if (!allowSelfJoin) return;
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

  const leave = async () => {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{committee.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {myRole && (
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
                disabled={joining}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                {joining ? "Joining" : "Join"}
              </button>
            )}
          </div>
        </div>

        <CommitteeTabs committeeId={committeeId} active="dashboard" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                {isLeader && !editingAbout && (
                  <button onClick={() => setEditingAbout(true)} className="text-blue-600 hover:text-blue-700 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              {editingAbout ? (
                <div className="space-y-3">
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
                <p className="text-gray-700 whitespace-pre-line">{committee.description || "No description yet."}</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
              </div>

              {isLeader && (
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="Post an announcement..." rows={3} className="flex-1 px-3 py-2 border border-gray-300 rounded-md" />
                    <button onClick={() => void postAnnouncement()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50" disabled={!newAnnouncement.trim()}>
                      <Send className="w-4 h-4" />
                      Post
                    </button>
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
                        className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${selectedAnnouncementId === a.id ? "bg-blue-50" : ""}`}
                      >
                        <div className="text-sm text-gray-900 font-medium line-clamp-2">{a.body}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <Link to={`/profile/${a.author_user_id}`} className="text-blue-600 hover:underline">
                            {a.author?.display_name ?? "Unknown"}
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
                      <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                        <div className="text-sm text-gray-900 whitespace-pre-line">{selectedAnnouncement.body}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          <Link to={`/profile/${selectedAnnouncement.author_user_id}`} className="text-blue-600 hover:underline">
                            {selectedAnnouncement.author?.display_name ?? "Unknown"}
                          </Link>{" "}
                          • {new Date(selectedAnnouncement.created_at).toLocaleString()}
                        </div>
                        <div className="mt-3">
                          <ReactionsBar
                            size="md"
                            summary={announcementReactions[selectedAnnouncement.id]}
                            onToggle={(emoji) => void toggleAnnouncementReaction(selectedAnnouncement.id, emoji)}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                        <ThreadedComments
                          comments={visibleComments}
                          meId={myRole ? meId : null}
                          reactionsByCommentId={commentReactions}
                          onToggleReaction={(commentId, emoji) => void toggleCommentReaction(commentId, emoji)}
                          onSubmitComment={submitComment}
                        />
                      </div>

                      {myRole && (
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
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Select an announcement.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
              <span className="text-sm text-gray-500">{members.length} member{members.length === 1 ? "" : "s"}</span>
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
                <div key={m.user_id} className="flex items-center gap-3">
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <DefaultAvatar className="w-10 h-10" iconClassName="w-5 h-5 text-gray-500" />
                  )}
                    <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link to={`/profile/${m.user_id}`} className="text-blue-600 hover:underline">
                        {m.profile?.display_name ?? "Member"}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{memberDescriptor(m.profile)}</div>
                  </div>
                  {leadershipLabel(m.role) && (
                    <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{leadershipLabel(m.role)}</div>
                  )}
                </div>
              ))}
              {visibleMembers.length === 0 && <div className="text-sm text-gray-500">No members found.</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
