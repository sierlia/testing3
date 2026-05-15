import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import {
  AssignmentTask,
  AUTO_CRITERIA_OPTIONS,
  AutoCriteriaConfig,
  criterionFromOption,
  newRubricItem,
  normalizeAssignment,
  normalizeCriteria,
  normalizeRubric,
  RubricItem,
  autoCriteriaTotal,
  rubricTotal,
} from "../services/assignments";

type AudienceType = AssignmentTask["audience_type"];
type GradingMode = AssignmentTask["grading_mode"];
type OrgOption = { id: string; name: string };
type StudentRow = { user_id: string; display_name: string };

const assignmentSelect =
  "id,task_type,title,description,due_at,audience_type,audience_id,audience_user_ids,created_at,points_possible,grading_mode,manual_submission_required,rubric,auto_criteria,integration_targets";

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function sortByName<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function TeacherAssignmentModal({
  classId,
  open,
  onClose,
  onSaved,
}: {
  classId: string | null | undefined;
  open: boolean;
  onClose: () => void;
  onSaved?: (assignment: AssignmentTask) => void | Promise<void>;
}) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [parties, setParties] = useState<OrgOption[]>([]);
  const [committees, setCommittees] = useState<OrgOption[]>([]);
  const [caucuses, setCaucuses] = useState<OrgOption[]>([]);
  const [lobbyists, setLobbyists] = useState<OrgOption[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newAudienceType, setNewAudienceType] = useState<AudienceType>("all");
  const [newAudienceId, setNewAudienceId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradingMode, setGradingMode] = useState<GradingMode>("manual");
  const [manualSubmissionRequired, setManualSubmissionRequired] = useState(true);
  const [newPointsPossible, setNewPointsPossible] = useState("100");
  const [rubricRows, setRubricRows] = useState<RubricItem[]>([newRubricItem()]);
  const [criteriaRows, setCriteriaRows] = useState<AutoCriteriaConfig[]>([]);
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [audienceOptionQuery, setAudienceOptionQuery] = useState("");

  const reset = () => {
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
    setStudentPickerQuery("");
    setAudienceOptionQuery("");
  };

  useEffect(() => {
    if (!open) return;
    reset();
    if (!classId) return;
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [{ data: pRows }, { data: cRows }, { data: caRows }, { data: lRows }, { data: memberRows }] = await Promise.all([
          supabase.from("parties").select("id,name").eq("class_id", classId).order("name"),
          supabase.from("committees").select("id,name").eq("class_id", classId).order("name"),
          supabase.from("caucuses").select("id,title").eq("class_id", classId).order("title"),
          supabase.from("lobbyist_groups").select("id,name").eq("class_id", classId).order("name"),
          supabase
            .from("class_memberships")
            .select("user_id,role,status")
            .eq("class_id", classId)
            .eq("role", "student")
            .eq("status", "approved"),
        ]);
        setParties(sortByName(((pRows ?? []) as any[]).map((party) => ({ id: party.id, name: displayPartyName(party.name) }))));
        setCommittees(sortByName(((cRows ?? []) as any[]).map((committee) => ({ id: committee.id, name: committee.name }))));
        setCaucuses(sortByName(((caRows ?? []) as any[]).map((caucus) => ({ id: caucus.id, name: caucus.title ?? "Caucus" }))));
        setLobbyists(sortByName(((lRows ?? []) as any[]).map((group) => ({ id: group.id, name: group.name }))));
        const studentIds = ((memberRows ?? []) as any[]).map((row) => row.user_id);
        const { data: profileRows } = studentIds.length
          ? await supabase.from("profiles").select("user_id,display_name").in("user_id", studentIds)
          : ({ data: [] } as any);
        const profileMap = new Map(((profileRows ?? []) as any[]).map((row) => [row.user_id, row.display_name ?? "Student"]));
        setStudents(sortByName(studentIds.map((userId) => ({ user_id: userId, display_name: profileMap.get(userId) ?? "Student", name: profileMap.get(userId) ?? "Student" }))).map(({ user_id, display_name }) => ({ user_id, display_name })));
      } catch (error: any) {
        toast.error(error.message || "Could not load assignment options");
      } finally {
        setLoadingOptions(false);
      }
    };
    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  const specificOptions =
    newAudienceType === "party" ? parties : newAudienceType === "committee" ? committees : newAudienceType === "caucus" ? caucuses : newAudienceType === "lobbyist" ? lobbyists : [];
  const filteredSpecificOptions = useMemo(() => {
    const q = audienceOptionQuery.trim().toLowerCase();
    return specificOptions.filter((option) => !q || option.name.toLowerCase().includes(q));
  }, [audienceOptionQuery, specificOptions]);
  const filteredStudents = useMemo(() => {
    const q = studentPickerQuery.trim().toLowerCase();
    return students.filter((student) => !q || student.display_name.toLowerCase().includes(q));
  }, [studentPickerQuery, students]);

  const toggleSelectedStudent = (userId: string) => {
    setSelectedStudentIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const toggleCriteria = (id: string) => {
    setCriteriaRows((current) => (current.some((row) => row.id === id) ? current.filter((row) => row.id !== id) : [...current, criterionFromOption(id)]));
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!classId || !newTitle.trim()) return;
    const audienceId = newAudienceType === "all" || newAudienceType === "selected_students" ? null : newAudienceId || null;
    if (newAudienceType !== "all" && newAudienceType !== "selected_students" && !audienceId) return toast.error("Select a target for this assignment");
    if (newAudienceType === "selected_students" && selectedStudentIds.length === 0) return toast.error("Select at least one student");
    const normalizedRubric = gradingMode === "manual" ? normalizeRubric(rubricRows) : [];
    const normalizedCriteria = gradingMode === "auto" ? normalizeCriteria(criteriaRows) : [];
    if (gradingMode === "auto" && normalizedCriteria.length === 0) return toast.error("Choose at least one auto-graded rubric requirement");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sign in required");
      const dueAt = newDueDate.trim() === "" ? null : new Date(`${newDueDate}T${(newDueTime || "23:59").trim()}:00`).toISOString();
      const pointsPossible = gradingMode === "auto" ? autoCriteriaTotal(normalizedCriteria) : Math.max(0, Number(newPointsPossible) || 0);
      const { data, error } = await supabase
        .from("class_tasks")
        .insert({
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
        } as any)
        .select(assignmentSelect)
        .single();
      if (error) throw error;
      const saved = normalizeAssignment(data);
      await onSaved?.(saved);
      toast.success("Assignment created");
      close();
    } catch (error: any) {
      toast.error(error.message || "Could not save assignment");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Add assignment</h2>
          </div>
          <button onClick={close} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.95fr)]">
          <section className="space-y-5 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assignment details</h3>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Bill draft and committee memo" className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>

            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">Assigned to</div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "selected_students", "party", "committee", "caucus", "lobbyist"] as AudienceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setNewAudienceType(type);
                      setNewAudienceId("");
                      setAudienceOptionQuery("");
                      if (type !== "selected_students") setSelectedStudentIds([]);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${newAudienceType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {type === "all" ? "All students" : type === "selected_students" ? "Select students" : type === "party" ? "Parties" : type === "committee" ? "Committees" : type === "caucus" ? "Caucuses" : "Lobbyists"}
                  </button>
                ))}
              </div>
            </div>

            {newAudienceType !== "all" && newAudienceType !== "selected_students" ? (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 text-sm font-medium text-gray-700">Target</div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={audienceOptionQuery} onChange={(event) => setAudienceOptionQuery(event.target.value)} placeholder={`Search ${newAudienceType === "lobbyist" ? "lobbyist groups" : `${newAudienceType}s`}...`} className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredSpecificOptions.map((option) => (
                    <button key={option.id} type="button" onClick={() => setNewAudienceId(option.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${newAudienceId === option.id ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "hover:bg-gray-50"}`}>
                      <span className="truncate">{option.name}</span>
                      {newAudienceId === option.id ? <Check className="h-4 w-4 flex-shrink-0 text-blue-600" /> : null}
                    </button>
                  ))}
                  {!filteredSpecificOptions.length ? <div className="p-2 text-sm text-gray-500">{loadingOptions ? "Loading..." : "No matches."}</div> : null}
                </div>
              </div>
            ) : null}

            {newAudienceType === "selected_students" ? (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700">Students</div>
                  <div className="text-xs text-gray-500">{selectedStudentIds.length} selected</div>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={studentPickerQuery} onChange={(event) => setStudentPickerQuery(event.target.value)} placeholder="Search students..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {filteredStudents.map((student) => {
                    const selected = selectedStudentIds.includes(student.user_id);
                    return (
                      <button key={student.user_id} type="button" onClick={() => toggleSelectedStudent(student.user_id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selected ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "hover:bg-gray-50"}`}>
                        <span className="truncate">{student.display_name}</span>
                        {selected ? <Check className="h-4 w-4 flex-shrink-0 text-blue-600" /> : null}
                      </button>
                    );
                  })}
                  {students.length === 0 ? <div className="p-2 text-sm text-gray-500">{loadingOptions ? "Loading..." : "No approved students yet."}</div> : null}
                  {students.length > 0 && filteredStudents.length === 0 ? <div className="p-2 text-sm text-gray-500">No matches.</div> : null}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Due date</span>
                <input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Due time</span>
                <input type="time" value={newDueTime} onChange={(event) => setNewDueTime(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
              <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={4} placeholder="Instructions, resources, and what students should submit." className="w-full rounded-md border border-gray-300 px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
          </section>

          <section className="rounded-lg border border-gray-200 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">Grading</h3>
                <p className="text-sm text-gray-600">Choose whether this assignment is graded by a manual rubric or quantitative simulation requirements.</p>
              </div>
              {gradingMode === "manual" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Points possible</span>
                  <input type="number" min="0" value={newPointsPossible} onChange={(event) => setNewPointsPossible(event.target.value)} className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
                <button key={mode} type="button" onClick={() => setGradingMode(mode)} className={`rounded-md px-3 py-2 text-sm font-medium ${gradingMode === mode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {mode === "manual" ? "Manual grading" : "Auto-grading"}
                </button>
              ))}
            </div>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={manualSubmissionRequired} onChange={(event) => setManualSubmissionRequired(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
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
                      <input value={item.title} onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))} placeholder={`Criterion ${index + 1}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="number" min="0" value={item.points} onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, points: Math.max(0, Number(event.target.value) || 0) } : row)))} className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={() => setRubricRows((rows) => rows.filter((row) => row.id !== item.id))} className="rounded-md p-2 text-gray-500 hover:bg-white">
                        <X className="h-4 w-4" />
                      </button>
                      <textarea value={item.description} onChange={(event) => setRubricRows((rows) => rows.map((row) => (row.id === item.id ? { ...row, description: event.target.value } : row)))} placeholder="What earns credit for this criterion?" rows={2} className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-3" />
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
                          <input type="checkbox" checked={Boolean(selected)} onChange={() => toggleCriteria(option.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span>
                            <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                            <span className="block text-xs text-gray-600">{option.description}</span>
                          </span>
                        </label>
                        {selected ? (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-gray-600">#</span>
                              <input type="number" min="1" value={selected.target} onChange={(event) => setCriteriaRows((rows) => rows.map((row) => (row.id === option.id ? { ...row, target: Math.max(1, Number(event.target.value) || 1) } : row)))} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-gray-600">Points per #</span>
                              <input type="number" min="0" value={selected.points} onChange={(event) => setCriteriaRows((rows) => rows.map((row) => (row.id === option.id ? { ...row, points: Math.max(0, Number(event.target.value) || 0) } : row)))} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
          <button onClick={close} className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
            Cancel
          </button>
          <button onClick={() => void save()} disabled={!newTitle.trim() || saving} className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {saving ? "Saving..." : "Add assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
