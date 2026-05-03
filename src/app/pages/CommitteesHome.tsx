import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Building2, Check, ClipboardList, Search, UserPlus, Users } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { OrganizationsLayout } from "./OrganizationsLayout";

type CommitteeRow = { id: string; name: string; description: string | null; created_at: string };
type CommitteesCache = {
  committees: CommitteeRow[];
  memberCounts: Record<string, number>;
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
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [preferencesSubmitted, setPreferencesSubmitted] = useState<boolean>(false);
  const [needsPreferences, setNeedsPreferences] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [joinedCommitteeIds, setJoinedCommitteeIds] = useState<Set<string>>(new Set());
  const [joiningCommitteeId, setJoiningCommitteeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (committeesHomeCache) {
      setCommittees(committeesHomeCache.committees);
      setMemberCounts(committeesHomeCache.memberCounts);
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
        setRole(((profile as any)?.role ?? null) as any);
        if (!classId) {
          setCommittees([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        const s = (cls as any)?.settings ?? {};
        setSettings(s);
        const allowSelfJoin = !!s?.committees?.allowSelfJoin || s?.committees?.assignmentMode === "self-join";

        let nextPreferencesSubmitted = false;
        let nextNeedsPreferences = false;
        if ((profile as any)?.role === "student" && !allowSelfJoin) {
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

        const enabled = ((cls as any)?.settings?.committees?.enabled ?? []) as string[];
        let finalRows = (rows ?? []) as any[];
        if (((profile as any)?.role === "teacher") && finalRows.length === 0 && enabled.length > 0) {
          const { data: seeded, error: sErr } = await supabase
            .from("committees")
            .insert(enabled.map((name) => ({ class_id: classId, name, description: "" })))
            .select("id,name,description,created_at");
          if (sErr) throw sErr;
          finalRows = (seeded ?? []) as any[];
          setCommittees(finalRows as any);
        } else {
          setCommittees(finalRows as any);
        }

        const ids = finalRows.map((r) => r.id);
        const { data: memRows } = await supabase
          .from("committee_members")
          .select("committee_id,user_id")
          .in("committee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const counts: Record<string, number> = {};
        const joined = new Set<string>();
        for (const r of memRows ?? []) {
          const cid = (r as any).committee_id;
          counts[cid] = (counts[cid] ?? 0) + 1;
          if ((r as any).user_id === me) joined.add(cid);
        }
        setMemberCounts(counts);
        setJoinedCommitteeIds(joined);
        committeesHomeCache = {
          committees: finalRows as any,
          memberCounts: counts,
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

  const items = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return committees
      .filter((committee) => !query || committee.name.toLowerCase().includes(query) || (committee.description ?? "").toLowerCase().includes(query))
      .map((c) => ({ ...c, memberCount: memberCounts[c.id] ?? 0 }));
  }, [committees, memberCounts, searchQuery]);
  const canSelfJoin = role === "student" && (!!settings?.committees?.allowSelfJoin || settings?.committees?.assignmentMode === "self-join");

  const joinCommittee = async (committeeId: string) => {
    if (!meId || joinedCommitteeIds.has(committeeId)) return;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="committees">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Committees</h2>
              </div>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search committees..."
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
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
            {loading ? (
              <div className="text-sm text-gray-500">Loading committees…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-500">No committees configured yet.</div>
            ) : (
              <div className="space-y-3">
                {items.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/committees/${c.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") navigate(`/committees/${c.id}`);
                    }}
                    className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                      {c.description ? <div className="text-sm text-gray-600 mt-1 line-clamp-2">{c.description}</div> : null}
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        {c.memberCount} members
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canSelfJoin && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void joinCommittee(c.id);
                          }}
                          disabled={joinedCommitteeIds.has(c.id) || joiningCommitteeId === c.id}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-default ${
                            joinedCommitteeIds.has(c.id)
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                          }`}
                        >
                          {joinedCommitteeIds.has(c.id) ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          {joinedCommitteeIds.has(c.id) ? "Joined" : joiningCommitteeId === c.id ? "Joining" : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </OrganizationsLayout>
      </main>
    </div>
  );
}
