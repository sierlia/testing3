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
  committees: string[];
  caucuses: string[];
  leadershipRoles: string[];
  passedBills: number;
  failedBills: number;
  cosponsors: number;
};

type SortKey = "name" | "party" | "state" | "passed" | "cosponsors";

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
  const [filterCommittee, setFilterCommittee] = useState("all");
  const [filterCaucus, setFilterCaucus] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
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
        const userIds = ((data ?? []) as any[]).map((member) => member.user_id);
        const [{ data: committeeRows }, { data: caucusRows }, { data: billRows }, { data: cosponsorRows }, { data: partyRows }] = await Promise.all([
          supabase.from("committee_members").select("user_id,committees(name,class_id)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
          supabase.from("caucus_members").select("user_id,caucuses(title,class_id)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
          supabase.from("bills").select("author_user_id,status").eq("class_id", classId),
          supabase.from("bill_cosponsors").select("user_id").eq("class_id", classId),
          supabase.from("parties").select("id,name").eq("class_id", classId),
        ]);
        const partyNameById = new Map((partyRows ?? []).map((party: any) => [party.id, party.name]));
        const partyIds = Array.from(partyNameById.keys());
        const { data: partyRoleRows } = partyIds.length
          ? await supabase.from("party_member_roles").select("user_id,role,party_id").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]).in("party_id", partyIds)
          : ({ data: [] } as any);
        const committeesByUser = new Map<string, string[]>();
        const leadershipByUser = new Map<string, string[]>();
        const roleLabel = (role: string) => role === "member" ? "" : role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
        for (const row of committeeRows ?? []) {
          if ((row as any).committees?.class_id !== classId) continue;
          const name = (row as any).committees?.name;
          if (name) committeesByUser.set((row as any).user_id, [...(committeesByUser.get((row as any).user_id) ?? []), name]);
          const label = roleLabel((row as any).role ?? "member");
          if (label) leadershipByUser.set((row as any).user_id, [...(leadershipByUser.get((row as any).user_id) ?? []), `${label}, ${name ?? "Committee"}`]);
        }
        const caucusesByUser = new Map<string, string[]>();
        for (const row of caucusRows ?? []) {
          if ((row as any).caucuses?.class_id !== classId) continue;
          const title = (row as any).caucuses?.title;
          if (title) caucusesByUser.set((row as any).user_id, [...(caucusesByUser.get((row as any).user_id) ?? []), title]);
          const label = roleLabel((row as any).role ?? "member");
          if (label) leadershipByUser.set((row as any).user_id, [...(leadershipByUser.get((row as any).user_id) ?? []), `${label}, ${title ?? "Caucus"}`]);
        }
        for (const row of partyRoleRows ?? []) {
          const label = roleLabel((row as any).role ?? "member");
          const party = partyNameById.get((row as any).party_id) ?? "Party";
          if (label) leadershipByUser.set((row as any).user_id, [...(leadershipByUser.get((row as any).user_id) ?? []), `${label}, ${party}`]);
        }
        const passedByUser = new Map<string, number>();
        const failedByUser = new Map<string, number>();
        for (const bill of billRows ?? []) {
          const author = (bill as any).author_user_id;
          if ((bill as any).status === "passed") passedByUser.set(author, (passedByUser.get(author) ?? 0) + 1);
          if ((bill as any).status === "failed") failedByUser.set(author, (failedByUser.get(author) ?? 0) + 1);
        }
        const cosponsorsByUser = new Map<string, number>();
        for (const row of cosponsorRows ?? []) cosponsorsByUser.set((row as any).user_id, (cosponsorsByUser.get((row as any).user_id) ?? 0) + 1);
        setMembers(((data ?? []) as any[]).map((member) => ({
          ...member,
          committees: committeesByUser.get(member.user_id) ?? [],
          caucuses: caucusesByUser.get(member.user_id) ?? [],
          leadershipRoles: leadershipByUser.get(member.user_id) ?? [],
          passedBills: passedByUser.get(member.user_id) ?? 0,
          failedBills: failedByUser.get(member.user_id) ?? 0,
          cosponsors: cosponsorsByUser.get(member.user_id) ?? 0,
        })));
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

  const committees = useMemo(() => Array.from(new Set(members.flatMap((member) => member.committees))).sort(), [members]);
  const caucuses = useMemo(() => Array.from(new Set(members.flatMap((member) => member.caucuses))).sort(), [members]);
  const stateFor = (member: Member) => {
    const formatted = formatConstituency(member.constituency_name);
    const match = formatted.match(/^([A-Z]{2})-/);
    return match?.[1] ?? "";
  };
  const states = useMemo(() => Array.from(new Set(members.map(stateFor).filter(Boolean))).sort(), [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const name = member.display_name ?? "";
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesParty = member.role === "teacher" ? filterParty === "all" : filterParty === "all" || (member.party ?? "N/A") === filterParty;
      const matchesCommittee = filterCommittee === "all" || member.committees.includes(filterCommittee);
      const matchesCaucus = filterCaucus === "all" || member.caucuses.includes(filterCaucus);
      const matchesState = filterState === "all" || stateFor(member) === filterState;
      return matchesSearch && matchesParty && matchesCommittee && matchesCaucus && matchesState;
    }).sort((a, b) => {
      if (sortBy === "passed") return b.passedBills - a.passedBills || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (sortBy === "cosponsors") return b.cosponsors - a.cosponsors || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (sortBy === "state") return stateFor(a).localeCompare(stateFor(b)) || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (sortBy === "party") return (a.party ?? "").localeCompare(b.party ?? "") || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });
  }, [members, searchQuery, filterParty, filterCommittee, filterCaucus, filterState, sortBy]);

  const memberCount = filteredMembers.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Members ({memberCount})</h1>
        </div>

        {/* Search and filters */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All States</option>
              {states.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <select
              value={filterCommittee}
              onChange={(e) => setFilterCommittee(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Committees</option>
              {committees.map((committee) => (
                <option key={committee} value={committee}>{committee}</option>
              ))}
            </select>
            <select
              value={filterCaucus}
              onChange={(e) => setFilterCaucus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Caucuses</option>
              {caucuses.map((caucus) => (
                <option key={caucus} value={caucus}>{caucus}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="name">Sort by name</option>
              <option value="party">Sort by party</option>
              <option value="state">Sort by state</option>
              <option value="passed">Most passed bills</option>
              <option value="cosponsors">Most cosponsors</option>
            </select>
            </div>
          </div>
        </div>

        {/* Members grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {member.leadershipRoles.length > 0 && (
                    <div className="mt-1 truncate text-xs text-purple-700" title={member.leadershipRoles.join("; ")}>
                      {member.leadershipRoles.join("; ")}
                    </div>
                  )}
                </div>
              </div>
              {member.role !== "teacher" && (
                <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{member.passedBills}</div>
                    <div className="text-xs text-gray-500">Passed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{member.cosponsors}</div>
                    <div className="text-xs text-gray-500">Cosponsors</div>
                  </div>
                </div>
              )}
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
