import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { DollarSign, LogOut, MoreHorizontal, Pencil, Plus, Search, Send, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { SecureAvatar } from "../components/SecureAvatar";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";
import { profilePath } from "../utils/profileRoute";
import { committeeDisplayName } from "../utils/committeeNames";
import { AttachmentList, AttachmentPicker, DiscussionAttachment, parseDiscussionAttachments } from "../components/DiscussionAttachments";

type Member = { user_id: string; display_name: string | null; avatar_url: string | null; role: string | null };
type Contribution = {
  id: string;
  recipient_type: string;
  recipient_id: string;
  from_user_id: string | null;
  amount: number;
  note: string;
  created_at: string;
  contributorName?: string;
  recipientName?: string;
};
type Candidate = { user_id: string; display_name: string | null; avatar_url: string | null; role: string | null };
type Announcement = { id: string; author_user_id: string; body: string; created_at: string; updated_at?: string | null; attachments?: DiscussionAttachment[]; author?: Member | null };

function money(value: number) {
  return `$${Math.max(0, Number(value ?? 0)).toLocaleString()}`;
}

function effectiveGroupStartingAmount(group: any, classSettings: any) {
  const storedStartingAmount = Math.max(0, Number(group?.starting_amount ?? 0) || 0);
  if (storedStartingAmount > 0) return storedStartingAmount;
  return Math.max(0, Number(classSettings?.money?.startingAmount ?? 1000) || 0);
}

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function displayAccessNote(note: string) {
  if (/^dashboard access$/i.test(note.trim())) return "Message board access";
  if (/^review access$/i.test(note.trim())) return "Markup area access";
  return note;
}

export function LobbyistGroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = id!;
  const activeTab = searchParams.get("tab") === "spending" ? "spending" : "dashboard";
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [classSettings, setClassSettings] = useState<any>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newAnnouncementAttachments, setNewAnnouncementAttachments] = useState<DiscussionAttachment[]>([]);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementBody, setEditingAnnouncementBody] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ name: "", description: "" });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const uid = (await getCurrentUser())?.id ?? null;
      setMeId(uid);
      const { data: g } = await supabase.from("lobbyist_groups").select("id,class_id,name,description,join_mode,starting_amount").eq("id", groupId).maybeSingle();
      setGroup(g as any);
      if (!g) return;
      const [{ data: memberRows }, { data: profile }, { data: spending }, directory, { data: announcementRows }, { data: classRow }, { data: committees }, { data: parties }, { data: caucuses }] = await Promise.all([
        supabase.from("lobbyist_group_members").select("user_id").eq("group_id", groupId),
        uid ? supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle() : ({ data: null } as any),
        supabase.from("lobbyist_contributions").select("id,recipient_type,recipient_id,from_user_id,amount,note,created_at").eq("group_id", groupId).order("created_at", { ascending: false }),
        supabase.rpc("class_directory", { target_class: (g as any).class_id } as any),
        supabase.from("lobbyist_group_announcements").select("id,author_user_id,body,created_at,updated_at,attachments").eq("group_id", groupId).order("created_at", { ascending: false }),
        supabase.from("classes").select("settings").eq("id", (g as any).class_id).maybeSingle(),
        supabase.from("committees").select("id,name").eq("class_id", (g as any).class_id),
        supabase.from("parties").select("id,name").eq("class_id", (g as any).class_id),
        supabase.from("caucuses").select("id,title").eq("class_id", (g as any).class_id),
      ]);

      setClassSettings((classRow as any)?.settings ?? {});
      setIsTeacher((profile as any)?.role === "teacher");
      const ids = (memberRows ?? []).map((row: any) => row.user_id);
      setIsMember(uid ? ids.includes(uid) : false);
      setGroupDraft({ name: (g as any).name ?? "", description: (g as any).description ?? "" });

      const profileIds = Array.from(
        new Set([
          ...ids,
          ...((spending ?? []) as any[]).map((row) => row.from_user_id).filter(Boolean),
          ...((spending ?? []) as any[]).filter((row) => row.recipient_type === "member").map((row) => row.recipient_id),
          ...((announcementRows ?? []) as any[]).map((row) => row.author_user_id),
        ]),
      );
      const { data: profiles } = profileIds.length
        ? await supabase.from("profiles").select("user_id,display_name,avatar_url,role").in("user_id", profileIds)
        : ({ data: [] } as any);
      const profileMap = new Map(((profiles ?? []) as Member[]).map((profile) => [profile.user_id, profile]));
      const committeeNames = new Map(((committees ?? []) as any[]).map((committee) => [committee.id, committeeDisplayName(committee.name)]));
      const partyNames = new Map(((parties ?? []) as any[]).map((party) => [party.id, displayPartyName(party.name)]));
      const caucusNames = new Map(((caucuses ?? []) as any[]).map((caucus) => [caucus.id, caucus.title ?? "Caucus"]));
      const recipientNameFor = (row: any) => {
        if (row.recipient_type === "member") return profileMap.get(row.recipient_id)?.display_name ?? "Member";
        if (row.recipient_type === "committee") return committeeNames.get(row.recipient_id) ?? "Committee";
        if (row.recipient_type === "party") return partyNames.get(row.recipient_id) ?? "Party";
        if (row.recipient_type === "caucus") return caucusNames.get(row.recipient_id) ?? "Caucus";
        return "Recipient";
      };

      setMembers(ids.map((userId: string) => profileMap.get(userId) ?? { user_id: userId, display_name: "Member", avatar_url: null, role: null }));
      const memberSet = new Set(ids);
      const nextCandidates = ((directory.data ?? []) as any[])
        .filter((row) => !memberSet.has(row.user_id))
        .map((row) => ({ user_id: row.user_id, display_name: row.display_name ?? "Member", avatar_url: row.avatar_url ?? null, role: row.role ?? null }));
      setCandidates(nextCandidates);
      setContributions(
        ((spending ?? []) as any[]).map((row) => ({
          ...row,
          contributorName: row.from_user_id ? profileMap.get(row.from_user_id)?.display_name ?? "Member" : (g as any).name,
          recipientName: recipientNameFor(row),
          note: displayAccessNote(row.note ?? ""),
        })),
      );
      const mappedAnnouncements = ((announcementRows ?? []) as any[]).map((row) => ({
        ...row,
        attachments: parseDiscussionAttachments(row.attachments),
        author: profileMap.get(row.author_user_id) ?? null,
      }));
      setAnnouncements(mappedAnnouncements);
      setSelectedAnnouncementId((current) => current && mappedAnnouncements.some((announcement) => announcement.id === current) ? current : mappedAnnouncements[0]?.id ?? null);
    } catch (error: any) {
      toast.error(error.message || "Could not load lobbyist group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [groupId]);

  useEffect(() => {
    if (!memberPickerOpen && !openMemberMenuId) return;
    const close = () => {
      setMemberPickerOpen(false);
      setOpenMemberMenuId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [memberPickerOpen, openMemberMenuId]);

  const totalSpent = useMemo(() => contributions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), [contributions]);
  const totalMoney = useMemo(() => Math.max(0, effectiveGroupStartingAmount(group, classSettings) - totalSpent), [classSettings, group, totalSpent]);
  const selectedAnnouncement = announcements.find((announcement) => announcement.id === selectedAnnouncementId) ?? null;
  const canPostAnnouncements = isMember || isTeacher;
  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    return candidates.filter((candidate) => !q || (candidate.display_name ?? "Member").toLowerCase().includes(q));
  }, [candidates, candidateSearch]);

  const join = async () => {
    if (!meId || !group) return;
    const { data: otherMemberships } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", meId);
    if ((otherMemberships ?? []).length) return toast.error("You are already in a lobbyist group");
    const { error } = await supabase.from("lobbyist_group_members").insert({ group_id: groupId, user_id: meId } as any);
    if (error) return toast.error(error.message || "Could not join");
    await load();
  };

  const leave = async () => {
    if (!meId || !group || group.join_mode === "teacher_assigned") return;
    const { error } = await supabase.from("lobbyist_group_members").delete().eq("group_id", groupId).eq("user_id", meId);
    if (error) return toast.error(error.message || "Could not leave");
    await load();
  };

  const assignMember = async (candidate: Candidate) => {
    if (!isTeacher) return;
    const { data: existingLobbyist } = await supabase.from("lobbyist_group_members").select("user_id").eq("user_id", candidate.user_id).limit(1);
    if ((existingLobbyist ?? []).length) return toast.error("That member is already in a lobbyist group");
    if (candidate.role !== "teacher") {
      await Promise.all([
        supabase.from("profiles").update({ party: null } as any).eq("user_id", candidate.user_id),
        supabase.from("committee_members").delete().eq("user_id", candidate.user_id),
        supabase.from("caucus_members").delete().eq("user_id", candidate.user_id),
      ]);
    }
    const { error } = await supabase.from("lobbyist_group_members").insert({ group_id: groupId, user_id: candidate.user_id, assigned_by_teacher: true } as any);
    if (error) return toast.error(error.message || "Could not assign member");
    setCandidates((current) => current.filter((row) => row.user_id !== candidate.user_id));
    await load();
    toast.success("Member added");
  };

  const removeMember = async (userId: string) => {
    if (!isTeacher) return;
    const { error } = await supabase.from("lobbyist_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    if (error) return toast.error(error.message || "Could not remove member");
    setMembers((current) => current.filter((member) => member.user_id !== userId));
    toast.success("Member removed");
  };

  const saveGroup = async () => {
    if (!isTeacher || !groupDraft.name.trim()) return;
    const { error } = await supabase
      .from("lobbyist_groups")
      .update({ name: groupDraft.name.trim(), description: groupDraft.description.trim() } as any)
      .eq("id", groupId);
    if (error) return toast.error(error.message || "Could not update lobbyist group");
    setGroup((current: any) => current ? { ...current, name: groupDraft.name.trim(), description: groupDraft.description.trim() } : current);
    setGroupEditorOpen(false);
    toast.success("Lobbyist group updated");
  };

  const requestDeleteGroup = () => {
    if (!isTeacher || !group) return;
    setConfirmDialog({
      title: "Delete lobbyist group?",
      message: `${group.name} will be removed from this simulation. This cannot be undone.`,
      confirmLabel: "Delete group",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("lobbyist_groups").delete().eq("id", groupId);
        if (error) return toast.error(error.message || "Could not delete lobbyist group");
        toast.success("Lobbyist group deleted");
        navigate("/lobbyists");
      },
    });
  };

  const postAnnouncement = async () => {
    if (!group || !meId || !newAnnouncement.trim() || !canPostAnnouncements) return;
    const { error } = await supabase.from("lobbyist_group_announcements").insert({
      group_id: groupId,
      class_id: group.class_id,
      author_user_id: meId,
      body: newAnnouncement.trim(),
      attachments: newAnnouncementAttachments,
    } as any);
    if (error) return toast.error(error.message || "Could not post announcement");
    setNewAnnouncement("");
    setNewAnnouncementAttachments([]);
    await load();
    toast.success("Announcement posted");
  };

  const editAnnouncement = async () => {
    if (!editingAnnouncementId || !editingAnnouncementBody.trim()) return;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("lobbyist_group_announcements").update({ body: editingAnnouncementBody.trim(), updated_at: updatedAt } as any).eq("id", editingAnnouncementId);
    if (error) return toast.error(error.message || "Could not edit announcement");
    setAnnouncements((current) => current.map((announcement) => announcement.id === editingAnnouncementId ? { ...announcement, body: editingAnnouncementBody.trim(), updated_at: updatedAt } : announcement));
    setEditingAnnouncementId(null);
  };

  if (loading && !group) {
    return <div className="min-h-screen bg-gray-50"><Navigation /><main className="mx-auto max-w-7xl px-4 py-10 text-gray-600">Loading...</main></div>;
  }

  if (!group) {
    return <div className="min-h-screen bg-gray-50"><Navigation /><main className="mx-auto max-w-7xl px-4 py-10 text-gray-600">Lobbyist group not found.</main></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="rounded-md bg-green-50 px-3 py-1.5 font-semibold text-green-800">Total money: {money(totalMoney)}</span>
              <span className="rounded-md bg-blue-50 px-3 py-1.5 font-semibold text-blue-800">Contributed: {money(totalSpent)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTeacher && (
              <>
                <button type="button" onClick={() => setGroupEditorOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={requestDeleteGroup} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
            {!isTeacher && group.join_mode === "free_join" && (
              isMember ? (
                <button type="button" onClick={() => void leave()} className="inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"><LogOut className="h-4 w-4" />Leave</button>
              ) : (
                <button type="button" onClick={() => void join()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><UserPlus className="h-4 w-4" />Join</button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <Link to={`/lobbyists/${groupId}`} className={`rounded-md px-4 py-2.5 text-sm font-medium ${activeTab === "dashboard" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>Dashboard</Link>
          <Link to={`/lobbyists/${groupId}?tab=spending`} className={`rounded-md px-4 py-2.5 text-sm font-medium ${activeTab === "spending" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>Spending</Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            {activeTab === "spending" ? (
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 p-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Spending</h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Recipient</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {contributions.map((contribution) => (
                        <tr key={contribution.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{new Date(contribution.created_at).toLocaleDateString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-green-700">{money(contribution.amount)}</td>
                          <td className="px-4 py-3 text-gray-900">{contribution.recipientName}</td>
                          <td className="px-4 py-3 text-gray-600">{contribution.contributorName}</td>
                          <td className="max-w-md px-4 py-3 text-gray-600">{contribution.note || "No note"}</td>
                        </tr>
                      ))}
                      {!contributions.length && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No campaign contributions yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">About</h2>
                  <p className="mt-3 whitespace-pre-line text-gray-700">{group.description || "No description yet."}</p>
                </section>

                <section className="overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900">Announcement Board</h2>
                  </div>
                  {canPostAnnouncements && (
                    <div className="border-b border-gray-200 p-6">
                      <div className="rounded-md border border-gray-300 bg-white p-3 focus-within:ring-2 focus-within:ring-blue-500">
                        <textarea value={newAnnouncement} onChange={(event) => setNewAnnouncement(event.target.value)} placeholder="Post an announcement..." rows={3} className="w-full resize-y border-0 p-0 text-sm outline-none" />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <AttachmentPicker value={newAnnouncementAttachments} onChange={setNewAnnouncementAttachments} />
                          <button onClick={() => void postAnnouncement()} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50" disabled={!newAnnouncement.trim()}>
                            <Send className="h-4 w-4" />
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row">
                    <div className="max-h-[520px] overflow-y-auto border-r border-gray-200 md:w-2/5">
                      {announcements.length ? announcements.map((announcement) => (
                        <button key={announcement.id} type="button" onClick={() => setSelectedAnnouncementId(announcement.id)} className={`w-full border-b border-gray-100 p-4 text-left hover:bg-gray-50 ${selectedAnnouncementId === announcement.id ? "border-l-4 border-l-blue-500" : ""}`}>
                          <div className="line-clamp-2 text-sm font-medium text-gray-900">{announcement.body}</div>
                          <div className="mt-1 text-xs text-gray-500">{announcement.author?.display_name ?? "Member"} - {new Date(announcement.created_at).toLocaleString()}</div>
                        </button>
                      )) : <div className="p-6 text-sm text-gray-500">No announcements yet.</div>}
                    </div>
                    <div className="max-h-[520px] flex-1 overflow-y-auto p-4">
                      {selectedAnnouncement ? (
                        <div className="rounded-md border border-gray-200 bg-white p-4">
                          {editingAnnouncementId === selectedAnnouncement.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingAnnouncementBody}
                                onChange={(event) => setEditingAnnouncementBody(event.target.value)}
                                rows={4}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => void editAnnouncement()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                                <button type="button" onClick={() => setEditingAnnouncementId(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-line text-sm text-gray-900">{selectedAnnouncement.body}</p>
                              <AttachmentList attachments={selectedAnnouncement.attachments} />
                            </>
                          )}
                          <div className="mt-3 text-xs text-gray-500">
                            {selectedAnnouncement.author_user_id ? (
                              <Link to={profilePath(selectedAnnouncement.author_user_id)} className="text-blue-600 hover:underline">
                                {selectedAnnouncement.author?.display_name ?? "Member"}
                              </Link>
                            ) : "Member"}{" "}
                            - {new Date(selectedAnnouncement.created_at).toLocaleString()}
                            {selectedAnnouncement.updated_at && new Date(selectedAnnouncement.updated_at).getTime() - new Date(selectedAnnouncement.created_at).getTime() > 1000 ? " - Edited" : ""}
                          </div>
                          {selectedAnnouncement.author_user_id === meId && editingAnnouncementId !== selectedAnnouncement.id && (
                            <div className="mt-3 flex justify-end">
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
                            </div>
                          )}
                        </div>
                      ) : <div className="text-sm text-gray-500">Select an announcement.</div>}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          <aside className="self-start rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Members ({members.length})</h2>
              </div>
              {isTeacher && (
                <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => setMemberPickerOpen((open) => !open)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Add members">
                    <Plus className="h-4 w-4" />
                  </button>
                  {memberPickerOpen && (
                    <div className="absolute right-0 top-full z-[120] mt-2 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                        <div className="text-sm font-semibold text-gray-900">Add members</div>
                        <button type="button" onClick={() => setMemberPickerOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="border-b border-gray-100 p-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            value={candidateSearch}
                            onChange={(event) => setCandidateSearch(event.target.value)}
                            placeholder="Search members..."
                            className="h-9 w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredCandidates.length ? filteredCandidates.map((candidate) => (
                          <button
                            key={candidate.user_id}
                            type="button"
                            onClick={() => void assignMember(candidate)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <SecureAvatar src={candidate.avatar_url} alt={candidate.display_name ?? "Member"} className="h-7 w-7 rounded-full object-cover" fallbackClassName="h-7 w-7" iconClassName="h-4 w-4 text-gray-500" />
                            <span className="min-w-0 flex-1 truncate">{candidate.display_name ?? "Member"}</span>
                            {candidate.role === "teacher" && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-700">Teacher</span>}
                          </button>
                        )) : <div className="px-3 py-6 text-center text-sm text-gray-500">No available members.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-50">
                  <Link to={profilePath(member.user_id)} className="flex min-w-0 flex-1 items-center gap-3">
                    <SecureAvatar src={member.avatar_url} alt={member.display_name ?? "Member"} className="h-10 w-10 rounded-full object-cover" fallbackClassName="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />
                    <span className={member.role === "teacher" ? "truncate text-sm font-medium text-green-700" : "truncate text-sm font-medium text-blue-600"}>{member.display_name ?? "Member"}</span>
                  </Link>
                  {isTeacher && (
                    <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setOpenMemberMenuId((current) => current === member.user_id ? null : member.user_id)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Member options">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMemberMenuId === member.user_id && (
                        <div className="absolute right-0 top-full z-[120] mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
                          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other</div>
                          <button type="button" onClick={() => void removeMember(member.user_id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!members.length && <div className="text-sm text-gray-500">No members yet.</div>}
            </div>
          </aside>
        </div>
      </main>
      {groupEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit lobbyist group</h2>
              <button type="button" onClick={() => setGroupEditorOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-medium text-gray-700">
                Name
                <input value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Description
                <textarea value={groupDraft.description} onChange={(event) => setGroupDraft({ ...groupDraft, description: event.target.value })} rows={5} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setGroupEditorOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void saveGroup()} disabled={!groupDraft.name.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save changes</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
