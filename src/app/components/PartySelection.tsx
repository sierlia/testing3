import { useEffect, useState } from "react";
import { AlertCircle, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { PartyCreateForm, defaultPartyColor, NewParty } from "./PartyCreateForm";
import { supabase } from "../utils/supabase";

export type { NewParty } from "./PartyCreateForm";

export interface Party {
  id: string;
  name: string;
  platform: string;
  color: string;
}

interface PartySelectionProps {
  selectedParty: string | null;
  newParty?: NewParty;
  onSelectParty: (partyId: string | null) => void;
  onCreateParty: (party: NewParty | undefined) => void;
}

export function PartySelection({ selectedParty, newParty, onSelectParty, onCreateParty }: PartySelectionProps) {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [allowPartyCreation, setAllowPartyCreation] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState<NewParty>(newParty ?? { name: "", platform: "", color: "#2563eb" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", uid).maybeSingle();
        const classId = (profile as any)?.class_id;
        if (!classId) return;

        const [{ data: classRow }, { data: rows, error }] = await Promise.all([
          supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
          supabase
            .from("parties")
            .select("id,name,platform,color,approved")
            .eq("class_id", classId)
            .eq("approved", true)
            .order("name", { ascending: true }),
        ]);
        if (error) throw error;
        setParties(
          (rows ?? []).map((party: any) => ({
            id: party.id,
            name: party.name,
            platform: party.platform ?? "",
            color: party.color ?? defaultPartyColor(party.name),
          })),
        );
        setAllowPartyCreation((profile as any)?.role === "teacher" || !!(classRow as any)?.settings?.parties?.allowStudentCreated);
      } catch (error: any) {
        toast.error(error.message || "Could not load parties");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSelectParty = (partyId: string) => {
    onSelectParty(partyId);
    onCreateParty(undefined);
    setShowCreateForm(false);
  };

  const handleCreateDraft = () => {
    const next = { ...draft, color: draft.color || defaultPartyColor(draft.name) };
    onCreateParty(next);
    onSelectParty("custom");
    setShowCreateForm(false);
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">Choose Your Party</h2>
      <p className="mb-6 text-gray-600">Select one of the parties available in this class.</p>

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading parties...</div>
      ) : parties.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No approved parties are available yet.</div>
      ) : (
        <div className="mb-6 space-y-3">
          {parties.map((party) => {
            const isSelected = selectedParty === party.id;
            return (
              <button
                key={party.id}
                type="button"
                onClick={() => handleSelectParty(party.id)}
                className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                  isSelected ? "border-gray-900" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                style={{
                  backgroundColor: isSelected ? `${party.color}22` : "#ffffff",
                  boxShadow: `inset 4px 0 0 ${party.color}`,
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: party.color }} />
                      <h3 className="text-lg font-semibold text-gray-900">{party.name}</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{party.platform || "No platform yet."}</p>
                  </div>
                  {isSelected && (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: party.color }}>
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {allowPartyCreation ? (
        <div className="border-t border-gray-200 pt-6">
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(true);
                onSelectParty(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Create Party</span>
            </button>
          ) : (
            <PartyCreateForm
              value={draft}
              onChange={setDraft}
              onCancel={() => setShowCreateForm(false)}
              onSubmit={handleCreateDraft}
              submitLabel="Create Party"
            />
          )}
        </div>
      ) : (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>Party creation is currently disabled. Select from the approved parties above.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function getPartyNameById(_partyId: string | null | undefined) {
  return null;
}

export function getPartyIdByName(_name: string | null | undefined) {
  return null;
}
