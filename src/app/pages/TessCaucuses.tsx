import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search, Plus, Users, ArrowUpDown } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { OrganizationsLayout } from "./OrganizationsLayout";

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

export function TessCaucuses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "members">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const [caucuses, setCaucuses] = useState<Caucus[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;

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
          const { error } = await supabase.from("caucus_members").delete().eq("caucus_id", caucusId).eq("user_id", me);
          if (error) throw error;
          setCaucuses(
            caucuses.map((c) =>
              c.id === caucusId ? { ...c, isMember: false, memberCount: Math.max(0, c.memberCount - 1) } : c,
            ),
          );
        } else {
          const { error } = await supabase.from("caucus_members").insert({ caucus_id: caucusId, user_id: me, role: "member" });
          if (error) throw error;
          setCaucuses(caucuses.map((c) => (c.id === caucusId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c)));
        }
      } catch (e: any) {
        toast.error(e.message || "Could not update membership");
      }
    };
    void run();
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
        setCaucuses([
          {
            id: created.id,
            name: created.title,
            description: created.description ?? "",
            memberCount: 1,
            chair: { name: "You", party: "", image: null },
            coChair: { name: "—", party: "", image: null },
            isMember: true,
            createdAt: created.created_at,
          },
          ...caucuses,
        ]);
      } catch (e: any) {
        toast.error(e.message || "Could not create caucus");
      } finally {
        setCreating(false);
      }
    };
    void run();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="caucuses">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Caucuses</h2>
              <p className="text-sm text-gray-600">Join or create groups focused on specific issues</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Caucus
            </button>
          </div>

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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search caucuses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="createdAt">Creation Date</option>
              <option value="members">Members</option>
            </select>
            <button onClick={toggleSortOrder} className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              <ArrowUpDown className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">Loading caucuses...</div>
          ) : sortedCaucuses.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">No caucuses yet</div>
          ) : (
            sortedCaucuses.map((caucus) => (
              <div key={caucus.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link to={`/tess-caucuses/${caucus.id}`}>
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2">
                        {caucus.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-600 line-clamp-2">{caucus.description}</p>
                  </div>
                  <button
                    onClick={() => handleJoinLeave(caucus.id)}
                    className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${
                      caucus.isMember ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {caucus.isMember ? "Leave" : "Join"}
                  </button>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{caucus.memberCount} members</span>
                  </div>
                  <span>•</span>
                  <span>
                    Chair:{" "}
                    {caucus.chairId ? (
                      <Link to={`/profile/${caucus.chairId}`} className="text-blue-600 hover:underline">
                        {caucus.chair.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    Co-Chair:{" "}
                    {caucus.coChairId ? (
                      <Link to={`/profile/${caucus.coChairId}`} className="text-blue-600 hover:underline">
                        {caucus.coChair.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        </OrganizationsLayout>
      </main>
    </div>
  );
}
