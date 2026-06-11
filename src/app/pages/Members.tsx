import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigation } from "../components/Navigation";
import { Search } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { SecureAvatar } from "../components/SecureAvatar";
import { formatConstituency } from "../utils/constituency";
import { InfoTooltip } from "../components/InfoTooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { profilePath } from "../utils/profileRoute";
import { OrganizationsLayout } from "./OrganizationsLayout";

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
  campaignFunds: number;
};

type SortKey = "name" | "party" | "state" | "passed" | "cosponsors" | "campaign";

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function FilterSelect({ value, onChange, children, className = "w-36" }: { value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[140]">{children}</SelectContent>
    </Select>
  );
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
  const [moneyEnabled, setMoneyEnabled] = useState(false);

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

        const [{ data, error }, { data: cls }] = await Promise.all([
          supabase.rpc("class_directory", { target_class: classId } as any),
          supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
        ]);
        if (error) throw error;
        setMoneyEnabled(Boolean((cls as any)?.settings?.money?.enabled));
        const userIds = ((data ?? []) as any[]).map((member) => member.user_id);
        const [{ data: committeeRows }, { data: caucusRows }, { data: billRows }, { data: cosponsorRows }, { data: partyRows }, { data: contributionRows }, { data: lobbyistMemberRows }] = await Promise.all([
          supabase.from("committee_members").select("user_id,committees(name,class_id)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
          supabase.from("caucus_members").select("user_id,caucuses(title,class_id)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
          supabase.from("bills").select("author_user_id,status").eq("class_id", classId),
          supabase.from("bill_cosponsors").select("user_id").eq("class_id", classId),
          supabase.from("parties").select("id,name").eq("class_id", classId),
          supabase.from("lobbyist_contributions").select("group_id,from_user_id,recipient_type,recipient_id,amount").eq("class_id", classId),
          supabase.from("lobbyist_group_members").select("user_id,group_id,lobbyist_groups(starting_amount)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
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
          if (["passed", "senate_passed", "signed"].includes((bill as any).status)) passedByUser.set(author, (passedByUser.get(author) ?? 0) + 1);
          if (["failed", "vetoed"].includes((bill as any).status)) failedByUser.set(author, (failedByUser.get(author) ?? 0) + 1);
        }
        const cosponsorsByUser = new Map<string, number>();
        for (const row of cosponsorRows ?? []) cosponsorsByUser.set((row as any).user_id, (cosponsorsByUser.get((row as any).user_id) ?? 0) + 1);
        const settings = (cls as any)?.settings ?? {};
        const startingAmount = Math.max(0, Number(settings?.money?.startingAmount ?? 1000) || 0);
        const receivedByUser = new Map<string, number>();
        const spentByUser = new Map<string, number>();
        const spentByGroup = new Map<string, number>();
        for (const row of contributionRows ?? []) {
          const amount = Number((row as any).amount ?? 0);
          const fromUser = (row as any).from_user_id as string | null;
          const groupId = (row as any).group_id as string | null;
          if (fromUser) spentByUser.set(fromUser, (spentByUser.get(fromUser) ?? 0) + amount);
          if (groupId) spentByGroup.set(groupId, (spentByGroup.get(groupId) ?? 0) + amount);
          if ((row as any).recipient_type === "member") {
            receivedByUser.set((row as any).recipient_id, (receivedByUser.get((row as any).recipient_id) ?? 0) + amount);
          }
        }
        const lobbyistGroupByUser = new Map<string, { groupId: string; startingAmount: number }>();
        for (const row of lobbyistMemberRows ?? []) {
          const group = (row as any).lobbyist_groups;
          lobbyistGroupByUser.set((row as any).user_id, {
            groupId: (row as any).group_id,
            startingAmount: Math.max(0, Number(group?.starting_amount ?? 0) || 0) || startingAmount,
          });
        }
        const currentMoneyForUser = (userId: string) => {
          const group = lobbyistGroupByUser.get(userId);
          if (group) return Math.max(0, group.startingAmount - (spentByGroup.get(group.groupId) ?? 0));
          return Math.max(0, startingAmount - (spentByUser.get(userId) ?? 0) + (receivedByUser.get(userId) ?? 0));
        };
        setMembers(((data ?? []) as any[]).map((member) => ({
          ...member,
          committees: committeesByUser.get(member.user_id) ?? [],
          caucuses: caucusesByUser.get(member.user_id) ?? [],
          leadershipRoles: leadershipByUser.get(member.user_id) ?? [],
          passedBills: passedByUser.get(member.user_id) ?? 0,
          failedBills: failedByUser.get(member.user_id) ?? 0,
          cosponsors: cosponsorsByUser.get(member.user_id) ?? 0,
          campaignFunds: currentMoneyForUser(member.user_id),
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
      if (sortBy === "campaign") return b.campaignFunds - a.campaignFunds || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (sortBy === "state") return stateFor(a).localeCompare(stateFor(b)) || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (sortBy === "party") return (a.party ?? "").localeCompare(b.party ?? "") || (a.display_name ?? "").localeCompare(b.display_name ?? "");
      if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });
  }, [members, searchQuery, filterParty, filterCommittee, filterCaucus, filterState, sortBy]);

  const memberCount = filteredMembers.length;
  const countLabel = loading ? "Loading members..." : `${memberCount} member${memberCount === 1 ? "" : "s"} found`;
  const resetFilters = () => {
    setSearchQuery("");
    setFilterParty("all");
    setFilterCommittee("all");
    setFilterCaucus("all");
    setFilterState("all");
    setSortBy("name");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="members">
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{loading ? "Members" : `Members (${memberCount})`}</h2>
                  <InfoTooltip label="What are members?">
                    <p>Members of the House of Representatives are elected to represent congressional districts in the federal legislature. They introduce and debate legislation, vote on bills and resolutions, and serve on committees that study issues in detail. Members also conduct oversight of the executive branch, help shape the federal budget, and respond to concerns from constituents. Their work combines lawmaking, public representation, investigation, and negotiation with other members of Congress.</p>
                  </InfoTooltip>
                </div>
                <p className="mt-1 text-sm text-gray-600">{countLabel}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect value={filterParty} onChange={setFilterParty}>
                  <SelectItem value="all">All Parties</SelectItem>
                  {parties.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </FilterSelect>
                <FilterSelect value={filterState} onChange={setFilterState} className="w-32">
                  <SelectItem value="all">All States</SelectItem>
                  {states.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </FilterSelect>
                <FilterSelect value={filterCommittee} onChange={setFilterCommittee} className="w-44">
                  <SelectItem value="all">All Committees</SelectItem>
                  {committees.map((committee) => (
                    <SelectItem key={committee} value={committee}>{committee}</SelectItem>
                  ))}
                </FilterSelect>
                <FilterSelect value={filterCaucus} onChange={setFilterCaucus} className="w-40">
                  <SelectItem value="all">All Caucuses</SelectItem>
                  {caucuses.map((caucus) => (
                    <SelectItem key={caucus} value={caucus}>{caucus}</SelectItem>
                  ))}
                </FilterSelect>
                <FilterSelect value={sortBy} onChange={(value) => setSortBy(value as SortKey)} className="w-40">
                  <SelectItem value="name">Sort by name</SelectItem>
                  <SelectItem value="party">Sort by party</SelectItem>
                  <SelectItem value="state">Sort by state</SelectItem>
                  <SelectItem value="passed">Most passed bills</SelectItem>
                  <SelectItem value="cosponsors">Most cosponsors</SelectItem>
                  {moneyEnabled && <SelectItem value="campaign">Campaign funds</SelectItem>}
                </FilterSelect>
                <button type="button" onClick={resetFilters} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700">Reset</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMembers.map((member) => (
              <Link
                key={member.user_id}
                to={profilePath(member.user_id)}
                className={`rounded-lg border p-6 shadow-sm transition-shadow hover:shadow-md ${
                  member.role === "teacher" ? "border-green-200 bg-green-50 hover:bg-green-100" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <SecureAvatar src={member.avatar_url} alt={member.display_name ?? "Member"} className="w-16 h-16 rounded-full object-cover flex-shrink-0" fallbackClassName="w-16 h-16 flex-shrink-0" iconClassName="w-8 h-8 text-gray-500" />
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
                  <div className={`grid gap-2 border-t border-gray-100 pt-4 text-center text-sm ${moneyEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div>
                      <div className="font-semibold text-gray-900">{member.passedBills}</div>
                      <div className="text-xs text-gray-500">Passed</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{member.cosponsors}</div>
                      <div className="text-xs text-gray-500">Cosponsors</div>
                    </div>
                    {moneyEnabled && (
                      <div>
                        <div className="font-semibold text-gray-900">${member.campaignFunds.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Campaign</div>
                      </div>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>

        {loading && (
          <div className="text-center py-12 text-gray-500">
            Loading members...
          </div>
        )}
        {!loading && filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No members found
          </div>
        )}
        </OrganizationsLayout>
      </main>
    </div>
  );
}
