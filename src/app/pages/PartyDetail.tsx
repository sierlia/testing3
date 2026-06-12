import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle, Flag, GraduationCap, LogOut, MoreHorizontal, Pencil, Repeat2, Save, Send, Trash2, UserPlus, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { CollapsibleText } from "../components/CollapsibleText";
import { supabase } from "../utils/supabase";
import { SecureAvatar } from "../components/SecureAvatar";
import { formatConstituency } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { InfoTooltip } from "../components/InfoTooltip";
import { OrganizationLettersInbox } from "../components/OrganizationLettersInbox";
import { ContributionButton } from "../components/ContributionButton";
import { profilePath } from "../utils/profileRoute";
import { VerticalMenuPlacement, verticalMenuPlacementClass, verticalMenuPlacementForButton } from "../utils/menuPlacement";
import { TeacherAddMembersPopover, MemberCandidate } from "../components/TeacherAddMembersPopover";
import { AttachmentList, AttachmentPicker, DiscussionAttachment, parseDiscussionAttachments } from "../components/DiscussionAttachments";
import { sendOrganizationInvite } from "../utils/organizationInvites";
import { ANNOUNCEMENT_WORD_LIMIT, COMMENT_WORD_LIMIT, wordCount, wordLimitClass, withinWordLimit } from "../utils/wordLimits";

type PartyRow = { id: string; class_id: string; name: string; platform: string; color: string; created_at: string };
type PartyRole = "majority_leader" | "majority_whip" | "minority_leader" | "minority_whip" | "leader" | "whip" | "chair" | "vice_chair";
type MemberRow = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null; role?: string | null; organization_role?: PartyRole | null };
type Announcement = { id: string; author_user_id: string; body: string; created_at: string; updated_at?: string | null; attachments?: DiscussionAttachment[]; author?: MemberRow | null };
type CommentRow = { id: string; announcement_id: string; author_user_id: string; body: string; created_at: string; updated_at?: string | null; attachments?: DiscussionAttachment[]; author?: MemberRow | null };
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

const partyDetails: Record<string, { text: string; url: string }> = {
  "Democratic Party": { text: "The Democratic Party traces its roots to the Democratic-Republican tradition and the party built around Andrew Jackson in the 1820s and 1830s. Over time it became associated with a broad national coalition that, in modern politics, often emphasizes civil rights, social programs, labor, climate policy, and a more active federal government. Today it is one of the two major parties, meaning one of the two parties that dominate national elections, congressional organization, and presidential politics in the United States.", url: "https://democrats.org" },
  "Republican Party": { text: "The Republican Party was founded in 1854 by anti-slavery expansion coalitions and rose nationally with Abraham Lincoln's election in 1860. In modern politics it is often associated with conservatism, limited government, lower taxes, deregulation, social conservatism, and a strong national defense. Today it is one of the two major parties, meaning one of the two parties that dominate national elections, congressional organization, and presidential politics in the United States.", url: "https://gop.com" },
  "Green Party": { text: "Grew from U.S. Green organizing in the 1980s and 1990s, emphasizing ecology, democracy, social justice, and peace.", url: "https://www.gp.org" },
  "Libertarian Party": { text: "Founded in 1971 in Colorado around individual liberty, limited government, and free-market principles.", url: "https://www.lp.org" },
};

