import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Calendar, ChevronLeft, ChevronRight, Clock, Save } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { fetchCalendaredBillsForCurrentClass, fetchReportedBillsForTeacherCalendar, getCurrentProfileClass, saveBillCalendarEntry } from "../services/bills";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";

type TeacherBill = {
  id: string;
  hr_label: string;
  title: string;
  status: string;
  committee_name?: string;
  calendar?: { scheduled_at: string; duration_minutes: number } | null;
};

type CalendarEntry = {
  id: string;
  bill_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status?: string;
  bill: { hr_label: string; title: string; author_user_id?: string };
};

type CalendarTask = {
  id: string;
  title: string;
  due_at: string;
  task_type: string;
};
type SpeakerSignup = { bill_id: string; user_id: string; side: "for" | "against"; status: "pending" | "approved" | "rejected"; speaker_role?: "speaker" | "opposition_leader"; name?: string | null };

function localDateTimeValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

async function fetchSpeakerSignups(classId: string): Promise<SpeakerSignup[]> {
  const { data: signupRows, error } = await supabase
    .from("bill_floor_speakers")
    .select("bill_id,user_id,side,status,speaker_role")
    .eq("class_id", classId);
  if (error) throw error;

  const userIds = Array.from(new Set(((signupRows ?? []) as any[]).map((row) => row.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id,display_name").in("user_id", userIds)
    : ({ data: [] } as any);
  const namesById = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile.display_name ?? "Member"]));

  return ((signupRows ?? []) as any[]).map((row) => ({
    bill_id: row.bill_id,
    user_id: row.user_id,
    side: row.side,
    status: row.status ?? "approved",
    speaker_role: row.speaker_role ?? "speaker",
    name: namesById.get(row.user_id) ?? "Member",
  }));
}

