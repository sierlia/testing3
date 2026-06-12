import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  Backpack,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Save,
  Send,
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
import { TeacherAssignmentModal } from "../components/TeacherAssignmentModal";
import { fetchClassActivity, ClassActivity } from "../services/classActivity";
import { fetchCalendaredBillsForCurrentClass, saveBillCalendarEntry } from "../services/bills";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { useUnsavedChangesPrompt } from "../hooks/useUnsavedChangesPrompt";
import { profilePath } from "../utils/profileRoute";

interface CalendarEvent {
  id: string;
  sourceId: string;
  title: string;
  date: Date;
  hasTime?: boolean;
  type: "assignment" | "deadline" | "session" | "election" | "bill";
  href?: string;
}

const workflowSteps = [
  { id: "setup", label: "Set up class", description: "Choose default parties and committees before students begin." },
  { id: "elections", label: "Hold elections", description: "Open and close Speaker and organization leadership elections." },
  { id: "assign_committees", label: "Assign committees", description: "Place students onto committees from their preferences." },
  { id: "legislation", label: "Refer and calendar bills", description: "Route bills through committee referral and floor scheduling." },
];

export function ClassDashboard({ classIdOverride }: { classIdOverride?: string | null } = {}) {
  const { classId: routeClassId } = useParams();
  const classId = classIdOverride ?? routeClassId;
  const navigate = useNavigate();
  const [className, setClassName] = useState("");
  const [classNameDraft, setClassNameDraft] = useState("");
  const [editingClassName, setEditingClassName] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [classSettings, setClassSettings] = useState<any>({});
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ClassActivity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [selectedUpcomingDay, setSelectedUpcomingDay] = useState<string | null>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [activeCalendarMenuId, setActiveCalendarMenuId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [billStats, setBillStats] = useState({ total: 0, waitingReferral: 0, waitingCalendar: 0 });
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const currentTimelineCardRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  useUnsavedChangesPrompt(editingClassName && classNameDraft.trim() !== className);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [classId]);

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
      const [{ data: cls, error: cErr }, { data: rosterRows }, { data: billRows }] = await Promise.all([
        supabase.from("classes").select("name,class_code,settings").eq("id", classId).maybeSingle(),
        supabase.from("class_memberships").select("user_id,role").eq("class_id", classId).eq("status", "approved"),
        supabase.from("bills").select("id,status").eq("class_id", classId),
      ]);
      if (cErr) throw cErr;
      const settings = (cls as any)?.settings ?? {};
      setClassName((cls as any)?.name ?? "Class");
      setClassNameDraft((cls as any)?.name ?? "Class");
      setClassCode((cls as any)?.class_code ?? "");
      setClassSettings(settings);
      setStudentCount((rosterRows ?? []).filter((row: any) => row.role === "student").length);
      setTeacherCount((rosterRows ?? []).filter((row: any) => row.role === "teacher").length);
      const statsRows = (billRows ?? []) as any[];
      setBillStats({
        total: statsRows.length,
        waitingReferral: statsRows.filter((bill) => bill.status === "submitted").length,
        waitingCalendar: statsRows.filter((bill) => bill.status === "reported").length,
      });

      const now = new Date();
      const calendarStart = new Date(now.getFullYear() - 1, 0, 1);
      const calendarEnd = new Date(now.getFullYear() + 2, 0, 1);
      const { data: taskRows } = await supabase
        .from("class_tasks")
        .select("id,title,task_type,due_at")
        .eq("class_id", classId)
        .not("due_at", "is", null)
        .gte("due_at", calendarStart.toISOString())
        .lte("due_at", calendarEnd.toISOString())
        .order("due_at", { ascending: true })
        .limit(80);
      const calendaredBills = await fetchCalendaredBillsForCurrentClass();
      setUpcomingEvents(
        [
          ...(taskRows ?? []).map((task: any) => ({
          id: task.id,
          sourceId: task.id,
          title: task.title,
          date: new Date(task.due_at),
          type: task.task_type === "assignment" ? "assignment" : "deadline",
          href: task.task_type === "assignment" ? `/assignments/${task.id}` : undefined,
        })),
          ...calendaredBills.map((item) => ({
            id: `bill-${item.id}`,
            sourceId: item.bill_id,
            title: `${item.bill.hr_label}: ${item.bill.title}`,
            date: new Date(item.scheduled_at),
            hasTime: item.duration_minutes !== 0,
            type: "bill" as const,
            href: `/bills/${item.bill_id}`,
          })),
        ].sort((a, b) => a.date.getTime() - b.date.getTime()),
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

  const formatEventDate = (event: CalendarEvent) =>
    event.hasTime === false
      ? event.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : event.date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const eventDisplayTitle = (event: CalendarEvent) => {
    if (event.type === "assignment") return event.title;
    if (event.type === "bill") return `Floor: ${event.title}`;
    if (event.type === "deadline") return `Deadline: ${event.title}`;
    return event.title;
  };

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
    if (type === "assignment") return <Backpack className="h-4 w-4 text-blue-600" />;
    if (type === "deadline") return <Clock className="h-4 w-4 text-sky-600" />;
    if (type === "bill") return <FileText className="h-4 w-4 text-blue-600" />;
    if (type === "election") return <Vote className="h-4 w-4 text-purple-600" />;
    return <CalendarIcon className="h-4 w-4 text-blue-600" />;
  };

  const eventToneClass = (date: Date) => {
    const today = dayKey(new Date());
    const eventDay = dayKey(date);
    if (eventDay < today) return "border-yellow-200 bg-yellow-50 hover:bg-yellow-100";
    if (eventDay === today) return "border-blue-200 bg-blue-50 hover:bg-blue-100";
    return "border-gray-200 bg-white hover:bg-gray-50";
  };

  const dayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dashboardMonth = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, []);

  const dashboardCalendarWeeks = useMemo(() => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    const firstWeekStart = new Date(currentWeekStart);
    firstWeekStart.setDate(currentWeekStart.getDate() - 7);
    return Array.from({ length: 3 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const day = new Date(firstWeekStart);
        day.setDate(firstWeekStart.getDate() + weekIndex * 7 + dayIndex);
        return day;
      }),
    );
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
  const overdueEvents = useMemo(() => {
    const today = dayKey(new Date());
    return upcomingEvents.filter((event) => dayKey(event.date) < today).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [upcomingEvents]);

  useEffect(() => {
    calendarScrollRef.current?.scrollTo({ top: 0 });
  }, [dashboardCalendarWeeks.length]);

  const localDateInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const localTimeInput = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const openRescheduler = (event: CalendarEvent) => {
    setRescheduleTarget(event);
    setRescheduleDate(localDateInput(event.date));
    setRescheduleTime(localTimeInput(event.date));
    setActiveCalendarMenuId(null);
  };

  const saveEventDate = async (event: CalendarEvent, nextDate: Date) => {
    if (!classId) return;
    try {
      if (event.type === "assignment" || event.type === "deadline") {
        const { error } = await supabase.from("class_tasks").update({ due_at: nextDate.toISOString() } as any).eq("id", event.sourceId).eq("class_id", classId);
        if (error) throw error;
      } else if (event.type === "bill") {
        await saveBillCalendarEntry(event.sourceId, nextDate.toISOString(), event.hasTime === false ? 0 : 30);
      }
      setUpcomingEvents((current) => current.map((item) => item.id === event.id ? { ...item, date: nextDate } : item).sort((a, b) => a.date.getTime() - b.date.getTime()));
      setSelectedUpcomingDay(dayKey(nextDate));
      toast.success("Event rescheduled");
    } catch (error: any) {
      toast.error(error.message || "Could not reschedule event");
    }
  };

  const saveRescheduleTarget = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    await saveEventDate(rescheduleTarget, new Date(`${rescheduleDate}T${rescheduleTime || localTimeInput(rescheduleTarget.date)}:00`));
    setRescheduleTarget(null);
  };

  const dropEventOnDay = async (eventId: string, targetDay: Date) => {
    const event = upcomingEvents.find((item) => item.id === eventId);
    if (!event) return;
    const next = new Date(targetDay);
    next.setHours(event.date.getHours(), event.date.getMinutes(), 0, 0);
    await saveEventDate(event, next);
  };

  const saveClassName = async () => {
    if (!classId || !classNameDraft.trim()) return;
    const { error } = await supabase.from("classes").update({ name: classNameDraft.trim() }).eq("id", classId);
    if (error) return;
    setClassName(classNameDraft.trim());
    window.dispatchEvent(new CustomEvent("gavel:class-renamed", { detail: { classId, name: classNameDraft.trim() } }));
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
      ...(stage === "elections" ? { elections: { ...(classSettings.elections ?? {}), open: false } } : {}),
      ...(stage === "assign_committees" ? { elections: { ...(classSettings.elections ?? {}), open: false } } : {}),
      ...(stage === "legislation" ? { elections: { ...(classSettings.elections ?? {}), open: false } } : {}),
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

  const closeElections = async () => {
    await updateClassSettings({
      elections: { ...(classSettings.elections ?? {}), open: false },
      workflow: { ...(classSettings.workflow ?? {}), stage: "elections" },
    });
  };

  const confirmElectionToggle = (open: boolean) => {
    setConfirmDialog({
      title: open ? "Open all elections?" : "Close all elections?",
      message: open
        ? "This will open the Speaker election and every organization leadership election for the class. To open only one election, use the controls in that specific floor, party, committee, or caucus area."
        : "This will close the Speaker election and every organization leadership election for the class. To close only one election, use the controls in that specific floor, party, committee, or caucus area.",
      confirmLabel: open ? "Open all elections" : "Close all elections",
      onConfirm: open ? openElections : closeElections,
    });
  };

  const inviteTeacher = async () => {
    if (!classId || !inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      toast.error("please enter a valid email address");
      return;
    }
    setInviteBusy(true);
    try {
      const { error } = await supabase.rpc("invite_teacher_to_class", { target_class: classId, teacher_email: inviteEmail.trim() });
      if (error) throw error;
      toast.success("invitation sent if user exists");
      setInviteEmail("");
    } catch (e: any) {
      toast.error(e.message === "EMAIL_REQUIRED" ? "please enter a valid email address" : "invitation sent if user exists");
    } finally {
      setInviteBusy(false);
    }
  };

  const postDashboardAnnouncement = async () => {
    if (!classId || !announcementDraft.trim()) return;
    setPostingAnnouncement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("class_announcements").insert({
        class_id: classId,
        author_user_id: user.id,
        body: announcementDraft.trim(),
        is_pinned: announcementPinned,
      } as any);
      if (error) throw error;
      setAnnouncementDraft("");
      setAnnouncementPinned(false);
      toast.success("Announcement posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post announcement");
    } finally {
      setPostingAnnouncement(false);
    }
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
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const leftAligned = container.scrollLeft + cardRect.left - containerRect.left;
      const rightAligned = container.scrollLeft + cardRect.right - containerRect.right;
      const target = isLastCard ? rightAligned : leftAligned;
      container.scrollLeft = Math.max(0, target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, timelineExpanded, visibleWorkflowSteps.length]);

  const workflowAction = (stepId: string) => {
    if (stepId === "setup") {
      return (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => navigate(`/teacher/class/${classId}/settings`)} variant="outline" className="h-11 w-full justify-center px-5 text-base"><Settings className="mr-2 h-5 w-5" />Open settings</Button>
          <Button onClick={() => void enableClass()} disabled={workflowBusy} className="h-11 w-full justify-center px-5 text-base"><Unlock className="mr-2 h-5 w-5" />Enable class</Button>
        </div>
      );
    }
    if (stepId === "elections") {
      return (
        <div className="mt-4 w-full">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Elections: {electionsOpen ? "open" : "closed"}
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => confirmElectionToggle(true)}
              disabled={workflowBusy}
              className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${electionsOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <Vote className="h-4 w-4" />
              Open
            </button>
            <button
              type="button"
              onClick={() => confirmElectionToggle(false)}
              disabled={workflowBusy}
              className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${!electionsOpen ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <Vote className="h-4 w-4" />
              Close
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
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                Waiting for referral
                {billStats.waitingReferral > 0 && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">!</span>}
              </span>
              <ChevronRight className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold text-gray-900">{billStats.waitingReferral}</div>
          </button>
          <button type="button" onClick={() => navigate("/calendar?schedule=1")} className="rounded-md border border-gray-200 bg-white p-3 text-left hover:bg-gray-50">
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                Waiting to be calendared
                {billStats.waitingCalendar > 0 && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">!</span>}
              </span>
              <ChevronRight className="h-4 w-4" />
            </div>
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
                          <h2 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                            {step.label}
                            {step.id === "legislation" && (billStats.waitingReferral > 0 || billStats.waitingCalendar > 0) && (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">!</span>
                            )}
                          </h2>
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
        { label: "Sort bills into committees", href: "/teacher/bill-sorting", icon: FileText, count: billStats.waitingReferral },
        { label: "Calendar Bills", href: "/calendar?schedule=1", icon: CalendarIcon, count: billStats.waitingCalendar },
      ],
    },
    {
      title: "Organizations",
      actions: [{ label: "Assign to committees", href: "/teacher/committee-assignments", icon: BookOpen }],
    },
  ];

  useEffect(() => {
    if (className) window.dispatchEvent(new CustomEvent("gavel:dashboard-ready"));
  }, [className]);

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
                    <input
                      value={classNameDraft}
                      onChange={(event) => setClassNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveClassName();
                        }
                      }}
                      className="rounded-md border-2 border-dashed border-gray-300 bg-transparent px-3 py-2 text-3xl font-bold text-gray-900 outline-none hover:border-blue-300 focus:border-blue-500"
                    />
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
            <p className="mt-1 text-sm text-gray-600">
              {studentCount} student{studentCount === 1 ? "" : "s"}, {teacherCount} teacher{teacherCount === 1 ? "" : "s"} enrolled
            </p>
          </div>
          <TeacherClassTabs classId={classId} active="dashboard" />
        </div>

        {workflowTimeline}

        <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,2.5fr)_18rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Calendar</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setAssignmentModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Create assignment</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div />
                      <button type="button" onClick={() => navigate("/calendar")} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        View full calendar
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div ref={calendarScrollRef} className="max-h-[18rem] overflow-y-auto rounded-md border border-gray-200 bg-white">
                      <section>
                        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-2 py-1.5 text-sm font-semibold text-gray-900 backdrop-blur">
                          {dashboardMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                        </div>
                        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <div key={day} className="px-2 py-1">{day}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7">
                          {dashboardCalendarWeeks.flat().map((day) => {
                            const key = dayKey(day);
                            const inMonth = day.getMonth() === dashboardMonth.getMonth() && day.getFullYear() === dashboardMonth.getFullYear();
                            const events = inMonth ? eventsByDay.get(key) ?? [] : [];
                            const isToday = key === dayKey(new Date());
                            const selected = selectedUpcomingDay === key;
                            const dayLabel = day.getDate() === 1 ? day.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : String(day.getDate());
                            return (
                              <div
                                key={key}
                                onClick={() => {
                                  if (inMonth) setSelectedUpcomingDay(key);
                                }}
                                onDragOver={(event) => {
                                  if (inMonth) event.preventDefault();
                                }}
                                onDrop={(drop) => {
                                  if (!inMonth) return;
                                  drop.preventDefault();
                                  const eventId = drop.dataTransfer.getData("text/plain");
                                  if (eventId) void dropEventOnDay(eventId, day);
                                }}
                                className={`min-h-14 border-b border-r border-gray-100 p-1 text-left transition-colors sm:min-h-16 ${
                                  !inMonth
                                    ? "cursor-not-allowed bg-gray-100 text-gray-300"
                                    : selected
                                      ? "cursor-pointer bg-blue-50 ring-1 ring-inset ring-blue-400"
                                      : isToday
                                        ? "cursor-pointer bg-blue-50/70 hover:bg-blue-100"
                                        : "cursor-pointer bg-white hover:bg-gray-50"
                                }`}
                              >
                                <div className={`text-xs font-semibold ${inMonth && isToday ? "text-blue-700" : inMonth ? "text-gray-900" : "text-gray-300"}`}>{dayLabel}</div>
                                <div className="mt-0.5 space-y-0.5">
                                  {events.slice(0, 1).map((event) => (
                                    <div
                                      key={event.id}
                                      draggable
                                      onDragStart={(drag) => drag.dataTransfer.setData("text/plain", event.id)}
                                      className={`line-clamp-1 cursor-grab rounded px-1 py-0.5 text-[9px] font-medium leading-tight active:cursor-grabbing ${event.type === "bill" ? "bg-indigo-50 text-indigo-700" : event.type === "assignment" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}
                                    >
                                      {eventDisplayTitle(event)}
                                    </div>
                                  ))}
                                  {events.length > 1 && <div className="text-[9px] font-medium leading-none text-gray-500">+{events.length - 1} more</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedUpcomingDate && (
                      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 text-sm">
                        <span className="font-semibold text-gray-900">
                          {selectedUpcomingDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {displayedUpcomingEvents.length === 0 ? (
                        <div className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                          {selectedUpcomingDate ? "No events for this day." : "No scheduled events."}
                        </div>
                      ) : (
                        displayedUpcomingEvents.map((event) => (
                          <div
                            key={event.id}
                            role={event.href ? "link" : undefined}
                            tabIndex={event.href ? 0 : undefined}
                            draggable
                            onClick={() => {
                              if (event.href) navigate(event.href);
                            }}
                            onKeyDown={(keyEvent) => {
                              if (event.href && (keyEvent.key === "Enter" || keyEvent.key === " ")) navigate(event.href);
                            }}
                            onDragStart={(drag) => drag.dataTransfer.setData("text/plain", event.id)}
                            className={`group relative flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-all hover:-translate-y-0.5 hover:shadow-sm active:cursor-grabbing ${eventToneClass(event.date)}`}
                          >
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">{getEventIcon(event.type)}</div>
                            <div className="min-w-0 flex-1">
                              <h4 className="line-clamp-1 text-xs font-semibold text-gray-900">{eventDisplayTitle(event)}</h4>
                              <p className="mt-0.5 text-xs text-gray-600">{formatEventDate(event)}</p>
                            </div>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(click) => {
                                  click.preventDefault();
                                  click.stopPropagation();
                                  setActiveCalendarMenuId((current) => current === event.id ? null : event.id);
                                }}
                                className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-900"
                                aria-label="Event actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {activeCalendarMenuId === event.id ? (
                                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                  <button type="button" onClick={() => openRescheduler(event)} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Reschedule</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                      {overdueEvents.length ? (
                        <div className="pt-2">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Earlier active deadlines</div>
                          <div className="space-y-1.5">
                            {overdueEvents.slice(0, 8).map((event) => (
                              <div
                                key={`overdue-${event.id}`}
                                role={event.href ? "link" : undefined}
                                tabIndex={event.href ? 0 : undefined}
                                onClick={() => {
                                  if (event.href) navigate(event.href);
                                }}
                                onKeyDown={(keyEvent) => {
                                  if (event.href && (keyEvent.key === "Enter" || keyEvent.key === " ")) navigate(event.href);
                                }}
                                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-all hover:-translate-y-0.5 hover:shadow-sm ${eventToneClass(event.date)}`}
                              >
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">{getEventIcon(event.type)}</div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="line-clamp-1 text-xs font-semibold text-gray-900">{eventDisplayTitle(event)}</h4>
                                  <p className="mt-0.5 text-xs text-gray-600">{formatEventDate(event)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate("/assignments")}>Manage assignments</Button>
                    </div>
                  </div>
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
                    <div
                      key={activity.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(activity.targetUrl || profilePath(activity.studentId))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") navigate(activity.targetUrl || profilePath(activity.studentId));
                      }}
                      className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50">{getActivityIcon(activity.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          <Link to={profilePath(activity.studentId)} onClick={(event) => event.stopPropagation()} className={`font-semibold hover:underline ${activity.studentRole === "teacher" ? "text-green-700" : "text-gray-900 hover:text-blue-600"}`}>{activity.studentName}</Link>{" "}
                          <span className="font-medium text-gray-900">{activity.action}</span>
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
                <CardTitle>Class Announcement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={announcementDraft}
                  onChange={(event) => setAnnouncementDraft(event.target.value)}
                  rows={4}
                  placeholder="Post an announcement students will see on their dashboard"
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={announcementPinned}
                      onChange={(event) => setAnnouncementPinned(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Pin className="h-4 w-4 text-blue-600" />
                    Pin
                  </label>
                  <Button type="button" onClick={() => void postDashboardAnnouncement()} disabled={!announcementDraft.trim() || postingAnnouncement}>
                    <Send className="mr-2 h-4 w-4" />
                    {postingAnnouncement ? "Posting..." : "Post"}
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                              <span>{action.label}</span>
                              {typeof action.count === "number" && (
                                <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-800">
                                  {action.count}
                                </span>
                              )}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-4">
                  <div className="mb-2 text-sm font-semibold text-gray-900">Invite teacher</div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="teacher@email.com"
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button type="button" onClick={() => void inviteTeacher()} disabled={inviteBusy || !inviteEmail.trim()}>
                      Invite
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      {rescheduleTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900">Reschedule event</h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{eventDisplayTitle(rescheduleTarget)}</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Date</span>
                <input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Time</span>
                <input type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-5">
              <Button type="button" variant="outline" onClick={() => setRescheduleTarget(null)}>Cancel</Button>
              <Button type="button" onClick={() => void saveRescheduleTarget()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
      <TeacherAssignmentModal
        classId={classId}
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onSaved={async () => {
          setAssignmentModalOpen(false);
          await loadDashboard();
        }}
      />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
