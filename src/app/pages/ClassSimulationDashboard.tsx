import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { AnnouncementsFeed } from "../components/AnnouncementsFeed";
import { QuickLinks } from "../components/QuickLinks";
import { TeacherAdminShortcuts } from "../components/TeacherAdminShortcuts";
import { supabase } from "../utils/supabase";
import { fetchCalendaredBillsForCurrentClass, fetchMyBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";

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
  const [className, setClassName] = useState("");
  const [announcements, setAnnouncements] = useState<Array<{ id: string; author: string; role: string; content: string; timestamp: Date; isPinned: boolean; href?: string; isNew?: boolean }>>([]);
  const [myBills, setMyBills] = useState<BillRecord[]>([]);
  const [calendarItems, setCalendarItems] = useState<Array<{ id: string; bill_id: string; scheduled_at: string; duration_minutes: number; bill: BillRecord }>>([]);

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
        const desiredRole = (auth.user?.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
        const { data: membership } = await supabase
          .from("class_memberships")
          .select("status")
          .eq("class_id", classId)
          .eq("user_id", uid)
          .maybeSingle();
        if ((membership as any)?.status === "pending") {
          await supabase
            .from("class_memberships")
            .update({ status: "approved", approved_at: new Date().toISOString() })
            .eq("class_id", classId)
            .eq("user_id", uid);
        }

        const { error: upErr } = await supabase
          .from("profiles")
          .upsert({ user_id: uid, class_id: classId, role: desiredRole, display_name: auth.user?.user_metadata?.name ?? null } as any);
        if (upErr) throw upErr;

        const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
        setClassName((cls as any)?.name ?? "Class Dashboard");

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

        const seenKey = `class:${classId}:announcements-seen-at`;
        const seenAt = Number(window.localStorage.getItem(seenKey) || "0");
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
            href:
              a._type === "committee"
                ? `/committees/${a.committee_id}?announcement=${a.id}`
                : a._type === "caucus"
                  ? `/caucuses/${a.caucus_id}?announcement=${a.id}`
                  : undefined,
            isNew: new Date(a.created_at).getTime() > seenAt,
          })),
        );
        window.localStorage.setItem(seenKey, String(Date.now()));

        const calendar = await fetchCalendaredBillsForCurrentClass();
        setCalendarItems(calendar);
        if ((pRow as any)?.role !== "teacher") {
          const mine = await fetchMyBillsForCurrentClass();
          setMyBills(mine.slice(0, 12));
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [classId, navigate]);

  const statusLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof calendarItems>();
    for (const item of calendarItems) {
      const key = dateKey(new Date(item.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [calendarItems]);
  const dashboardAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 3),
    [announcements],
  );
  const miniCalendarDays = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, index) => {
      const day = new Date(start);
      day.setDate(index + 1);
      return day;
    });
  }, []);

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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{className || "Class Dashboard"}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AnnouncementsFeed announcements={dashboardAnnouncements} />

            {profile?.role !== "teacher" && (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">My Bills</h2>
                    <p className="text-sm text-gray-600">Drafts and submitted legislation</p>
                  </div>
                  <Link to="/bills/my" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    All
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {myBills.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">No bills yet.</div>
                ) : (
                  <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                    {myBills.map((bill) => (
                      <Link
                        key={bill.id}
                        to={bill.status === "draft" ? `/bills/create?draft=${bill.id}` : `/bills/${bill.id}`}
                        className="min-w-[240px] snap-start rounded-md border border-gray-200 bg-gray-50 p-4 hover:border-blue-200 hover:bg-blue-50"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-900">{bill.hr_label}</span>
                          <span className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700">{statusLabel(bill.status)}</span>
                        </div>
                        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{bill.title}</h3>
                        <p className="mt-3 text-xs text-gray-500">{bill.status === "draft" ? "Continue editing" : "View bill"}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>

          <div className="lg:col-span-1 space-y-6">
            {profile?.role === "teacher" && <TeacherAdminShortcuts />}
            <QuickLinks classId={classId} />
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
                <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                  Full calendar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {miniCalendarDays.map((day) => {
                  const key = dateKey(day);
                  const events = eventsByDay.get(key) ?? [];
                  const isToday = key === dateKey(new Date());
                  return (
                    <div key={key} className="group relative flex justify-center">
                      <button
                        type="button"
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                          events.length ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100" : isToday ? "bg-gray-100 text-gray-900 ring-1 ring-gray-300" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-left text-xs text-gray-700 shadow-lg group-hover:block">
                        <div className="mb-1 font-semibold text-gray-900">{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                        {events.length ? (
                          events.map((event) => (
                            <div key={event.id} className="py-0.5">
                              <span className="font-mono">{event.bill.hr_label}</span> at {new Date(event.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500">Nothing scheduled</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
