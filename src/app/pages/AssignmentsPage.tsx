import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Calendar, CheckCircle2, FileText, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { supabase } from "../utils/supabase";
import {
  AssignmentTask,
  AttachmentOption,
  AutoCriteriaResult,
  computeAutoCriteriaScores,
  loadAttachmentOptions,
  normalizeAssignment,
  autoScoreTotal,
  rubricTotal,
} from "../services/assignments";

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

export function AssignmentsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentTask[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [attachmentOptions, setAttachmentOptions] = useState<AttachmentOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [autoScores, setAutoScores] = useState<Record<string, Record<string, AutoCriteriaResult>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
        navigate("/settings/classes");
        return;
      }
      setClassId(activeClassId);

      const [{ data: taskRows, error: taskError }, { data: submissionRows }, options] = await Promise.all([
        supabase
          .from("class_tasks")
          .select("id,task_type,title,description,due_at,audience_type,audience_id,created_at,points_possible,rubric,auto_criteria,integration_targets")
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
      const nextAssignments = ((taskRows ?? []) as any[]).map(normalizeAssignment);
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
            return [
              assignment.id,
              {
                body: submission?.body ?? "",
                attachmentIds: (submission?.attachments ?? []).map((attachment) => attachment.id).filter(Boolean),
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

  const setDraft = (assignmentId: string, patch: Partial<DraftState>) => {
    setDrafts((current) => {
      const existing = current[assignmentId] ?? { body: "", attachmentIds: [] };
      return { ...current, [assignmentId]: { ...existing, ...patch } };
    });
  };

  const toggleAttachment = (assignmentId: string, optionId: string) => {
    const draft = drafts[assignmentId] ?? { body: "", attachmentIds: [] };
    const nextIds = draft.attachmentIds.includes(optionId)
      ? draft.attachmentIds.filter((id) => id !== optionId)
      : [...draft.attachmentIds, optionId];
    setDraft(assignmentId, { attachmentIds: nextIds });
  };

  const submitAssignment = async (assignment: AssignmentTask) => {
    if (!classId || !userId) return;
    setSubmittingId(assignment.id);
    try {
      const draft = drafts[assignment.id] ?? { body: "", attachmentIds: [] };
      const selectedAttachments = draft.attachmentIds.map((id) => attachmentMap.get(id)).filter(Boolean) as AttachmentOption[];
      const scores = assignment.auto_criteria.length ? await computeAutoCriteriaScores(classId, userId, assignment.auto_criteria) : {};
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
      setAutoScores((current) => ({ ...current, [assignment.id]: scores }));
      await load();
      toast.success("Assignment submitted");
    } catch (e: any) {
      toast.error(e.message || "Could not submit assignment");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
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
          <div className="space-y-5">
            {assignments.map((assignment) => {
              const submission = submissionMap.get(assignment.id);
              const draft = drafts[assignment.id] ?? { body: "", attachmentIds: [] };
              const scores = autoScores[assignment.id] ?? submission?.auto_scores ?? {};
              const returned = submission?.status === "returned";
              return (
                <article key={assignment.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Assignment</span>
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{scoreText(assignment, submission)}</span>
                          {submission?.status ? (
                            <span className={`rounded px-2 py-1 text-xs font-medium ${returned ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                              {returned ? "Returned" : submission.status === "submitted" ? "Submitted" : "Draft"}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">{assignment.title}</h2>
                        {assignment.description ? <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{assignment.description}</p> : null}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDateTime(assignment.due_at)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
                    <div className="space-y-5">
                      {assignment.auto_criteria.length ? (
                        <section>
                          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Requirements</h3>
                          <div className="space-y-2">
                            {assignment.auto_criteria.map((criterion) => {
                              const score = scores[criterion.id];
                              return (
                                <div key={criterion.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className={`h-4 w-4 ${score?.complete ? "text-green-600" : "text-gray-300"}`} />
                                    <span className="font-medium text-gray-900">{score?.label ?? criterion.id}</span>
                                  </div>
                                  <span className={score?.complete ? "font-semibold text-green-700" : "text-gray-500"}>
                                    {score ? `${score.value}/${score.target}` : `0/${criterion.target}`} - {score ? `${score.earned}/${score.points}` : `0/${criterion.points}`} pts
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ) : null}

                      {assignment.rubric.length ? (
                        <section>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Rubric</h3>
                            <span className="text-sm font-medium text-gray-600">{rubricTotal(assignment.rubric)} pts</span>
                          </div>
                          <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                            {assignment.rubric.map((item) => (
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
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Submission note</span>
                        <textarea
                          value={draft.body}
                          onChange={(event) => setDraft(assignment.id, { body: event.target.value })}
                          rows={5}
                          placeholder="Optional note to your teacher"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </label>

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
                                onChange={() => toggleAttachment(assignment.id, option.id)}
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
                        onClick={() => void submitAssignment(assignment)}
                        disabled={submittingId === assignment.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {submittingId === assignment.id ? "Submitting..." : submission?.status === "submitted" ? "Resubmit assignment" : "Submit assignment"}
                      </button>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
