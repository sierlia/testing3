import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Settings,
  TrendingUp,
  Unlock,
  Users,
  Vote,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { Navigation } from "../components/Navigation";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { fetchClassActivity, ClassActivity } from "../services/classActivity";
import { supabase } from "../utils/supabase";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "deadline" | "session" | "election";
}

const workflowSteps = [
  { id: "setup", label: "Set up class", description: "Choose default parties and committees before students begin." },
  { id: "elections", label: "Hold elections", description: "Open and close Speaker and organization leadership elections." },
  { id: "assign_committees", label: "Assign committees", description: "Place students onto committees from their preferences." },
  { id: "legislation", label: "Refer and calendar bills", description: "Route bills through committee referral and floor scheduling." },
];

export function ClassDashboard() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [className, setClassName] = useState("");
  const [classNameDraft, setClassNameDraft] = useState("");
  const [editingClassName, setEditingClassName] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [classSettings, setClassSettings] = useState<any>({});
  const [studentCount, setStudentCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ClassActivity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [selectedUpcomingDay, setSelectedUpcomingDay] = useState<string | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [billStats, setBillStats] = useState({ total: 0, waitingReferral: 0, waitingCalendar: 0 });
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const currentTimelineCardRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const setActive = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) return;
      await supabase.from("profiles").upsert({
        user_id: user.id,
        class_id: classId,
        role: "teacher",
        display_name: user.user_metadata?.name ?? null,
      });
    };
    void setActive();
  }, [classId]);

  const loadDashboard = async () => {
    if (!classId) return;
    try {
      const [{ data: cls, error: cErr }, { count: rosterCount }, { data: billRows }] = await Promise.all([
        supabase.from("classes").select("name,class_code,settings").eq("id", classId).maybeSingle(),
        supabase.from("class_memberships").select("user_id", { count: "exact", head: true }).eq("class_id", classId).eq("status", "approved"),
        supabase.from("bills").select("id,status").eq("class_id", classId),
      ]);
      if (cErr) throw cErr;
      const settings = (cls as any)?.settings ?? {};
      setClassName((cls as any)?.name ?? "Class");
      setClassNameDraft((cls as any)?.name ?? "Class");
      setClassCode((cls as any)?.class_code ?? "");
      setClassSettings(settings);
      setStudentCount(rosterCount ?? 0);
      const statsRows = (billRows ?? []) as any[];
      setBillStats({
        total: statsRows.length,
        waitingReferral: statsRows.filter((bill) => bill.status === "submitted").length,
        waitingCalendar: statsRows.filter((bill) => bill.status === "reported").length,
      });

      const nowIso = new Date().toISOString();
      const { data: taskRows } = await supabase
        .from("class_tasks")
        .select("id,title,task_type,due_at")
        .gte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(6);
      setUpcomingEvents(
        (taskRows ?? []).map((task: any) => ({
          id: task.id,
          title: `${task.task_type === "assignment" ? "Assignment" : "Deadline"}: ${task.title}`,
          date: new Date(task.due_at),
          type: "deadline",
        })),
      );

      const activity = await fetchClassActivity(classId, 12);
      setRecentActivity(activity.slice(0, 8));
    } catch {
      // The dashboard should remain usable if one secondary data source fails.
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [classId]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatEventDate = (date: Date) =>
    date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "bill":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "letter":
      case "caucus":
      case "comment":
        return <MessageSquare className="h-4 w-4 text-gray-700" />;
      case "committee":
        return <BookOpen className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventIcon = (type: string) => {
    if (type === "deadline") return <Clock className="h-4 w-4 text-sky-600" />;
    if (type === "election") return <Vote className="h-4 w-4 text-purple-600" />;
    return <CalendarIcon className="h-4 w-4 text-blue-600" />;
  };

  const dayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of upcomingEvents) {
      const key = dayKey(event.date);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [upcomingEvents]);

  const displayedUpcomingEvents = selectedUpcomingDay ? eventsByDay.get(selectedUpcomingDay) ?? [] : upcomingEvents;
  const selectedUpcomingDate = selectedUpcomingDay ? new Date(`${selectedUpcomingDay}T00:00:00`) : null;

  const saveClassName = async () => {
    if (!classId || !classNameDraft.trim()) return;
    const { error } = await supabase.from("classes").update({ name: classNameDraft.trim() }).eq("id", classId);
    if (error) return;
    setClassName(classNameDraft.trim());
    setEditingClassName(false);
  };

  const updateClassSettings = async (next: any) => {
    if (!classId) return;
    setWorkflowBusy(true);
    const merged = { ...classSettings, ...next };
    const { error } = await supabase.from("classes").update({ settings: merged } as any).eq("id", classId);
    setWorkflowBusy(false);
    if (error) return;
    setClassSettings(merged);
  };

  const enableClass = async () => {
    await updateClassSettings({
      class: { ...(classSettings.class ?? {}), joinEnabled: true },
      workflow: { ...(classSettings.workflow ?? {}), stage: "elections" },
    });
  };

  const toggleClassJoin = () => {
    setConfirmDialog({
      title: classJoinEnabled ? "Disable class join?" : "Enable class join?",
      message: classJoinEnabled ? "Students will no longer be able to join with the class code." : "Students will be able to join with the class code.",
      confirmLabel: classJoinEnabled ? "Disable join" : "Enable join",
      danger: classJoinEnabled,
      onConfirm: async () => {
        await updateClassSettings({
          class: { ...(classSettings.class ?? {}), joinEnabled: !classJoinEnabled },
        });
      },
    });
  };

  const setWorkflowStage = async (stage: string) => {
    const next: any = {
      workflow: { ...(classSettings.workflow ?? {}), stage },
      ...(stage === "setup" ? { class: { ...(classSettings.class ?? {}), joinEnabled: false } } : {}),
      ...(stage === "elections" ? { elections: { ...(classSettings.elections ?? {}), open: false, concluded: false } } : {}),
      ...(stage === "assign_committees" ? { elections: { ...(classSettings.elections ?? {}), open: false, concluded: true } } : {}),
      ...(stage === "legislation" ? { elections: { ...(classSettings.elections ?? {}), open: false, concluded: true } } : {}),
    };
    await updateClassSettings(next);
  };

  const confirmWorkflowStage = (stage: string, mode: "revert" | "skip" | "advance") => {
    const target = workflowSteps.find((step) => step.id === stage);
    setConfirmDialog({
      title: `${mode === "revert" ? "Revert" : mode === "skip" ? "Skip ahead" : "Advance"} to ${target?.label ?? "stage"}?`,
      message: mode === "revert" ? "This will move the class timeline back to this stage." : "This will move the class timeline forward to this stage.",
      confirmLabel: mode === "revert" ? "Revert" : "Move timeline",
      danger: mode === "revert",
      onConfirm: () => setWorkflowStage(stage),
    });
  };

  const openElections = async () => {
    await updateClassSettings({
      elections: { ...(classSettings.elections ?? {}), open: true },
      workflow: { ...(classSettings.workflow ?? {}), stage: "elections" },
    });
  };

  const concludeElections = async () => {
    await updateClassSettings({
      elections: { ...(classSettings.elections ?? {}), open: false, concluded: true },
      workflow: { ...(classSettings.workflow ?? {}), stage: "elections" },
    });
  };

  const workflowStepRaw = classSettings?.workflow?.stage ?? "setup";
  const workflowStep = ["open_elections", "conclude_elections"].includes(workflowStepRaw) ? "elections" : workflowStepRaw;
  const classJoinEnabled = Boolean(classSettings?.class?.joinEnabled);
  const electionsOpen = Boolean(classSettings?.elections?.open);
  const committeeSelfJoin = classSettings?.committees?.allowSelfJoin || classSettings?.committees?.assignmentMode === "self-join";
  const visibleWorkflowSteps = workflowSteps.filter((step) => step.id !== "assign_committees" || !committeeSelfJoin);
  const foundWorkflowIndex = visibleWorkflowSteps.findIndex((step) => step.id === workflowStep);
  const currentIndex = foundWorkflowIndex >= 0 ? foundWorkflowIndex : Math.max(0, visibleWorkflowSteps.findIndex((step) => step.id === "legislation"));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!currentTimelineCardRef.current || !timelineScrollRef.current) return;
      const container = timelineScrollRef.current;
      const card = currentTimelineCardRef.current;
      const isLastCard = currentIndex === visibleWorkflowSteps.length - 1;
      const target = isLastCard ? card.offsetLeft - (container.clientWidth - card.offsetWidth) : card.offsetLeft - 56;
      container.scrollLeft = Math.max(0, target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, timelineExpanded, visibleWorkflowSteps.length]);

  const ActivityActionLink = ({ activity }: { activity: ClassActivity }) => {
    if (!activity.targetUrl) return <>{activity.action}</>;
    return <Link to={activity.targetUrl} className="font-medium text-gray-900 hover:text-blue-600">{activity.action}</Link>;
  };

  const workflowAction = (stepId: string) => {
    if (stepId === "setup") {
      return (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => navigate("/teacher/setup")} variant="outline" className="h-11 w-full justify-center px-5 text-base"><Settings className="mr-2 h-5 w-5" />Open setup</Button>
          <Button onClick={() => void enableClass()} disabled={workflowBusy} className="h-11 w-full justify-center px-5 text-base"><Unlock className="mr-2 h-5 w-5" />Enable class</Button>
        </div>
      );
    }
    if (stepId === "elections") {
      return (
        <div className="mt-4 w-full rounded-md border border-gray-200 bg-white p-1 shadow-sm">
          <div className="px-3 py-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Elections: {electionsOpen ? "open" : "closed"}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => void openElections()}
              disabled={workflowBusy}
              className={`inline-flex items-center justify-center gap-2 rounded px-4 py-3 text-base font-semibold transition disabled:opacity-50 ${electionsOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <Vote className="h-5 w-5" />
              Open
            </button>
            <button
              type="button"
              onClick={() => void concludeElections()}
              disabled={workflowBusy}
              className={`inline-flex items-center justify-center gap-2 rounded px-4 py-3 text-base font-semibold transition disabled:opacity-50 ${!electionsOpen ? "bg-gray-900 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <Vote className="h-5 w-5" />
              Closed
            </button>
          </div>
        </div>
      );
    }
    if (stepId === "assign_committees") {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => navigate("/teacher/committee-assignments")}><Users className="mr-2 h-4 w-4" />Assign committees</Button>
          <Button onClick={() => confirmWorkflowStage("legislation", "advance")} variant="outline" disabled={workflowBusy}>Mark complete</Button>
        </div>
      );
    }
    return (
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-white p-3"><div className="text-xs text-gray-500">All bills</div><div className="text-xl font-bold text-gray-900">{billStats.total}</div></div>
          <button type="button" onClick={() => navigate("/teacher/bill-sorting")} className="rounded-md border border-gray-200 bg-white p-3 text-left hover:bg-gray-50">
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">Waiting for referral <ChevronRight className="h-4 w-4" /></div>
            <div className="text-xl font-bold text-gray-900">{billStats.waitingReferral}</div>
          </button>
          <button type="button" onClick={() => navigate("/calendar?schedule=1")} className="rounded-md border border-gray-200 bg-white p-3 text-left hover:bg-gray-50">
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">Waiting to be calendared <ChevronRight className="h-4 w-4" /></div>
            <div className="text-xl font-bold text-gray-900">{billStats.waitingCalendar}</div>
          </button>
        </div>
      </div>
    );
  };

  const workflowTimeline = useMemo(
    () => (
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleClassJoin}
              className="group flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {classJoinEnabled ? <Unlock className="h-4 w-4 text-green-600" /> : <Lock className="h-4 w-4 text-gray-500" />}
              {classJoinEnabled ? "Class join is enabled" : "Class join is currently closed"}
              <Pencil className="h-3.5 w-3.5 text-gray-400" />
              <span className="hidden rounded bg-white px-2 py-0.5 text-xs font-medium text-blue-700 shadow-sm group-hover:inline">
                {classJoinEnabled ? "Disable" : "Enable"}
              </span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => setTimelineExpanded((open) => !open)}>
              {timelineExpanded ? "Collapse timeline" : "View full timeline"}
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${timelineExpanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Class timeline</div>
          <div ref={timelineScrollRef} className="no-scrollbar overflow-x-auto pb-2">
            <div className="flex w-max items-stretch gap-0">
              {visibleWorkflowSteps.map((step, index) => {
                const isCurrent = index === currentIndex;
                const isPast = index < currentIndex;
                const moveMode = isPast ? "revert" : index === currentIndex + 1 ? "advance" : "skip";
                return (
                  <div key={step.id} className="flex flex-shrink-0 items-stretch">
                    {index > 0 && <div className="mt-9 h-0 w-8 border-t-2 border-dashed border-gray-300" />}
                    {isCurrent ? (
                      <div ref={currentTimelineCardRef} className="min-h-48 w-[80vw] min-w-[520px] max-w-[1024px] flex-shrink-0 rounded-lg border border-blue-200 bg-blue-50 p-5">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next action</div>
                          <h2 className="mt-1 text-2xl font-bold text-gray-900">{step.label}</h2>
                          <p className="mt-1 text-base text-gray-600">{step.description}</p>
                        </div>
                        {workflowAction(step.id)}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirmWorkflowStage(step.id, moveMode)}
                        className={`min-h-48 w-[260px] flex-shrink-0 rounded-lg border border-gray-200 p-5 text-left transition hover:opacity-100 ${isPast ? "bg-gray-50 text-gray-400 opacity-75 hover:bg-gray-100" : "bg-gray-50 text-gray-500 opacity-60 hover:bg-gray-100"}`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{isPast ? "Previous" : "Upcoming"}</div>
                        <h3 className="mt-1 font-semibold text-gray-700">{step.label}</h3>
                        <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {timelineExpanded && (
            <div className="no-scrollbar mt-4 overflow-x-auto">
              <div className="flex w-max gap-0">
                {visibleWorkflowSteps.map((step, index) => (
                  <div key={step.id} className="flex flex-shrink-0 items-start">
                    {index > 0 && <div className="mt-6 h-0 w-8 border-t-2 border-dashed border-gray-300" />}
                    <button
                      type="button"
                      onClick={() => index < currentIndex ? confirmWorkflowStage(step.id, "revert") : index > currentIndex ? confirmWorkflowStage(step.id, "skip") : undefined}
                      className={`min-h-28 w-56 flex-shrink-0 rounded-md border p-3 text-left text-sm transition ${index < currentIndex ? "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100" : index === currentIndex ? "border-blue-300 bg-white text-gray-900" : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      <div className="font-semibold">{step.label}</div>
                      <div className="mt-1 text-xs font-medium">{index < currentIndex ? "Revert here" : index === currentIndex ? "Next" : "Skip here"}</div>
                      <p className="mt-2 line-clamp-2 text-xs opacity-80">{step.description}</p>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    ),
    [billStats, classJoinEnabled, currentIndex, electionsOpen, visibleWorkflowSteps, timelineExpanded, workflowBusy, classSettings],
  );

  const actionSections = [
    {
      title: "Legislation",
      actions: [
        { label: "Sort bills into committees", href: "/teacher/bill-sorting", icon: FileText },
        { label: "Calendar Bills", href: "/calendar?schedule=1", icon: CalendarIcon },
      ],
    },
    {
      title: "Organizations",
      actions: [{ label: "Assign to committees", href: "/teacher/committee-assignments", icon: BookOpen }],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {className ? (
              <div className="flex flex-wrap items-center gap-2">
                {editingClassName ? (
                  <>
                    <input value={classNameDraft} onChange={(event) => setClassNameDraft(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-3xl font-bold text-gray-900" />
                    <button type="button" onClick={() => void saveClassName()} className="rounded-md p-2 text-blue-600 hover:bg-blue-50" aria-label="Save class name"><Save className="h-5 w-5" /></button>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-gray-900">{className}</h1>
                    <button type="button" onClick={() => setEditingClassName(true)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Rename class"><Pencil className="h-5 w-5" /></button>
                  </>
                )}
              </div>
            ) : (
              <div className="h-9 w-64 animate-pulse rounded bg-gray-200" />
            )}
            <p className="mt-1 text-sm text-gray-600">{studentCount} students enrolled</p>
          </div>
          <TeacherClassTabs classId={classId} active="dashboard" />
        </div>

        {workflowTimeline}

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Events & Deadlines</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => navigate("/teacher/deadlines?add=1")}><Plus className="mr-2 h-4 w-4" />Add Deadline</Button>
                    <Button variant="outline" onClick={() => navigate("/calendar")}>View full calendar</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-7 gap-2">
                  {currentWeekDays.map((day) => {
                    const events = eventsByDay.get(dayKey(day)) ?? [];
                    const isToday = dayKey(day) === dayKey(new Date());
                    return (
                      <button
                        key={dayKey(day)}
                        type="button"
                        onClick={() => setSelectedUpcomingDay(dayKey(day))}
                        className="group relative text-left"
                      >
                        <div className={`flex min-h-16 flex-col items-center justify-center rounded-full border text-center text-xs ${selectedUpcomingDay === dayKey(day) ? "border-blue-300 bg-blue-100 text-blue-900" : events.length ? "border-sky-200 bg-sky-50 text-sky-800" : isToday ? "border-gray-200 bg-gray-100 text-gray-800" : "border-gray-200 bg-white text-gray-500"}`}>
                          <span className="font-semibold">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                          <span className="text-lg font-bold">{day.getDate()}</span>
                        </div>
                        {events.length > 0 && (
                          <div className="pointer-events-none absolute left-full top-0 z-10 ml-2 hidden w-56 space-y-2 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover:block">
                            {events.map((event) => (
                              <div key={event.id}>
                                <div className="font-semibold text-gray-900">{event.title}</div>
                                <div className="mt-0.5 text-gray-500">{formatEventDate(event.date)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  {selectedUpcomingDate && (
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm">
                      <span className="font-semibold text-gray-900">
                        {selectedUpcomingDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                      </span>
                      <button type="button" onClick={() => setSelectedUpcomingDay(null)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        Show all
                      </button>
                    </div>
                  )}
                  {displayedUpcomingEvents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                      {selectedUpcomingDate ? "No upcoming events for this day." : "No upcoming events."}
                    </div>
                  ) : (
                    displayedUpcomingEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 rounded-lg bg-sky-50 p-3 transition-colors hover:bg-sky-100">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">{getEventIcon(event.type)}</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">{event.title}</h4>
                          <p className="mt-0.5 text-xs text-gray-600">{formatEventDate(event.date)}</p>
                        </div>
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700">{event.type}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 flex">
                  <Button variant="outline" onClick={() => navigate("/teacher/deadlines")}>Manage deadlines</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Student Activity</CardTitle>
                    <CardDescription>Track what your students are doing</CardDescription>
                  </div>
                  <Link to={`/teacher/class/${classId}/activity`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    All activity
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-4">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50">{getActivityIcon(activity.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          <Link to={`/profile/${activity.studentId}`} className="font-semibold transition-colors hover:text-blue-600">{activity.studentName}</Link>{" "}
                          <ActivityActionLink activity={activity} />
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && <div className="p-4 text-sm text-gray-500">No recent activity.</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {actionSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.title}</h3>
                    <div className="space-y-2">
                      {section.actions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <Link key={action.label} to={action.href}>
                            <Button variant="ghost" className="w-full justify-start bg-white text-base text-gray-900 hover:bg-gray-50">
                              <Icon className="mr-2 h-4 w-4" />
                              {action.label}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
