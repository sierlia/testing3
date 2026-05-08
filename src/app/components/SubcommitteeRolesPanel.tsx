import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";

type Subcommittee = { id: string; name: string; committee_id: string; class_id: string };
type SubcommitteeMember = { subcommittee_id: string; user_id: string; role: "member" | "chair" | "ranking_member" };

function roleLabel(role: SubcommitteeMember["role"]) {
  if (role === "chair") return "Chair";
  if (role === "ranking_member") return "Ranking member";
  return "Member";
}

export function SubcommitteeRolesPanel({ committeeId, compact = false, allowMemberRoleSelection = false }: { committeeId: string; compact?: boolean; allowMemberRoleSelection?: boolean }) {
  const [meId, setMeId] = useState<string | null>(null);
  const [isCommitteeMember, setIsCommitteeMember] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [subcommittees, setSubcommittees] = useState<Subcommittee[]>([]);
  const [memberships, setMemberships] = useState<SubcommitteeMember[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setMeId(uid);
    const [{ data: profile }, { data: myCommitteeMembership }, { data: subs }] = await Promise.all([
      uid ? supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle() : ({ data: null } as any),
      uid ? supabase.from("committee_members").select("role").eq("committee_id", committeeId).eq("user_id", uid).maybeSingle() : ({ data: null } as any),
      supabase.from("subcommittees").select("id,name,committee_id,class_id").eq("committee_id", committeeId).order("created_at", { ascending: true }),
    ]);
    const subRows = (subs ?? []) as Subcommittee[];
    setSubcommittees(subRows);
    setIsTeacher((profile as any)?.role === "teacher");
    setIsCommitteeMember(Boolean(myCommitteeMembership));
    setIsLeader(["chair", "co_chair", "ranking_member"].includes((myCommitteeMembership as any)?.role));
    const ids = subRows.map((row) => row.id);
    const { data: memberRows } = ids.length
      ? await supabase.from("subcommittee_members").select("subcommittee_id,user_id,role").in("subcommittee_id", ids)
      : ({ data: [] } as any);
    setMemberships((memberRows ?? []) as SubcommitteeMember[]);
  };

  useEffect(() => {
    void load().catch((error) => toast.error(error.message || "Could not load subcommittees"));
  }, [committeeId]);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const membership of memberships) next[membership.subcommittee_id] = (next[membership.subcommittee_id] ?? 0) + 1;
    return next;
  }, [memberships]);

  const myMemberships = useMemo(() => new Set(memberships.filter((row) => row.user_id === meId).map((row) => row.subcommittee_id)), [memberships, meId]);
  const canJoin = isCommitteeMember || isTeacher;

  const join = async (subcommittee: Subcommittee) => {
    if (!meId || !canJoin) return;
    setBusyId(subcommittee.id);
    try {
      const { error } = await supabase.from("subcommittee_members").upsert(
        { subcommittee_id: subcommittee.id, user_id: meId, role: "member" } as any,
        { onConflict: "subcommittee_id,user_id" },
      );
      if (error) throw error;
      await load();
      toast.success("Joined subcommittee");
    } catch (error: any) {
      toast.error(error.message || "Could not join subcommittee");
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (subcommittee: Subcommittee) => {
    if (!meId) return;
    setBusyId(subcommittee.id);
    try {
      const { error } = await supabase.from("subcommittee_members").delete().eq("subcommittee_id", subcommittee.id).eq("user_id", meId);
      if (error) throw error;
      await load();
      toast.success("Left subcommittee");
    } catch (error: any) {
      toast.error(error.message || "Could not leave subcommittee");
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (subcommittee: Subcommittee, userId: string, role: SubcommitteeMember["role"]) => {
    if (!isLeader && !isTeacher) return;
    try {
      if (role !== "member" && (isLeader || isTeacher)) {
        await supabase.from("subcommittee_members").update({ role: "member" } as any).eq("subcommittee_id", subcommittee.id).eq("role", role).neq("user_id", userId);
      }
      const { error } = await supabase.from("subcommittee_members").update({ role } as any).eq("subcommittee_id", subcommittee.id).eq("user_id", userId);
      if (error) throw error;
      await load();
      toast.success("Subcommittee role updated");
    } catch (error: any) {
      toast.error(error.message || "Could not update subcommittee role");
    }
  };

  if (!subcommittees.length) {
    if (compact) return null;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Subcommittees</h2>
        </div>
        <div className="text-sm text-gray-500">No subcommittees have been created yet.</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${compact ? "p-3" : "p-4"} shadow-sm`}>
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Subcommittees</h2>
      </div>
      <div className="space-y-2">
        {subcommittees.map((subcommittee) => {
          const joined = myMemberships.has(subcommittee.id);
          const leaders = memberships.filter((row) => row.subcommittee_id === subcommittee.id && row.role !== "member");
          const myRow = memberships.find((row) => row.subcommittee_id === subcommittee.id && row.user_id === meId);
          return (
            <div key={subcommittee.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-gray-900">{subcommittee.name}</div>
                <div className="text-xs text-gray-500">
                  {counts[subcommittee.id] ?? 0} member{counts[subcommittee.id] === 1 ? "" : "s"}
                  {leaders.length ? ` · ${leaders.map((row) => roleLabel(row.role)).join(", ")}` : ""}
                  {myRow ? ` · ${roleLabel(myRow.role)}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {joined && (isLeader || isTeacher || allowMemberRoleSelection) && meId && (
                  <select value={myRow?.role ?? "member"} onChange={(event) => void setRole(subcommittee, meId, event.target.value as any)} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs">
                    <option value="member">Member</option>
                    <option value="chair">Chair</option>
                    <option value="ranking_member">Ranking</option>
                  </select>
                )}
                {joined ? (
                  <button type="button" onClick={() => void leave(subcommittee)} disabled={busyId === subcommittee.id} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50">
                    Leave
                  </button>
                ) : (
                  <button type="button" onClick={() => void join(subcommittee)} disabled={!canJoin || busyId === subcommittee.id} className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
                    Join
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!canJoin && <div className="mt-2 text-xs text-gray-500">Join the main committee before joining a subcommittee.</div>}
    </div>
  );
}
