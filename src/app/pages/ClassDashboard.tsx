import { useEffect, useMemo, useState } from "react";
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
  RotateCcw,
  Save,
  Settings,
  TrendingUp,
  Unlock,
  Users,
  Vote,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Navigation } from "../components/Navigation";
import { fetchClassActivity, ClassActivity } from "../services/classActivity";
import { supabase } from "../utils/supabase";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "deadline" | "session" | "election";
}

const workflowSteps = [
  { id: "setup", label: "Setup / Enable class", description: "Configure settings, then open the join code when the class is ready." },
  { id: "open_elections", label: "Open elections", description: "Open Speaker, party, committee, and caucus leadership elections." },
  { id: "conclude_elections", label: "Conclude elections", description: "Close leadership elections and move into legislative work." },
  { id: "legislation", label: "Refer bills to committees, calendar bills", description: "Route bills through committee referral and floor scheduling." },
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
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [billStats, setBillStats] = useState({ total: 0, waitingReferral: 0, waitingCalendar: 0 });
  const [workflowBusy, setWorkflowBusy] = useState(false);

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
    if (type === "deadline") return <Clock className="h-4 w-4 text-red-600" />;
    if (type === "election") return <Vote className="h-4 w-4 text-purple-600" />;
    return <CalendarIcon className="h-4 w-4 text-blue-600" />;
  };

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
      workflow: { ...(classSettings.workflow ?? {}), stage: "open_elections" },
    });
    alert(`Class is enabled. Have students join with code ${classCode}.`);
  };

  const disableClassJoin = async () => {
    await updateClassSettings({
      class: { ...(classSettings.class ?? {}), joinEnabled: false },
    });
  };

  const revertWorkflow = async (stage: string) => {
    await updateClassSettings({
      workflow: { ...(classSettings.workflow ?? {}), stage },
      ...(stage === "setup" ? { class: { ...(classSettings.class ?? {}), joinEnabled: false } } : {}),
      ...(stage === "open_elections" ? { elections: { ...(classSettings.elections ?? {}), open: true, concluded: false } } : {}),
      ...(stage === "conclude_elections" ? { elections: { ...(classSettings.elections ?? {}), open: false, concluded: false } } : {}),
    });
  };

  const openElections = async () => {
    await updateClassSettings({
      elections: { ...(classSettings.elections ?? {}), open: true },
      workflow: { ...(classSettings.workflow ?? {}), stage: "conclude_elections" },
    });
  };

  const concludeElections = async () => {
    await updateClassSettings({
      elections: { ...(classSettings.elections ?? {}), open: false, concluded: true },
      workflow: { ...(classSettings.workflow ?? {}), stage: "legislation" },
    });
  };

  const workflowStep = classSettings?.workflow?.stage ?? "setup";
  const classJoinEnabled = Boolean(classSettings?.class?.joinEnabled);
  const currentIndex = Math.max(0, workflowSteps.findIndex((step) => step.id === workflowStep));
  const currentWorkflowStep = workflowSteps[currentIndex] ?? workflowSteps[0];
  const nextWorkflowStep = workflowSteps[currentIndex + 1] ?? null;

  const workflowAction = (stepId: string) => {
    if (stepId === "setup") {
      return (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => navigate("/teacher/setup")} variant="outline"><Settings className="mr-2 h-4 w-4" />Open settings</Button>
          <Button onClick={() => void enableClass()} disabled={workflowBusy}><Unlock className="mr-2 h-4 w-4" />Enable class</Button>
        </div>
      );
    }
    if (stepId === "open_elections") return <Button className="mt-4" onClick={() => void openElections()} disabled={workflowBusy}><Vote className="mr-2 h-4 w-4" />Open elections</Button>;
    if (stepId === "conclude_elections") return <Button className="mt-4" onClick={() => void concludeElections()} disabled={workflowBusy}><Vote className="mr-2 h-4 w-4" />Conclude elections</Button>;
    return (
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">All bills</div><div className="text-xl font-bold text-gray-900">{billStats.total}</div></div>
          <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">Waiting for referral</div><div className="text-xl font-bold text-gray-900">{billStats.waitingReferral}</div></div>
          <div className="rounded-md bg-gray-50 p-3"><div className="text-xs text-gray-500">Waiting to be calendared</div><div className="text-xl font-bold text-gray-900">{billStats.waitingCalendar}</div></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => navigate("/teacher/bill-sorting")}><FileText className="mr-2 h-4 w-4" />Refer bills</Button>
          <Button onClick={() => navigate("/calendar")} variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />Calendar bills</Button>
        </div>
      </div>
    );
  };

  const workflowTimeline = useMemo(
    () => (
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-700">
              {classJoinEnabled ? <Unlock className="h-4 w-4 text-green-600" /> : <Lock className="h-4 w-4 text-gray-500" />}
              {classJoinEnabled ? "Class join is enabled" : "Class join is currently closed"}
              {classJoinEnabled && (
                <Button variant="ghost" size="sm" onClick={() => void disableClassJoin()} disabled={workflowBusy} className="h-7 px-2 text-xs">
                  Disable class join
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTimelineExpanded((open) => !open)}>
              {timelineExpanded ? "Collapse timeline" : "View full timeline"}
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${timelineExpanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Class timeline</div>
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            <div className="min-w-[520px] flex-[2] rounded-lg border border-blue-200 bg-blue-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next action</div>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{currentWorkflowStep.label}</h2>
              <p className="mt-1 text-sm text-gray-600">{currentWorkflowStep.description}</p>
              {workflowAction(currentWorkflowStep.id)}
            </div>
            {nextWorkflowStep && (
              <>
                <div className="mt-9 h-0 min-w-8 border-t-2 border-dashed border-gray-300" />
                <div className="min-w-[260px] flex-1 rounded-lg border border-gray-200 bg-gray-50 p-5 opacity-60">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">After that</div>
                  <h3 className="mt-1 font-semibold text-gray-700">{nextWorkflowStep.label}</h3>
                  <p className="mt-1 text-sm text-gray-500">{nextWorkflowStep.description}</p>
                </div>
              </>
            )}
          </div>
          {timelineExpanded && (
            <div className="mt-4 flex gap-0 overflow-x-auto">
              {workflowSteps.map((step, index) => (
                <div key={step.id} className="flex items-start">
                  {index > 0 && <div className="mt-6 h-0 w-8 border-t-2 border-dashed border-gray-300" />}
                  <div className={`min-w-56 rounded-md border p-3 text-sm ${index < currentIndex ? "border-blue-200 bg-blue-50 text-blue-900" : index === currentIndex ? "border-blue-300 bg-white text-gray-900" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
                    <div className="font-semibold">{step.label}</div>
                    <div className="mt-1 text-xs">{index < currentIndex ? "Complete" : index === currentIndex ? "Current" : "Upcoming"}</div>
                    {index < currentIndex && (
                      <button type="button" onClick={() => void revertWorkflow(step.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                        <RotateCcw className="h-3 w-3" />
                        Revert here
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    [billStats, classJoinEnabled, currentIndex, currentWorkflowStep, nextWorkflowStep, timelineExpanded, workflowBusy, classSettings],
  );

  const primaryActions = [
    { label: "Student Roster", href: `/teacher/class/${classId}/manage`, icon: Users },
    { label: "Simulation Settings", href: "/teacher/setup", icon: Settings },
  ];

  const actionSections = [
    {
      title: "Legislation",
      actions: [
        { label: "Sort Bills into Committees", href: "/teacher/bill-sorting", icon: FileText },
        { label: "Calendar Bills", href: "/calendar", icon: CalendarIcon },
      ],
    },
    {
      title: "Organizations",
      actions: [{ label: "Committee Assignments", href: "/teacher/committee-assignments", icon: BookOpen }],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
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
          {classCode && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Join code</div>
              <div className="mt-1 font-mono text-xl font-bold text-blue-700">{classCode}</div>
            </div>
          )}
        </div>

        {workflowTimeline}

        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Events & Deadlines</CardTitle>
                    <CardDescription>Manage your class schedule and deadlines</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/teacher/deadlines")}><Plus className="mr-2 h-4 w-4" />Add Deadline</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No upcoming events.</div>
                  ) : (
                    upcomingEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">{getEventIcon(event.type)}</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">{event.title}</h4>
                          <p className="mt-0.5 text-xs text-gray-600">{formatEventDate(event.date)}</p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">{event.type}</span>
                      </div>
                    ))
                  )}
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={() => navigate("/calendar")}>View Full Calendar</Button>
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
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">{getActivityIcon(activity.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          <Link to={`/profile/${activity.studentId}`} className="font-semibold transition-colors hover:text-blue-600">{activity.studentName}</Link>{" "}
                          {activity.action}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No recent activity.</div>}
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
                <div className="space-y-2">
                  {primaryActions.map((action) => {
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
                {actionSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.title}</h3>
                    <div className="space-y-2">
                      {section.actions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <Link key={action.label} to={action.href}>
                            <Button variant="ghost" className="w-full justify-start bg-gray-50 hover:bg-gray-100">
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
    </div>
  );
}
