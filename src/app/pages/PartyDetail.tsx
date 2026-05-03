import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle, Flag, GraduationCap, LogOut, MoreHorizontal, Pencil, Repeat2, Save, Send, Trash2, UserPlus, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

type PartyRow = { id: string; class_id: string; name: string; platform: string; color: string; created_at: string };
type PartyRole = "majority_leader" | "majority_whip" | "minority_leader" | "minority_whip" | "leader" | "whip" | "chair" | "vice_chair";
type MemberRow = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null; role?: string | null; organization_role?: PartyRole | null };
type Announcement = { id: string; author_user_id: string; body: string; created_at: string; author?: MemberRow | null };
type CommentRow = { id: string; announcement_id: string; author_user_id: string; body: string; created_at: string; author?: MemberRow | null };
type PartyMemberRoleRow = { party_id: string; user_id: string; role: PartyRole };

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function comparablePartyName(name: string | null | undefined) {
  return displayPartyName(String(name ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
}

function displayAuthorName(author: MemberRow | null | undefined, fallback = "Member") {
  const name = author?.display_name ?? fallback;
  return author?.role === "teacher" ? `${name} (Teacher)` : name;
}

function authorLinkClass(author: MemberRow | null | undefined) {
  return author?.role === "teacher" ? "text-green-700 hover:underline" : "text-blue-600 hover:underline";
}

function isMajorPartyName(name: string | null | undefined) {
  const comparable = comparablePartyName(name);
  return comparable === "democratic party" || comparable === "republican party";
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

function PartyIcon({ name }: { name: string }) {
  const normalized = name.toLowerCase();
  if (normalized.includes("democrat")) {
    return <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Democratic%20Disc.svg" alt="Democratic Party donkey" className="h-8 w-8 rounded-full object-cover" />;
  }
  if (normalized.includes("republican")) {
    return <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Republican%20Disc.svg" alt="Republican Party elephant" className="h-8 w-8 rounded-full object-cover" />;
  }
  return <Flag className="h-4 w-4" />;
}

export function PartyDetail() {
  const { id } = useParams();
  const partyId = id!;

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [myParty, setMyParty] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<"teacher" | "student" | null>(null);
  const [party, setParty] = useState<PartyRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newComment, setNewComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "district">("name");
  const [votes, setVotes] = useState<Array<{ position: "chair" | "whip"; voter_user_id: string; candidate_user_id: string }>>([]);
  const [optOuts, setOptOuts] = useState<Array<{ position: "chair" | "whip"; user_id: string }>>([]);
  const [partyRoles, setPartyRoles] = useState<PartyMemberRoleRow[]>([]);
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [majorPartyAlignment, setMajorPartyAlignment] = useState<"majority" | "minority" | "tie" | null>(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "election">("dashboard");
  const [classSettings, setClassSettings] = useState<any>({});

  const isMember = !!party && comparablePartyName(myParty) === comparablePartyName(party.name);
  const isTeacher = viewerRole === "teacher";
  const canUseBoard = isMember || isTeacher;
  const selectedAnnouncement = announcements.find((a) => a.id === selectedAnnouncementId) ?? null;

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMeId(uid);
      if (!uid) return;

      const { data: p, error: pErr } = await supabase.from("parties").select("id,class_id,name,platform,color,created_at").eq("id", partyId).single();
      if (pErr) throw pErr;
      setParty(p as any);
      setAboutDraft((p as any).platform ?? "");
      setNameDraft(displayPartyName((p as any).name ?? ""));
      const { data: classRow } = await supabase.from("classes").select("settings").eq("id", (p as any).class_id).maybeSingle();
      setClassSettings((classRow as any)?.settings ?? {});

      const { data: me } = await supabase.from("profiles").select("party,role").eq("user_id", uid).maybeSingle();
      setMyParty((me as any)?.party ?? null);
      setViewerRole(((me as any)?.role ?? null) as any);

      const { data: memberRows, error: memberErr } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url,role")
        .eq("class_id", (p as any).class_id)
        .order("display_name", { ascending: true });
      if (memberErr) throw memberErr;
      const allClassMembers = (memberRows ?? []) as any[];
      const demCount = allClassMembers.filter((member) => comparablePartyName(member.party) === "democratic party").length;
      const repCount = allClassMembers.filter((member) => comparablePartyName(member.party) === "republican party").length;
      const currentPartyName = comparablePartyName((p as any).name);
      setMajorPartyAlignment(
        currentPartyName === "democratic party"
          ? demCount === repCount ? "tie" : demCount > repCount ? "majority" : "minority"
          : currentPartyName === "republican party"
            ? demCount === repCount ? "tie" : repCount > demCount ? "majority" : "minority"
            : null,
      );
      const { data: roleRows, error: roleErr } = await supabase.from("party_member_roles").select("party_id,user_id,role").eq("party_id", partyId);
      if (roleErr) throw roleErr;
      const nextRoles = (roleRows ?? []) as PartyMemberRoleRow[];
      setPartyRoles(nextRoles);
      const roleMap = new Map(nextRoles.map((row) => [row.user_id, row.role]));
      setMembers(((memberRows ?? []) as any[]).filter((member) => comparablePartyName(member.party) === comparablePartyName((p as any).name)).map((member) => ({ ...member, organization_role: roleMap.get(member.user_id) ?? null })) as any);

      const { data: aRows, error: aErr } = await supabase
        .from("party_announcements")
        .select("id,author_user_id,body,created_at")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;

      const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
      const { data: authors } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url,role")
        .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
      const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, { ...a, organization_role: nextRoles.find((row) => row.user_id === a.user_id)?.role ?? null }]));
      const mappedAnnouncements = (aRows ?? []).map((a: any) => ({ ...a, author: authorMap.get(a.author_user_id) ?? null }));
      setAnnouncements(mappedAnnouncements as any);
      setSelectedAnnouncementId((prev) => prev ?? mappedAnnouncements[0]?.id ?? null);

      const announcementIds = mappedAnnouncements.map((a: any) => a.id);
      if (announcementIds.length) {
        const { data: cRows } = await supabase.from("party_comments").select("id,announcement_id,author_user_id,body,created_at").in("announcement_id", announcementIds).order("created_at", { ascending: true });
        const commentAuthorIds = [...new Set((cRows ?? []).map((c: any) => c.author_user_id))];
        const { data: cAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
        const cAuthorMap = new Map((cAuthors ?? []).map((a: any) => [a.user_id, { ...a, organization_role: nextRoles.find((row) => row.user_id === a.user_id)?.role ?? null }]));
        const grouped: Record<string, CommentRow[]> = {};
        for (const row of cRows ?? []) {
          const comment = { ...(row as any), author: cAuthorMap.get((row as any).author_user_id) ?? null };
          grouped[comment.announcement_id] = [...(grouped[comment.announcement_id] ?? []), comment];
        }
        setComments(grouped);
      } else {
        setComments({});
      }

      const [{ data: voteRows }, { data: optOutRows }] = await Promise.all([
        supabase.from("party_leadership_votes").select("position,voter_user_id,candidate_user_id").eq("party_id", partyId),
        supabase.from("party_leadership_opt_outs").select("position,user_id").eq("party_id", partyId),
      ]);
      setVotes((voteRows ?? []) as any);
      setOptOuts((optOutRows ?? []) as any);
    } catch (e: any) {
      toast.error(e.message || "Could not load party");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!partyId) return;
    void load();
  }, [partyId]);

  const visibleMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return members
      .filter((m) => {
        if (!query) return true;
        return (m.display_name ?? "Member").toLowerCase().includes(query) || formatConstituency(m.constituency_name).toLowerCase().includes(query);
      })
      .sort((a, b) =>
        sortBy === "district"
          ? formatConstituency(a.constituency_name).localeCompare(formatConstituency(b.constituency_name))
          : (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"),
      );
  }, [members, searchQuery, sortBy]);

  const hasOptedOut = (position: "chair" | "whip", userId: string) => optOuts.some((row) => row.position === position && row.user_id === userId);

  const leaderFor = (position: "chair" | "whip") => {
    const counts = new Map<string, number>();
    for (const vote of votes.filter((v) => v.position === position && !hasOptedOut(position, v.candidate_user_id))) counts.set(v.candidate_user_id, (counts.get(v.candidate_user_id) ?? 0) + 1);
    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner ? members.find((m) => m.user_id === winner) ?? null : null;
  };
  const roleHolder = (role: PartyRole) => partyRoles.find((row) => row.role === role)?.user_id ?? null;
  const memberForRole = (role: PartyRole) => {
    const userId = roleHolder(role);
    return userId ? members.find((member) => member.user_id === userId) ?? null : null;
  };
  const partyRoleOptions = (): Array<{ role: PartyRole | "member"; label: string }> => {
    if (!party || !isMajorPartyName(party.name)) {
      return [
        { role: "member", label: "Member" },
        { role: "chair", label: "Chair" },
        { role: "vice_chair", label: "Vice chair" },
      ];
    }
    if (majorPartyAlignment === "majority") {
      return [
        { role: "member", label: "Member" },
        { role: "majority_leader", label: "Majority leader" },
        { role: "majority_whip", label: "Majority whip" },
      ];
    }
    if (majorPartyAlignment === "minority") {
      return [
        { role: "member", label: "Member" },
        { role: "minority_leader", label: "Minority leader" },
        { role: "minority_whip", label: "Minority whip" },
      ];
    }
    return [
      { role: "member", label: "Member" },
      { role: "leader", label: "Leader" },
      { role: "whip", label: "Whip" },
    ];
  };
  const partyRoleLabel = (role: PartyRole | null | undefined) => {
    if (!role) return "";
    return partyRoleOptions().find((option) => option.role === role)?.label ?? role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  };
  const partyMemberRole = (userId: string | null | undefined) => {
    if (!userId) return "";
    const explicitRole = partyRoles.find((row) => row.user_id === userId)?.role;
    if (explicitRole) return partyRoleLabel(explicitRole);
    if (leaderFor("chair")?.user_id === userId) return partyRoleLabel(partyRoleOptions()[1]?.role as PartyRole);
    if (leaderFor("whip")?.user_id === userId) return partyRoleLabel(partyRoleOptions()[2]?.role as PartyRole);
    return "";
  };
  const partyAuthorLinkClass = (author: MemberRow | null | undefined) =>
    partyMemberRole(author?.user_id) ? "text-purple-700 hover:underline" : authorLinkClass(author);

  const joinOrSwitch = async () => {
    if (!party || !meId) return;
    const nextParty = isMember ? null : party.name;
    if (isMember) {
      setConfirmDialog({
        title: "Leave party?",
        message: `Leave ${party.name}?`,
        confirmLabel: "Leave",
        danger: true,
        onConfirm: () => updatePartyMembership(nextParty),
      });
      return;
    }
    if (myParty && myParty !== party.name) {
      setConfirmDialog({
        title: "Switch party?",
        message: `Switch from ${myParty} to ${party.name}?`,
        confirmLabel: "Switch",
        onConfirm: () => updatePartyMembership(nextParty),
      });
      return;
    }
    await updatePartyMembership(nextParty);
  };

  const updatePartyMembership = async (nextParty: string | null) => {
    if (!meId) return;
    try {
      const { error } = await supabase.from("profiles").update({ party: nextParty } as any).eq("user_id", meId);
      if (error) throw error;
      setMyParty(nextParty);
      toast.success(nextParty ? (myParty ? "Party switched" : "Joined party") : "Left party");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update party");
    }
  };

  const saveName = async () => {
    if (!party || !nameDraft.trim()) return;
    const nextName = displayPartyName(nameDraft);
    try {
      const { error } = await supabase.from("parties").update({ name: nextName } as any).eq("id", party.id);
      if (error) throw error;
      await supabase.from("profiles").update({ party: nextName } as any).eq("class_id", party.class_id).eq("party", party.name);
      setParty({ ...party, name: nextName });
      setMyParty((current) => (current === party.name ? nextName : current));
      setEditingName(false);
      toast.success("Party renamed");
    } catch (e: any) {
      toast.error(e.message || "Could not rename party");
    }
  };

  const saveAbout = async () => {
    if (!party) return;
    try {
      const { error } = await supabase.from("parties").update({ platform: aboutDraft } as any).eq("id", party.id);
      if (error) throw error;
      setParty({ ...party, platform: aboutDraft });
      setEditingAbout(false);
      toast.success("Party platform updated");
    } catch (e: any) {
      toast.error(e.message || "Could not update party");
    }
  };

  const requestPartyRoleChange = (member: MemberRow, nextRole: PartyRole | "member") => {
    if (!party || !isTeacher) return;
    const currentRole = partyRoles.find((row) => row.user_id === member.user_id)?.role ?? null;
    if ((nextRole === "member" && !currentRole) || currentRole === nextRole) return;
    const existingHolder = nextRole === "member" ? null : memberForRole(nextRole);
    const replacementText = existingHolder && existingHolder.user_id !== member.user_id
      ? ` ${existingHolder.display_name ?? "The current role holder"} will be moved back to Member.`
      : "";
    setConfirmDialog({
      title: "Change party role?",
      message: `Set ${member.display_name ?? "this member"} to ${nextRole === "member" ? "Member" : partyRoleLabel(nextRole)} for ${displayPartyName(party.name)}?${replacementText}`,
      confirmLabel: "Change role",
      onConfirm: () => updatePartyRole(member.user_id, nextRole),
    });
  };

  const updatePartyRole = async (userId: string, nextRole: PartyRole | "member") => {
    if (!party) return;
    try {
      if (nextRole === "member") {
        const { error } = await supabase.from("party_member_roles").delete().eq("party_id", party.id).eq("user_id", userId);
        if (error) throw error;
        setPartyRoles((prev) => prev.filter((row) => row.user_id !== userId));
        setMembers((prev) => prev.map((member) => member.user_id === userId ? { ...member, organization_role: null } : member));
      } else {
        const { error: deleteUserError } = await supabase.from("party_member_roles").delete().eq("party_id", party.id).eq("user_id", userId);
        if (deleteUserError) throw deleteUserError;
        const { error: deleteRoleError } = await supabase.from("party_member_roles").delete().eq("party_id", party.id).eq("role", nextRole);
        if (deleteRoleError) throw deleteRoleError;
        const { error: insertError } = await supabase.from("party_member_roles").insert({ party_id: party.id, user_id: userId, role: nextRole } as any);
        if (insertError) throw insertError;
        const nextRoles = [...partyRoles.filter((row) => row.user_id !== userId && row.role !== nextRole), { party_id: party.id, user_id: userId, role: nextRole }];
        setPartyRoles(nextRoles);
        const roleMap = new Map(nextRoles.map((row) => [row.user_id, row.role]));
        setMembers((prev) => prev.map((member) => ({ ...member, organization_role: roleMap.get(member.user_id) ?? null })));
      }
      setMemberMenuOpen(null);
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e.message || "Could not update role");
    }
  };

  const postAnnouncement = async () => {
    if (!party || !meId || !newAnnouncement.trim()) return;
    try {
      const { error } = await supabase.from("party_announcements").insert({
        party_id: party.id,
        class_id: party.class_id,
        author_user_id: meId,
        body: newAnnouncement.trim(),
      } as any);
      if (error) throw error;
      setNewAnnouncement("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const postComment = async () => {
    if (!selectedAnnouncementId || !meId || !newComment.trim()) return;
    try {
      const { error } = await supabase.from("party_comments").insert({
        announcement_id: selectedAnnouncementId,
        author_user_id: meId,
        body: newComment.trim(),
      } as any);
      if (error) throw error;
      setNewComment("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    }
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
      const { error } = await supabase.from("party_announcements").delete().eq("id", announcementId);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== announcementId));
      setComments((prev) => {
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
    if (!isTeacher || !selectedAnnouncement) return;
    setConfirmDialog({
      title: "Delete comment?",
      message: "This comment will be removed for everyone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => deleteCommentConfirmed(commentId),
    });
  };

  const deleteCommentConfirmed = async (commentId: string) => {
    if (!selectedAnnouncement) return;
    try {
      const { error } = await supabase.from("party_comments").delete().eq("id", commentId);
      if (error) throw error;
      setComments((prev) => ({
        ...prev,
        [selectedAnnouncement.id]: (prev[selectedAnnouncement.id] ?? []).filter((comment) => comment.id !== commentId),
      }));
      toast.success("Comment deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete comment");
    }
  };

  const castLeadershipVote = async (position: "chair" | "whip", candidateId: string) => {
    if (!party || !meId || !isMember) return;
    if (hasOptedOut(position, candidateId)) return toast.error("This candidate opted out");
    try {
      if (myLeadershipVote(position) === candidateId) {
        const { error } = await supabase.from("party_leadership_votes").delete().eq("party_id", party.id).eq("voter_user_id", meId).eq("position", position);
        if (error) throw error;
        setVotes((prev) => prev.filter((v) => !(v.voter_user_id === meId && v.position === position)));
        toast.success("Vote withdrawn");
        return;
      }
      const { error } = await supabase.from("party_leadership_votes").upsert(
        {
          party_id: party.id,
          class_id: party.class_id,
          voter_user_id: meId,
          candidate_user_id: candidateId,
          position,
        } as any,
        { onConflict: "party_id,voter_user_id,position" },
      );
      if (error) throw error;
      setVotes((prev) => [...prev.filter((v) => !(v.voter_user_id === meId && v.position === position)), { voter_user_id: meId, candidate_user_id: candidateId, position }]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    }
  };

  const toggleOptOut = async (position: "chair" | "whip") => {
    if (!party || !meId || !isMember) return;
    const optedOut = hasOptedOut(position, meId);
    try {
      if (optedOut) {
        const { error } = await supabase.from("party_leadership_opt_outs").delete().eq("party_id", party.id).eq("user_id", meId).eq("position", position);
        if (error) throw error;
        setOptOuts((prev) => prev.filter((row) => !(row.user_id === meId && row.position === position)));
        toast.success("Opt-out removed");
        return;
      }
      const [{ error: optError }, { error: voteError }] = await Promise.all([
        supabase.from("party_leadership_opt_outs").upsert({ party_id: party.id, class_id: party.class_id, user_id: meId, position } as any, { onConflict: "party_id,user_id,position" }),
        supabase.from("party_leadership_votes").delete().eq("party_id", party.id).eq("candidate_user_id", meId).eq("position", position),
      ]);
      if (optError || voteError) throw optError ?? voteError;
      setOptOuts((prev) => [...prev.filter((row) => !(row.user_id === meId && row.position === position)), { user_id: meId, position }]);
      setVotes((prev) => prev.filter((vote) => !(vote.candidate_user_id === meId && vote.position === position)));
      toast.success("Opted out");
    } catch (e: any) {
      toast.error(e.message || "Could not update opt-out");
    }
  };

  const voteCount = (position: "chair" | "whip", candidateId: string) => hasOptedOut(position, candidateId) ? 0 : votes.filter((v) => v.position === position && v.candidate_user_id === candidateId).length;
  const myLeadershipVote = (position: "chair" | "whip") => votes.find((v) => v.position === position && v.voter_user_id === meId)?.candidate_user_id ?? null;
  const electionOpen = classSettings?.elections?.partyOpenById?.[partyId] ?? Boolean(classSettings?.elections?.open);
  const electionConcluded = Boolean(classSettings?.elections?.partyConcludedById?.[partyId]);

  const setPartyElectionOpen = async (open: boolean) => {
    if (!party || !isTeacher) return;
    const nextSettings = {
      ...classSettings,
      elections: {
        ...(classSettings.elections ?? {}),
        partyOpenById: { ...(classSettings.elections?.partyOpenById ?? {}), [party.id]: open },
      },
    };
    const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", party.class_id);
    if (error) return toast.error(error.message || "Could not update election");
    setClassSettings(nextSettings);
    toast.success(open ? "Party election opened" : "Party election closed");
  };

  const postPartyElectionResults = async () => {
    if (!party || !isTeacher) return;
    const firstRole = partyRoleOptions()[1]?.role as PartyRole | undefined;
    const secondRole = partyRoleOptions()[2]?.role as PartyRole | undefined;
    const firstWinner = leaderFor("chair");
    const secondWinner = leaderFor("whip");
    const nextSettings = {
      ...classSettings,
      elections: {
        ...(classSettings.elections ?? {}),
        partyConcludedById: { ...(classSettings.elections?.partyConcludedById ?? {}), [party.id]: true },
        partyOpenById: { ...(classSettings.elections?.partyOpenById ?? {}), [party.id]: false },
      },
    };
    try {
      if (firstRole && firstWinner) await updatePartyRole(firstWinner.user_id, firstRole);
      if (secondRole && secondWinner) await updatePartyRole(secondWinner.user_id, secondRole);
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", party.class_id);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success("Election results posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post results");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" style={{ "--party-color": party?.color || "#2563eb" } as CSSProperties}>
        {loading || !party ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="h-2" style={{ backgroundColor: party.color || "#2563eb" }} />
              <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-white" style={{ backgroundColor: party.color || "#2563eb" }}>
                      <PartyIcon name={party.name} />
                    </span>
                    {editingName ? (
                      <>
                        <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-2xl font-bold text-gray-900" />
                        <button type="button" onClick={() => void saveName()} className="rounded-md p-1 text-[var(--party-color)] hover:bg-gray-100"><Save className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-bold text-gray-900">{displayPartyName(party.name)}</h1>
                        {isTeacher && <button type="button" onClick={() => setEditingName(true)} className="rounded-md p-1 text-[var(--party-color)] hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>}
                      </>
                    )}
                  </div>
                  <p className="hidden">
                    Chair: {leaderFor("chair")?.display_name ?? "N/A"} • Whip: {leaderFor("whip")?.display_name ?? "N/A"} • {members.length} members
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    {partyRoleOptions()[1]?.label ?? "Leader"}: {memberForRole(partyRoleOptions()[1]?.role as PartyRole)?.display_name ?? leaderFor("chair")?.display_name ?? "N/A"} | {partyRoleOptions()[2]?.label ?? "Whip"}: {memberForRole(partyRoleOptions()[2]?.role as PartyRole)?.display_name ?? leaderFor("whip")?.display_name ?? "N/A"} | {members.length} members
                  </p>
                </div>
                {!isTeacher && (
                  <button
                    onClick={() => void joinOrSwitch()}
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: party.color || "#2563eb" }}
                  >
                    {isMember ? <LogOut className="h-4 w-4" /> : myParty ? <Repeat2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {isMember ? "Leave" : myParty ? "Switch to party" : "Join party"}
                  </button>
                )}
              </div>
              <div className="mt-5 border-t border-gray-200 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">About</h2>
                  {(isMember || isTeacher) && !editingAbout && (
                    <button onClick={() => setEditingAbout(true)} className="text-[var(--party-color)] hover:opacity-80"><Pencil className="h-4 w-4" /></button>
                  )}
                </div>
                {editingAbout ? (
                  <div className="space-y-3">
                    <textarea value={aboutDraft} onChange={(e) => setAboutDraft(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                    <button onClick={() => void saveAbout()} className="inline-flex items-center gap-2 rounded-md bg-[var(--party-color)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"><Save className="h-4 w-4" />Save</button>
                  </div>
                ) : (
                  <p className="whitespace-pre-line text-gray-700">{party.platform || "No platform yet."}</p>
                )}
              </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              {(["dashboard", "election"] as const).filter((tab) => tab === "dashboard" || isMember || isTeacher).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab ? "text-white" : "text-gray-700 hover:bg-gray-50"
                  }`}
                  style={activeTab === tab ? { backgroundColor: party.color || "#2563eb" } : undefined}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-6">
                {activeTab === "dashboard" ? (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
                  </div>
                  {canUseBoard && (
                    <div className="border-b border-gray-200 p-5">
                      <div className="rounded-md border border-gray-300 bg-white p-3 focus-within:ring-2 focus-within:ring-blue-500">
                        <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} rows={3} placeholder="Post an announcement..." className="w-full resize-y border-0 p-0 text-sm outline-none" />
                        <div className="mt-3 flex justify-end">
                          <button onClick={() => void postAnnouncement()} disabled={!newAnnouncement.trim()} className="inline-flex items-center gap-2 rounded-md bg-[var(--party-color)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Send className="h-4 w-4" />Post</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-[260px_1fr]">
                    <div className="max-h-[520px] overflow-y-auto border-r border-gray-200">
                      {announcements.length === 0 ? (
                        <div className="p-5 text-sm text-gray-500">No announcements yet.</div>
                      ) : (
                        announcements.map((a) => (
                          <button key={a.id} onClick={() => setSelectedAnnouncementId(a.id)} style={selectedAnnouncementId === a.id && a.author?.role !== "teacher" ? { borderLeftColor: party.color || "#2563eb" } : undefined} className={`relative w-full border-b border-gray-100 bg-white p-4 text-left hover:bg-gray-50 ${selectedAnnouncementId === a.id ? `border-l-4 ${a.author?.role === "teacher" ? "border-l-green-500" : ""}` : ""}`}>
                            {a.author?.role === "teacher" && <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
                            <div className="line-clamp-2 text-sm font-medium text-gray-900">{a.body}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              <Link to={`/profile/${a.author_user_id}`} className={partyAuthorLinkClass(a.author)}>{displayAuthorName(a.author)}</Link> • {new Date(a.created_at).toLocaleDateString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="max-h-[520px] overflow-y-auto p-5">
                      {selectedAnnouncement ? (
                        <div className="space-y-4">
                          <div className="relative rounded-md border border-gray-200 bg-white p-4">
                            {selectedAnnouncement.author?.role === "teacher" && <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
                            <div className="whitespace-pre-line text-sm text-gray-900">{selectedAnnouncement.body}</div>
                            <div className="mt-2 text-xs text-gray-500">
                              <Link to={`/profile/${selectedAnnouncement.author_user_id}`} className={partyAuthorLinkClass(selectedAnnouncement.author)}>{displayAuthorName(selectedAnnouncement.author)}</Link> • {new Date(selectedAnnouncement.created_at).toLocaleString()}
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
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                            {(comments[selectedAnnouncement.id] ?? []).map((comment) => (
                              <div key={comment.id} className="rounded-md border border-gray-200 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <Link to={`/profile/${comment.author_user_id}`} className={`font-medium ${partyAuthorLinkClass(comment.author)}`}>{displayAuthorName(comment.author)}</Link>
                                  {isTeacher && (
                                    <button type="button" onClick={() => void deleteComment(comment.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete comment">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="mt-1 text-gray-700">{comment.body}</div>
                              </div>
                            ))}
                          </div>
                          {canUseBoard && (
                            <div className="flex gap-2 border-t border-gray-200 pt-3">
                              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} placeholder="Write a comment..." className="flex-1 rounded-md border border-gray-300 px-3 py-2" />
                              <button onClick={() => void postComment()} disabled={!newComment.trim()} className="rounded-md bg-[var(--party-color)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Send</button>
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
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Vote className="h-5 w-5 text-[var(--party-color)]" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Party Leadership Elections</h2>
                        <p className="text-sm text-gray-500">{electionConcluded ? "Winners are final." : electionOpen ? "Voting is open." : "Voting is closed."}</p>
                      </div>
                    </div>
                    {isTeacher && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                          <button
                            type="button"
                            onClick={() => void setPartyElectionOpen(true)}
                            disabled={electionConcluded}
                            className={`px-3 py-2 text-sm font-medium disabled:opacity-50 ${electionOpen ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => void setPartyElectionOpen(false)}
                            disabled={electionConcluded}
                            className={`border-l border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 ${!electionOpen ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                          >
                            Close
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void postPartyElectionResults()}
                          disabled={electionConcluded}
                          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Post results
                        </button>
                      </div>
                    )}
                  </div>
                  {(["chair", "whip"] as const).map((position) => (
                    <div key={position} className="mb-5 last:mb-0">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold capitalize text-gray-700">{position}</h3>
                        <div className="text-sm text-gray-500">Winner: {leaderFor(position)?.display_name ?? "No votes yet"}</div>
                      </div>
                      {isMember && !electionConcluded && (
                        <button
                          type="button"
                          onClick={() => void toggleOptOut(position)}
                          disabled={!electionOpen}
                          className={`mb-3 rounded-md px-3 py-1.5 text-xs font-medium ${hasOptedOut(position, meId ?? "") ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"} disabled:opacity-50`}
                        >
                          {hasOptedOut(position, meId ?? "") ? "Opted out" : "Opt out"}
                        </button>
                      )}
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={`${position}:${member.user_id}`} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{member.display_name ?? "Member"}</div>
                              {hasOptedOut(position, member.user_id) && <div className="text-xs text-gray-500">Opted out</div>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">{voteCount(position, member.user_id)} votes</span>
                              {isMember && electionOpen && !electionConcluded && !hasOptedOut(position, member.user_id) && (
                                <button
                                  onClick={() => void castLeadershipVote(position, member.user_id)}
                                  className={`rounded px-3 py-1.5 text-xs font-medium ${myLeadershipVote(position) === member.user_id ? "text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                                  style={myLeadershipVote(position) === member.user_id ? { backgroundColor: party.color || "#2563eb" } : undefined}
                                >
                                  {myLeadershipVote(position) === member.user_id ? "Voted" : "Vote"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-[var(--party-color)]" />
                  <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                </div>
                <div className="mb-4 flex gap-2">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search members..." className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                    <option value="name">Name</option>
                    <option value="district">District</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {visibleMembers.map((m) => {
                    const roleLabel = partyMemberRole(m.user_id);
                    return (
                      <div key={m.user_id} className="relative flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                        {m.role === "teacher" && <GraduationCap className="absolute right-2 top-2 h-4 w-4 text-green-600" />}
                        {m.avatar_url ? <img src={m.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar className="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />}
                        <div className="min-w-0 flex-1">
                          <Link to={`/profile/${m.user_id}`} className={`truncate text-sm font-medium hover:underline ${roleLabel ? "text-purple-700" : m.role === "teacher" ? "text-green-700" : "text-[var(--party-color)]"}`}>{m.display_name ?? "Member"}</Link>
                          {m.role !== "teacher" && <div className="truncate text-xs text-gray-500">Rep.-{partyAbbr(m.party)}-{formatConstituency(m.constituency_name) || "N/A"}</div>}
                          {roleLabel && <div className="mt-1 inline-flex rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{roleLabel}</div>}
                        </div>
                        {isTeacher && (
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
                              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                                {partyRoleOptions().map((option) => (
                                  <button
                                    key={option.role}
                                    type="button"
                                    onClick={() => requestPartyRoleChange(m, option.role)}
                                    disabled={(m.organization_role ?? "member") === option.role}
                                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400"
                                  >
                                    <span>{option.label}</span>
                                    {(m.organization_role ?? "member") === option.role && <span className="text-xs">Current</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
