import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";

export function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return navigate("/signin");

      const role = (user.user_metadata as any)?.role;
      if (role === "teacher") return navigate("/teacher/dashboard");

      const { data: pRow } = await supabase.from("profiles").select("class_id").eq("user_id", user.id).maybeSingle();
      const classId = (pRow as any)?.class_id as string | null | undefined;
      if (classId) return navigate(`/class/${classId}/dashboard`);

      navigate("/settings/classes");
    };
    void go();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-600">Loadingâ€¦</div>
    </div>
  );
}

