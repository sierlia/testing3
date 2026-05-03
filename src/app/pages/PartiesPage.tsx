import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Flag, Plus, Shield, Users, Vote } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { PartyCreateForm, NewParty, defaultPartyColor } from "../components/PartyCreateForm";
import { supabase } from "../utils/supabase";

type PartyRow = { id: string; name: string; platform: string; color: string; approved: boolean; created_at: string };
type MemberProfile = { user_id: string; display_name: string | null; party: string | null };
type LeadershipVote = { party_id: string; position: "chair" | "whip"; candidate_user_id: string };

function PartyIcon({ name, color }: { name: string; color: string }) {
  const normalized = name.toLowerCase();
  if (normalized.includes("democrat")) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: color }}>
        D
      </span>
    );
  }
  if (normalized.includes("republican")) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: color }}>
        R
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
      <Flag className="h-4 w-4" />
    </span>
  );
}

export function PartiesPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [votes, setVotes] = useState<LeadershipVote[]>([]);
  const [newPartyOpen, setNewPartyOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<NewParty>({ name: "", platform: "", color: "#2563eb" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;
        setMeId(me);

        const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", me).maybeSingle();
        const activeClassId = (profile as any)?.class_id;
        setClassId(activeClassId ?? null);
        setRole(((profile as any)?.role ?? null) as any);
        if (!activeClassId) {
          setParties([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", activeClassId).maybeSingle();
        const classSettings = (cls as any)?.settings ?? {};
        setSettings(classSettings);

        const { data: partyRows, error: partyError } = await supabase
          .from("parties")
          .select("id,name,platform,color,approved,created_at")
          .eq("class_id", activeClassId)
          .order("created_at", { ascending: false });
        if (partyError) throw partyError;
        let rows = (partyRows ?? []) as any[];

        const allowed = (classSettings?.parties?.allowed ?? []) as string[];
        if ((profile as any)?.role === "teacher" && rows.length === 0 && allowed.length > 0) {
          const { data: seeded, error: seedError } = await supabase
            .from("parties")
            .insert(
              allowed.map((name) => ({
                class_id: activeClassId,
                name,
                platform: "",
                color: defaultPartyColor(name),
                created_by: me,
                approved: true,
              })),
            )
            .select("id,name,platform,color,approved,created_at");
          if (seedError) throw seedError;
          rows = seeded ?? [];
        }

        setParties(
          rows.map((party) => ({
            id: party.id,
            name: party.name,
            platform: party.platform ?? "",
            color: party.color ?? defaultPartyColor(party.name),
            approved: !!party.approved,
            created_at: party.created_at,
          })),
        );

        const { data: memberships } = await supabase.from("class_memberships").select("user_id").eq("class_id", activeClassId).eq("status", "approved");
        const memberIds = (memberships ?? []).map((m: any) => m.user_id);
        const [{ data: memberProfiles }, { data: voteRows }] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id,display_name,party")
            .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]),
          supabase.from("party_leadership_votes").select("party_id,position,candidate_user_id").eq("class_id", activeClassId),
        ]);
        setMembers((memberProfiles ?? []) as any);
        setVotes((voteRows ?? []) as any);
      } catch (error: any) {
        toast.error(error.message || "Could not load parties");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const allowStudentCreated = !!settings?.parties?.allowStudentCreated;
  const requireApproval = !!settings?.parties?.requireApproval;
  const canCreate = role === "teacher" || allowStudentCreated;
  const approvedParties = useMemo(() => parties.filter((party) => party.approved), [parties]);
  const pendingParties = useMemo(() => parties.filter((party) => !party.approved), [parties]);

  const memberCount = (partyName: string) => members.filter((member) => member.party === partyName).length;
  const leaderFor = (party: PartyRow, position: "chair" | "whip") => {
    const counts = new Map<string, number>();
    for (const vote of votes.filter((row) => row.party_id === party.id && row.position === position)) {
      counts.set(vote.candidate_user_id, (counts.get(vote.candidate_user_id) ?? 0) + 1);
    }
    const winnerId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winnerId ? members.find((member) => member.user_id === winnerId) ?? null : null;
  };

  const createParty = async () => {
    if (!classId || !meId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          class_id: classId,
          name: draft.name.trim(),
          platform: draft.platform.trim(),
          color: draft.color,
          created_by: meId,
          approved: role === "teacher" ? true : !requireApproval,
        } as any)
        .select("id,name,platform,color,approved,created_at")
        .single();
      if (error) throw error;
      setParties([data as any, ...parties]);
      setDraft({ name: "", platform: "", color: "#2563eb" });
      setNewPartyOpen(false);
      toast.success(role === "teacher" || !requireApproval ? "Party created" : "Party submitted for approval");
    } catch (error: any) {
      toast.error(error.message || "Could not create party");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <OrganizationsLayout active="parties">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Parties</h2>
              <p className="text-sm text-gray-600">Class political parties and leadership</p>
            </div>
            {canCreate && (
              <button
                onClick={() => setNewPartyOpen((open) => !open)}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Party
              </button>
            )}
          </div>

          {newPartyOpen && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Create Party</h3>
              <PartyCreateForm value={draft} onChange={setDraft} onCancel={() => setNewPartyOpen(false)} onSubmit={createParty} submitting={creating} />
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading parties...</div>
          ) : approvedParties.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No parties yet.</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {approvedParties.map((party) => {
                const chair = leaderFor(party, "chair");
                const whip = leaderFor(party, "whip");
                return (
                  <Link
                    key={party.id}
                    to={`/parties/${party.id}`}
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="h-2" style={{ backgroundColor: party.color }} />
                    <div className="p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <PartyIcon name={party.name} color={party.color} />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">{party.name}</h3>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <Users className="h-3.5 w-3.5" />
                              {memberCount(party.name)} members
                            </div>
                          </div>
                        </div>
                        <Shield className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="line-clamp-3 text-sm text-gray-600">{party.platform || "No platform yet."}</p>
                      <div className="mt-4 grid gap-2 border-t border-gray-200 pt-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="h-4 w-4" /> Chair</span>
                          <span className="truncate text-gray-600">{chair?.display_name ?? "Not elected"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="h-4 w-4" /> Whip</span>
                          <span className="truncate text-gray-600">{whip?.display_name ?? "Not elected"}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {pendingParties.length > 0 && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Pending approval: {pendingParties.length}
            </div>
          )}
        </OrganizationsLayout>
      </main>
    </div>
  );
}