export function CalendarScheduling() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [teacherBills, setTeacherBills] = useState<TeacherBill[]>([]);
  const [studentItems, setStudentItems] = useState<Array<{ id: string; bill_id: string; scheduled_at: string; duration_minutes: number; bill: any }>>([]);
  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "all">("calendar");
  const [teacherListMode, setTeacherListMode] = useState<"uncalendared" | "calendared">("uncalendared");
  const [taskItems, setTaskItems] = useState<CalendarTask[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [meName, setMeName] = useState("Member");
  const [speakerSignups, setSpeakerSignups] = useState<SpeakerSignup[]>([]);
  const [classSettings, setClassSettings] = useState<any>({});

  const load = async () => {
    setLoading(true);
    try {
      const { profile, classId, userId } = await getCurrentProfileClass();
      setRole(profile.role ?? null);
      setClassId(classId);
      setMeId(userId);
      setMeName(profile.display_name ?? "Member");
      const [{ data: tasks }, { data: cls }] = await Promise.all([
        supabase.from("class_tasks").select("id,title,task_type,due_at").eq("class_id", classId).not("due_at", "is", null).order("due_at", { ascending: true }),
        supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
      ]);
      setClassSettings((cls as any)?.settings ?? {});
      setTaskItems(((tasks ?? []) as any[]).filter((task) => task.due_at));
      if (profile.role === "teacher") {
        const rows = await fetchReportedBillsForTeacherCalendar();
        setTeacherBills(rows as any);
        setDraftTimes(
          Object.fromEntries(
            (rows as TeacherBill[]).map((bill) => [bill.id, localDateTimeValue(bill.calendar?.scheduled_at)]),
          ),
        );
      } else {
        setStudentItems(await fetchCalendaredBillsForCurrentClass());
      }
      try {
        setSpeakerSignups(await fetchSpeakerSignups(classId));
      } catch {
        setSpeakerSignups([]);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not load floor calendar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (searchParams.get("schedule") !== "1") return;
    setViewMode("all");
    setTeacherListMode("uncalendared");
  }, [searchParams]);

  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam) return;
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setSelectedCalendarDate(parsed);
    setViewMode("calendar");
  }, [searchParams]);

  const publishedItems = useMemo<CalendarEntry[]>(() => {
    if (role === "teacher") {
      return teacherBills
        .filter((bill) => bill.calendar?.scheduled_at)
        .map((bill) => ({
          id: bill.id,
          bill_id: bill.id,
          scheduled_at: bill.calendar!.scheduled_at,
          duration_minutes: bill.calendar!.duration_minutes,
          status: bill.status,
          bill: { hr_label: bill.hr_label, title: bill.title },
        }));
    }
    return studentItems;
  }, [role, studentItems, teacherBills]);

  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const selectedDateKey = dateKey(selectedCalendarDate);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const item of publishedItems) {
      const key = dateKey(new Date(item.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [publishedItems]);
  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of taskItems) {
      const key = dateKey(new Date(task.due_at));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [taskItems]);
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
  const selectedTasks = tasksByDay.get(selectedDateKey) ?? [];

  const saveSchedule = async (billId: string) => {
    const value = draftTimes[billId];
    if (!value) return toast.error("Choose a date and time first");
    setSavingId(billId);
    try {
      await saveBillCalendarEntry(billId, new Date(value).toISOString());
      toast.success("Bill calendared");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not calendar bill");
    } finally {
      setSavingId(null);
    }
  };

  const signupForSpeech = async (billId: string, side: "for" | "against") => {
    if (!classId || !meId) return;
    const status = classSettings?.floor?.speakerSignupMode === "request" ? "pending" : "approved";
    const existing = speakerSignups.find((row) => row.bill_id === billId && row.user_id === meId);
    const next = existing?.side === side
      ? speakerSignups.filter((row) => !(row.bill_id === billId && row.user_id === meId))
      : [...speakerSignups.filter((row) => !(row.bill_id === billId && row.user_id === meId)), { bill_id: billId, user_id: meId, side, status, name: meName }];
    setSpeakerSignups(next);
    try {
      if (existing?.side === side) {
        await supabase.from("bill_floor_speakers").delete().eq("bill_id", billId).eq("user_id", meId);
      } else {
        await supabase.from("bill_floor_speakers").upsert({ class_id: classId, bill_id: billId, user_id: meId, side, status } as any, { onConflict: "bill_id,user_id" });
      }
    } catch {
      // Table may not exist until migrations are applied; keep the local UI responsive.
    }
  };

  const updateSpeakerRequest = async (billId: string, userId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase.from("bill_floor_speakers").update({ status } as any).eq("bill_id", billId).eq("user_id", userId);
      if (error) throw error;
      setSpeakerSignups((prev) => prev.map((row) => row.bill_id === billId && row.user_id === userId ? { ...row, status } : row));
    } catch (e: any) {
      toast.error(e.message || "Could not update request");
    }
  };

  const publishedCalendar = (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Calendar</h2>
        </div>
      </div>
      <div className="p-5">
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
            {monthDays.map((day, index) => {
              const key = dateKey(day);
              const events = eventsByDay.get(key) ?? [];
              const tasks = tasksByDay.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={`${key}-${index}`}
                  type="button"
                  onClick={() => setSelectedCalendarDate(day)}
                  className={`min-h-20 border-b border-r border-gray-100 p-1.5 text-left text-xs transition-colors ${
                    isSelected ? "bg-blue-100 text-blue-900" : events.length || tasks.length ? "bg-blue-50 text-gray-900 hover:bg-blue-100" : "hover:bg-gray-50"
                  } ${isCurrentMonth ? "" : "text-gray-300"}`}
                >
                  <span className="font-medium">{day.getDate()}</span>
                  <div className="mt-1 space-y-1">
                    {events.slice(0, 2).map((event) => (
                      <div key={event.id} className="truncate rounded bg-white/80 px-1 py-0.5 text-[10px] text-blue-800">
                        {new Date(event.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {event.bill.hr_label}
                      </div>
                    ))}
                    {tasks.slice(0, Math.max(0, 2 - events.length)).map((task) => (
                      <div key={task.id} className="truncate rounded bg-sky-100 px-1 py-0.5 text-[10px] text-sky-800">
                        {new Date(task.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {task.title}
                      </div>
                    ))}
                    {events.length + tasks.length > 2 && <div className="text-[10px] font-medium text-blue-700">+{events.length + tasks.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );

  const renderScheduledList = (items: CalendarEntry[], title: string, subtitle: string, emptyText: string, tasks: CalendarTask[] = []) => (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="max-h-[640px] divide-y divide-gray-100 overflow-y-auto">
        {items.length === 0 && tasks.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">{emptyText}</div>
        ) : (
          <>
            {items
              .slice()
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .map((item) => (
              <div key={item.id} className="block p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/bills/${item.bill_id}`} className="font-mono text-sm font-semibold text-gray-900 hover:text-blue-600">{item.bill.hr_label}</Link>
                    <Link to={`/bills/${item.bill_id}`} className="mt-1 line-clamp-2 text-sm text-gray-700 hover:text-blue-600">{item.bill.title}</Link>
                  </div>
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                </div>
                <div className="mt-2 text-xs font-medium text-gray-500">{new Date(item.scheduled_at).toLocaleString()}</div>
                {item.status && <div className="mt-1 text-xs capitalize text-gray-500">{item.status.replace("_", " ")}</div>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(["for", "against"] as const).map((side) => {
                    const rows = speakerSignups.filter((row) => row.bill_id === item.bill_id && row.side === side && row.status === "approved");
                    const pendingCount = speakerSignups.filter((row) => row.bill_id === item.bill_id && row.side === side && row.status === "pending").length;
                    const count = rows.length;
                    const selected = speakerSignups.some((row) => row.bill_id === item.bill_id && row.user_id === meId && row.side === side);
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void signupForSpeech(item.bill_id, side);
                        }}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
                      >
                        {classSettings?.floor?.speakerSignupMode === "request" ? "Request" : "Speak"} {side === "for" ? "for" : "against"} ({count}{pendingCount ? `, ${pendingCount} pending` : ""})
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 text-xs text-gray-600 sm:grid-cols-2">
                  {(["for", "against"] as const).map((side) => (
                    <div key={side} className="rounded-md bg-gray-50 p-2">
                      <div className="mb-1 font-semibold text-gray-900">{side === "for" ? "In favor" : "In opposition"}</div>
                      {speakerSignups.filter((row) => row.bill_id === item.bill_id && row.side === side && row.status === "approved").length ? (
                        speakerSignups.filter((row) => row.bill_id === item.bill_id && row.side === side && row.status === "approved").map((row) => (
                          <div key={row.user_id}>{row.speaker_role === "opposition_leader" ? "Opposition leader: " : ""}{row.name ?? "Member"}</div>
                        ))
                      ) : <div className="text-gray-400">No approved speakers</div>}
                    </div>
                  ))}
                </div>
                {(role === "teacher" || item.bill.author_user_id === meId) && speakerSignups.some((row) => row.bill_id === item.bill_id && row.status === "pending") && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                    <div className="mb-1 font-semibold text-amber-900">Speaker requests</div>
                    {speakerSignups.filter((row) => row.bill_id === item.bill_id && row.status === "pending").map((row) => (
                      <div key={row.user_id} className="flex items-center justify-between gap-2 py-1">
                        <span>{row.name ?? "Member"} - {row.side === "for" ? "in favor" : "in opposition"}</span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => void updateSpeakerRequest(item.bill_id, row.user_id, "approved")} className="rounded bg-white px-2 py-1 font-medium text-green-700">Approve</button>
                          <button type="button" onClick={() => void updateSpeakerRequest(item.bill_id, row.user_id, "rejected")} className="rounded bg-white px-2 py-1 font-medium text-red-700">Reject</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ))}
            {tasks.map((task) => (
              <div key={task.id} className="block bg-sky-50 p-4">
                {task.task_type === "assignment" ? (
                  <Link to={`/assignments/${task.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600">
                    {task.title}
                  </Link>
                ) : (
                  <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                )}
                <div className="mt-1 text-xs font-medium text-sky-700">{new Date(task.due_at).toLocaleString()}</div>
                <div className="mt-1 text-xs capitalize text-gray-500">{task.task_type}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const renderTeacherSchedulingList = (items: TeacherBill[], emptyText: string) => (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{teacherListMode === "uncalendared" ? "Uncalendared Bills" : "Calendared Bills"}</h2>
            <p className="mt-1 text-sm text-gray-500">Set or update floor date and time.</p>
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
            {(["uncalendared", "calendared"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTeacherListMode(mode)}
                className={`rounded px-3 py-1.5 text-sm font-semibold capitalize transition ${teacherListMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">{emptyText}</div>
        ) : (
          items.map((bill) => (
            <div key={bill.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/bills/${bill.id}`} className="block truncate text-sm font-semibold text-gray-900 hover:text-blue-600">
                    <span className="font-mono">{bill.hr_label}</span>
                    <span className="text-gray-500"> - </span>
                    {bill.title}
                  </Link>
                  <div className="mt-1 text-xs text-gray-500">{bill.committee_name || "No committee listed"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <input
                      type="datetime-local"
                      value={draftTimes[bill.id] ?? ""}
                      onChange={(event) => setDraftTimes((prev) => ({ ...prev, [bill.id]: event.target.value }))}
                      className="bg-transparent text-sm outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveSchedule(bill.id)}
                    disabled={savingId === bill.id}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === bill.id ? "Saving" : bill.calendar ? "Update" : "Calendar"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const selectedDayList = renderScheduledList(
    selectedEvents,
    "Scheduled on",
    selectedCalendarDate.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    "No bills are scheduled for this day.",
    selectedTasks,
  );

  const allScheduledList = renderScheduledList(
    publishedItems,
    "All Calendared Bills",
    `${publishedItems.length} ${publishedItems.length === 1 ? "bill" : "bills"} calendared`,
    "No bills have been calendared.",
  );

  const teacherUncalendaredBills = teacherBills.filter((bill) => !bill.calendar?.scheduled_at);
  const teacherCalendaredBills = teacherBills.filter((bill) => bill.calendar?.scheduled_at);
  const teacherAllList = renderTeacherSchedulingList(
    teacherListMode === "uncalendared" ? teacherUncalendaredBills : teacherCalendaredBills,
    teacherListMode === "uncalendared" ? "No reported bills are waiting to be calendared." : "No bills have been calendared.",
  );

  const calendarLayout = (
    viewMode === "calendar" ? (
      <div className="grid gap-6 lg:grid-cols-[3fr_1fr]">
        {publishedCalendar}
        {selectedDayList}
      </div>
    ) : role === "teacher" ? teacherAllList : allScheduledList
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Calendar</h1>
            <p className="text-gray-600">{role === "teacher" ? "Calendar reported bills for floor debate" : "View bills scheduled for floor debate"}</p>
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
            {(["calendar", "all"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-4 py-2 text-sm font-semibold capitalize transition ${viewMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading calendar...</div>
        ) : role === "teacher" ? (
          <div className="space-y-6">
            {calendarLayout}
          </div>
        ) : (
          calendarLayout
        )}
      </main>
    </div>
  );
}
