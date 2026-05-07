import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { ClassDashboard } from "./ClassDashboard";
import { ClassSimulationDashboard } from "./ClassSimulationDashboard";

export function Dashboard() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<{ role: "teacher" | "student"; classId: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const go = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        navigate("/signin");
        return;
      }

      const role = (user.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
      const { data: pRow } = await supabase.from("profiles").select("class_id").eq("user_id", user.id).maybeSingle();
      let classId = (pRow as any)?.class_id as string | null | undefined;

      if (!classId) {
        const { data: memberships } = await supabase
          .from("class_memberships")
          .select("class_id,status")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .limit(1);
        classId = (memberships ?? [])[0]?.class_id;
      }

      if (!classId) {
        navigate(role === "teacher" ? "/classes" : "/settings/classes");
        return;
      }

      setTarget({ role, classId });
      setLoading(false);
    };
    void go();
  }, [navigate]);

  if (target?.role === "teacher") return <ClassDashboard classIdOverride={target.classId} />;
  if (target?.role === "student") return <ClassSimulationDashboard classIdOverride={target.classId} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-600">
        {loading ? "Loading..." : "Loading dashboard..."}
      </div>
    </div>
  );
}
