import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Calendar, CheckCircle2, FileText, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { AttachmentList } from "../components/DiscussionAttachments";
import { supabase } from "../utils/supabase";
import {
  AssignmentTask,
  AttachmentOption,
  AutoCriteriaConfig,
  AutoCriteriaResult,
  computeAutoCriteriaScores,
  loadAttachmentOptions,
  normalizeAssignment,
  autoScoreTotal,
  rubricTotal,
} from "../services/assignments";
import { useAuth } from "../utils/AuthContext";
import { TeacherDeadlines } from "./TeacherDeadlines";

type SubmissionRow = {
  id: string;
  assignment_id: string;
  body: string;
  attachments: AttachmentOption[];
  auto_scores: Record<string, AutoCriteriaResult>;
  manual_score: number | null;
  manual_feedback: string;
  status: "draft" | "submitted" | "returned";
  submitted_at: string | null;
  returned_at: string | null;
};
type DraftState = { body: string; attachmentIds: string[] };
type AssignmentTab = "upcoming" | "submitted" | "returned";

const assignmentSelect =
  "id,task_type,title,description,due_at,audience_type,audience_id,audience_user_ids,created_at,points_possible,grading_mode,manual_submission_required,allow_late_submissions,rubric,auto_criteria,attachments,integration_targets";

function formatDateTime(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function scoreText(task: AssignmentTask, submission?: SubmissionRow) {
  const autoTotal = autoScoreTotal(submission?.auto_scores);
  if (submission?.manual_score != null) return `${submission.manual_score}/${task.points_possible}`;
  if (autoTotal > 0) return `${autoTotal}/${task.points_possible}`;
  return `${task.points_possible} pts`;
}

function sortAssignments(rows: AssignmentTask[]) {
  return [...rows].sort((a, b) => {
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function limitWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
}

function preferredAttachmentIds(criteria: AutoCriteriaConfig[], options: AttachmentOption[]) {
  const ids = new Set<string>();
  for (const criterion of criteria) {
    const target = Math.max(1, Number(criterion.target) || 1);
    const type =
      criterion.id === "write_bills"
        ? "bill"
        : criterion.id === "cosponsor_bills"
          ? "cosponsored_bill"
          : criterion.id === "send_letters"
            ? "letter"
            : criterion.id === "complete_profile" || criterion.id === "select_constituency"
              ? "profile"
              : null;
    if (!type) continue;
    options.filter((option) => option.type === type).slice(0, target).forEach((option) => ids.add(option.id));
  }
  return [...ids];
}

function attachmentTypeForCriterion(criterionId: string): AttachmentOption["type"] | null {
  if (criterionId === "write_bills") return "bill";
  if (criterionId === "cosponsor_bills") return "cosponsored_bill";
  if (criterionId === "send_letters") return "letter";
  if (criterionId === "complete_profile" || criterionId === "select_constituency") return "profile";
  return null;
}

function adjustScoresForSelectedAttachments(
  criteria: AutoCriteriaConfig[],
  baseScores: Record<string, AutoCriteriaResult>,
  selectedAttachments: AttachmentOption[],
) {
  const selectedCountByType = selectedAttachments.reduce<Record<string, number>>((counts, attachment) => {
    counts[attachment.type] = (counts[attachment.type] ?? 0) + 1;
    return counts;
  }, {});
  return Object.fromEntries(
    criteria.map((criterion) => {
      const base = baseScores[criterion.id];
      const target = Math.max(1, Number(criterion.target) || 1);
      const points = Math.max(0, Number(criterion.points) || 0);
      const attachmentType = attachmentTypeForCriterion(criterion.id);
      const rawValue = attachmentType ? Math.min(Number(base?.value ?? 0), selectedCountByType[attachmentType] ?? 0) : Number(base?.value ?? 0);
      const value = Math.max(0, rawValue);
      const earned = Math.round(Math.min(value, target) * points * 100) / 100;
      return [
        criterion.id,
        {
          id: criterion.id,
          label: base?.label ?? criterion.id,
          value,
          target,
          points,
          earned,
          complete: value >= target,
          extra_credit: Boolean(criterion.extra_credit),
        } satisfies AutoCriteriaResult,
      ];
    }),
  );
}

function requiredCriteriaMet(scores: Record<string, AutoCriteriaResult>) {
  return Object.values(scores).every((score) => score.extra_credit || score.complete);
}

function autoCriteriaPossible(criteria: AutoCriteriaConfig[]) {
  return criteria.reduce((sum, criterion) => criterion.extra_credit ? sum : sum + Math.max(1, Number(criterion.target) || 1) * Math.max(0, Number(criterion.points) || 0), 0);
}

function appliesToCurrentStudent(task: AssignmentTask, userId: string) {
  if (task.audience_type !== "selected_students") return true;
  return task.audience_user_ids.includes(userId);
}

export function AssignmentsPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-600 sm:px-6 lg:px-8">Loading assignments...</main>
      </div>
    );
  }
  if ((user?.user_metadata as any)?.role === "teacher") return <TeacherDeadlines />;
  return <StudentAssignmentsPage />;
}

function StudentAssignmentsPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentTask[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [attachmentOptions, setAttachmentOptions] = useState<AttachmentOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [autoScores, setAutoScores] = useState<Record<string, Record<string, AutoCriteriaResult>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [assignmentTab, setAssignmentTab] = useState<AssignmentTab>("upcoming");
  const [confirmSubmitId, setConfirmSubmitId] = useState<string | null>(null);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );
  const submissionMap = useMemo(() => new Map(submissions.map((submission) => [submission.assignment_id, submission])), [submissions]);
  const attachmentMap = useMemo(() => new Map(attachmentOptions.map((option) => [option.id, option])), [attachmentOptions]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        navigate("/signin");
        return;
      }
      setUserId(uid);
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const activeClassId = (profile as any)?.class_id as string | null;
      if (!activeClassId) {
        navigate("/my-classes");
        return;
      }
      setClassId(activeClassId);

      const [{ data: taskRows, error: taskError }, { data: submissionRows }, options] = await Promise.all([
        supabase
          .from("class_tasks")
          .select(assignmentSelect)
          .eq("class_id", activeClassId)
          .eq("task_type", "assignment")
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("assignment_submissions")
          .select("id,assignment_id,body,attachments,auto_scores,manual_score,manual_feedback,status,submitted_at,returned_at")
          .eq("class_id", activeClassId)
          .eq("student_user_id", uid),
        loadAttachmentOptions(activeClassId, uid),
      ]);
      if (taskError) throw taskError;
      const nextAssignments = sortAssignments(((taskRows ?? []) as any[]).map(normalizeAssignment).filter((assignment) => appliesToCurrentStudent(assignment, uid)));
      const nextSubmissions = ((submissionRows ?? []) as any[]).map((row) => ({
        ...row,
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        auto_scores: row.auto_scores && typeof row.auto_scores === "object" ? row.auto_scores : {},
      })) as SubmissionRow[];
      setAssignments(nextAssignments);
      setSubmissions(nextSubmissions);
      setAttachmentOptions(options);
      const byAssignment = new Map(nextSubmissions.map((submission) => [submission.assignment_id, submission]));
      setDrafts(
        Object.fromEntries(
          nextAssignments.map((assignment) => {
            const submission = byAssignment.get(assignment.id);
            const savedIds = (submission?.attachments ?? []).map((attachment) => attachment.id).filter(Boolean);
            return [
              assignment.id,
              {
                body: submission?.body ?? "",
                attachmentIds: savedIds.length ? savedIds : preferredAttachmentIds(assignment.auto_criteria, options),
              },
            ];
          }),
        ),
      );
      const scores = await Promise.all(
        nextAssignments.map(async (assignment) => [
          assignment.id,
          assignment.auto_criteria.length ? await computeAutoCriteriaScores(activeClassId, uid, assignment.auto_criteria) : {},
        ]),
      );
      setAutoScores(Object.fromEntries(scores));
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
    if (!assignments.length) {
      setSelectedAssignmentId(null);
      return;
    }
    const routeAssignment = assignmentId && assignments.some((assignment) => assignment.id === assignmentId) ? assignmentId : null;
    setSelectedAssignmentId(routeAssignment ?? selectedAssignmentId ?? assignments[0]?.id ?? null);
  }, [assignmentId, assignments, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignment || !classId || !userId) return;
    if (submissionMap.has(selectedAssignment.id)) return;
    const markViewed = async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .upsert(
          {
            assignment_id: selectedAssignment.id,
            class_id: classId,
            student_user_id: userId,
            body: "",
            attachments: [],
            auto_scores: {},
            status: "draft",
            submitted_at: null,
          } as any,
          { onConflict: "assignment_id,student_user_id" },
        )
        .select("id,assignment_id,body,attachments,auto_scores,manual_score,manual_feedback,status,submitted_at,returned_at")
        .single();
      if (error || !data) return;
      const row = {
        ...(data as any),
        attachments: Array.isArray((data as any).attachments) ? (data as any).attachments : [],
        auto_scores: (data as any).auto_scores && typeof (data as any).auto_scores === "object" ? (data as any).auto_scores : {},
      } as SubmissionRow;
      setSubmissions((current) => current.some((submission) => submission.assignment_id === row.assignment_id) ? current : [...current, row]);
    };
    void markViewed();
  }, [classId, selectedAssignment, submissionMap, userId]);

  const setDraft = (assignmentIdToPatch: string, patch: Partial<DraftState>) => {
    setDrafts((current) => {
      const existing = current[assignmentIdToPatch] ?? { body: "", attachmentIds: [] };
      return { ...current, [assignmentIdToPatch]: { ...existing, ...patch } };
    });
  };

  const toggleAttachment = (assignmentIdToPatch: string, optionId: string) => {
    const draft = drafts[assignmentIdToPatch] ?? { body: "", attachmentIds: [] };
    const nextIds = draft.attachmentIds.includes(optionId)
      ? draft.attachmentIds.filter((id) => id !== optionId)
      : [...draft.attachmentIds, optionId];
    setDraft(assignmentIdToPatch, { attachmentIds: nextIds });
  };

  const submitAssignment = async (assignment: AssignmentTask, force = false) => {
    if (!classId || !userId) return;
    const existingSubmission = submissionMap.get(assignment.id);
    if (existingSubmission?.status === "submitted" && !force) {
      setSubmittingId(assignment.id);
      try {
        const { error } = await supabase.from("assignment_submissions").update({ status: "draft", submitted_at: null } as any).eq("id", existingSubmission.id);
        if (error) throw error;
        await load();
        toast.success("Assignment unsubmitted");
      } catch (e: any) {
        toast.error(e.message || "Could not unsubmit assignment");
      } finally {
        setSubmittingId(null);
      }
      return;
    }
    setSubmittingId(assignment.id);
    try {
      const draft = drafts[assignment.id] ?? { body: "", attachmentIds: [] };
      if (wordCount(draft.body) > 100) {
        toast.error("Submission notes are limited to 100 words.");
        return;
      }
      const selectedAttachments = draft.attachmentIds.map((id) => attachmentMap.get(id)).filter(Boolean) as AttachmentOption[];
      const computedScores = assignment.auto_criteria.length ? await computeAutoCriteriaScores(classId, userId, assignment.auto_criteria) : {};
      const scores = adjustScoresForSelectedAttachments(assignment.auto_criteria, computedScores, selectedAttachments);
      if (!force && assignment.auto_criteria.length && !requiredCriteriaMet(scores)) {
        setConfirmSubmitId(assignment.id);
        return;
      }
      const { error } = await supabase.from("assignment_submissions").upsert(
        {
          assignment_id: assignment.id,
          class_id: classId,
          student_user_id: userId,
          body: draft.body.trim(),
          attachments: selectedAttachments,
          auto_scores: scores,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        } as any,
        { onConflict: "assignment_id,student_user_id" },
      );
      if (error) throw error;
      setConfirmSubmitId(null);
      setAutoScores((current) => ({ ...current, [assignment.id]: scores }));
      await load();
      toast.success(submissionMap.get(assignment.id)?.status === "returned" ? "Assignment resubmitted" : assignment.manual_submission_required ? "Assignment submitted" : "Assignment work saved");
    } catch (e: any) {
      toast.error(e.message || "Could not submit assignment");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
          <p className="mt-1 text-gray-600">View requirements, attach simulation work, and submit assignments.</p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">No assignments yet</h2>
            <p className="mt-1 text-gray-600">Assignments your teacher creates will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="grid grid-cols-3 gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
                  {([
                    ["upcoming", "Upcoming"],
                    ["submitted", "Submitted"],
                    ["returned", "Returned"],
                  ] as Array<[AssignmentTab, string]>).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAssignmentTab(tab)}
                      className={`rounded px-2 py-1.5 text-xs font-semibold transition ${assignmentTab === tab ? "bg-blue-800 text-white shadow-sm" : "text-gray-600 hover:bg-blue-50 hover:text-blue-800"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {assignments.filter((assignment) => {
                  const status = submissionMap.get(assignment.id)?.status;
                  if (assignmentTab === "submitted") return status === "submitted";
                  if (assignmentTab === "returned") return status === "returned";
                  return status !== "submitted" && status !== "returned";
                }).map((assignment) => {
                  const submission = submissionMap.get(assignment.id);
                  const selected = assignment.id === selectedAssignmentId;
                  return (
                    <button
                      key={assignment.id}
                      type="button"
                      onClick={() => {
                        setSelectedAssignmentId(assignment.id);
                        navigate(`/assignments/${assignment.id}`);
                      }}
                      className={`block w-full px-4 py-3 text-left ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{assignment.title}</h3>
                        <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700">{scoreText(assignment, submission)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatDateTime(assignment.due_at)}</span>
                        {submission?.status ? (
                          <>
                            <span aria-hidden="true">|</span>
                            <span>{submission.status === "returned" ? "Returned" : submission.status === "submitted" ? "Submitted" : "Viewed"}</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {assignments.filter((assignment) => {
                  const status = submissionMap.get(assignment.id)?.status;
                  if (assignmentTab === "submitted") return status === "submitted";
                  if (assignmentTab === "returned") return status === "returned";
                  return status !== "submitted" && status !== "returned";
                }).length === 0 ? <div className="p-4 text-sm text-gray-500">No assignments in this tab.</div> : null}
              </div>
            </section>

            {selectedAssignment ? (
              <AssignmentDetail
                assignment={selectedAssignment}
                submission={submissionMap.get(selectedAssignment.id)}
                draft={drafts[selectedAssignment.id] ?? { body: "", attachmentIds: [] }}
                scores={adjustScoresForSelectedAttachments(
                  selectedAssignment.auto_criteria,
                  autoScores[selectedAssignment.id] ?? submissionMap.get(selectedAssignment.id)?.auto_scores ?? {},
                  (drafts[selectedAssignment.id]?.attachmentIds ?? []).map((id) => attachmentMap.get(id)).filter(Boolean) as AttachmentOption[],
                )}
                attachmentOptions={attachmentOptions}
                submitting={submittingId === selectedAssignment.id}
                onDraftChange={(patch) => setDraft(selectedAssignment.id, patch)}
                onToggleAttachment={(optionId) => toggleAttachment(selectedAssignment.id, optionId)}
                onSubmit={(force) => void submitAssignment(selectedAssignment, force)}
              />
            ) : null}
          </div>
        )}
      </main>
      {confirmSubmitId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900">Submit before all requirements are met?</h2>
              <p className="mt-1 text-sm text-gray-600">Some required auto-graded requirements are incomplete. Extra credit is not required.</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5">
              <button type="button" onClick={() => setConfirmSubmitId(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Keep working
              </button>
              <button type="button" onClick={() => {
                const assignment = assignments.find((item) => item.id === confirmSubmitId);
                if (assignment) void submitAssignment(assignment, true);
              }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentDetail({
  assignment,
  submission,
  draft,
  scores,
  attachmentOptions,
  submitting,
  onDraftChange,
  onToggleAttachment,
  onSubmit,
}: {
  assignment: AssignmentTask;
  submission?: SubmissionRow;
  draft: DraftState;
  scores: Record<string, AutoCriteriaResult>;
  attachmentOptions: AttachmentOption[];
  submitting: boolean;
  onDraftChange: (patch: Partial<DraftState>) => void;
  onToggleAttachment: (optionId: string) => void;
  onSubmit: (force?: boolean) => void;
}) {
  const returned = submission?.status === "returned";
  const autoPossible = autoCriteriaPossible(assignment.auto_criteria);
  const autoTotal = autoScoreTotal(scores);
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{assignment.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              {formatDateTime(assignment.due_at)}
            </div>
            {assignment.description ? <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{assignment.description}</p> : null}
            <AttachmentList attachments={assignment.attachments} />
          </div>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{scoreText(assignment, submission)}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {assignment.auto_criteria.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Requirements</h3>
              <div className="divide-y divide-gray-100">
                {assignment.auto_criteria.map((criterion) => {
                  const score = scores[criterion.id];
                  return (
                    <div key={criterion.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${score?.complete ? "text-green-600" : "text-gray-300"}`} />
                        <span className="font-medium text-gray-900">
                          {score?.label ?? criterion.id}
                          {criterion.extra_credit ? <span className="ml-1 text-xs font-semibold text-blue-700">(extra credit)</span> : null}
                        </span>
                      </div>
                      <span className={score?.complete ? "font-semibold text-green-700" : "text-gray-500"}>
                        {score ? `${score.value}/${score.target}` : `0/${criterion.target}`} - {score ? `${score.earned}/${score.points * score.target}` : `0/${criterion.points * criterion.target}`} pts
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                Auto grading total: {autoTotal}/{autoPossible} pts
              </div>
            </section>
          ) : null}

          {assignment.rubric.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Rubric</h3>
                <span className="text-sm font-medium text-gray-600">{rubricTotal(assignment.rubric)} pts</span>
              </div>
              <div className="space-y-3">
                {assignment.rubric.map((item) => (
                  <div key={item.id}>
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

          {returned ? (
            <section className="rounded-md border border-green-200 bg-green-50 p-4">
              <h3 className="font-semibold text-green-900">Returned grade</h3>
              <p className="mt-1 text-sm text-green-800">
                Score: {submission?.manual_score ?? autoScoreTotal(submission?.auto_scores)}/{assignment.points_possible}
              </p>
              {submission?.manual_feedback ? <p className="mt-2 whitespace-pre-line text-sm text-green-900">{submission.manual_feedback}</p> : null}
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {!assignment.manual_submission_required ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              Manual submission is optional for this assignment. Your attached simulation work can still be updated.
            </div>
          ) : null}
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Paperclip className="h-4 w-4" />
              Attach simulation work
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2">
              {attachmentOptions.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={draft.attachmentIds.includes(option.id)}
                    onChange={() => onToggleAttachment(option.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              ))}
              {attachmentOptions.length === 0 ? <div className="p-3 text-sm text-gray-500">No attachable work yet.</div> : null}
            </div>
          </section>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Optional submission note</span>
            <textarea
              value={draft.body}
              onChange={(event) => onDraftChange({ body: limitWords(event.target.value, 100) })}
              rows={5}
              placeholder="Optional note to your teacher"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="mt-1 block text-xs text-gray-500">{wordCount(draft.body)}/100 words</span>
          </label>

          {submission?.attachments?.length ? (
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">Submitted attachments</div>
              <div className="flex flex-wrap gap-2">
                {submission.attachments.map((attachment) => (
                  <Link key={attachment.id} to={attachment.href} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                    {attachment.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting
              ? "Saving..."
              : assignment.manual_submission_required
                ? submission?.status === "submitted"
                  ? "Unsubmit assignment"
                  : submission?.status === "returned"
                    ? "Resubmit assignment"
                    : "Submit assignment"
                : submission?.status === "submitted"
                  ? "Unsubmit assignment"
                  : submission?.status === "returned"
                    ? "Resubmit work"
                  : "Submit assignment"
                }
          </button>
        </aside>
      </div>
    </article>
  );
}
