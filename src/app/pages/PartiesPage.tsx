import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { Plus, Flag, Users } from "lucide-react";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { Link } from "react-router";
import { formatConstituency } from "../utils/constituency";

type PartyRow = { id: string; name: string; platform: string; approved: boolean; created_at: string };
type PartyMember = { user_id: string; display_name: string | null; party: string | null; constituency_name: string | null };

export function PartiesPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);

  const [parties, setParties] = useState<PartyRow[]>([]);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"name" | "district">("name");
  const [newPartyOpen, setNewPartyOpen] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyPlatform, setPartyPlatform] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;

        const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", me).maybeSingle();
        const classId = (profile as any)?.class_id;
        setRole(((profile as any)?.role ?? null) as any);
        if (!classId) {
          setParties([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        setSettings((cls as any)?.settings ?? {});

        const { data: partyRows, error: pErr } = await supabase
          .from("parties")
          .select("id,name,platform,approved,created_at")
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;
        const rows = (partyRows ?? []) as any;

        const { data: memberships } = await supabase.from("class_memberships").select("user_id").eq("class_id", classId).eq("status", "approved");
        const memberIds = (memberships ?? []).map((m: any) => m.user_id);
        const { data: memberProfiles } = await supabase
          .from("profiles")
          .select("user_id,display_name,party,constituency_name")
          .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
        setPartyMembers((memberProfiles ?? []) as any);

        // Teacher: if no parties exist yet, initialize from class settings
        const allowed = ((cls as any)?.settings?.parties?.allowed ?? []) as string[];
        if (((profile as any)?.role === "teacher") && rows.length === 0 && allowed.length > 0) {
          const { data: seeded, error: sErr } = await supabase
            .from("parties")
            .insert(
              allowed.map((name) => ({
                class_id: classId,
                name,
                platform: "",
                created_by: me,
                approved: true,
              })),
            )
            .select("id,name,platform,approved,created_at");
          if (sErr) throw sErr;
          setParties((seeded ?? []) as any);
        } else {
          setParties(rows);
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load parties");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const allowStudentCreated = !!settings?.parties?.allowStudentCreated;
  const requireApproval = !!settings?.parties?.requireApproval;
  const canPropose = role === "teacher" || allowStudentCreated;

  const approvedParties = useMemo(() => parties.filter((p) => p.approved), [parties]);
  const pendingParties = useMemo(() => parties.filter((p) => !p.approved), [parties]);
  const membersByParty = useMemo(() => {
    const grouped = new Map<string, PartyMember[]>();
    const query = memberSearch.toLowerCase().trim();
    for (const member of partyMembers) {
      const party = member.party ?? "";
      if (!party) continue;
      if (
        query &&
        !(member.display_name ?? "Member").toLowerCase().includes(query) &&
        !formatConstituency(member.constituency_name).toLowerCase().includes(query)
      ) {
        continue;
      }
      grouped.set(party, [...(grouped.get(party) ?? []), member]);
    }
    for (const [party, members] of grouped) {
      grouped.set(
        party,
        members.sort((a, b) =>
          memberSort === "district"
            ? formatConstituency(a.constituency_name).localeCompare(formatConstituency(b.constituency_name))
            : (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"),
        ),
      );
    }
    return grouped;
  }, [memberSearch, memberSort, partyMembers]);

  const createParty = async () => {
    setCreating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) return;

      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", me).maybeSingle();
      const classId = (profile as any)?.class_id;
      if (!classId) throw new Error("Join a class first");

      const { data, error } = await supabase
        .from("parties")
        .insert({
          class_id: classId,
          name: partyName.trim(),
          platform: partyPlatform.trim(),
          created_by: me,
          approved: role === "teacher" ? true : !requireApproval,
        })
        .select("id,name,platform,approved,created_at")
        .single();
      if (error) throw error;
      setParties([data as any, ...parties]);
      setPartyName("");
      setPartyPlatform("");
      setNewPartyOpen(false);
      toast.success(role === "teacher" || !requireApproval ? "Party saved" : "Party submitted for approval");
    } catch (e: any) {
      toast.error(e.message || "Could not create party");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="parties">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Parties</h2>
              </div>
              {canPropose && (
                <button
                  onClick={() => setNewPartyOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {role === "teacher" ? "Add Party" : "Propose Party"}
                </button>
              )}
            </div>

            {newPartyOpen && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                  <input value={partyName} onChange={(e) => setPartyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <textarea value={partyPlatform} onChange={(e) => setPartyPlatform(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setNewPartyOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900">Cancel</button>
                  <button
                    disabled={creating || !partyName.trim() || !partyPlatform.trim()}
                    onClick={() => void createParty()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-sm text-gray-500">Loading parties…</div>
            ) : approvedParties.length === 0 ? (
              <div className="text-sm text-gray-500">No parties yet.</div>
            ) : (
              <>
                <div className="flex gap-2 mb-4">
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search party members..."
                    className="min-w-0 flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <select value={memberSort} onChange={(e) => setMemberSort(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="name">Name</option>
                    <option value="district">District</option>
                  </select>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {approvedParties.map((p) => (
                    <div key={p.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-sm text-gray-700 mt-1">{p.platform}</div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2">
                          <Users className="w-3.5 h-3.5" />
                          Members
                        </div>
                        <div className="space-y-1.5">
                          {(membersByParty.get(p.name) ?? []).length === 0 ? (
                            <div className="text-xs text-gray-500">No members found.</div>
                          ) : (
                            (membersByParty.get(p.name) ?? []).map((member) => (
                              <div key={member.user_id} className="flex items-center justify-between gap-2 text-sm">
                                <Link to={`/profile/${member.user_id}`} className="text-blue-600 hover:underline truncate">
                                  {member.display_name ?? "Member"}
                                </Link>
                                <span className="text-xs text-gray-500">{formatConstituency(member.constituency_name)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {pendingParties.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">Pending approval: {pendingParties.length}</div>
            )}
          </div>
        </OrganizationsLayout>
      </main>
    </div>
  );
}
