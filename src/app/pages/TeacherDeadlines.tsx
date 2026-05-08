import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Calendar,
  ClipboardCheck,
  CloudUpload,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { supabase } from "../utils/supabase";
import {
  AssignmentProvider,
  AssignmentTask,
  AUTO_CRITERIA_OPTIONS,
  AutoCriteriaConfig,
  AutoCriteriaResult,
  criterionFromOption,
  computeAutoCriteriaScores,
  newRubricItem,
  normalizeAssignment,
  normalizeCriteria,
  normalizeRubric,
  PROVIDERS,
  RubricItem,
  autoCriteriaLabel,
  autoScoreTotal,
  rubricTotal,
} from "../services/assignments";

type AudienceType = "all" | "caucus" | "party" | "committee";
type TaskType = "deadline" | "assignment";

type TaskRow = AssignmentTask;
type OrgOption = { id: string; name: string };
type StudentRow = { user_id: string; display_name: string };
type SubmissionRow = {
  id: string;
  assignment_id: string;
  class_id: string;
  student_user_id: string;
  body: string;
  attachments: Array<{ id: string; label: string; href: string; type: string; description?: string }>;
  auto_scores: Record<string, AutoCriteriaResult>;
  manual_score: number | null;
  manual_feedback: string;
  status: "draft" | "submitted" | "returned";
  submitted_at: string | null;
  returned_at: string | null;
  updated_at: string;
};
type GradeDraft = { manual_score: string; manual_feedback: string };
type IntegrationRow = {
  id?: string;
  provider: AssignmentProvider;
  enabled: boolean;
  external_course_id: string;
  external_gradebook_id: string;
  sync_mode: "manual" | "auto_returned";
  status: string;
};

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function providerLabel(provider: AssignmentProvider) {
  return PROVIDERS.find((item) => item.id === provider)?.label ?? provider;
}

function blankIntegrations(): IntegrationRow[] {
  return PROVIDERS.map((provider) => ({
    provider: provider.id,
    enabled: false,
    external_course_id: "",
    external_gradebook_id: "",
    sync_mode: "manual",
    status: "not_connected",
  }));
}

