import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";

type LobbyistGroup = { id: string; class_id: string; name: string; description: string; join_mode: "free_join" | "teacher_assigned"; starting_amount: number; created_at: string; memberCount: number };

export function LobbyistGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<LobbyistGroup[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [spentByGroup, setSpentByGroup] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const uid = (await getCurrentUser())?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", uid).maybeSingle();
    const activeClassId = (profile as any)?.class_id ?? null;
    setRole(((profile as any)?.role ?? null) as any);
    setClassId(activeClassId);
    if (!activeClassId) {
      setLoading(false);
      return;
    }
    const { data: cls } = await supabase.from("classes").select("settings").eq("id", activeClassId).maybeSingle();
    setSettings((cls as any)?.settings ?? {});
    const [{ data: rows }, { data: members }, { data: contributions }] = await Promise.all([
      supabase.from("lobbyist_groups").select("id,class_id,name,description,join_mode,starting_amount,created_at").eq("class_id", activeClassId).order("created_at", { ascending: true }),
      supabase.from("lobbyist_group_members").select("group_id"),
      supabase.from("lobbyist_contributions").select("group_id,amount").eq("class_id", activeClassId),
    ]);
    const counts: Record<string, number> = {};
    for (const member of members ?? []) counts[(member as any).group_id] = (counts[(member as any).group_id] ?? 0) + 1;
    const spent: Record<string, number> = {};
    for (const row of contributions ?? []) spent[(row as any).group_id] = (spent[(row as any).group_id] ?? 0) + Number((row as any).amount ?? 0);
    setSpentByGroup(spent);
    setGroups(((rows ?? []) as any[]).map((row) => ({ ...row, memberCount: counts[row.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return groups.filter((group) => !q || group.name.toLowerCase().includes(q) || group.description.toLowerCase().includes(q));
  }, [groups, query]);
  const sectionDisabled = settings?.organizations?.enabled === false || settings?.organizations?.enableLobbyists === false || settings?.lobbyists?.enabled === false;

  const createGroup = async () => {
    if (!classId || !draft.name.trim()) return;
    const uid = (await getCurrentUser())?.id;
    const { error } = await supabase.from("lobbyist_groups").insert({
      class_id: classId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      join_mode: settings?.lobbyists?.joinMode ?? "free_join",
      starting_amount: Math.max(0, Number(settings?.lobbyists?.startingAmount ?? 1000) || 0),
      created_by: uid ?? null,
    } as any);
    if (error) return toast.error(error.message || "Could not create lobbyist group");
    setEditing(false);
    setDraft({ name: "", description: "" });
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <OrganizationsLayout active="lobbyists">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lobbyist groups..." className="h-10 w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {role === "teacher" && !sectionDisabled && (
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Create group
                  </button>
                )}
              </div>
            </div>
            {role === "teacher" && editing && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Group name" />
                  <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Summary" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void createGroup()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
                  </div>
                </div>
              </div>
            )}
            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading lobbyist groups...</div>
            ) : sectionDisabled && !items.length ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Lobbyist groups have been disabled from settings.</div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No lobbyist groups yet.</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {sectionDisabled && <div className="border-b border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600">Lobbyist groups have been disabled from settings.</div>}
                {items.map((group, index) => (
                  <div key={group.id} role="button" tabIndex={0} onClick={() => navigate(`/lobbyists/${group.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/lobbyists/${group.id}`); }} className={`flex cursor-pointer items-start justify-between gap-4 p-4 transition-colors hover:bg-gray-50 ${index < items.length - 1 ? "border-b border-gray-200" : ""} ${sectionDisabled ? "pointer-events-none opacity-50 grayscale" : ""}`}>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">{group.name}</div>
                      {group.description ? <div className="mt-1 line-clamp-2 text-sm text-gray-600">{group.description}</div> : null}
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Users className="h-3.5 w-3.5" />
                        {group.memberCount} members
                        <span className="text-gray-300">|</span>
                        ${Math.max(0, Number(group.starting_amount ?? 0) - Number(spentByGroup[group.id] ?? 0)).toLocaleString()} total money
                      </div>
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
