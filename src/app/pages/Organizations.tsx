import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { Plus, Users, Flag, Building2 } from "lucide-react";
import { Link } from "react-router";

type PartyRow = { id: string; name: string; platform: string; approved: boolean; created_at: string };
type CommitteeRow = { id: string; name: string; description: string | null; created_at: string };
type CaucusRow = { id: string; title: string; description: string | null; created_at: string };

export function Organizations() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});

  const [parties, setParties] = useState<PartyRow[]>([]);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [caucuses, setCaucuses] = useState<CaucusRow[]>([]);

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

        const { data: profile } = await supabase.from("profiles").select("class_id, role").eq("user_id", me).maybeSingle();
        const classId = (profile as any)?.class_id;
        if (!classId) {
          setParties([]);
          setCommittees([]);
          setCaucuses([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        setSettings((cls as any)?.settings ?? {});

        const { data: partyRows, error: pErr } = await supabase
          .from("parties")
          .select("id,name,platform,approved,created_at")
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;
        setParties(partyRows as any);

        const { data: committeeRows, error: cErr } = await supabase
          .from("committees")
          .select("id,name,description,created_at")
          .order("created_at", { ascending: true });
        if (cErr) throw cErr;
        setCommittees(committeeRows as any);

        const { data: caucusRows, error: caErr } = await supabase
          .from("caucuses")
          .select("id,title,description,created_at")
          .order("created_at", { ascending: false });
        if (caErr) throw caErr;
        setCaucuses(caucusRows as any);
      } catch (e: any) {
        toast.error(e.message || "Could not load organizations");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const allowStudentCreated = !!settings?.parties?.allowStudentCreated;
  const requireApproval = !!settings?.parties?.requireApproval;

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
          approved: requireApproval ? false : true,
        })
        .select("id,name,platform,approved,created_at")
        .single();
      if (error) throw error;
      setParties([data as any, ...parties]);
      setPartyName("");
      setPartyPlatform("");
      setNewPartyOpen(false);
      toast.success(requireApproval ? "Party submitted for approval" : "Party created");
    } catch (e: any) {
      toast.error(e.message || "Could not create party");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
          <p className="text-gray-600">Parties, committees, and caucuses for your class</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Parties</h2>
            </div>
            {allowStudentCreated && (
              <button
                onClick={() => setNewPartyOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Propose Party
              </button>
            )}
          </div>

          {newPartyOpen && (
            <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                <input
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <textarea
                  value={partyPlatform}
                  onChange={(e) => setPartyPlatform(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setNewPartyOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900">
                  Cancel
                </button>
                <button
                  disabled={creating || !partyName.trim() || !partyPlatform.trim()}
                  onClick={() => void createParty()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "Submitting..." : requireApproval ? "Submit" : "Create"}
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
            <div className="mt-4 text-sm text-gray-600">
              Pending approval: {pendingParties.length}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Committees</h2>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading committees…</div>
          ) : committees.length === 0 ? (
            <div className="text-sm text-gray-500">No committees configured yet.</div>
          ) : (
            <div className="space-y-2">
              {committees.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-4">
                  <div>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.description ? <div className="text-sm text-gray-600 mt-1">{c.description}</div> : null}
                  </div>
                  <Link to={`/committee/${c.id}/workspace`} className="text-sm text-blue-600 hover:underline">
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Caucuses</h2>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading caucuses…</div>
          ) : caucuses.length === 0 ? (
            <div className="text-sm text-gray-500">No caucuses yet.</div>
          ) : (
            <div className="space-y-2">
              {caucuses.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-4">
                  <div>
                    <div className="font-medium text-gray-900">{c.title}</div>
                    {c.description ? <div className="text-sm text-gray-600 mt-1">{c.description}</div> : null}
                  </div>
                  <Link to={`/tess-caucuses/${c.id}`} className="text-sm text-blue-600 hover:underline">
                    Open
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

