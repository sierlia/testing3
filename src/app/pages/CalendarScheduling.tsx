import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, Clock, Save } from "lucide-react";
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

function localDateTimeValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CalendarScheduling() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [teacherBills, setTeacherBills] = useState<TeacherBill[]>([]);
  const [studentItems, setStudentItems] = useState<Array<{ id: string; bill_id: string; scheduled_at: string; duration_minutes: number; bill: any }>>([]);
  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const groupedStudentItems = useMemo(() => {
    const rows = [...studentItems].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return rows.reduce<Record<string, typeof studentItems>>((acc, item) => {
      const key = new Date(item.scheduled_at).toLocaleDateString();
      acc[key] = [...(acc[key] ?? []), item];
      return acc;
    }, {});
  }, [studentItems]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Floor Calendar</h1>
          <p className="text-gray-600">{role === "teacher" ? "Calendar reported bills for floor debate" : "View bills scheduled for floor debate"}</p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading calendar...</div>
        ) : role === "teacher" ? (
          <div className="space-y-4">
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
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-5">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Published Calendar</h2>
              </div>
            </div>
            {studentItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No bills are calendared yet.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {Object.entries(groupedStudentItems).map(([day, items]) => (
                  <div key={day} className="p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{day}</h3>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <Link key={item.id} to={`/bills/${item.bill_id}`} className="flex items-center gap-4 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                            <div className="truncate text-sm text-gray-700">{item.bill.title}</div>
                          </div>
                          <div className="text-sm font-medium text-gray-700">
                            {new Date(item.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
