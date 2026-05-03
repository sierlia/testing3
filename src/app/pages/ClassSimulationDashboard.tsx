import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { AnnouncementsFeed } from "../components/AnnouncementsFeed";
import { QuickLinks } from "../components/QuickLinks";
import { MyStatusCard } from "../components/MyStatusCard";
import { TeacherAdminShortcuts } from "../components/TeacherAdminShortcuts";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";
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
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

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

        if ((pRow as any)?.role !== "teacher") {
          const [mine, calendar] = await Promise.all([fetchMyBillsForCurrentClass(), fetchCalendaredBillsForCurrentClass()]);
          setMyBills(mine.slice(0, 12));
          setCalendarItems(calendar);
        }
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
      constituency: formatConstituency(profile?.constituency_name),
      committees: committeeNames,
      leadershipRoles,
    }),
    [profile?.party, profile?.constituency_name, committeeNames, leadershipRoles],
  );

  const statusLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const selectedDateKey = dateKey(selectedCalendarDate);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof calendarItems>();
    for (const item of calendarItems) {
      const key = dateKey(new Date(item.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [calendarItems]);
  const monthDays = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstGridDay = new Date(start);
    firstGridDay.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(firstGridDay);
      day.setDate(firstGridDay.getDate() + index);
      return day;
    });
  }, [calendarMonth]);
  const selectedEvents = eventsByDay.get(selectedDateKey) ?? [];

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
            <AnnouncementsFeed announcements={announcements} />

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

            {profile?.role !== "teacher" && (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Floor Calendar</h2>
                    <p className="text-sm text-gray-600">Calendared bills scheduled for floor debate</p>
                  </div>
                  <Link to="/calendar" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    Full calendar
                  </Link>
                </div>
                <div className="rounded-md border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 p-3">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="rounded p-1 text-gray-600 hover:bg-gray-100"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="font-semibold text-gray-900">
                      {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="rounded p-1 text-gray-600 hover:bg-gray-100"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="py-2">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((day) => {
                      const key = dateKey(day);
                      const hasEvents = Boolean(eventsByDay.get(key)?.length);
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                      const isSelected = key === selectedDateKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedCalendarDate(day)}
                          className={`min-h-14 border-b border-r border-gray-100 p-1.5 text-left text-xs transition-colors last:border-r-0 ${
                            isSelected ? "bg-blue-100 text-blue-900" : hasEvents ? "bg-blue-50 text-gray-900 hover:bg-blue-100" : "hover:bg-gray-50"
                          } ${isCurrentMonth ? "" : "text-gray-300"}`}
                        >
                          <span className="font-medium">{day.getDate()}</span>
                          {hasEvents && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">
                    {selectedCalendarDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  {selectedEvents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">Nothing calendared for this day.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.map((item) => (
                        <Link key={item.id} to={`/bills/${item.bill_id}`} className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                            <div className="truncate text-sm text-gray-700">{item.bill.title}</div>
                          </div>
                          <div className="flex-shrink-0 text-xs text-gray-500">
                            {new Date(item.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {profile?.role === "teacher" && <TeacherAdminShortcuts />}
            <QuickLinks classId={classId} />
            <MyStatusCard status={status} />
          </div>
        </div>
      </main>
    </div>
  );
}