export function TeacherDeadlines() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [gradingDrafts, setGradingDrafts] = useState<Record<string, GradeDraft>>({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>(blankIntegrations());

  const [newTaskType, setNewTaskType] = useState<TaskType>("deadline");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newAudienceType, setNewAudienceType] = useState<AudienceType>("all");
  const [newAudienceId, setNewAudienceId] = useState<string>("");
  const [newPointsPossible, setNewPointsPossible] = useState("100");
  const [rubricRows, setRubricRows] = useState<RubricItem[]>([newRubricItem()]);
  const [criteriaRows, setCriteriaRows] = useState<AutoCriteriaConfig[]>([]);
  const [integrationTargets, setIntegrationTargets] = useState<AssignmentProvider[]>([]);

  const [parties, setParties] = useState<OrgOption[]>([]);
  const [committees, setCommittees] = useState<OrgOption[]>([]);
  const [caucuses, setCaucuses] = useState<OrgOption[]>([]);

  const selectedAssignment = useMemo(
    () => tasks.find((task) => task.id === selectedAssignmentId && task.task_type === "assignment") ?? null,
    [selectedAssignmentId, tasks],
  );
  const submissionMap = useMemo(() => new Map(submissions.map((submission) => [submission.student_user_id, submission])), [submissions]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const activeClassId = (profile as any)?.class_id as string | null;
      if (!activeClassId) return;
      setClassId(activeClassId);

      const [{ data: tRows, error: tErr }, { data: pRows }, { data: cRows }, { data: caRows }, { data: iRows }] = await Promise.all([
        supabase
          .from("class_tasks")
          .select("id,task_type,title,description,due_at,audience_type,audience_id,created_at,points_possible,rubric,auto_criteria,integration_targets")
          .eq("class_id", activeClassId)
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase.from("parties").select("id,name").eq("class_id", activeClassId).order("name"),
        supabase.from("committees").select("id,name").eq("class_id", activeClassId).order("name"),
        supabase.from("caucuses").select("id,title").eq("class_id", activeClassId).order("title"),
        supabase.from("grade_integrations").select("id,provider,enabled,external_course_id,external_gradebook_id,sync_mode,status").eq("class_id", activeClassId),
      ]);
      if (tErr) throw tErr;
      const normalizedTasks = ((tRows ?? []) as any[]).map(normalizeAssignment);
      setTasks(normalizedTasks);
      setParties(((pRows ?? []) as any[]).map((party) => ({ ...party, name: displayPartyName(party.name) })));
      setCommittees((cRows ?? []) as any);
      setCaucuses(((caRows ?? []) as any[]).map((row) => ({ id: row.id, name: row.title })));

      const byProvider = new Map(((iRows ?? []) as any[]).map((row) => [row.provider, row]));
      setIntegrations(
        blankIntegrations().map((row) => {
          const saved = byProvider.get(row.provider);
          return saved
            ? {
                id: saved.id,
                provider: saved.provider,
                enabled: Boolean(saved.enabled),
                external_course_id: saved.external_course_id ?? "",
                external_gradebook_id: saved.external_gradebook_id ?? "",
                sync_mode: saved.sync_mode ?? "manual",
                status: saved.status ?? "not_connected",
              }
            : row;
        }),
      );
    } catch (e: any) {
      toast.error(e.message || "Could not load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (searchParams.get("add") === "1") setShowModal(true);
  }, [searchParams]);

  const loadReview = async (assignmentId: string) => {
    if (!classId) return;
    setReviewLoading(true);
    try {
      const [{ data: memberRows }, { data: submissionRows, error: sErr }] = await Promise.all([
        supabase
          .from("class_memberships")
          .select("user_id,role,status")
          .eq("class_id", classId)
          .eq("role", "student")
          .eq("status", "approved"),
        supabase
          .from("assignment_submissions")
          .select("id,assignment_id,class_id,student_user_id,body,attachments,auto_scores,manual_score,manual_feedback,status,submitted_at,returned_at,updated_at")
          .eq("assignment_id", assignmentId)
          .order("updated_at", { ascending: false }),
      ]);
      if (sErr) throw sErr;

      const studentIds = ((memberRows ?? []) as any[]).map((row) => row.user_id);
      const { data: profileRows } = studentIds.length
        ? await supabase.from("profiles").select("user_id,display_name").in("user_id", studentIds)
        : ({ data: [] } as any);
      const profileMap = new Map(((profileRows ?? []) as any[]).map((row) => [row.user_id, row.display_name ?? "Student"]));
      const nextStudents = studentIds
        .map((userId) => ({ user_id: userId, display_name: profileMap.get(userId) ?? "Student" }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
      const nextSubmissions = ((submissionRows ?? []) as any[]).map((row) => ({
        ...row,
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        auto_scores: row.auto_scores && typeof row.auto_scores === "object" ? row.auto_scores : {},
      })) as SubmissionRow[];
      const byStudent = new Map(nextSubmissions.map((submission) => [submission.student_user_id, submission]));
      setStudents(nextStudents);
      setSubmissions(nextSubmissions);
      setGradingDrafts(
        Object.fromEntries(
          nextStudents.map((student) => {
            const submission = byStudent.get(student.user_id);
            return [
              student.user_id,
              {
                manual_score: submission?.manual_score != null ? String(submission.manual_score) : "",
                manual_feedback: submission?.manual_feedback ?? "",
              },
            ];
          }),
        ),
      );
    } catch (e: any) {
      toast.error(e.message || "Could not load submissions");
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAssignmentId) void loadReview(selectedAssignmentId);
  }, [selectedAssignmentId, classId]);

  const targetLabel = useMemo(() => {
    const partyMap = new Map(parties.map((p) => [p.id, p.name]));
    const committeeMap = new Map(committees.map((c) => [c.id, c.name]));
    const caucusMap = new Map(caucuses.map((c) => [c.id, c.name]));
    return (t: TaskRow) => {
      if (t.audience_type === "all") return "All students";
      if (t.audience_type === "party") return `Party: ${displayPartyName(partyMap.get(t.audience_id || "") || "Unknown")}`;
      if (t.audience_type === "committee") return `Committee: ${committeeMap.get(t.audience_id || "") || "Unknown"}`;
      if (t.audience_type === "caucus") return `Caucus: ${caucusMap.get(t.audience_id || "") || "Unknown"}`;
      return t.audience_type;
    };
  }, [parties, committees, caucuses]);

  const specificOptions =
    newAudienceType === "party" ? parties : newAudienceType === "committee" ? committees : newAudienceType === "caucus" ? caucuses : [];

  const resetModal = () => {
    setShowModal(false);
    setNewTaskType("deadline");
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewDueTime("");
    setNewAudienceType("all");
    setNewAudienceId("");
    setNewPointsPossible("100");
    setRubricRows([newRubricItem()]);
    setCriteriaRows([]);
    setIntegrationTargets([]);
  };

  const handleAdd = async () => {
    if (!classId || !newTitle.trim()) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const dueAt =
        newDueDate.trim() === ""
          ? null
          : new Date(`${newDueDate}T${(newDueTime || "23:59").trim()}:00`).toISOString();

      const audienceId = newAudienceType === "all" ? null : newAudienceId || null;
      if (newAudienceType !== "all" && !audienceId) {
        toast.error("Select a target for this task");
        return;
      }

      const normalizedRubric = newTaskType === "assignment" ? normalizeRubric(rubricRows) : [];
      const normalizedCriteria = newTaskType === "assignment" ? normalizeCriteria(criteriaRows) : [];
      const { data, error } = await supabase
        .from("class_tasks")
        .insert({
          class_id: classId,
          created_by: uid,
          task_type: newTaskType,
          audience_type: newAudienceType,
          audience_id: audienceId,
          title: newTitle.trim(),
          description: newDescription.trim(),
          due_at: dueAt,
          points_possible: Math.max(0, Number(newPointsPossible) || 0),
          rubric: normalizedRubric,
          auto_criteria: normalizedCriteria,
          integration_targets: newTaskType === "assignment" ? integrationTargets : [],
        } as any)
        .select("id,task_type,title,description,due_at,audience_type,audience_id,created_at,points_possible,rubric,auto_criteria,integration_targets")
        .single();
      if (error) throw error;
      setTasks((prev) => [...prev, normalizeAssignment(data)].sort((a, b) => (a.due_at || "9999").localeCompare(b.due_at || "9999")));
      toast.success(newTaskType === "assignment" ? "Assignment created" : "Deadline created");
      resetModal();
    } catch (e: any) {
      toast.error(e.message || "Could not create task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("class_tasks").delete().eq("id", id);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedAssignmentId === id) setSelectedAssignmentId(null);
      toast.success("Task deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete task");
    }
  };

  const updateIntegration = (provider: AssignmentProvider, patch: Partial<IntegrationRow>) => {
    setIntegrations((current) => current.map((row) => (row.provider === provider ? { ...row, ...patch } : row)));
  };

  const saveIntegration = async (row: IntegrationRow) => {
    if (!classId) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const { data, error } = await supabase
        .from("grade_integrations")
        .upsert(
          {
            class_id: classId,
            provider: row.provider,
            enabled: row.enabled,
            external_course_id: row.external_course_id.trim(),
            external_gradebook_id: row.external_gradebook_id.trim(),
            sync_mode: row.sync_mode,
            status: row.enabled ? "configured" : "disabled",
            updated_by: uid,
          } as any,
          { onConflict: "class_id,provider" },
        )
        .select("id,provider,enabled,external_course_id,external_gradebook_id,sync_mode,status")
        .single();
      if (error) throw error;
      updateIntegration(row.provider, data as IntegrationRow);
      toast.success(`${providerLabel(row.provider)} saved`);
    } catch (e: any) {
      toast.error(e.message || "Could not save integration");
    }
  };

  const runAutoGrade = async (studentId?: string) => {
    if (!classId || !selectedAssignment || !selectedAssignment.auto_criteria.length) return;
    const targetStudents = studentId ? students.filter((student) => student.user_id === studentId) : students;
    if (!targetStudents.length) return;
    setAutoBusy(true);
    try {
      for (const student of targetStudents) {
        const existing = submissionMap.get(student.user_id);
        const scores = await computeAutoCriteriaScores(classId, student.user_id, selectedAssignment.auto_criteria);
        const { error } = await supabase.from("assignment_submissions").upsert(
          {
            assignment_id: selectedAssignment.id,
            class_id: classId,
            student_user_id: student.user_id,
            body: existing?.body ?? "",
            attachments: existing?.attachments ?? [],
            auto_scores: scores,
            status: existing?.status ?? "draft",
            submitted_at: existing?.submitted_at ?? null,
          } as any,
          { onConflict: "assignment_id,student_user_id" },
        );
        if (error) throw error;
      }
      await loadReview(selectedAssignment.id);
      toast.success(studentId ? "Auto-grade refreshed" : "Auto-grading complete");
    } catch (e: any) {
      toast.error(e.message || "Could not run auto-grading");
    } finally {
      setAutoBusy(false);
    }
  };

  const returnGrade = async (student: StudentRow) => {
    if (!classId || !selectedAssignment) return;
    const draft = gradingDrafts[student.user_id] ?? { manual_score: "", manual_feedback: "" };
    const score = draft.manual_score.trim() === "" ? null : Math.max(0, Number(draft.manual_score));
    if (draft.manual_score.trim() !== "" && Number.isNaN(score)) {
      toast.error("Enter a valid score");
      return;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const existing = submissionMap.get(student.user_id);
      const autoScores = selectedAssignment.auto_criteria.length
        ? existing?.auto_scores && Object.keys(existing.auto_scores).length
          ? existing.auto_scores
          : await computeAutoCriteriaScores(classId, student.user_id, selectedAssignment.auto_criteria)
        : {};
      const { error } = await supabase.from("assignment_submissions").upsert(
        {
          assignment_id: selectedAssignment.id,
          class_id: classId,
          student_user_id: student.user_id,
          body: existing?.body ?? "",
          attachments: existing?.attachments ?? [],
          auto_scores: autoScores,
          manual_score: score,
          manual_feedback: draft.manual_feedback.trim(),
          status: "returned",
          returned_at: new Date().toISOString(),
          graded_by: auth.user?.id ?? null,
          submitted_at: existing?.submitted_at ?? null,
        } as any,
        { onConflict: "assignment_id,student_user_id" },
      );
      if (error) throw error;
      await loadReview(selectedAssignment.id);
      toast.success(`Returned grade for ${student.display_name}`);
    } catch (e: any) {
      toast.error(e.message || "Could not return grade");
    }
  };

  const queueSync = async () => {
    if (!classId || !selectedAssignment) return;
    const enabledProviders = integrations.filter((row) => row.enabled && selectedAssignment.integration_targets.includes(row.provider));
    if (!enabledProviders.length) {
      toast.error("Enable and select at least one integration for this assignment");
      return;
    }
    const returned = submissions.filter((submission) => submission.status === "returned");
    if (!returned.length) {
      toast.error("No returned grades to sync");
      return;
    }
    setSyncBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const rows = enabledProviders.map((provider) => ({
        class_id: classId,
        assignment_id: selectedAssignment.id,
        provider: provider.provider,
        status: "queued",
        message: `${returned.length} returned grade${returned.length === 1 ? "" : "s"} queued from Gavel.`,
        payload: {
          assignment: { id: selectedAssignment.id, title: selectedAssignment.title, points_possible: selectedAssignment.points_possible },
          external_course_id: provider.external_course_id,
          external_gradebook_id: provider.external_gradebook_id,
          grades: returned.map((submission) => ({
            student_user_id: submission.student_user_id,
            score: submission.manual_score ?? autoScoreTotal(submission.auto_scores),
            feedback: submission.manual_feedback,
          })),
        },
        created_by: auth.user?.id ?? null,
      }));
      const { error } = await supabase.from("assignment_sync_logs").insert(rows as any);
      if (error) throw error;
      toast.success("Returned grades queued for sync");
    } catch (e: any) {
      toast.error(e.message || "Could not queue sync");
    } finally {
      setSyncBusy(false);
    }
  };

  const toggleCriteria = (id: string) => {
    setCriteriaRows((current) => (current.some((row) => row.id === id) ? current.filter((row) => row.id !== id) : [...current, criterionFromOption(id)]));
  };

  const toggleIntegrationTarget = (provider: AssignmentProvider) => {
    setIntegrationTargets((current) => (current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]));
  };

  const assignmentCount = tasks.filter((task) => task.task_type === "assignment").length;
  const deadlineCount = tasks.filter((task) => task.task_type === "deadline").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
            <p className="mt-1 text-gray-600">Create deadlines, attach rubrics, auto-grade quantitative requirements, and return feedback.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Add Assignment
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-500">Assignments</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{assignmentCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-500">Deadlines</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{deadlineCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-500">Gradebook integrations</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{integrations.filter((row) => row.enabled).length}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section>
            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading...</div>
            ) : tasks.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <h3 className="mb-1 text-lg font-medium text-gray-900">No tasks yet</h3>
                <p className="text-gray-600">Create an assignment with a rubric or add a deadline for students.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const isAssignment = task.task_type === "assignment";
                  return (
                    <article key={task.id} className="rounded-lg border border-gray-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded px-2 py-1 text-xs font-semibold ${isAssignment ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                              {isAssignment ? "Assignment" : "Deadline"}
                            </span>
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{targetLabel(task)}</span>
                            {isAssignment ? (
                              <span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{task.points_possible} pts</span>
                            ) : null}
                          </div>
                          <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
                          {task.description ? <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{task.description}</p> : null}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDateTime(task.due_at)}
                            </span>
                            {isAssignment ? (
                              <>
                                <span>{task.rubric.length} rubric item{task.rubric.length === 1 ? "" : "s"}</span>
                                <span>{task.auto_criteria.length} auto requirement{task.auto_criteria.length === 1 ? "" : "s"}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {isAssignment ? (
                            <button
                              onClick={() => setSelectedAssignmentId(task.id)}
                              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                selectedAssignmentId === task.id ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              Review
                            </button>
                          ) : null}
                          <button onClick={() => void handleDelete(task.id)} className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Gradebook integrations</h2>
              </div>
              <div className="space-y-4">
                {integrations.map((row) => {
                  const provider = PROVIDERS.find((item) => item.id === row.provider)!;
                  return (
                    <div key={row.provider} className="rounded-md border border-gray-200 p-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(event) => updateIntegration(row.provider, { enabled: event.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900">{provider.label}</span>
                          <span className="block text-xs text-gray-500">{provider.description}</span>
                        </span>
                      </label>
                      <div className="mt-3 grid gap-2">
                        <input
                          value={row.external_course_id}
                          onChange={(event) => updateIntegration(row.provider, { external_course_id: event.target.value })}
                          placeholder="Course or section ID"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          value={row.external_gradebook_id}
                          onChange={(event) => updateIntegration(row.provider, { external_gradebook_id: event.target.value })}
                          placeholder="Gradebook column ID"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={row.sync_mode}
                          onChange={(event) => updateIntegration(row.provider, { sync_mode: event.target.value as IntegrationRow["sync_mode"] })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="manual">Manual sync</option>
                          <option value="auto_returned">Auto-sync returned grades</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void saveIntegration(row)}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Save {provider.label}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {selectedAssignment ? (
              <section className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Review: {selectedAssignment.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {submissions.filter((submission) => submission.status === "submitted" || submission.status === "returned").length} of {students.length} students have a submission.
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedAssignmentId(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runAutoGrade()}
                    disabled={autoBusy || !selectedAssignment.auto_criteria.length}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${autoBusy ? "animate-spin" : ""}`} />
                    Run auto-grading
                  </button>
                  <button
                    type="button"
                    onClick={() => void queueSync()}
                    disabled={syncBusy}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CloudUpload className="h-4 w-4" />
                    Sync returned grades
                  </button>
                </div>
                {reviewLoading ? (
                  <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-600">Loading submissions...</div>
                ) : (
                  <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                    {students.map((student) => {
                      const submission = submissionMap.get(student.user_id);
                      const draft = gradingDrafts[student.user_id] ?? { manual_score: "", manual_feedback: "" };
                      const autoTotal = autoScoreTotal(submission?.auto_scores);
                      return (
                        <div key={student.user_id} className="rounded-md border border-gray-200 p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{student.display_name}</div>
                              <div className="text-xs text-gray-500">
                                {submission?.status === "returned"
                                  ? `Returned${submission.returned_at ? ` ${new Date(submission.returned_at).toLocaleDateString()}` : ""}`
                                  : submission?.status === "submitted"
                                    ? `Submitted${submission.submitted_at ? ` ${new Date(submission.submitted_at).toLocaleDateString()}` : ""}`
                                    : submission
                                      ? "Auto-grade draft"
                                      : "Not submitted"}
                              </div>
                            </div>
                            <button type="button" onClick={() => void runAutoGrade(student.user_id)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Refresh auto-grade">
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </div>
                          {selectedAssignment.auto_criteria.length ? (
                            <div className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
                              <div className="mb-1 font-semibold text-gray-900">Auto score: {autoTotal} pts</div>
                              <div className="space-y-1">
                                {selectedAssignment.auto_criteria.map((criterion) => {
                                  const score = submission?.auto_scores?.[criterion.id];
                                  return (
                                    <div key={criterion.id} className="flex items-center justify-between gap-3">
                                      <span>{autoCriteriaLabel(criterion.id)}</span>
                                      <span className={score?.complete ? "font-semibold text-green-700" : "text-gray-500"}>
                                        {score ? `${score.value}/${score.target} - ${score.earned}/${score.points}` : `0/${criterion.target} - 0/${criterion.points}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {submission?.body ? <p className="mb-3 whitespace-pre-line rounded-md bg-gray-50 p-2 text-sm text-gray-700">{submission.body}</p> : null}
                          {submission?.attachments?.length ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {submission.attachments.map((attachment) => (
                                <Link key={attachment.id} to={attachment.href} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                                  {attachment.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                          <div className="grid gap-2">
                            <input
                              value={draft.manual_score}
                              onChange={(event) => setGradingDrafts((current) => ({ ...current, [student.user_id]: { ...draft, manual_score: event.target.value } }))}
                              placeholder={`Score out of ${selectedAssignment.points_possible}`}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <textarea
                              value={draft.manual_feedback}
                              onChange={(event) => setGradingDrafts((current) => ({ ...current, [student.user_id]: { ...draft, manual_feedback: event.target.value } }))}
                              rows={2}
                              placeholder="Feedback for the student"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => void returnGrade(student)}
                              className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                            >
                              <Send className="h-4 w-4" />
                              Return grade
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {students.length === 0 ? <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No students are enrolled yet.</div> : null}
                  </div>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Add task</h2>
              </div>
              <button onClick={resetModal} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Type</span>
                  <select
                    value={newTaskType}
                    onChange={(event) => setNewTaskType(event.target.value as TaskType)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="deadline">Deadline</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Points possible</span>
                  <input
                    type="number"
                    min="0"
                    value={newPointsPossible}
                    onChange={(event) => setNewPointsPossible(event.target.value)}
                    disabled={newTaskType !== "assignment"}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="e.g., Bill draft and committee memo"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                <textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  rows={4}
                  placeholder="Instructions, resources, and what students should submit."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Due Date</span>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(event) => setNewDueDate(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Due Time</span>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(event) => setNewDueTime(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">Assigned to</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "party", "committee", "caucus"] as AudienceType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewAudienceType(type);
                        setNewAudienceId("");
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        newAudienceType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type === "all" ? "All students" : type === "party" ? "Parties" : type === "committee" ? "Committees" : "Caucuses"}
                    </button>
                  ))}
                </div>
              </div>

              {newAudienceType !== "all" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Target</span>
                  <select
                    value={newAudienceId}
                    onChange={(event) => setNewAudienceId(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose...</option>
                    {specificOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {newTaskType === "assignment" ? (
                <>
                  <section className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">Rubric</h3>
                        <p className="text-sm text-gray-600">Students can see these criteria before they submit.</p>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{rubricTotal(normalizeRubric(rubricRows))} pts</span>
                    </div>
                    <div className="space-y-3">
                      {rubricRows.map((item, index) => (
                        <div key={item.id} className="grid gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-[1fr_88px_auto]">
                          <input
                            value={item.title}
                            onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))}
                            placeholder={`Criterion ${index + 1}`}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.points}
                            onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, points: Math.max(0, Number(event.target.value) || 0) } : row)))}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button type="button" onClick={() => setRubricRows((rows) => rows.filter((row) => row.id !== item.id))} className="rounded-md p-2 text-gray-500 hover:bg-white">
                            <X className="h-4 w-4" />
                          </button>
                          <textarea
                            value={item.description}
                            onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, description: event.target.value } : row)))}
                            placeholder="What earns credit for this criterion?"
                            rows={2}
                            className="sm:col-span-3 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setRubricRows((rows) => [...rows, newRubricItem()])} className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Plus className="h-4 w-4" />
                      Add rubric item
                    </button>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900">Auto-grade requirements</h3>
                    <p className="mt-1 text-sm text-gray-600">Choose quantitative simulation actions Gavel should score.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {AUTO_CRITERIA_OPTIONS.map((option) => {
                        const selected = criteriaRows.find((row) => row.id === option.id);
                        return (
                          <div key={option.id} className={`rounded-md border p-3 ${selected ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={Boolean(selected)}
                                onChange={() => toggleCriteria(option.id)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>
                                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                                <span className="block text-xs text-gray-600">{option.description}</span>
                              </span>
                            </label>
                            {selected ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium text-gray-600">Target</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selected.target}
                                    onChange={(event) => setCriteriaRows((rows) => rows.map((row) => (row.id === option.id ? { ...row, target: Math.max(1, Number(event.target.value) || 1) } : row)))}
                                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium text-gray-600">Points</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={selected.points}
                                    onChange={(event) => setCriteriaRows((rows) => rows.map((row) => (row.id === option.id ? { ...row, points: Math.max(0, Number(event.target.value) || 0) } : row)))}
                                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900">Sync targets</h3>
                    <p className="mt-1 text-sm text-gray-600">Returned grades can be queued for these configured gradebook integrations.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {PROVIDERS.map((provider) => (
                        <label key={provider.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={integrationTargets.includes(provider.id)}
                            onChange={() => toggleIntegrationTarget(provider.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {provider.label}
                        </label>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
              <button onClick={resetModal} className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={!newTitle.trim()}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add {newTaskType === "assignment" ? "Assignment" : "Deadline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
