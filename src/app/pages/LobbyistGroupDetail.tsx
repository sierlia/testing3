import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { DollarSign, LogOut, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";
import { profilePath } from "../utils/profileRoute";

type Member = { user_id: string; display_name: string | null; avatar_url: string | null; role: string | null };
type Contribution = { id: string; recipient_type: string; recipient_id: string; amount: number; note: string; created_at: string };
type Candidate = { user_id: string; display_name: string | null };

export function LobbyistGroupDetail() {
  const { id } = useParams();
  const groupId = id!;
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  const load = async () => {
    const uid = (await getCurrentUser())?.id ?? null;
    setMeId(uid);
    const { data: g } = await supabase.from("lobbyist_groups").select("id,class_id,name,description,join_mode,starting_amount").eq("id", groupId).maybeSingle();
    setGroup(g as any);
    if (!g) return;
    const [{ data: memberRows }, { data: profile }, { data: spending }, directory] = await Promise.all([
      supabase.from("lobbyist_group_members").select("user_id").eq("group_id", groupId),
      uid ? supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle() : ({ data: null } as any),
      supabase.from("lobbyist_contributions").select("id,recipient_type,recipient_id,amount,note,created_at").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.rpc("class_directory", { target_class: (g as any).class_id } as any),
    ]);
    setIsTeacher((profile as any)?.role === "teacher");
    const ids = (memberRows ?? []).map((row: any) => row.user_id);
    setIsMember(uid ? ids.includes(uid) : false);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id,display_name,avatar_url,role").in("user_id", ids) : ({ data: [] } as any);
    setMembers((profiles ?? []) as any);
    const memberSet = new Set(ids);
    const nextCandidates = ((directory.data ?? []) as any[]).filter((row) => row.role !== "teacher" && !memberSet.has(row.user_id)).map((row) => ({ user_id: row.user_id, display_name: row.display_name ?? "Member" }));
    setCandidates(nextCandidates);
    setSelectedCandidateId((current) => current && nextCandidates.some((candidate) => candidate.user_id === current) ? current : nextCandidates[0]?.user_id ?? "");
    setContributions((spending ?? []) as any);
  };

  useEffect(() => {
    void load();
  }, [groupId]);

  const total = useMemo(() => contributions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), [contributions]);
  const byRecipient = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of contributions) map.set(`${row.recipient_type}:${row.recipient_id}`, (map.get(`${row.recipient_type}:${row.recipient_id}`) ?? 0) + Number(row.amount ?? 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [contributions]);

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

  const assignMember = async () => {
    if (!isTeacher || !selectedCandidateId) return;
    const { data: existingLobbyist } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", selectedCandidateId).limit(1);
    if ((existingLobbyist ?? []).length) return toast.error("That member is already in a lobbyist group");
    await Promise.all([
      supabase.from("profiles").update({ party: null } as any).eq("user_id", selectedCandidateId),
      supabase.from("committee_members").delete().eq("user_id", selectedCandidateId),
      supabase.from("caucus_members").delete().eq("user_id", selectedCandidateId),
    ]);
    const { error } = await supabase.from("lobbyist_group_members").insert({ group_id: groupId, user_id: selectedCandidateId, assigned_by_teacher: true } as any);
    if (error) return toast.error(error.message || "Could not assign member");
    await load();
  };

  if (!group) {
    return <div className="min-h-screen bg-gray-50"><Navigation /><main className="mx-auto max-w-7xl px-4 py-10 text-gray-600">Loading...</main></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
              <p className="mt-2 whitespace-pre-line text-gray-700">{group.description || "No description yet."}</p>
              <div className="mt-4 inline-flex rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                Total money: ${Math.max(0, Number(group.starting_amount ?? 0) - total).toLocaleString()}
              </div>
            </div>
            {!isTeacher && group.join_mode === "free_join" && (
              isMember ? (
                <button type="button" onClick={() => void leave()} className="inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"><LogOut className="h-4 w-4" />Leave</button>
              ) : (
                <button type="button" onClick={() => void join()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><UserPlus className="h-4 w-4" />Join</button>
              )
            )}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            </div>
            {isTeacher && (
              <div className="mb-4 flex max-w-xl gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                <select value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                  {candidates.length ? candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.display_name ?? "Member"}</option>) : <option value="">No available students</option>}
                </select>
                <button type="button" onClick={() => void assignMember()} disabled={!selectedCandidateId} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Assign</button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => (
                <Link key={member.user_id} to={profilePath(member.user_id)} className="flex items-center gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                  {member.avatar_url ? <img src={member.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar className="h-10 w-10" iconClassName="h-5 w-5 text-gray-500" />}
                  <span className={member.role === "teacher" ? "text-sm font-medium text-green-700" : "text-sm font-medium text-blue-600"}>{member.display_name ?? "Member"}</span>
                </Link>
              ))}
            </div>
          </section>
          <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Spending</h2>
            </div>
            <div className="grid gap-2">
              <div className="rounded-md bg-green-50 p-3 text-sm font-semibold text-green-800">Starting funds: ${Number(group.starting_amount ?? 0).toLocaleString()}</div>
              <div className="rounded-md bg-gray-50 p-3 text-sm font-semibold text-gray-800">Total money: ${Math.max(0, Number(group.starting_amount ?? 0) - total).toLocaleString()}</div>
              <div className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-blue-800">Total contributed: ${total.toLocaleString()}</div>
            </div>
            <div className="mt-4 space-y-2">
              {byRecipient.length ? byRecipient.map(([recipient, amount]) => (
                <div key={recipient} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <div className="font-medium capitalize">{recipient.replace(":", " ")}</div>
                  <div className="text-xs text-gray-500">${amount.toLocaleString()}</div>
                </div>
              )) : <div className="text-sm text-gray-500">No spending yet.</div>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
