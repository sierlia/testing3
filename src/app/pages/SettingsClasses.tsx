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
  const [classes, setClasses] = useState<Array<{ id: string; name: string; class_code: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const { data: memberships, error: mErr } = await supabase
        .from("class_memberships")
        .select("class_id")
        .eq("user_id", uid);
      if (mErr) throw mErr;
      const classIds = (memberships ?? []).map((m: any) => m.class_id);
      if (classIds.length === 0) {
        setClasses([]);
        return;
      }
      const { data: cls, error: cErr } = await supabase.from("classes").select("id,name,class_code").in("id", classIds);
      if (cErr) throw cErr;
      setClasses((cls ?? []) as any);
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
    const { error } = await supabase.from("profiles").upsert({ user_id: uid, class_id: id } as any);
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
                <Button onClick={() => void openClassDashboard(c.id)}>Go to Dashboard</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SettingsLayout>
  );
}

