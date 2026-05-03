import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import { SettingsLayout } from "./SettingsLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { X } from "lucide-react";

export function SettingsClasses() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; class_code: string; status: string }>>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const [{ data: memberships, error: mErr }, { data: profile }] = await Promise.all([
        supabase
        .from("class_memberships")
        .select("class_id,status")
        .eq("user_id", uid),
        supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle(),
      ]);
      if (mErr) throw mErr;
      const byClass = new Map((memberships ?? []).map((m: any) => [m.class_id, m.status ?? "approved"]));
      const profileClassId = (profile as any)?.class_id as string | undefined;
      setActiveClassId(profileClassId ?? null);
      if (profileClassId && !byClass.has(profileClassId)) byClass.set(profileClassId, "approved");
      const classIds = Array.from(byClass.keys());
      if (classIds.length === 0) {
        setClasses([]);
        return;
      }
      const { data: cls, error: cErr } = await supabase.from("classes").select("id,name,class_code").in("id", classIds);
      if (cErr) throw cErr;
      setClasses(((cls ?? []) as any[]).map((c) => ({ ...c, status: byClass.get(c.id) ?? "approved" })));
    } catch (e: any) {
      toast.error(e.message || "Could not load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [navigate]);

  const openClassDashboard = async (id: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return navigate("/signin");
    const desiredRole = (auth.user?.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: uid, class_id: id, role: desiredRole, display_name: auth.user?.user_metadata?.name ?? null } as any);
    if (error) toast.error(error.message);
    navigate(`/class/${id}/dashboard`);
  };

  const joinClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { error } = await supabase.rpc("join_class_by_code", { join_code_input: joinCode.trim().toUpperCase() });
      if (error) throw error;
      toast.success("Class joined");
      setJoinCode("");
      setShowJoinModal(false);
      await load();
    } catch (e: any) {
      toast.error(e.message === "INVALID_CLASS_CODE" ? "Invalid class code" : e.message || "Could not join class");
    } finally {
      setJoining(false);
    }
  };

  const updateInvitation = async (classId: string, accepted: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = accepted
      ? await supabase
          .from("class_memberships")
          .update({ status: "approved", approved_at: new Date().toISOString() } as any)
          .eq("class_id", classId)
          .eq("user_id", uid)
      : await supabase.from("class_memberships").delete().eq("class_id", classId).eq("user_id", uid);
    if (error) return toast.error(error.message || "Could not update invitation");
    toast.success(accepted ? "Invitation accepted" : "Invitation declined");
    await load();
  };

  return (
    <SettingsLayout>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Classes</h2>
        <Button onClick={() => setShowJoinModal(true)}>Join Class</Button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">Loadingâ€¦</div>
      ) : classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Join a Class to Continue</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowJoinModal(true)}>Join Class</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Join code: <span className="font-mono font-semibold">{c.class_code}</span>
                </p>
                {c.status === "invited" ? (
                  <div className="flex gap-2">
                    <Button onClick={() => void updateInvitation(c.id, true)}>Accept</Button>
                    <Button variant="outline" onClick={() => void updateInvitation(c.id, false)}>Decline</Button>
                  </div>
                ) : activeClassId === c.id ? (
                  <div className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Active</div>
                ) : (
                  <Button variant="outline" onClick={() => void openClassDashboard(c.id)}>Make active</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="relative w-full max-w-md">
            <button type="button" onClick={() => setShowJoinModal(false)} className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <CardHeader>
              <CardTitle>Join a Class</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={joinClass} className="space-y-4">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-lg uppercase outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC123"
                  required
                />
                <Button className="w-full" disabled={joining}>{joining ? "Joining..." : "Join Class"}</Button>
                <button type="button" onClick={() => navigate("/join-class")} className="w-full text-sm font-medium text-blue-600 hover:text-blue-700">
                  Open join page
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsLayout>
  );
}
