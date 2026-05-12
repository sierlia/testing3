import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Calendar,
  ClipboardCheck,
  CloudUpload,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
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
  PROVIDER_INTEGRATION_FIELDS,
  PROVIDERS,
  RubricItem,
  autoCriteriaLabel,
  autoCriteriaTotal,
  autoScoreTotal,
  rubricTotal,
} from "../services/assignments";

type AudienceType = AssignmentTask["audience_type"];
type GradingMode = AssignmentTask["grading_mode"];
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
  settings: Record<string, string>;
};

const assignmentSelect =
  "id,task_type,title,description,due_at,audience_type,audience_id,audience_user_ids,created_at,points_possible,grading_mode,manual_submission_required,rubric,auto_criteria,integration_targets";

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

function localDateInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTimeInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sortAssignments(rows: TaskRow[]) {
  return [...rows].sort((a, b) => {
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}

function providerLabel(provider: AssignmentProvider) {
  return PROVIDERS.find((item) => item.id === provider)?.label ?? provider;
}

function externalCourseIdFor(row: IntegrationRow) {
  const settings = row.settings ?? {};
  return String(settings.courseId || settings.sectionId || settings.classSourcedId || settings.sectionSourcedId || row.external_course_id || "");
}

function externalGradebookIdFor(row: IntegrationRow) {
  const settings = row.settings ?? {};
  return String(settings.courseWorkId || settings.assignmentId || settings.lineItemSourcedId || row.external_gradebook_id || "");
}

function blankIntegrations(): IntegrationRow[] {
  return PROVIDERS.map((provider) => ({
    provider: provider.id,
    enabled: false,
    external_course_id: "",
    external_gradebook_id: "",
    sync_mode: "manual",
    status: "not_connected",
    settings: {},
  }));
}

function appliesToStudent(task: TaskRow, student: StudentRow) {
  if (task.audience_type === "all") return true;
  if (task.audience_type === "selected_students") return task.audience_user_ids.includes(student.user_id);
  return true;
}

export function TeacherDeadlines() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [assignmentReviewTab, setAssignmentReviewTab] = useState<"submissions" | "rubric">("submissions");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [gradingDrafts, setGradingDrafts] = useState<Record<string, GradeDraft>>({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showSyncReview, setShowSyncReview] = useState(false);
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({});
  const [integrations, setIntegrations] = useState<IntegrationRow[]>(blankIntegrations());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newAudienceType, setNewAudienceType] = useState<AudienceType>("all");
  const [newAudienceId, setNewAudienceId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradingMode, setGradingMode] = useState<GradingMode>("manual");
  const [manualSubmissionRequired, setManualSubmissionRequired] = useState(true);
  const [newPointsPossible, setNewPointsPossible] = useState("100");
  const [rubricRows, setRubricRows] = useState<RubricItem[]>([newRubricItem()]);
  const [criteriaRows, setCriteriaRows] = useState<AutoCriteriaConfig[]>([]);

  const [parties, setParties] = useState<OrgOption[]>([]);
  const [committees, setCommittees] = useState<OrgOption[]>([]);
  const [caucuses, setCaucuses] = useState<OrgOption[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedAssignment = useMemo(
    () => tasks.find((task) => task.id === selectedAssignmentId) ?? null,
    [selectedAssignmentId, tasks],
  );
  const assignedStudents = useMemo(
    () => selectedAssignment ? students.filter((student) => appliesToStudent(selectedAssignment, student)) : [],
    [selectedAssignment, students],
  );
  const submissionMap = useMemo(() => new Map(submissions.map((submission) => [submission.student_user_id, submission])), [submissions]);
  const returnedSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "returned" && assignedStudents.some((student) => student.user_id === submission.student_user_id)),
    [assignedStudents, submissions],
  );

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

      const [
        { data: tRows, error: tErr },
        { data: pRows },
        { data: cRows },
        { data: caRows },
        { data: iRows },
        { data: memberRows },
      ] = await Promise.all([
        supabase
          .from("class_tasks")
          .select(assignmentSelect)
          .eq("class_id", activeClassId)
          .eq("task_type", "assignment")
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase.from("parties").select("id,name").eq("class_id", activeClassId).order("name"),
        supabase.from("committees").select("id,name").eq("class_id", activeClassId).order("name"),
        supabase.from("caucuses").select("id,title").eq("class_id", activeClassId).order("title"),
        supabase.from("grade_integrations").select("id,provider,enabled,external_course_id,external_gradebook_id,sync_mode,status,settings").eq("class_id", activeClassId),
        supabase
          .from("class_memberships")
          .select("user_id,role,status")
          .eq("class_id", activeClassId)
          .eq("role", "student")
          .eq("status", "approved"),
      ]);
      if (tErr) throw tErr;
      const normalizedTasks = sortAssignments(((tRows ?? []) as any[]).map(normalizeAssignment));
      setTasks(normalizedTasks);
      setParties(((pRows ?? []) as any[]).map((party) => ({ ...party, name: displayPartyName(party.name) })));
      setCommittees((cRows ?? []) as any);
      setCaucuses(((caRows ?? []) as any[]).map((row) => ({ id: row.id, name: row.title })));

      const studentIds = ((memberRows ?? []) as any[]).map((row) => row.user_id);
      const { data: profileRows } = studentIds.length
        ? await supabase.from("profiles").select("user_id,display_name").in("user_id", studentIds)
        : ({ data: [] } as any);
      const profileMap = new Map(((profileRows ?? []) as any[]).map((row) => [row.user_id, row.display_name ?? "Student"]));
      setStudents(
        studentIds
          .map((userId) => ({ user_id: userId, display_name: profileMap.get(userId) ?? "Student" }))
          .sort((a, b) => a.display_name.localeCompare(b.display_name)),
      );

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
                settings: saved.settings && typeof saved.settings === "object" ? saved.settings : {},
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
    if (searchParams.get("add") === "1") openCreateModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!tasks.length) {
      setSelectedAssignmentId(null);
      return;
    }
    const routeTask = assignmentId && tasks.some((task) => task.id === assignmentId) ? assignmentId : null;
    const next = routeTask ?? selectedAssignmentId ?? tasks[0]?.id ?? null;
    setSelectedAssignmentId(next);
  }, [assignmentId, selectedAssignmentId, tasks]);

  useEffect(() => {
    if (selectedAssignmentId) void loadReview(selectedAssignmentId);
    else {
      setSubmissions([]);
      setGradingDrafts({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignmentId, classId]);

  useEffect(() => {
    if (!activeMenuId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setActiveMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [activeMenuId]);

  const loadReview = async (assignmentIdToLoad: string) => {
    if (!classId) return;
    setReviewLoading(true);
    try {
      const { data: submissionRows, error: sErr } = await supabase
        .from("assignment_submissions")
        .select("id,assignment_id,class_id,student_user_id,body,attachments,auto_scores,manual_score,manual_feedback,status,submitted_at,returned_at,updated_at")
        .eq("assignment_id", assignmentIdToLoad)
        .order("updated_at", { ascending: false });
      if (sErr) throw sErr;

      const nextSubmissions = ((submissionRows ?? []) as any[]).map((row) => ({
        ...row,
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        auto_scores: row.auto_scores && typeof row.auto_scores === "object" ? row.auto_scores : {},
      })) as SubmissionRow[];
      const byStudent = new Map(nextSubmissions.map((submission) => [submission.student_user_id, submission]));
      setSubmissions(nextSubmissions);
      setGradingDrafts(
        Object.fromEntries(
          students.map((student) => {
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

  const targetLabel = useMemo(() => {
    const partyMap = new Map(parties.map((p) => [p.id, p.name]));
    const committeeMap = new Map(committees.map((c) => [c.id, c.name]));
    const caucusMap = new Map(caucuses.map((c) => [c.id, c.name]));
    return (t: TaskRow) => {
      if (t.audience_type === "all") return "All students";
      if (t.audience_type === "selected_students") return `${t.audience_user_ids.length} selected student${t.audience_user_ids.length === 1 ? "" : "s"}`;
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
    setEditingTaskId(null);
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewDueTime("");
    setNewAudienceType("all");
    setNewAudienceId("");
    setSelectedStudentIds([]);
    setGradingMode("manual");
    setManualSubmissionRequired(true);
    setNewPointsPossible("100");
    setRubricRows([newRubricItem()]);
    setCriteriaRows([]);
  };

  const openCreateModal = () => {
    resetModal();
    setShowModal(true);
  };

  const openEditModal = (task: TaskRow) => {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewDescription(task.description);
    setNewDueDate(localDateInput(task.due_at));
    setNewDueTime(localTimeInput(task.due_at));
    setNewAudienceType(task.audience_type);
    setNewAudienceId(task.audience_id ?? "");
    setSelectedStudentIds(task.audience_user_ids ?? []);
    setGradingMode(task.grading_mode);
    setManualSubmissionRequired(task.manual_submission_required);
    setNewPointsPossible(String(task.points_possible ?? 100));
    setRubricRows(task.rubric.length ? task.rubric : [newRubricItem()]);
    setCriteriaRows(task.auto_criteria);
    setActiveMenuId(null);
    setShowModal(true);
  };

  const toggleSelectedStudent = (userId: string) => {
    setSelectedStudentIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const handleSaveAssignment = async () => {
    if (!classId || !newTitle.trim()) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const dueAt =
        newDueDate.trim() === ""
          ? null
          : new Date(`${newDueDate}T${(newDueTime || "23:59").trim()}:00`).toISOString();

      const audienceId = newAudienceType === "all" || newAudienceType === "selected_students" ? null : newAudienceId || null;
      if (newAudienceType !== "all" && newAudienceType !== "selected_students" && !audienceId) {
        toast.error("Select a target for this assignment");
        return;
      }
      if (newAudienceType === "selected_students" && selectedStudentIds.length === 0) {
        toast.error("Select at least one student");
        return;
      }

      const normalizedRubric = gradingMode === "manual" ? normalizeRubric(rubricRows) : [];
      const normalizedCriteria = gradingMode === "auto" ? normalizeCriteria(criteriaRows) : [];
      if (gradingMode === "auto" && normalizedCriteria.length === 0) {
        toast.error("Choose at least one auto-graded rubric requirement");
        return;
      }
      const pointsPossible = gradingMode === "auto" ? autoCriteriaTotal(normalizedCriteria) : Math.max(0, Number(newPointsPossible) || 0);

      const payload = {
        class_id: classId,
        created_by: uid,
        task_type: "assignment",
        audience_type: newAudienceType,
        audience_id: audienceId,
        audience_user_ids: newAudienceType === "selected_students" ? selectedStudentIds : [],
        title: newTitle.trim(),
        description: newDescription.trim(),
        due_at: dueAt,
        points_possible: pointsPossible,
        grading_mode: gradingMode,
        manual_submission_required: manualSubmissionRequired,
        rubric: normalizedRubric,
        auto_criteria: normalizedCriteria,
        integration_targets: [],
      } as any;

      const query = editingTaskId
        ? supabase.from("class_tasks").update(payload).eq("id", editingTaskId).select(assignmentSelect).single()
        : supabase.from("class_tasks").insert(payload).select(assignmentSelect).single();
      const { data, error } = await query;
      if (error) throw error;
      const saved = normalizeAssignment(data);
      setTasks((prev) => sortAssignments(editingTaskId ? prev.map((task) => (task.id === saved.id ? saved : task)) : [...prev, saved]));
      setSelectedAssignmentId(saved.id);
      navigate(`/assignments/${saved.id}`);
      toast.success(editingTaskId ? "Assignment updated" : "Assignment created");
      resetModal();
    } catch (e: any) {
      toast.error(e.message || "Could not save assignment");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("class_tasks").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      const nextTasks = tasks.filter((task) => task.id !== deleteTarget.id);
      setTasks(nextTasks);
      setDeleteTarget(null);
      setActiveMenuId(null);
      if (selectedAssignmentId === deleteTarget.id) {
        const next = sortAssignments(nextTasks)[0]?.id ?? null;
        setSelectedAssignmentId(next);
        navigate(next ? `/assignments/${next}` : "/assignments");
      }
      toast.success("Assignment deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete assignment");
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
            external_course_id: externalCourseIdFor(row).trim(),
            external_gradebook_id: externalGradebookIdFor(row).trim(),
            sync_mode: row.sync_mode,
            status: row.enabled ? "configured" : "disabled",
            settings: row.settings ?? {},
            updated_by: uid,
          } as any,
          { onConflict: "class_id,provider" },
        )
        .select("id,provider,enabled,external_course_id,external_gradebook_id,sync_mode,status,settings")
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
    const targetStudents = studentId ? assignedStudents.filter((student) => student.user_id === studentId) : assignedStudents;
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

  const openSyncReview = () => {
    if (!returnedSubmissions.length) {
      toast.error("No returned grades to sync");
      return;
    }
    if (!integrations.some((row) => row.enabled)) {
      toast.error("Enable at least one gradebook integration");
      return;
    }
    setSyncSelection(Object.fromEntries(returnedSubmissions.map((submission) => [submission.id, true])));
    setShowSyncReview(true);
  };

  const queueSync = async () => {
    if (!classId || !selectedAssignment) return;
    const enabledProviders = integrations.filter((row) => row.enabled);
    if (!enabledProviders.length) {
      toast.error("Enable at least one integration");
      return;
    }
    const selectedReturned = returnedSubmissions.filter((submission) => syncSelection[submission.id]);
    if (!selectedReturned.length) {
      toast.error("Select at least one grade to sync");
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
        message: `${selectedReturned.length} returned grade${selectedReturned.length === 1 ? "" : "s"} queued from Gavel.`,
        payload: {
          assignment: { id: selectedAssignment.id, title: selectedAssignment.title, points_possible: selectedAssignment.points_possible },
          external_course_id: externalCourseIdFor(provider),
          external_gradebook_id: externalGradebookIdFor(provider),
          integration_settings: provider.settings ?? {},
          grades: selectedReturned.map((submission) => ({
            student_user_id: submission.student_user_id,
            score: submission.manual_score ?? autoScoreTotal(submission.auto_scores),
            feedback: submission.manual_feedback,
          })),
        },
        created_by: auth.user?.id ?? null,
      }));
      const { error } = await supabase.from("assignment_sync_logs").insert(rows as any);
      if (error) throw error;
      setShowSyncReview(false);
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

  const allSyncSelected = returnedSubmissions.length > 0 && returnedSubmissions.every((submission) => syncSelection[submission.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
            <p className="mt-1 text-gray-600">Create assignments, attach rubrics, auto-grade simulation work, and return feedback.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowIntegrations(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" />
            Gradebook integrations
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <h2 className="text-base font-semibold text-gray-900">Assignments</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Assignment
                </button>
              </div>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-gray-600">Loading assignments...</div>
            ) : tasks.length === 0 ? (
              <div className="p-10 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <h3 className="mb-1 text-base font-medium text-gray-900">No assignments yet</h3>
                <p className="text-sm text-gray-600">Create the first assignment for this class.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tasks.map((task) => {
                  const selected = selectedAssignmentId === task.id;
                  return (
                    <article key={task.id} className={`group relative ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssignmentId(task.id);
                          navigate(`/assignments/${task.id}`);
                        }}
                        className="block w-full px-4 py-3 text-left"
                      >
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{task.title}</h3>
                          <span className="mr-8 shrink-0 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700">{task.points_possible} pts</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{formatDateTime(task.due_at)}</span>
                          <span aria-hidden="true">|</span>
                          <span>{targetLabel(task)}</span>
                        </div>
                      </button>
                      <div className="absolute right-2 top-2" ref={activeMenuId === task.id ? menuRef : null}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveMenuId((current) => (current === task.id ? null : task.id));
                          }}
                          className="rounded-md p-1.5 text-gray-500 opacity-100 hover:bg-white hover:text-gray-900"
                          aria-label="Assignment actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {activeMenuId === task.id ? (
                          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                            <button type="button" onClick={() => openEditModal(task)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(task);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-w-0">
            {selectedAssignment ? (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{selectedAssignment.grading_mode === "auto" ? "Auto-graded" : "Manual grading"}</span>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{targetLabel(selectedAssignment)}</span>
                      </div>
                      <h2 className="text-2xl font-semibold text-gray-900">{selectedAssignment.title}</h2>
                      {selectedAssignment.description ? <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{selectedAssignment.description}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-sm text-gray-600">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDateTime(selectedAssignment.due_at)}
                      </span>
                      <span className="font-medium text-gray-900">{selectedAssignment.points_possible} points possible</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
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
                      onClick={openSyncReview}
                      disabled={!returnedSubmissions.length}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CloudUpload className="h-4 w-4" />
                      Review sync ({returnedSubmissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedAssignment)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit assignment
                    </button>
                  </div>
                </div>

                <div className="border-b border-gray-200 px-5 pt-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignmentReviewTab("submissions")}
                      className={`rounded-t-md px-3 py-2 text-sm font-medium ${assignmentReviewTab === "submissions" ? "border border-b-white border-gray-200 bg-white text-blue-700" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      Student submissions
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentReviewTab("rubric")}
                      className={`rounded-t-md px-3 py-2 text-sm font-medium ${assignmentReviewTab === "rubric" ? "border border-b-white border-gray-200 bg-white text-blue-700" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      Auto-graded rubric
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  {assignmentReviewTab === "submissions" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900">Student submissions</h3>
                      <span className="text-sm text-gray-500">
                        {submissions.filter((submission) => submission.status === "submitted" || submission.status === "returned").length} of {assignedStudents.length}
                      </span>
                    </div>
                    {reviewLoading ? (
                      <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-600">Loading submissions...</div>
                    ) : assignedStudents.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">No students are assigned to this assignment.</div>
                    ) : (
                      <div className="max-h-[780px] space-y-3 overflow-y-auto pr-1">
                        {assignedStudents.map((student) => {
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
                                            {score ? `${score.value}/${score.target} - ${score.earned}/${score.points * score.target}` : `0/${criterion.target} - 0/${criterion.points * criterion.target}`}
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
                      </div>
                    )}
                  </div>
                  ) : (
                  <aside className="max-w-3xl space-y-4">
                    {selectedAssignment.rubric.length ? (
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Rubric</h3>
                          <span className="text-sm font-medium text-gray-600">{rubricTotal(selectedAssignment.rubric)} pts</span>
                        </div>
                        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                          {selectedAssignment.rubric.map((item) => (
                            <div key={item.id} className="p-3">
                              <div className="flex justify-between gap-3">
                                <h4 className="font-semibold text-gray-900">{item.title || "Rubric item"}</h4>
                                <span className="text-sm font-semibold text-gray-700">{item.points} pts</span>
                              </div>
                              {item.description ? <p className="mt-1 text-sm text-gray-600">{item.description}</p> : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {selectedAssignment.auto_criteria.length ? (
                      <section>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Auto-graded rubric</h3>
                        <div className="space-y-2">
                          {selectedAssignment.auto_criteria.map((criterion) => (
                            <div key={criterion.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                              <div className="font-medium text-gray-900">{autoCriteriaLabel(criterion.id)}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                {criterion.target} required, {criterion.points} point{criterion.points === 1 ? "" : "s"} each
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </aside>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">Select an assignment to review.</div>
            )}
          </section>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">{editingTaskId ? "Edit assignment" : "Add assignment"}</h2>
              </div>
              <button onClick={resetModal} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Bill draft and committee memo"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">Assigned to</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "selected_students", "party", "committee", "caucus"] as AudienceType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewAudienceType(type);
                        setNewAudienceId("");
                        if (type !== "selected_students") setSelectedStudentIds([]);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        newAudienceType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type === "all" ? "All students" : type === "selected_students" ? "Select students" : type === "party" ? "Parties" : type === "committee" ? "Committees" : "Caucuses"}
                    </button>
                  ))}
                </div>
              </div>

              {newAudienceType !== "all" && newAudienceType !== "selected_students" ? (
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

              {newAudienceType === "selected_students" ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-medium text-gray-700">Students</div>
                  <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                    {students.map((student) => (
                      <label key={student.user_id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.user_id)}
                          onChange={() => toggleSelectedStudent(student.user_id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{student.display_name}</span>
                      </label>
                    ))}
                    {students.length === 0 ? <div className="p-2 text-sm text-gray-500">No approved students yet.</div> : null}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Due date</span>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(event) => setNewDueDate(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Due time</span>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(event) => setNewDueTime(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                <textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  rows={4}
                  placeholder="Instructions, resources, and what students should submit."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <section className="rounded-lg border border-gray-200 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Grading</h3>
                    <p className="text-sm text-gray-600">Choose whether this assignment is graded by a manual rubric or quantitative simulation requirements.</p>
                  </div>
                  {gradingMode === "manual" ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">Points possible</span>
                      <input
                        type="number"
                        min="0"
                        value={newPointsPossible}
                        onChange={(event) => setNewPointsPossible(event.target.value)}
                        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  ) : (
                    <div className="text-right text-sm text-gray-600">
                      <span className="block text-xs font-medium text-gray-500">Total</span>
                      <span className="font-semibold text-gray-900">{autoCriteriaTotal(normalizeCriteria(criteriaRows))} pts</span>
                    </div>
                  )}
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(["manual", "auto"] as GradingMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGradingMode(mode)}
                      className={`rounded-md px-3 py-2 text-sm font-medium ${gradingMode === mode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {mode === "manual" ? "Manual grading" : "Auto-grading"}
                    </button>
                  ))}
                </div>
                <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={manualSubmissionRequired}
                    onChange={(event) => setManualSubmissionRequired(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Student must manually submit this assignment
                </label>

                {gradingMode === "manual" ? (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">Rubric</h4>
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
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-3"
                          />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setRubricRows((rows) => [...rows, newRubricItem()])} className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Plus className="h-4 w-4" />
                      Add rubric item
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-gray-900">Auto-graded rubric requirements</h4>
                      <span className="text-sm font-medium text-gray-600">{autoCriteriaTotal(normalizeCriteria(criteriaRows))} pts</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">Set the number required and points earned for each completed item.</p>
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
                                  <span className="mb-1 block text-xs font-medium text-gray-600">#</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selected.target}
                                    onChange={(event) => setCriteriaRows((rows) => rows.map((row) => (row.id === option.id ? { ...row, target: Math.max(1, Number(event.target.value) || 1) } : row)))}
                                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium text-gray-600">Points per #</span>
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
                  </>
                )}
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
              <button onClick={resetModal} className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
                Cancel
              </button>
              <button
                onClick={() => void handleSaveAssignment()}
                disabled={!newTitle.trim()}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {editingTaskId ? "Save assignment" : "Add assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIntegrations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Gradebook integrations</h2>
              </div>
              <button type="button" onClick={() => setShowIntegrations(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              {integrations.map((row) => {
                const provider = PROVIDERS.find((item) => item.id === row.provider)!;
                const fields = PROVIDER_INTEGRATION_FIELDS[row.provider] ?? [];
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
                      {fields.map((field) => (
                        <label key={field.key} className="block">
                          <span className="mb-1 block text-xs font-semibold text-gray-700">
                            {field.label}
                            {field.secret ? " (secret reference)" : ""}
                          </span>
                          {field.type === "select" ? (
                            <select
                              value={row.settings?.[field.key] ?? ""}
                              onChange={(event) => updateIntegration(row.provider, { settings: { ...(row.settings ?? {}), [field.key]: event.target.value } })}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">{field.placeholder}</option>
                              {(field.options ?? []).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={row.settings?.[field.key] ?? ""}
                              onChange={(event) => updateIntegration(row.provider, { settings: { ...(row.settings ?? {}), [field.key]: event.target.value } })}
                              placeholder={field.placeholder}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                          {field.description ? <span className="mt-1 block text-xs leading-4 text-gray-500">{field.description}</span> : null}
                        </label>
                      ))}
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
          </div>
        </div>
      )}

      {showSyncReview && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Review grade sync</h2>
                <p className="mt-1 text-sm text-gray-600">Choose which returned grades should be queued for the configured gradebook integrations.</p>
              </div>
              <button type="button" onClick={() => setShowSyncReview(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={allSyncSelected}
                  onChange={(event) => setSyncSelection(Object.fromEntries(returnedSubmissions.map((submission) => [submission.id, event.target.checked])))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {selectedAssignment.title}
              </label>
              <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
                {returnedSubmissions.map((submission) => {
                  const student = students.find((row) => row.user_id === submission.student_user_id);
                  return (
                    <label key={submission.id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(syncSelection[submission.id])}
                          onChange={(event) => setSyncSelection((current) => ({ ...current, [submission.id]: event.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate font-medium text-gray-900">{student?.display_name ?? "Student"}</span>
                      </span>
                      <span className="text-gray-600">{submission.manual_score ?? autoScoreTotal(submission.auto_scores)}/{selectedAssignment.points_possible}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-5">
              <button type="button" onClick={() => setShowSyncReview(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void queueSync()} disabled={syncBusy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {syncBusy ? "Queuing..." : "Post sync"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete assignment?</h2>
            <p className="mt-2 text-sm text-gray-600">This will remove "{deleteTarget.title}" and its submissions. This cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void handleDeleteConfirmed()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
