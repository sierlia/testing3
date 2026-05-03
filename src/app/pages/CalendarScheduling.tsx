import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Calendar, ChevronLeft, ChevronRight, Clock, Save } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { fetchCalendaredBillsForCurrentClass, fetchReportedBillsForTeacherCalendar, getCurrentProfileClass, saveBillCalendarEntry } from "../services/bills";
import { toast } from "sonner";

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
  bill: { hr_label: string; title: string };
};

function localDateTimeValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
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
  const scheduleSectionRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { profile } = await getCurrentProfileClass();
      setRole(profile.role ?? null);
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
    if (loading || searchParams.get("schedule") !== "1") return;
    const frame = window.requestAnimationFrame(() => scheduleSectionRef.current?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [loading, searchParams]);

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

  const publishedCalendar = (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Published Calendar</h2>
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
              const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={`${key}-${index}`}
                  type="button"
                  onClick={() => setSelectedCalendarDate(day)}
                  className={`min-h-20 border-b border-r border-gray-100 p-1.5 text-left text-xs transition-colors ${
                    isSelected ? "bg-blue-100 text-blue-900" : events.length ? "bg-blue-50 text-gray-900 hover:bg-blue-100" : "hover:bg-gray-50"
                  } ${isCurrentMonth ? "" : "text-gray-300"}`}
                >
                  <span className="font-medium">{day.getDate()}</span>
                  <div className="mt-1 space-y-1">
                    {events.slice(0, 2).map((event) => (
                      <div key={event.id} className="truncate rounded bg-white/80 px-1 py-0.5 text-[10px] text-blue-800">
                        {new Date(event.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {event.bill.hr_label}
                      </div>
                    ))}
                    {events.length > 2 && <div className="text-[10px] font-medium text-blue-700">+{events.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );

  const renderScheduledList = (items: CalendarEntry[], title: string, subtitle: string, emptyText: string) => (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="max-h-[640px] divide-y divide-gray-100 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">{emptyText}</div>
        ) : (
          items
            .slice()
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            .map((item) => (
              <Link key={item.id} to={`/bills/${item.bill_id}`} className="block p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-gray-700">{item.bill.title}</div>
                  </div>
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                </div>
                <div className="mt-2 text-xs font-medium text-gray-500">{new Date(item.scheduled_at).toLocaleString()}</div>
                {item.status && <div className="mt-1 text-xs capitalize text-gray-500">{item.status.replace("_", " ")}</div>}
              </Link>
            ))
        )}
      </div>
    </div>
  );

  const selectedDayList = renderScheduledList(
    selectedEvents,
    "Scheduled Bills",
    selectedCalendarDate.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    "No bills are scheduled for this day.",
  );

  const allScheduledList = renderScheduledList(
    publishedItems,
    "All Calendared Bills",
    `${publishedItems.length} ${publishedItems.length === 1 ? "bill" : "bills"} calendared`,
    "No bills have been calendared.",
  );

  const calendarLayout = (
    viewMode === "calendar" ? (
      <div className="grid gap-6 lg:grid-cols-[3fr_1fr]">
        {publishedCalendar}
        {selectedDayList}
      </div>
    ) : allScheduledList
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Floor Calendar</h1>
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
            <div ref={scheduleSectionRef} className="scroll-mt-8 space-y-3">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">Calendar Bills</h2>
                <p className="mt-1 text-sm text-gray-600">Set or update the floor date and time for reported bills.</p>
              </div>
              {teacherBills.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No reported bills are ready to calendar.</div>
              ) : (
                teacherBills.map((bill) => (
                  <div key={bill.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{bill.status.replace("_", " ")}</span>
                        </div>
                        <Link to={`/bills/${bill.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{bill.title}</Link>
                        <div className="mt-1 text-sm text-gray-600">{bill.committee_name || "No committee listed"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={draftTimes[bill.id] ?? ""}
                          onChange={(event) => setDraftTimes((prev) => ({ ...prev, [bill.id]: event.target.value }))}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
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
        ) : (
          calendarLayout
        )}
      </main>
    </div>
  );
}
