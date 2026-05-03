import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search, Plus, Users, ArrowUpDown, Vote, LogOut, UserPlus, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

interface Caucus {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  chairId: string | null;
  chair: { name: string; party: string; image: string | null };
  coChairId: string | null;
  coChair: { name: string; party: string; image: string | null };
  isMember: boolean;
  createdAt: string;
}

let caucusesPageCache: Caucus[] | null = null;

export function TessCaucuses() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "members">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [editingCaucus, setEditingCaucus] = useState<Caucus | null>(null);

  const [caucuses, setCaucuses] = useState<Caucus[]>([]);

  useEffect(() => {
    if (caucusesPageCache) {
      setCaucuses(caucusesPageCache);
      setLoading(false);
    }

    const load = async () => {
      if (!caucusesPageCache) setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", me).maybeSingle();
        setRole(((profile as any)?.role ?? null) as any);

        const { data: caucusRows, error: cErr } = await supabase
          .from("caucuses")
          .select("id,title,description,created_at")
          .order("created_at", { ascending: false });
        if (cErr) throw cErr;

        const caucusIds = (caucusRows ?? []).map((c) => c.id);
        const { data: memberRows, error: mErr } = await supabase
          .from("caucus_members")
          .select("caucus_id,user_id,role")
          .in("caucus_id", caucusIds.length ? caucusIds : ["00000000-0000-0000-0000-000000000000"]);
        if (mErr) throw mErr;

        const userIds = [...new Set((memberRows ?? []).map((m: any) => m.user_id))];
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,avatar_url")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        if (pErr) throw pErr;
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

        const byCaucus = new Map<string, any[]>();
        for (const m of memberRows ?? []) {
          const arr = byCaucus.get((m as any).caucus_id) ?? [];
          arr.push(m);
          byCaucus.set((m as any).caucus_id, arr);
        }

        const views: Caucus[] = (caucusRows ?? []).map((c: any) => {
          const members = byCaucus.get(c.id) ?? [];
          const chair = members.find((m: any) => m.role === "chair");
          const coChair = members.find((m: any) => m.role === "co_chair");
          const chairProfile = chair ? profileMap.get(chair.user_id) : null;
          const coChairProfile = coChair ? profileMap.get(coChair.user_id) : null;
          return {
            id: c.id,
            name: c.title,
            description: c.description ?? "",
            memberCount: members.length,
            chairId: chair?.user_id ?? null,
            chair: {
              name: chairProfile?.display_name ?? "N/A",
              party: (chairProfile?.party ?? "N/A").toString(),
              image: chairProfile?.avatar_url ?? null,
            },
            coChairId: coChair?.user_id ?? null,
            coChair: {
              name: coChairProfile?.display_name ?? "N/A",
              party: (coChairProfile?.party ?? "N/A").toString(),
              image: coChairProfile?.avatar_url ?? null,
            },
            isMember: members.some((m: any) => m.user_id === me),
            createdAt: c.created_at,
          };
        });

        setCaucuses(views);
        caucusesPageCache = views;
      } catch (e: any) {
        toast.error(e.message || "Could not load caucuses");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredCaucuses = useMemo(
    () =>
      caucuses.filter(
        (caucus) =>
          caucus.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          caucus.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [caucuses, searchQuery],
  );

  const sortedCaucuses = useMemo(() => {
    return [...filteredCaucuses].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "members") comparison = a.memberCount - b.memberCount;
      if (sortBy === "createdAt")
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredCaucuses, sortBy, sortOrder]);

  const toggleSortOrder = () => setSortOrder(sortOrder === "asc" ? "desc" : "asc");

  const handleJoinLeave = (caucusId: string) => {
    const run = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;

        const existing = caucuses.find((c) => c.id === caucusId);
        if (!existing) return;

        if (existing.isMember) {
          setConfirmDialog({
            title: "Leave caucus?",
            message: `Leave ${existing.name}?`,
            confirmLabel: "Leave",
            danger: true,
            onConfirm: () => updateCaucusMembership(caucusId, true, me),
          });
          return;
        } else {
          await updateCaucusMembership(caucusId, false, me);
        }
      } catch (e: any) {
        toast.error(e.message || "Could not update membership");
      }
    };
    void run();
  };

  const updateCaucusMembership = async (caucusId: string, leaving: boolean, me: string) => {
    try {
        if (leaving) {
          const { error } = await supabase.from("caucus_members").delete().eq("caucus_id", caucusId).eq("user_id", me);
          if (error) throw error;
          setCaucuses(
            caucuses.map((c) =>
              c.id === caucusId ? { ...c, isMember: false, memberCount: Math.max(0, c.memberCount - 1) } : c,
            ),
          );
          caucusesPageCache = caucusesPageCache?.map((c) =>
            c.id === caucusId ? { ...c, isMember: false, memberCount: Math.max(0, c.memberCount - 1) } : c,
          ) ?? null;
        } else {
          const { error } = await supabase.from("caucus_members").insert({ caucus_id: caucusId, user_id: me, role: "member" });
          if (error) throw error;
          setCaucuses(caucuses.map((c) => (c.id === caucusId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c)));
          caucusesPageCache = caucusesPageCache?.map((c) => (c.id === caucusId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c)) ?? null;
        }
      } catch (e: any) {
        toast.error(e.message || "Could not update membership");
      }
  };

  const handleCreate = () => {
    const run = async () => {
      setCreating(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;

        const { data: p } = await supabase.from("profiles").select("class_id").eq("user_id", me).maybeSingle();
        const classId = (p as any)?.class_id;
        if (!classId) throw new Error("Join a class first");

        const { data: created, error } = await supabase
          .from("caucuses")
          .insert({ class_id: classId, title: createName.trim(), description: createDescription.trim(), creator_user_id: me })
          .select("id,title,description,created_at")
          .single();
        if (error) throw error;

        const { error: mErr } = await supabase.from("caucus_members").insert({ caucus_id: created.id, user_id: me, role: "chair" });
        if (mErr) throw mErr;

        toast.success("Caucus created");
        setShowCreateForm(false);
        setCreateName("");
        setCreateDescription("");
        const nextCaucuses = [
          {
            id: created.id,
            name: created.title,
            description: created.description ?? "",
            memberCount: 1,
            chairId: me,
            chair: { name: "You", party: "", image: null },
            coChairId: null,
            coChair: { name: "—", party: "", image: null },
            isMember: true,
            createdAt: created.created_at,
          },
          ...caucuses,
        ];
        setCaucuses(nextCaucuses);
        caucusesPageCache = nextCaucuses;
      } catch (e: any) {
        toast.error(e.message || "Could not create caucus");
      } finally {
        setCreating(false);
      }
    };
    void run();
  };

  const saveCaucusEdits = async () => {
    if (!editingCaucus) return;
    const { error } = await supabase
      .from("caucuses")
      .update({ title: editingCaucus.name.trim(), description: editingCaucus.description.trim() } as any)
      .eq("id", editingCaucus.id);
    if (error) return toast.error(error.message || "Could not update caucus");
    const next = caucuses.map((caucus) => (caucus.id === editingCaucus.id ? editingCaucus : caucus));
    setCaucuses(next);
    caucusesPageCache = next;
    setEditingCaucus(null);
    toast.success("Caucus updated");
  };

  const deleteCaucus = (caucus: Caucus) => {
    setConfirmDialog({
      title: "Delete caucus?",
      message: `${caucus.name} will be deleted.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("caucuses").delete().eq("id", caucus.id);
        if (error) throw error;
        const next = caucuses.filter((item) => item.id !== caucus.id);
        setCaucuses(next);
        caucusesPageCache = next;
        toast.success("Caucus deleted");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="caucuses">
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Caucus</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Caucus Name *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Climate Action Caucus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Describe the caucus purpose and goals..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                  Cancel
                </button>
                <button
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  disabled={creating || !createName.trim() || !createDescription.trim()}
                  onClick={handleCreate}
                >
                  {creating ? "Creating..." : "Create Caucus"}
                </button>
              </div>
            </div>
          </div>
        )}

        {role === "teacher" && editingCaucus && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <input
                value={editingCaucus.name}
                onChange={(event) => setEditingCaucus({ ...editingCaucus, name: event.target.value })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Caucus name"
              />
              <input
                value={editingCaucus.description}
                onChange={(event) => setEditingCaucus({ ...editingCaucus, description: event.target.value })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="About this caucus"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveCaucusEdits()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                <button type="button" onClick={() => setEditingCaucus(null)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search caucuses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt">Creation Date</option>
              <option value="members">Members</option>
            </select>
            <button onClick={toggleSortOrder} className="rounded-md border border-gray-300 bg-white p-2 transition-colors hover:bg-gray-50">
              <ArrowUpDown className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Caucus
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">Loading caucuses...</div>
          ) : sortedCaucuses.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">No caucuses yet</div>
          ) : (
            sortedCaucuses.map((caucus) => (
              <div
                key={caucus.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/tess-caucuses/${caucus.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") navigate(`/tess-caucuses/${caucus.id}`);
                }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2">
                      {caucus.name}
                    </h3>
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      {caucus.memberCount} members
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{caucus.description}</p>
                  </div>
                  {role !== "teacher" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleJoinLeave(caucus.id);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${
                        caucus.isMember ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {caucus.isMember ? <LogOut className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {caucus.isMember ? "Leave" : "Join"}
                    </button>
                  )}
                  {role === "teacher" && (
                    <div className="ml-2 flex gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingCaucus(caucus);
                        }}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        aria-label="Edit caucus"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCaucus(caucus);
                        }}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete caucus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 border-t border-gray-200 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="w-4 h-4" /> Chair</span>
                    {caucus.chairId ? (
                      <Link to={`/profile/${caucus.chairId}`} onClick={(event) => event.stopPropagation()} className="truncate text-blue-600 hover:underline">
                        {caucus.chair.name}
                      </Link>
                    ) : (
                      <span className="text-gray-600">N/A</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="w-4 h-4" /> Co-Chair</span>
                    {caucus.coChairId ? (
                      <Link to={`/profile/${caucus.coChairId}`} onClick={(event) => event.stopPropagation()} className="truncate text-blue-600 hover:underline">
                        {caucus.coChair.name}
                      </Link>
                    ) : (
                      <span className="text-gray-600">N/A</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </OrganizationsLayout>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
