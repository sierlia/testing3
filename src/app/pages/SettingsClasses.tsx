import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import { SettingsLayout } from "./SettingsLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function SettingsClasses() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; class_code: string; status: string }>>([]);

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
    const current = classes.find((c) => c.id === id);
    if (current?.status === "pending") {
      toast.info("Your teacher has not approved this class yet.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: uid, class_id: id, role: desiredRole, display_name: auth.user?.user_metadata?.name ?? null } as any);
    if (error) toast.error(error.message);
    navigate(`/class/${id}/dashboard`);
  };

  return (
    <SettingsLayout>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Classes</h2>
        <Button onClick={() => navigate("/join-class")}>Join Class</Button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">Loadingâ€¦</div>
      ) : classes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Join a Class to Continue</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/join-class")}>Join Class</Button>
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
                {c.status === "pending" && <p className="text-sm text-amber-700 mb-3">Pending teacher approval</p>}
                <Button onClick={() => void openClassDashboard(c.id)} disabled={c.status === "pending"}>Open</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SettingsLayout>
  );
}
