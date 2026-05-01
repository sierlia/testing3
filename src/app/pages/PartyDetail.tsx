import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";

type PartyRow = { id: string; name: string; platform: string; created_at: string };
type MemberRow = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null; avatar_url: string | null };

export function PartyDetail() {
  const { id } = useParams();
  const partyId = id!;

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<PartyRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "district">("name");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data: myProfile, error: mpErr } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
        if (mpErr) throw mpErr;
        const classId = (myProfile as any)?.class_id as string | null;
        if (!classId) throw new Error("No active class selected");

        const { data: p, error: pErr } = await supabase.from("parties").select("id,name,platform,created_at").eq("id", partyId).single();
        if (pErr) throw pErr;
        setParty(p as any);

        const { data: memberships, error: mErr } = await supabase
          .from("class_memberships")
          .select("user_id")
          .eq("class_id", classId)
          .eq("status", "approved");
        if (mErr) throw mErr;
        const memberIds = (memberships ?? []).map((m: any) => m.user_id);

        const { data: rows, error } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name,avatar_url")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"])
          .eq("party", (p as any).name)
          .order("display_name", { ascending: true });
        if (error) throw error;
        setMembers((rows ?? []) as any);
      } catch (e: any) {
        toast.error(e.message || "Could not load party");
      } finally {
        setLoading(false);
      }
    };
    if (!partyId) return;
    void load();
  }, [partyId]);

  const visibleMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return members
      .filter((m) => {
        if (!query) return true;
        return (
          (m.display_name ?? "Member").toLowerCase().includes(query) ||
          formatConstituency(m.constituency_name).toLowerCase().includes(query)
        );
      })
      .sort((a, b) =>
        sortBy === "district"
          ? formatConstituency(a.constituency_name).localeCompare(formatConstituency(b.constituency_name))
          : (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"),
      );
  }, [members, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading || !party ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{party.name}</h1>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {members.length} members
                  </div>
                </div>
                <Link to="/parties" className="text-sm text-blue-600 hover:underline">
                  Back to parties
                </Link>
              </div>

              <div className="mt-5 pt-5 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-gray-700 whitespace-pre-line">{party.platform || "No platform yet."}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                </div>
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="min-w-0 w-64 max-w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="name">Name</option>
                    <option value="district">District</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {visibleMembers.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <DefaultAvatar className="w-10 h-10" iconClassName="w-5 h-5 text-gray-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link to={`/profile/${m.user_id}`} className="text-blue-600 hover:underline">
                          {m.display_name ?? "Member"}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{formatConstituency(m.constituency_name)}</div>
                    </div>
                  </div>
                ))}
                {visibleMembers.length === 0 && <div className="text-sm text-gray-500">No members found.</div>}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