function PartyHistoryTooltip({ name }: { name: string }) {
  const details = partyDetails[displayPartyName(name)];
  if (!details) return null;
  return (
    <InfoTooltip label={`${displayPartyName(name)} history`}>
      <p>{details.text}</p>
      <a href={details.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-600 hover:underline">Official website</a>
    </InfoTooltip>
  );
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
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [seenAnnouncementIds, setSeenAnnouncementIds] = useState<Set<string>>(new Set());
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newAnnouncementAttachments, setNewAnnouncementAttachments] = useState<DiscussionAttachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentAttachments, setNewCommentAttachments] = useState<DiscussionAttachment[]>([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementBody, setEditingAnnouncementBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "district">("name");
  const [votes, setVotes] = useState<Array<{ position: "chair" | "whip"; voter_user_id: string; candidate_user_id: string }>>([]);
  const [optOuts, setOptOuts] = useState<Array<{ position: "chair" | "whip"; user_id: string }>>([]);
  const [partyRoles, setPartyRoles] = useState<PartyMemberRoleRow[]>([]);
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [memberMenuPlacement, setMemberMenuPlacement] = useState<VerticalMenuPlacement>("down");
  const [majorPartyAlignment, setMajorPartyAlignment] = useState<"majority" | "minority" | "tie" | null>(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "letters" | "election">("dashboard");
  const [classSettings, setClassSettings] = useState<any>({});

  const isMember = !!party && comparablePartyName(myParty) === comparablePartyName(party.name);
  const isTeacher = viewerRole === "teacher";
  const canUseBoard = isMember || isTeacher;
  const selectedAnnouncement = announcements.find((a) => a.id === selectedAnnouncementId) ?? null;
  const newAnnouncementWordCount = wordCount(newAnnouncement);
  const newCommentWordCount = wordCount(newComment);
  const myPartyRole = partyRoles.find((row) => row.user_id === meId)?.role ?? null;
  const isPartyLeader = Boolean(myPartyRole);

  const markAnnouncementSeen = (announcementId: string) => {
    const storageKey = `gavel:party-announcements-seen:${partyId}`;
    setSeenAnnouncementIds((current) => {
      const next = new Set(current);
      next.add(announcementId);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    if (!memberMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-party-member-menu]")) return;
      setMemberMenuOpen(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [memberMenuOpen]);

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
      const nextPartyMembers = ((memberRows ?? []) as any[]).filter((member) => comparablePartyName(member.party) === comparablePartyName((p as any).name)).map((member) => ({ ...member, organization_role: roleMap.get(member.user_id) ?? null })) as MemberRow[];
      setMembers(nextPartyMembers as any);
      const candidateRows = ((memberRows ?? []) as any[]).filter((member) => comparablePartyName(member.party) !== comparablePartyName((p as any).name));
      const candidateUserIds = candidateRows.map((member) => member.user_id);
      const { data: lobbyistRows } = await supabase.from("lobbyist_group_members").select("user_id").in("user_id", candidateUserIds.length ? candidateUserIds : ["00000000-0000-0000-0000-000000000000"]);
      const lobbyistUserIds = new Set(((lobbyistRows ?? []) as any[]).map((row) => row.user_id));
      setMemberCandidates(
        candidateRows.map((member) => ({
          user_id: member.user_id,
          display_name: member.display_name,
          party: member.party,
          constituency_name: member.constituency_name,
          avatar_url: member.avatar_url,
          role: member.role,
          membershipNote: member.party ? `Currently in ${displayPartyName(member.party)}` : null,
          disabledReason: lobbyistUserIds.has(member.user_id) ? "Already in a lobbyist group." : null,
        })),
      );

      const { data: aRows, error: aErr } = await supabase
        .from("party_announcements")
        .select("id,author_user_id,body,created_at,updated_at,attachments")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;

      const authorIds = [...new Set((aRows ?? []).map((a: any) => a.author_user_id))];
      const { data: authors } = await supabase
        .from("profiles")
        .select("user_id,display_name,party,constituency_name,avatar_url,role")
        .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
      const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, { ...a, organization_role: nextRoles.find((row) => row.user_id === a.user_id)?.role ?? null }]));
      const mappedAnnouncements = (aRows ?? []).map((a: any) => ({ ...a, attachments: parseDiscussionAttachments(a.attachments), author: authorMap.get(a.author_user_id) ?? null }));
      setAnnouncements(mappedAnnouncements as any);
      setSelectedAnnouncementId((prev) => prev ?? mappedAnnouncements[0]?.id ?? null);

      const announcementIds = mappedAnnouncements.map((a: any) => a.id);
      if (announcementIds.length) {
        const { data: cRows } = await supabase.from("party_comments").select("id,announcement_id,author_user_id,body,created_at,updated_at,attachments").in("announcement_id", announcementIds).order("created_at", { ascending: true });
        const commentAuthorIds = [...new Set((cRows ?? []).map((c: any) => c.author_user_id))];
        const { data: cAuthors } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url,role")
          .in("user_id", commentAuthorIds.length ? commentAuthorIds : ["00000000-0000-0000-0000-000000000000"]);
        const cAuthorMap = new Map((cAuthors ?? []).map((a: any) => [a.user_id, { ...a, organization_role: nextRoles.find((row) => row.user_id === a.user_id)?.role ?? null }]));
        const grouped: Record<string, CommentRow[]> = {};
        for (const row of cRows ?? []) {
          const comment = { ...(row as any), attachments: parseDiscussionAttachments((row as any).attachments), author: cAuthorMap.get((row as any).author_user_id) ?? null };
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
    try {
      setSeenAnnouncementIds(new Set(JSON.parse(window.localStorage.getItem(`gavel:party-announcements-seen:${partyId}`) || "[]")));
    } catch {
      setSeenAnnouncementIds(new Set());
    }
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
    const { data: lobbyMembership } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", meId).limit(1);
    if ((lobbyMembership ?? []).length) {
      toast.error("Lobbyist group members cannot join parties");
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

  const addMemberToParty = async (candidate: MemberCandidate) => {
    if (!party || !isTeacher) return;
    const nextParty = displayPartyName(party.name);
    const { error } = await supabase.from("profiles").update({ party: nextParty } as any).eq("user_id", candidate.user_id);
    if (error) return toast.error(error.message || "Could not add member");
    const row: MemberRow = {
      user_id: candidate.user_id,
      display_name: candidate.display_name,
      party: nextParty,
      constituency_name: candidate.constituency_name ?? null,
      avatar_url: candidate.avatar_url ?? null,
      role: candidate.role ?? null,
      organization_role: null,
    };
    setMembers((prev) => (prev.some((member) => member.user_id === candidate.user_id) ? prev : [...prev, row]));
    setMemberCandidates((prev) => prev.filter((member) => member.user_id !== candidate.user_id));
    toast.success("Member added");
  };

  const inviteMemberToParty = async (candidate: MemberCandidate) => {
    if (!party) return;
    try {
      await sendOrganizationInvite({
        classId: party.class_id,
        recipientUserId: candidate.user_id,
        orgType: "party",
        orgId: party.id,
        orgName: displayPartyName(party.name),
        href: `/parties/${party.id}`,
      });
      toast.success("Invite sent");
    } catch (e: any) {
      toast.error(e.message || "Could not send invite");
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

  const removePartyMember = async (member: MemberRow) => {
    if (!party || !isTeacher) return;
    try {
      const [{ error: roleError }, { error: profileError }] = await Promise.all([
        supabase.from("party_member_roles").delete().eq("party_id", party.id).eq("user_id", member.user_id),
        supabase.from("profiles").update({ party: null } as any).eq("user_id", member.user_id),
      ]);
      if (roleError || profileError) throw roleError ?? profileError;
      setMembers((prev) => prev.filter((row) => row.user_id !== member.user_id));
      setPartyRoles((prev) => prev.filter((row) => row.user_id !== member.user_id));
      setMemberCandidates((prev) => [
        ...prev.filter((row) => row.user_id !== member.user_id),
        {
          user_id: member.user_id,
          display_name: member.display_name,
          party: null,
          constituency_name: member.constituency_name,
          avatar_url: member.avatar_url,
          role: member.role ?? null,
        },
      ]);
      setMemberMenuOpen(null);
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e.message || "Could not remove member");
    }
  };

  const requestRemovePartyMember = (member: MemberRow) => {
    if (!party || !isTeacher) return;
    setConfirmDialog({
      title: "Remove party member?",
      message: `Remove ${member.display_name ?? "this member"} from ${displayPartyName(party.name)}?`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => removePartyMember(member),
    });
  };

  const postAnnouncement = async () => {
    if (!party || !meId || !newAnnouncement.trim()) return;
    if (!withinWordLimit(newAnnouncement, ANNOUNCEMENT_WORD_LIMIT)) return toast.error(`Announcements must be ${ANNOUNCEMENT_WORD_LIMIT} words or fewer`);
    try {
      const { error } = await supabase.from("party_announcements").insert({
        party_id: party.id,
        class_id: party.class_id,
        author_user_id: meId,
        body: newAnnouncement.trim(),
        attachments: newAnnouncementAttachments,
      } as any);
      if (error) throw error;
      setNewAnnouncement("");
      setNewAnnouncementAttachments([]);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    }
  };

  const postComment = async () => {
    if (!selectedAnnouncementId || !meId || !newComment.trim()) return;
    if (!withinWordLimit(newComment, COMMENT_WORD_LIMIT)) return toast.error(`Comments must be ${COMMENT_WORD_LIMIT} words or fewer`);
    try {
      const { error } = await supabase.from("party_comments").insert({
        announcement_id: selectedAnnouncementId,
        author_user_id: meId,
        body: newComment.trim(),
        attachments: newCommentAttachments,
      } as any);
      if (error) throw error;
      setNewComment("");
      setNewCommentAttachments([]);
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

  const editAnnouncement = async () => {
    if (!editingAnnouncementId || !editingAnnouncementBody.trim()) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("party_announcements").update({ body: editingAnnouncementBody.trim(), updated_at: updatedAt } as any).eq("id", editingAnnouncementId);
    if (error) return toast.error(error.message || "Could not edit announcement");
    setAnnouncements((prev) => prev.map((announcement) => announcement.id === editingAnnouncementId ? { ...announcement, body: editingAnnouncementBody.trim(), updated_at: updatedAt } : announcement));
    setEditingAnnouncementId(null);
    setEditingAnnouncementBody("");
  };

  const editComment = async () => {
    if (!selectedAnnouncement || !editingCommentId || !editingCommentBody.trim()) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("party_comments").update({ body: editingCommentBody.trim(), updated_at: updatedAt } as any).eq("id", editingCommentId);
    if (error) return toast.error(error.message || "Could not edit comment");
    setComments((prev) => ({
      ...prev,
      [selectedAnnouncement.id]: (prev[selectedAnnouncement.id] ?? []).map((comment) => comment.id === editingCommentId ? { ...comment, body: editingCommentBody.trim(), updated_at: updatedAt } : comment),
    }));
    setEditingCommentId(null);
    setEditingCommentBody("");
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
                        <PartyHistoryTooltip name={party.name} />
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
                <div className="flex flex-wrap items-center gap-2">
                  <ContributionButton recipientType="party" recipientId={party.id} recipientName={displayPartyName(party.name)} />
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
              {(["dashboard", "letters", "election"] as const).filter((tab) => tab !== "election" || isMember || isTeacher).map((tab) => {
                const inactiveElection = tab === "election" && !electionOpen;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-md px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                      inactiveElection
                        ? activeTab === tab ? "bg-gray-100 text-gray-500" : "text-gray-400 hover:bg-gray-50"
                        : activeTab === tab ? "text-white" : "text-gray-700 hover:bg-gray-50"
                    }`}
                    style={!inactiveElection && activeTab === tab ? { backgroundColor: party.color || "#2563eb" } : undefined}
                  >
                    {inactiveElection ? "Election (inactive)" : tab}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-6">
                {activeTab === "letters" ? (
                  <OrganizationLettersInbox organizationType="party" organizationId={party.id} organizationName={displayPartyName(party.name)} memberIds={members.map((member) => member.user_id)} />
                ) : activeTab === "dashboard" ? (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
                  </div>
                  {canUseBoard && (
                    <div className="border-b border-gray-200 p-5">
                      <div className="rounded-md border border-gray-300 bg-white p-3 focus-within:ring-2 focus-within:ring-blue-500">
                        <div className="relative">
                          <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} rows={3} placeholder="Post an announcement..." className="w-full resize-y border-0 p-0 pr-24 text-sm outline-none" />
                          <span className={`pointer-events-none absolute bottom-0 right-0 text-[11px] ${wordLimitClass(newAnnouncementWordCount, ANNOUNCEMENT_WORD_LIMIT)}`}>
                            {newAnnouncementWordCount}/{ANNOUNCEMENT_WORD_LIMIT}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <AttachmentPicker value={newAnnouncementAttachments} onChange={setNewAnnouncementAttachments} />
                          <button onClick={() => void postAnnouncement()} disabled={!newAnnouncement.trim() || !withinWordLimit(newAnnouncement, ANNOUNCEMENT_WORD_LIMIT)} className="inline-flex items-center gap-2 rounded-md bg-[var(--party-color)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Send className="h-4 w-4" />Post</button>
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
                          <button key={a.id} onClick={() => { setSelectedAnnouncementId(a.id); markAnnouncementSeen(a.id); }} style={selectedAnnouncementId === a.id && a.author?.role !== "teacher" ? { borderLeftColor: party.color || "#2563eb" } : undefined} className={`relative w-full border-b border-gray-100 bg-white p-4 text-left hover:bg-gray-50 ${selectedAnnouncementId === a.id ? `border-l-4 ${a.author?.role === "teacher" ? "border-l-green-500" : ""}` : ""}`}>
                            {a.author?.role === "teacher" && <GraduationCap className="absolute right-3 top-3 h-4 w-4 text-green-600" />}
                            {!seenAnnouncementIds.has(a.id) && <span className="mb-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">New</span>}
                            <div className="line-clamp-2 text-sm font-medium text-gray-900">{a.body}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              <Link to={profilePath(a.author_user_id)} className={partyAuthorLinkClass(a.author)}>{displayAuthorName(a.author)}</Link> • {new Date(a.created_at).toLocaleDateString()}
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
                            <div className="mt-2 text-xs text-gray-500">
                              <Link to={profilePath(selectedAnnouncement.author_user_id)} className={partyAuthorLinkClass(selectedAnnouncement.author)}>{displayAuthorName(selectedAnnouncement.author)}</Link> • {new Date(selectedAnnouncement.created_at).toLocaleString()}
                            </div>
                            {(isTeacher || selectedAnnouncement.author_user_id === meId) && (
                              <div className="mt-3 flex justify-end gap-2">
                                {selectedAnnouncement.author_user_id === meId && (
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
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                            {(comments[selectedAnnouncement.id] ?? []).map((comment) => (
                              <div key={comment.id} className="rounded-md border border-gray-200 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <Link to={profilePath(comment.author_user_id)} className={`font-medium ${partyAuthorLinkClass(comment.author)}`}>{displayAuthorName(comment.author)}</Link>
                                  {isTeacher && (
                                    <button type="button" onClick={() => void deleteComment(comment.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete comment">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                {editingCommentId === comment.id ? (
                                  <div className="mt-2 space-y-2">
                                    <textarea value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => void editComment()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                                      <button type="button" onClick={() => setEditingCommentId(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="mt-1 text-gray-700">{comment.body}</div>
                                    <AttachmentList attachments={comment.attachments} />
                                  </>
                                )}
                                {comment.updated_at && new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 1000 && <div className="mt-1 text-xs text-gray-400">Edited</div>}
                                {comment.author_user_id === meId && editingCommentId !== comment.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentBody(comment.body);
                                    }}
                                    className="mt-2 text-xs text-gray-500 hover:text-gray-900"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {canUseBoard && (
                            <>
                            <div className="flex gap-2 border-t border-gray-200 pt-3">
                              <div className="relative flex-1">
                                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} placeholder="Write a comment..." className="w-full rounded-md border border-gray-300 px-3 py-2 pr-20" />
                                <span className={`pointer-events-none absolute bottom-2 right-3 text-[11px] ${wordLimitClass(newCommentWordCount, COMMENT_WORD_LIMIT)}`}>
                                  {newCommentWordCount}/{COMMENT_WORD_LIMIT}
                                </span>
                              </div>
                              <button onClick={() => void postComment()} disabled={!newComment.trim() || !withinWordLimit(newComment, COMMENT_WORD_LIMIT)} className="rounded-md bg-[var(--party-color)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Send</button>
                            </div>
                            <div className="mt-2">
                              <AttachmentPicker value={newCommentAttachments} onChange={setNewCommentAttachments} />
                            </div>
                            </>
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
                        <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => void setPartyElectionOpen(true)}
                            disabled={electionConcluded}
                            className={`rounded px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${electionOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => void setPartyElectionOpen(false)}
                            disabled={electionConcluded}
                            className={`rounded px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${!electionOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
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
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[var(--party-color)]" />
                    <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                  </div>
                  {(isTeacher || isPartyLeader) ? (
                    <TeacherAddMembersPopover
                      candidates={memberCandidates}
                      onAdd={isTeacher ? addMemberToParty : undefined}
                      onInvite={inviteMemberToParty}
                      inviteOnly={!isTeacher}
                      buttonLabel={isTeacher ? "Add or invite member" : "Invite member"}
                    />
                  ) : null}
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
                        <SecureAvatar src={m.avatar_url} alt={m.display_name ?? "Member"} className="h-10 w-10 rounded-full object-cover" fallbackClassName="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <Link to={profilePath(m.user_id)} className={`truncate text-sm font-medium hover:underline ${m.role === "teacher" ? "text-green-700" : roleLabel ? "text-purple-700" : "text-[var(--party-color)]"}`}>{m.display_name ?? "Member"}</Link>
                          {m.role !== "teacher" && <div className="truncate text-xs text-gray-500">Rep.-{partyAbbr(m.party)}-{formatConstituency(m.constituency_name) || "N/A"}</div>}
                          {roleLabel && <div className="mt-1 inline-flex rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{roleLabel}</div>}
                        </div>
                        {isTeacher && (
                          <div className="relative" data-party-member-menu onPointerDown={(event) => event.stopPropagation()}>
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
                              <div className={`absolute right-0 z-20 w-52 rounded-md border border-gray-200 bg-white p-1 shadow-lg ${verticalMenuPlacementClass(memberMenuPlacement)}`}>
                                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Modify position</div>
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
                                <div className="my-1 border-t border-gray-100" />
                                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other</div>
                                <button
                                  type="button"
                                  onClick={() => requestRemovePartyMember(m)}
                                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </button>
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
