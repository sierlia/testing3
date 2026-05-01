import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search, MapPin, Flag } from "lucide-react";
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
    for (const m of members) if (m.party) set.add(m.party);
    return Array.from(set).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const name = member.display_name ?? "";
      const constituency = formatConstituency(member.constituency_name);
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) || constituency.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesParty = filterParty === "all" || (member.party ?? "N/A") === filterParty;
      return matchesSearch && matchesParty;
    });
  }, [members, searchQuery, filterParty]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                placeholder="Search by name or district..."
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
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4 mb-4">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.display_name ?? "Member"} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <DefaultAvatar className="w-16 h-16 flex-shrink-0" iconClassName="w-8 h-8 text-gray-500" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">{member.display_name ?? "Member"}</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{formatConstituency(member.constituency_name)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Flag className="w-3 h-3" />
                      <span>{member.party ?? "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">{member.role === "teacher" ? "Teacher" : "Student"}</div>
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
