import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { ClipboardList, LogOut, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { committeeDisplayName } from "../utils/committeeNames";

type CommitteeRow = { id: string; name: string; description: string | null; created_at: string };
type SubcommitteeRow = { id: string; committee_id: string; name: string };
type CommitteesCache = {
  committees: CommitteeRow[];
  memberCounts: Record<string, number>;
  subcommitteesByCommitteeId: Record<string, string[]>;
  leadershipNames: Record<string, { chair?: string; ranking?: string }>;
  role: "teacher" | "student" | null;
  settings: any;
  preferencesSubmitted: boolean;
  needsPreferences: boolean;
  meId: string | null;
  joinedCommitteeIds: Set<string>;
};

let committeesHomeCache: CommitteesCache | null = null;

export function CommitteesHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [subcommitteesByCommitteeId, setSubcommitteesByCommitteeId] = useState<Record<string, string[]>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string[]>>({});
  const [leadershipNames, setLeadershipNames] = useState<Record<string, { chair?: string; ranking?: string }>>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [preferencesSubmitted, setPreferencesSubmitted] = useState<boolean>(false);
  const [needsPreferences, setNeedsPreferences] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [joinedCommitteeIds, setJoinedCommitteeIds] = useState<Set<string>>(new Set());
  const [joiningCommitteeId, setJoiningCommitteeId] = useState<string | null>(null);
  const [leavingCommitteeId, setLeavingCommitteeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<CommitteeRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (committeesHomeCache) {
      setCommittees(committeesHomeCache.committees);
      setMemberCounts(committeesHomeCache.memberCounts);
      setSubcommitteesByCommitteeId(committeesHomeCache.subcommitteesByCommitteeId);
      setLeadershipNames(committeesHomeCache.leadershipNames);
      setRole(committeesHomeCache.role);
      setSettings(committeesHomeCache.settings);
      setPreferencesSubmitted(committeesHomeCache.preferencesSubmitted);
      setNeedsPreferences(committeesHomeCache.needsPreferences);
      setMeId(committeesHomeCache.meId);
      setJoinedCommitteeIds(new Set(committeesHomeCache.joinedCommitteeIds));
      setLoading(false);
    }

    const load = async () => {
      if (!committeesHomeCache) setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;
        setMeId(me);

        const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", me).maybeSingle();
        const classId = (profile as any)?.class_id;
        setActiveClassId(classId ?? null);
        setRole(((profile as any)?.role ?? null) as any);
        if (!classId) {
          setCommittees([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        const s = (cls as any)?.settings ?? {};
        setSettings(s);
        const allowSelfJoin = !!s?.committees?.allowSelfJoin || s?.committees?.assignmentMode === "self-join";
        const randomAssignments = s?.committees?.assignmentMode === "random";

        let nextPreferencesSubmitted = false;
        let nextNeedsPreferences = false;
        if ((profile as any)?.role === "student" && !allowSelfJoin && !randomAssignments) {
          const { data: sub } = await supabase
            .from("committee_preference_submissions")
            .select("submitted_at")
            .eq("class_id", classId)
            .eq("user_id", me)
            .maybeSingle();
          const submitted = !!sub;
          nextPreferencesSubmitted = submitted;
          nextNeedsPreferences = !submitted;
          setPreferencesSubmitted(nextPreferencesSubmitted);
          setNeedsPreferences(nextNeedsPreferences);
        }

        const { data: rows, error } = await supabase
          .from("committees")
          .select("id,name,description,created_at")
          .eq("class_id", classId)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const configuredCommittees = ((cls as any)?.settings?.committees?.enabled ?? []) as string[];
        const subcommitteeParents = (((cls as any)?.settings?.committees?.enabledSubcommittees ?? []) as string[]).map((key) => key.split("::")[0]).filter(Boolean);
        const enabled = Array.from(new Set([...configuredCommittees, ...subcommitteeParents]));
        let finalRows = (rows ?? []) as any[];
        if (((profile as any)?.role === "teacher") && enabled.length > 0) {
          const existingNames = new Set(finalRows.map((committee) => committee.name));
          const missing = enabled.filter((name) => !existingNames.has(name));
          if (missing.length) {
          const { data: seeded, error: sErr } = await supabase
              .from("committees")
              .insert(missing.map((name) => ({ class_id: classId, name, description: "" })))
              .select("id,name,description,created_at");
          if (sErr) throw sErr;
            finalRows = [...finalRows, ...((seeded ?? []) as any[])];
          }
        }
        setCommittees(finalRows as any);

        const ids = finalRows.map((r) => r.id);
        if ((profile as any)?.role === "teacher" && s?.committees?.subcommitteesEnabled) {
          const subcommitteeRows = finalRows.flatMap((committee: any) =>
            ((s?.committees?.enabledSubcommittees ?? []) as string[])
              .filter((key) => key.startsWith(`${committee.name}::`))
              .map((key) => ({
                committee_id: committee.id,
                class_id: classId,
                name: key.split("::").slice(1).join("::"),
                description: "",
              })),
          );
          if (subcommitteeRows.length) await supabase.from("subcommittees").upsert(subcommitteeRows as any, { onConflict: "committee_id,name" });
        }
        const { data: subRows } = ids.length
          ? await supabase.from("subcommittees").select("id,committee_id,name").in("committee_id", ids)
          : ({ data: [] } as any);
        const subsByCommittee: Record<string, string[]> = {};
        for (const row of (subRows ?? []) as SubcommitteeRow[]) {
          subsByCommittee[row.committee_id] = [...(subsByCommittee[row.committee_id] ?? []), row.name];
        }
        setSubcommitteesByCommitteeId(subsByCommittee);
        const { data: memRows } = await supabase
          .from("committee_members")
          .select("committee_id,user_id,role")
          .in("committee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const counts: Record<string, number> = {};
        const joined = new Set<string>();
        for (const r of memRows ?? []) {
          const cid = (r as any).committee_id;
          counts[cid] = (counts[cid] ?? 0) + 1;
          if ((r as any).user_id === me) joined.add(cid);
        }
        const profileIds = [...new Set((memRows ?? []).map((row: any) => row.user_id))];
        const { data: memberProfiles } = profileIds.length
          ? await supabase.from("profiles").select("user_id,display_name").in("user_id", profileIds)
          : ({ data: [] } as any);
        const profileNameMap = new Map((memberProfiles ?? []).map((row: any) => [row.user_id, row.display_name ?? "Member"]));
        const names: Record<string, string[]> = {};
        const leaders: Record<string, { chair?: string; ranking?: string }> = {};
        for (const row of memRows ?? []) {
          const cid = (row as any).committee_id;
          const name = profileNameMap.get((row as any).user_id) ?? "Member";
          names[cid] = [...(names[cid] ?? []), name];
          if ((row as any).role === "chair") leaders[cid] = { ...(leaders[cid] ?? {}), chair: name };
          if ((row as any).role === "ranking_member") leaders[cid] = { ...(leaders[cid] ?? {}), ranking: name };
        }
        setMemberNames(names);
        setLeadershipNames(leaders);
        setMemberCounts(counts);
        setJoinedCommitteeIds(joined);
        committeesHomeCache = {
          committees: finalRows as any,
          memberCounts: counts,
          subcommitteesByCommitteeId: subsByCommittee,
          leadershipNames: leaders,
          role: ((profile as any)?.role ?? null) as any,
          settings: s,
          preferencesSubmitted: nextPreferencesSubmitted,
          needsPreferences: nextNeedsPreferences,
          meId: me ?? null,
          joinedCommitteeIds: joined,
        };
      } catch (e: any) {
        toast.error(e.message || "Could not load committees");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenuId]);

  const items = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return committees
      .filter((committee) => !query || committee.name.toLowerCase().includes(query) || (committee.description ?? "").toLowerCase().includes(query) || (memberNames[committee.id] ?? []).some((name) => name.toLowerCase().includes(query)))
      .map((c) => ({ ...c, memberCount: memberCounts[c.id] ?? 0, capacity: Number(settings?.committees?.capacities?.[c.id] ?? settings?.committees?.capacitiesByName?.[c.name] ?? 0), subcommittees: subcommitteesByCommitteeId[c.id] ?? [], leadership: leadershipNames[c.id] ?? {} }));
  }, [committees, leadershipNames, memberCounts, memberNames, searchQuery, settings, subcommitteesByCommitteeId]);
  const canSelfJoin = role === "student" && (!!settings?.committees?.allowSelfJoin || settings?.committees?.assignmentMode === "self-join");
  const sectionDisabled = settings?.organizations?.enabled === false || settings?.organizations?.enableCommittees === false;
  const canUseJoinButton = !sectionDisabled && (role === "teacher" || canSelfJoin);

  const joinCommittee = async (committeeId: string) => {
    if (!meId || joinedCommitteeIds.has(committeeId)) return;
    const committee = committees.find((item) => item.id === committeeId);
    const capacity = Number(settings?.committees?.capacities?.[committeeId] ?? (committee ? settings?.committees?.capacitiesByName?.[committee.name] : 0) ?? 0);
    if (capacity > 0 && (memberCounts[committeeId] ?? 0) >= capacity) {
      toast.error("This committee is full");
      return;
    }
    const { data: lobbyMembership } = await supabase.from("lobbyist_group_members").select("group_id").eq("user_id", meId).limit(1);
    if ((lobbyMembership ?? []).length) {
      toast.error("Lobbyist group members cannot join committees");
      return;
    }
    setJoiningCommitteeId(committeeId);
    try {
      const { error } = await supabase
        .from("committee_members")
        .upsert({ committee_id: committeeId, user_id: meId, role: "member" } as any, { onConflict: "committee_id,user_id" });
      if (error) throw error;
      setJoinedCommitteeIds((prev) => new Set(prev).add(committeeId));
      setMemberCounts((prev) => ({ ...prev, [committeeId]: (prev[committeeId] ?? 0) + 1 }));
      if (committeesHomeCache) {
        const joined = new Set(committeesHomeCache.joinedCommitteeIds);
        joined.add(committeeId);
        committeesHomeCache = {
          ...committeesHomeCache,
          joinedCommitteeIds: joined,
          memberCounts: { ...committeesHomeCache.memberCounts, [committeeId]: (committeesHomeCache.memberCounts[committeeId] ?? 0) + 1 },
        };
      }
      toast.success("Joined committee");
    } catch (e: any) {
      if (String(e?.message ?? "").toLowerCase().includes("duplicate")) {
        setJoinedCommitteeIds((prev) => new Set(prev).add(committeeId));
      } else {
        toast.error(e.message || "Could not join committee");
      }
    } finally {
      setJoiningCommitteeId(null);
    }
  };

  const leaveCommittee = async (committeeId: string) => {
    if (!meId || !joinedCommitteeIds.has(committeeId)) return;
    const committeeName = committees.find((committee) => committee.id === committeeId)?.name ?? "this committee";
    setConfirmDialog({
      title: "Leave committee?",
      message: `Leave ${committeeName}?`,
      confirmLabel: "Leave",
      danger: true,
      onConfirm: () => leaveCommitteeConfirmed(committeeId),
    });
  };

  const leaveCommitteeConfirmed = async (committeeId: string) => {
    if (!meId || !joinedCommitteeIds.has(committeeId)) return;
    setLeavingCommitteeId(committeeId);
    try {
      const { error } = await supabase.from("committee_members").delete().eq("committee_id", committeeId).eq("user_id", meId);
      if (error) throw error;
      setJoinedCommitteeIds((prev) => {
        const next = new Set(prev);
        next.delete(committeeId);
        return next;
      });
      setMemberCounts((prev) => ({ ...prev, [committeeId]: Math.max(0, (prev[committeeId] ?? 1) - 1) }));
      if (committeesHomeCache) {
        const joined = new Set(committeesHomeCache.joinedCommitteeIds);
        joined.delete(committeeId);
        committeesHomeCache = {
          ...committeesHomeCache,
          joinedCommitteeIds: joined,
          memberCounts: { ...committeesHomeCache.memberCounts, [committeeId]: Math.max(0, (committeesHomeCache.memberCounts[committeeId] ?? 1) - 1) },
        };
      }
      toast.success("Left committee");
    } catch (e: any) {
      toast.error(e.message || "Could not leave committee");
    } finally {
      setLeavingCommitteeId(null);
    }
  };

  const saveCommitteeEdits = async () => {
    if (!editingCommittee) return;
    if (editingCommittee.id === "new") {
      if (!activeClassId) return toast.error("Open a class first");
      const { data, error } = await supabase
        .from("committees")
        .insert({ class_id: activeClassId, name: editingCommittee.name.trim(), description: editingCommittee.description ?? "" } as any)
        .select("id,name,description,created_at")
        .single();
      if (error) return toast.error(error.message || "Could not create committee");
      setCommittees((prev) => [...prev, data as CommitteeRow]);
      setEditingCommittee(null);
      toast.success("Committee created");
      return;
    }
    const { error } = await supabase
      .from("committees")
      .update({ name: editingCommittee.name.trim(), description: editingCommittee.description ?? "" } as any)
      .eq("id", editingCommittee.id);
    if (error) return toast.error(error.message || "Could not update committee");
    setCommittees((prev) => prev.map((committee) => (committee.id === editingCommittee.id ? editingCommittee : committee)));
    setEditingCommittee(null);
    toast.success("Committee updated");
  };

  const deleteCommittee = (committee: CommitteeRow) => {
    setConfirmDialog({
      title: "Delete committee?",
      message: `${committee.name} will be deleted.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("committees").delete().eq("id", committee.id);
        if (error) throw error;
        setCommittees((prev) => prev.filter((item) => item.id !== committee.id));
        toast.success("Committee deleted");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="committees">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search committees..."
                    className="h-10 w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {role === "teacher" && !sectionDisabled && (
                  <button
                    type="button"
                    onClick={() => setEditingCommittee({ id: "new", name: "", description: "", created_at: new Date().toISOString() })}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create committee
                  </button>
                )}
              </div>
            </div>
            {role === "student" && needsPreferences && !preferencesSubmitted && (
              <button
                type="button"
                onClick={() => navigate("/committee-preferences")}
                className="mb-4 flex w-full items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-left text-blue-900 transition-colors hover:bg-blue-100"
              >
                <ClipboardList className="h-5 w-5 flex-shrink-0 text-blue-600" />
                <span>
                  <span className="block text-sm font-semibold">Fill out your committee preference survey</span>
                  <span className="block text-sm text-blue-800">Your teacher will use these rankings to assign committees.</span>
                </span>
              </button>
            )}
            {sectionDisabled && (
              <div className="rounded-md border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600">
                Committees have been disabled from settings.
              </div>
            )}
            {loading ? (
              <div className="text-sm text-gray-500">Loading committees…</div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No committees yet.</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {items.map((c, index) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/committees/${c.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") navigate(`/committees/${c.id}`);
                    }}
                    className={`flex cursor-pointer items-start justify-between gap-4 p-4 transition-colors hover:bg-gray-50 ${index < items.length - 1 ? "border-b border-gray-200" : ""} ${sectionDisabled ? "pointer-events-none opacity-50 grayscale" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">{committeeDisplayName(c.name)}</div>
                      {c.description ? <div className="text-sm text-gray-600 mt-1 line-clamp-2">{c.description}</div> : null}
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        {c.capacity > 0 ? `${c.memberCount}/${c.capacity} members` : `${c.memberCount} members`}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                        <div><span className="font-semibold text-gray-700">Chair:</span> {c.leadership.chair ?? "None"}</div>
                        <div><span className="font-semibold text-gray-700">Ranking:</span> {c.leadership.ranking ?? "None"}</div>
                      </div>
                    </div>
                    <div className="hidden min-h-[3.75rem] w-80 shrink-0 border-l border-gray-200 pl-4 text-xs text-gray-500 lg:block">
                        <div className="mb-1 font-semibold text-gray-700">Subcommittees</div>
                        <div className="line-clamp-3 break-words">{c.subcommittees.length ? c.subcommittees.join(", ") : "N/A"}</div>
                    </div>
                    <div className="flex w-44 shrink-0 items-center justify-end gap-2">
                      {canUseJoinButton && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (joinedCommitteeIds.has(c.id)) void leaveCommittee(c.id);
                            else void joinCommittee(c.id);
                          }}
                          disabled={joiningCommitteeId === c.id || leavingCommitteeId === c.id || (!joinedCommitteeIds.has(c.id) && c.capacity > 0 && c.memberCount >= c.capacity)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-60 ${
                            joinedCommitteeIds.has(c.id)
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {joinedCommitteeIds.has(c.id) ? <LogOut className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          {joinedCommitteeIds.has(c.id) ? (leavingCommitteeId === c.id ? "Leaving" : "Leave") : c.capacity > 0 && c.memberCount >= c.capacity ? "Full" : joiningCommitteeId === c.id ? "Joining" : "Join"}
                        </button>
                      )}
                      {role === "teacher" && (
                        <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId((current) => current === c.id ? null : c.id);
                            }}
                            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            aria-label="Committee options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenuId === c.id && (
                            <div className="absolute right-0 top-full z-[120] mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  setEditingCommittee(c);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  deleteCommittee(c);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </OrganizationsLayout>
      </main>
      {role === "teacher" && editingCommittee && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{editingCommittee.id === "new" ? "Create committee" : "Edit committee"}</h2>
            <div className="space-y-3">
              <input
                value={editingCommittee.name}
                onChange={(event) => setEditingCommittee({ ...editingCommittee, name: event.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Committee name"
              />
              <textarea
                value={editingCommittee.description ?? ""}
                onChange={(event) => setEditingCommittee({ ...editingCommittee, description: event.target.value })}
                className="min-h-28 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="About this committee"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingCommittee(null)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
                <button type="button" onClick={() => void saveCommitteeEdits()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
