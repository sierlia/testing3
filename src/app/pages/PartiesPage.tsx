import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Flag, LogOut, Pencil, Plus, Repeat2, Search, Trash2, UserPlus, Users, Vote } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { OrganizationsLayout } from "./OrganizationsLayout";
import { PartyCreateForm, NewParty, defaultPartyColor } from "../components/PartyCreateForm";
import { supabase } from "../utils/supabase";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

type PartyRow = { id: string; name: string; platform: string; color: string; approved: boolean; created_at: string };
type MemberProfile = { user_id: string; display_name: string | null; party: string | null };
type LeadershipVote = { party_id: string; position: "chair" | "whip"; candidate_user_id: string };
type PartiesCache = { settings: any; role: "teacher" | "student" | null; classId: string | null; meId: string | null; parties: PartyRow[]; members: MemberProfile[]; votes: LeadershipVote[] };

let partiesPageCache: PartiesCache | null = null;

function PartyIcon({ name }: { name: string }) {
  const normalized = name.toLowerCase();
  if (normalized.includes("democrat")) {
    return (
      <img
        src="https://commons.wikimedia.org/wiki/Special:FilePath/Democratic%20Disc.svg"
        alt="Democratic Party donkey"
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  if (normalized.includes("republican")) {
    return (
      <img
        src="https://commons.wikimedia.org/wiki/Special:FilePath/Republican%20Disc.svg"
        alt="Republican Party elephant"
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400">
      <Flag className="h-4 w-4" />
    </span>
  );
}

function fadedPartyColor(color: string) {
  const hex = color.trim();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return "#fee2e2";
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.14)`;
}

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function comparablePartyName(name: string) {
  return displayPartyName(name).toLowerCase().replace(/\s+/g, " ").trim();
}

export function PartiesPage() {
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [partyNameError, setPartyNameError] = useState("");
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);

  useEffect(() => {
    if (partiesPageCache) {
      setSettings(partiesPageCache.settings);
      setRole(partiesPageCache.role);
      setClassId(partiesPageCache.classId);
      setMeId(partiesPageCache.meId);
      setParties(partiesPageCache.parties);
      setMembers(partiesPageCache.members);
      setVotes(partiesPageCache.votes);
      setLoading(false);
    }

    const load = async () => {
      if (!partiesPageCache) setLoading(true);
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

        const nextParties = rows.map((party) => ({
            id: party.id,
            name: party.name,
            platform: party.platform ?? "",
            color: party.color ?? defaultPartyColor(party.name),
            approved: !!party.approved,
            created_at: party.created_at,
          }));
        setParties(nextParties);

        const [{ data: memberProfiles }, { data: voteRows }] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id,display_name,party")
            .eq("class_id", activeClassId),
          supabase.from("party_leadership_votes").select("party_id,position,candidate_user_id").eq("class_id", activeClassId),
        ]);
        const nextMembers = (memberProfiles ?? []) as any;
        const nextVotes = (voteRows ?? []) as any;
        setMembers(nextMembers);
        setVotes(nextVotes);
        partiesPageCache = { settings: classSettings, role: ((profile as any)?.role ?? null) as any, classId: activeClassId ?? null, meId: me ?? null, parties: nextParties, members: nextMembers, votes: nextVotes };
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
  const filteredParties = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return parties.filter((party) => !query || party.name.toLowerCase().includes(query) || (party.platform ?? "").toLowerCase().includes(query));
  }, [parties, searchQuery]);
  const memberCount = (partyName: string) => {
    const comparable = comparablePartyName(partyName);
    return members.filter((member) => member.party && comparablePartyName(member.party) === comparable).length;
  };
  const approvedParties = useMemo(() => {
    const rows = filteredParties.filter((party) => party.approved);
    return rows.sort((a, b) => {
      const aCount = memberCount(a.name);
      const bCount = memberCount(b.name);
      if (aCount !== bCount) return bCount - aCount;
      const priority = (name: string) => {
        const normalized = displayPartyName(name).toLowerCase();
        if (normalized.includes("republican")) return 0;
        if (normalized.includes("democratic")) return 1;
        return 2;
      };
      const priorityDiff = priority(a.name) - priority(b.name);
      if (priorityDiff) return priorityDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredParties, members]);
  const pendingParties = useMemo(() => parties.filter((party) => !party.approved), [parties]);
  const currentPartyName = useMemo(() => members.find((member) => member.user_id === meId)?.party ?? null, [meId, members]);
  const twoPartyMajorityName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members) {
      if (!member.party) continue;
      counts.set(member.party, (counts.get(member.party) ?? 0) + 1);
    }
    const democratic = [...counts.entries()].find(([name]) => name.toLowerCase().includes("democrat"));
    const republican = [...counts.entries()].find(([name]) => name.toLowerCase().includes("republican"));
    const democraticCount = democratic?.[1] ?? 0;
    const republicanCount = republican?.[1] ?? 0;
    if (democraticCount === republicanCount) return null;
    return democraticCount > republicanCount ? democratic?.[0] ?? null : republican?.[0] ?? null;
  }, [members]);

  const leadershipLabels = (partyName: string) => {
    const normalized = partyName.toLowerCase();
    const isMajorParty = normalized.includes("democrat") || normalized.includes("republican");
    if (!isMajorParty) return { chair: "Chair", whip: "Vice Chair" };
    if (!twoPartyMajorityName) return { chair: "Leader", whip: "Whip" };
    const isMajority = partyName === twoPartyMajorityName;
    return {
      chair: isMajority ? "Majority Leader" : "Minority Leader",
      whip: isMajority ? "Majority Whip" : "Minority Whip",
    };
  };
  const leaderFor = (party: PartyRow, position: "chair" | "whip") => {
    const counts = new Map<string, number>();
    for (const vote of votes.filter((row) => row.party_id === party.id && row.position === position)) {
      counts.set(vote.candidate_user_id, (counts.get(vote.candidate_user_id) ?? 0) + 1);
    }
    const winnerId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winnerId ? members.find((member) => member.user_id === winnerId) ?? null : null;
  };

  const updateMyParty = async (partyName: string | null) => {
    if (!meId) return;
    if (partyName === null && currentPartyName) {
      setConfirmDialog({
        title: "Leave party?",
        message: `Leave ${currentPartyName}?`,
        confirmLabel: "Leave",
        danger: true,
        onConfirm: () => updateMyPartyConfirmed(null),
      });
      return;
    }
    if (partyName && currentPartyName && currentPartyName !== partyName) {
      setConfirmDialog({
        title: "Switch party?",
        message: `Switch from ${currentPartyName} to ${partyName}?`,
        confirmLabel: "Switch",
        onConfirm: () => updateMyPartyConfirmed(partyName),
      });
      return;
    }
    await updateMyPartyConfirmed(partyName);
  };

  const updateMyPartyConfirmed = async (partyName: string | null) => {
    if (!meId) return;
    try {
      const { error } = await supabase.from("profiles").update({ party: partyName }).eq("user_id", meId);
      if (error) throw error;
      const nextMembers = members.map((member) => (member.user_id === meId ? { ...member, party: partyName } : member));
      setMembers(nextMembers);
      if (partiesPageCache) partiesPageCache = { ...partiesPageCache, members: nextMembers };
      toast.success(partyName ? `Switched to ${partyName}` : "Left party");
    } catch (error: any) {
      toast.error(error.message || "Could not update party");
    }
  };

  const hasDuplicatePartyName = (name: string, ignoredPartyId = editingPartyId) => {
    if (!name.trim()) return false;
    const normalizedName = comparablePartyName(name);
    if (!normalizedName) return false;
    return parties.some((party) => party.id !== ignoredPartyId && comparablePartyName(party.name) === normalizedName);
  };

  const validatePartyName = (name = draft.name) => {
    const duplicate = hasDuplicatePartyName(name);
    setPartyNameError(duplicate ? "Name already used" : "");
    return !duplicate;
  };

  const createParty = async () => {
    if (!classId || !meId) return;
    if (!validatePartyName()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          class_id: classId,
          name: displayPartyName(draft.name),
          platform: draft.platform.trim(),
          color: draft.color,
          created_by: meId,
          approved: role === "teacher" ? true : !requireApproval,
        } as any)
        .select("id,name,platform,color,approved,created_at")
        .single();
      if (error) throw error;
      const nextParties = [data as any, ...parties];
      setParties(nextParties);
      if (partiesPageCache) partiesPageCache = { ...partiesPageCache, parties: nextParties };
      setDraft({ name: "", platform: "", color: "#2563eb" });
      setPartyNameError("");
      setNewPartyOpen(false);
      toast.success(role === "teacher" || !requireApproval ? "Party created" : "Party submitted for approval");
    } catch (error: any) {
      toast.error(error.message || "Could not create party");
    } finally {
      setCreating(false);
    }
  };

  const savePartyEdits = async () => {
    if (!editingPartyId) return;
    const current = parties.find((party) => party.id === editingPartyId);
    if (!current) return;
    const nextName = displayPartyName(draft.name);
    if (!validatePartyName(nextName)) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .update({ name: nextName, platform: draft.platform.trim(), color: draft.color } as any)
        .eq("id", editingPartyId)
        .select("id,name,platform,color,approved,created_at")
        .single();
      if (error) throw error;
      const nextParties = parties.map((party) => (party.id === editingPartyId ? (data as any) : party));
      setParties(nextParties);
      if (partiesPageCache) partiesPageCache = { ...partiesPageCache, parties: nextParties };
      setEditingPartyId(null);
      setNewPartyOpen(false);
      setDraft({ name: "", platform: "", color: "#2563eb" });
      setPartyNameError("");
      toast.success("Party updated");
    } catch (error: any) {
      toast.error(error.message || "Could not update party");
    } finally {
      setCreating(false);
    }
  };

  const deleteParty = (party: PartyRow) => {
    setConfirmDialog({
      title: "Delete party?",
      message: `${displayPartyName(party.name)} will be deleted. Members in this party will no longer have a party.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("parties").delete().eq("id", party.id);
        if (error) throw error;
        const nextParties = parties.filter((item) => item.id !== party.id);
        setParties(nextParties);
        if (partiesPageCache) partiesPageCache = { ...partiesPageCache, parties: nextParties };
        toast.success("Party deleted");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <OrganizationsLayout active="parties">
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search parties..."
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {canCreate && (
                <button
                  onClick={() => {
                    setEditingPartyId(null);
                    setPartyNameError("");
                    setDraft({ name: "", platform: "", color: "#2563eb" });
                    setNewPartyOpen((open) => !open);
                  }}
                  className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Party
                </button>
              )}
            </div>
          </div>

          {newPartyOpen && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">{editingPartyId ? "Edit Party" : "Create Party"}</h3>
              <PartyCreateForm
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  if (partyNameError && !hasDuplicatePartyName(next.name)) setPartyNameError("");
                }}
                onNameBlur={() => validatePartyName()}
                onCancel={() => {
                  setNewPartyOpen(false);
                  setEditingPartyId(null);
                  setPartyNameError("");
                }}
                onSubmit={editingPartyId ? savePartyEdits : createParty}
                submitting={creating}
                submitLabel={editingPartyId ? "Save Party" : "Create Party"}
                nameError={partyNameError}
              />
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
                const labels = leadershipLabels(party.name);
                const isCurrentParty = currentPartyName === party.name;
                return (
                  <div
                    key={party.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/parties/${party.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") navigate(`/parties/${party.id}`);
                    }}
                    style={{ "--party-color": party.color } as CSSProperties}
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="h-2" style={{ backgroundColor: party.color }} />
                    <div className="p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <PartyIcon name={party.name} />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:[color:var(--party-color)]">{displayPartyName(party.name)}</h3>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <Users className="h-3.5 w-3.5" />
                              {memberCount(party.name)} members
                            </div>
                          </div>
                        </div>
                        {role !== "teacher" && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void updateMyParty(isCurrentParty ? null : party.name);
                            }}
                            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              isCurrentParty ? "border hover:opacity-90" : "text-white hover:opacity-90"
                            }`}
                            style={isCurrentParty ? { backgroundColor: fadedPartyColor(party.color), borderColor: party.color, color: party.color } : { backgroundColor: party.color }}
                          >
                            {isCurrentParty ? <LogOut className="h-3.5 w-3.5" /> : currentPartyName ? <Repeat2 className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                            {isCurrentParty ? "Leave" : currentPartyName ? "Switch" : "Join"}
                          </button>
                        )}
                        {role === "teacher" && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingPartyId(party.id);
                                setDraft({ name: displayPartyName(party.name), platform: party.platform, color: party.color });
                                setPartyNameError("");
                                setNewPartyOpen(true);
                              }}
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                              aria-label="Edit party"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteParty(party);
                              }}
                              className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete party"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-3 text-sm text-gray-600">{party.platform || "No platform yet."}</p>
                      <div className="mt-4 grid gap-2 border-t border-gray-200 pt-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="h-4 w-4" /> {labels.chair}</span>
                          <span className="truncate text-gray-600">{chair?.display_name ?? "Not elected"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-medium text-gray-700"><Vote className="h-4 w-4" /> {labels.whip}</span>
                          <span className="truncate text-gray-600">{whip?.display_name ?? "Not elected"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
