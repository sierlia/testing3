import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";

type Member = {
  user_id: string;
  display_name: string | null;
  party: string | null;
  constituency_name: string | null;
  avatar_url: string | null;
  role: "teacher" | "student";
};

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

export function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterParty, setFilterParty] = useState("all");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        const { data: myProfile } = me
          ? await supabase.from("profiles").select("class_id").eq("user_id", me).maybeSingle()
          : ({ data: null } as any);
        const classId = (myProfile as any)?.class_id as string | undefined;
        if (!classId) {
          setMembers([]);
          return;
        }

        const { data, error } = await supabase.rpc("class_directory", { target_class: classId } as any);
        if (error) throw error;
        setMembers((data ?? []) as any);
      } catch (e: any) {
        toast.error(e.message || "Could not load members");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const parties = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) if (m.role !== "teacher" && m.party) set.add(m.party);
    return Array.from(set).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const name = member.display_name ?? "";
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesParty = member.role === "teacher" ? filterParty === "all" : filterParty === "all" || (member.party ?? "N/A") === filterParty;
      return matchesSearch && matchesParty;
    });
  }, [members, searchQuery, filterParty]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Members</h1>
          <p className="text-gray-600">
            Directory of all simulation participants
          </p>
        </div>

        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterParty}
              onChange={(e) => setFilterParty(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Parties</option>
              {parties.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Members grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <Link
              key={member.user_id}
              to={`/profile/${member.user_id}`}
              className={`rounded-lg border p-6 shadow-sm transition-shadow hover:shadow-md ${
                member.role === "teacher" ? "border-green-200 bg-green-50 hover:bg-green-100" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.display_name ?? "Member"} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <DefaultAvatar className="w-16 h-16 flex-shrink-0" iconClassName="w-8 h-8 text-gray-500" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`mb-1 truncate font-semibold ${member.role === "teacher" ? "text-green-800" : "text-gray-900"}`}>
                    {member.display_name ?? "Member"}
                  </h3>
                  {member.role === "teacher" ? (
                    <div className="text-sm font-medium text-green-700">Teacher</div>
                  ) : (
                    <div className="text-sm text-gray-600">Rep.-{partyAbbr(member.party)}-{formatConstituency(member.constituency_name) || "N/A"}</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No members found
          </div>
        )}
      </main>
    </div>
  );
}
