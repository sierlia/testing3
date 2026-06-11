import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { readActiveClassPreference, saveActiveClassPreference } from "../utils/activeClass";
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
      const [{ data: pRow }, { data: memberships }] = await Promise.all([
        supabase.from("profiles").select("class_id").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("class_memberships")
          .select("class_id,status,classes(id,name,created_at)")
          .eq("user_id", user.id)
          .eq("status", "approved"),
      ]);
      const profileClassId = (pRow as any)?.class_id as string | null | undefined;
      let classId = profileClassId;

      if (role === "student") {
        const approvedClasses = ((memberships ?? []) as any[])
          .map((membership) => ({
            id: membership.class_id as string,
            name: membership.classes?.name as string | undefined,
            created_at: membership.classes?.created_at as string | undefined,
          }))
          .filter((classItem) => classItem.id)
          .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        const cookieClassId = readActiveClassPreference(user.id);
        const preferredClass =
          approvedClasses.find((classItem) => classItem.id === cookieClassId) ??
          approvedClasses.find((classItem) => classItem.id === profileClassId) ??
          approvedClasses[0] ??
          null;
        classId = preferredClass?.id ?? null;
        if (preferredClass) {
          saveActiveClassPreference(user.id, preferredClass.id, preferredClass.name);
          if (profileClassId !== preferredClass.id) {
            await supabase.from("profiles").upsert({ user_id: user.id, class_id: preferredClass.id, role: "student" } as any);
          }
        }
      } else if (!classId) {
        classId = (memberships ?? [])[0]?.class_id;
      }

      if (!classId) {
        navigate(role === "teacher" ? "/classes" : "/my-classes");
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
