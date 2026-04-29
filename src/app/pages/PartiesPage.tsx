import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { Plus, Flag } from "lucide-react";
import { OrganizationsLayout } from "./OrganizationsLayout";

type PartyRow = { id: string; name: string; platform: string; approved: boolean; created_at: string };

export function PartiesPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);

  const [parties, setParties] = useState<PartyRow[]>([]);
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
              <div className="grid md:grid-cols-2 gap-3">
                {approvedParties.map((p) => (
                  <div key={p.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-700 mt-1">{p.platform}</div>
                  </div>
                ))}
              </div>
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
