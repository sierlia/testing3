import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Mail, PenSquare } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { AnnouncementsFeed } from "../components/AnnouncementsFeed";
import { QuickLinks } from "../components/QuickLinks";
import { MyStatusCard } from "../components/MyStatusCard";
import { TeacherAdminShortcuts } from "../components/TeacherAdminShortcuts";
import { supabase } from "../utils/supabase";

type Profile = {
  user_id: string;
  role: "teacher" | "student";
  display_name: string | null;
  party: string | null;
  constituency_name: string | null;
};

export function ClassSimulationDashboard() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [committeeNames, setCommitteeNames] = useState<string[]>([]);
  const [leadershipRoles, setLeadershipRoles] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; author: string; role: string; content: string; timestamp: Date; isPinned: boolean }>>([]);

  useEffect(() => {
    const load = async () => {
      if (!classId) return;
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!uid) return navigate("/signin");
        setMeId(uid);

        // Set active class for RLS scoping
        const { error: upErr } = await supabase.from("profiles").upsert({ user_id: uid, class_id: classId } as any);
        if (upErr) throw upErr;

        const { data: pRow, error: pErr } = await supabase
          .from("profiles")
          .select("user_id,role,display_name,party,constituency_name")
          .eq("user_id", uid)
          .maybeSingle();
        if (pErr) throw pErr;
        setProfile((pRow as any) ?? null);

        const [{ data: cm }, { data: committees }, { data: caucusMemberships }] = await Promise.all([
          supabase.from("committee_members").select("committee_id,role").eq("user_id", uid),
          supabase.from("committees").select("id,name"),
          supabase.from("caucus_members").select("caucus_id,role").eq("user_id", uid),
        ]);

        const committeeMap = new Map((committees ?? []).map((c: any) => [c.id, c.name]));
        const myCommitteeNames = (cm ?? []).map((r: any) => committeeMap.get(r.committee_id)).filter(Boolean) as string[];
        setCommitteeNames(myCommitteeNames);

        const roles: string[] = [];
        for (const r of cm ?? []) {
          if (r.role && r.role !== "member") roles.push(`Committee ${String(r.role).replace("_", " ")}`);
        }
        for (const r of caucusMemberships ?? []) {
          if (r.role && r.role !== "member") roles.push(`Caucus ${String(r.role).replace("_", " ")}`);
        }
        setLeadershipRoles(roles);

        // Announcements feed (committee + caucus announcements)
        let committeeIds: string[] = [];
        let caucusIds: string[] = [];

        if ((pRow as any)?.role === "teacher") {
          const { data: allCommittees } = await supabase.from("committees").select("id");
          const { data: allCaucuses } = await supabase.from("caucuses").select("id");
          committeeIds = (allCommittees ?? []).map((c: any) => c.id);
          caucusIds = (allCaucuses ?? []).map((c: any) => c.id);
        } else {
          committeeIds = (cm ?? []).map((r: any) => r.committee_id);
          caucusIds = (caucusMemberships ?? []).map((r: any) => r.caucus_id);
        }

        const [cAnn, mAnn, taskRows] = await Promise.all([
          caucusIds.length
            ? supabase
                .from("caucus_announcements")
                .select("id,author_user_id,body,created_at,caucus_id")
                .in("caucus_id", caucusIds)
                .order("created_at", { ascending: false })
                .limit(10)
            : Promise.resolve({ data: [] as any[] } as any),
          committeeIds.length
            ? supabase
                .from("committee_announcements")
                .select("id,author_user_id,body,created_at,committee_id")
                .in("committee_id", committeeIds)
                .order("created_at", { ascending: false })
                .limit(10)
            : Promise.resolve({ data: [] as any[] } as any),
          supabase
            .from("class_tasks")
            .select("id,task_type,title,description,due_at,created_at,created_by")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const combined = [
          ...((cAnn as any).data ?? []).map((a: any) => ({ ...a, _type: "caucus" as const })),
          ...((mAnn as any).data ?? []).map((a: any) => ({ ...a, _type: "committee" as const })),
          ...(((taskRows as any).data ?? []) as any[]).map((t: any) => ({ ...t, _type: "task" as const })),
        ]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);

        const authorIds = Array.from(
          new Set(
            combined
              .map((a: any) => (a._type === "task" ? a.created_by : a.author_user_id))
              .filter(Boolean),
          ),
        );
        const { data: authors } = await supabase
          .from("profiles")
          .select("user_id,display_name,role")
          .in("user_id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
        const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, a]));

        setAnnouncements(
          combined.map((a: any) => ({
            id: a.id,
            author:
              authorMap.get(a._type === "task" ? a.created_by : a.author_user_id)?.display_name ?? "Unknown",
            role: a._type === "task" ? "Teacher" : a._type === "committee" ? "Committee" : "Caucus",
            content:
              a._type === "task"
                ? `${a.task_type === "deadline" ? "Deadline" : "Assignment"}: ${a.title}${
                    a.due_at ? ` (Due ${new Date(a.due_at).toLocaleString()})` : ""
                  }\n\n${a.description || ""}`.trim()
                : a.body,
            timestamp: new Date(a.created_at),
            isPinned: a._type === "task",
          })),
        );
      } catch (e: any) {
        toast.error(e.message || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [classId, navigate]);

  const status = useMemo(
    () => ({
      party: profile?.party ?? "N/A",
      constituency: profile?.constituency_name ?? "N/A",
      committees: committeeNames,
      leadershipRoles,
    }),
    [profile?.party, profile?.constituency_name, committeeNames, leadershipRoles],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => navigate("/dear-colleague/inbox")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            <Mail className="w-4 h-4" />
            Dear Colleague Letters
          </button>
          <button
            onClick={() => navigate("/dear-colleague/compose")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <PenSquare className="w-4 h-4" />
            Compose Letter
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AnnouncementsFeed announcements={announcements} />
          </div>

          <div className="lg:col-span-1 space-y-6">
            {profile?.role === "teacher" && <TeacherAdminShortcuts />}
            <QuickLinks />
            <MyStatusCard status={status} />
          </div>
        </div>
      </main>
    </div>
  );
}
