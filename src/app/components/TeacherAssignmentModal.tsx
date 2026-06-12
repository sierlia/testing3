import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardCheck, Plus, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import {
  AssignmentTask,
  AUTO_CRITERIA_OPTIONS,
  AutoCriteriaConfig,
  RubricItem,
  criterionFromOption,
  newRubricItem,
  normalizeAssignment,
  normalizeCriteria,
  normalizeRubric,
  rubricTotal,
} from "../services/assignments";
import { AttachmentPicker, DiscussionAttachment } from "./DiscussionAttachments";

type AudienceType = AssignmentTask["audience_type"];
type OrgOption = { id: string; name: string; userIds?: string[] };
type StudentRow = { user_id: string; display_name: string; party?: string | null };
type AudienceOption = { key: string; label: string; description: string; userIds: string[]; tone: string };

const assignmentSelect =
  "id,task_type,title,description,due_at,audience_type,audience_id,audience_user_ids,created_at,points_possible,grading_mode,manual_submission_required,allow_late_submissions,rubric,auto_criteria,attachments,integration_targets";

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function sortByName<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
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

function criteriaFromRubric(rubric: RubricItem[]): AutoCriteriaConfig[] {
  return rubric
    .filter((item) => item.autoCriteriaId)
    .map((item) => {
      const fallback = criterionFromOption(item.autoCriteriaId || AUTO_CRITERIA_OPTIONS[0].id);
      return {
        id: item.autoCriteriaId || fallback.id,
        target: Math.max(1, Number(item.autoTarget ?? fallback.target) || 1),
        points: Math.max(0, Number(item.autoPoints ?? item.points ?? fallback.points) || 0),
        extra_credit: Boolean(item.extraCredit),
        rubric_item_id: item.id,
      };
    });
}

function parseRubricImport(text: string): RubricItem[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return normalizeRubric(parsed);
    if (Array.isArray(parsed?.rubric)) return normalizeRubric(parsed.rubric);
  } catch {
    // Fall through to simple line parsing.
  }

  return normalizeRubric(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const pieces = line.split(/,|\t/).map((piece) => piece.trim()).filter(Boolean);
        const pointIndex = pieces.findIndex((piece) => Number.isFinite(Number(piece)));
        const points = pointIndex >= 0 ? Math.max(0, Number(pieces[pointIndex]) || 0) : 10;
        const textPieces = pieces.filter((_, index) => index !== pointIndex);
        const title = textPieces[0] ?? "Rubric item";
        const description = textPieces.slice(1).join(" ");
        return { ...newRubricItem(), title, description, points };
      }),
  );
}

function rubricFileCanBeReadAsText(file: File) {
  const name = file.name.toLowerCase();
  return file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json");
}

export function TeacherAssignmentModal({
  classId,
  open,
  assignment,
  onClose,
  onSaved,
}: {
  classId: string | null | undefined;
  open: boolean;
  assignment?: AssignmentTask | null;
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
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(true);
  const [newPointsPossible, setNewPointsPossible] = useState("");
  const [rubricRows, setRubricRows] = useState<RubricItem[]>([]);
  const [assignmentAttachments, setAssignmentAttachments] = useState<DiscussionAttachment[]>([]);
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [audienceOptionQuery, setAudienceOptionQuery] = useState("");
  const [selectedAudienceKeys, setSelectedAudienceKeys] = useState<string[]>([]);
  const [autoMenuRubricId, setAutoMenuRubricId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoMenuRef = useRef<HTMLDivElement | null>(null);

  const reset = (source?: AssignmentTask | null) => {
    setNewTitle(source?.title ?? "");
    setNewDescription(source?.description ?? "");
    setNewDueDate(localDateInput(source?.due_at ?? null));
    setNewDueTime(localTimeInput(source?.due_at ?? null));
    setNewAudienceType(!source || source.audience_type === "all" ? "all" : "selected_students");
    setNewAudienceId(source?.audience_id ?? "");
    setSelectedStudentIds(source?.audience_user_ids ?? []);
    setAllowLateSubmissions(source?.allow_late_submissions ?? true);
    setNewPointsPossible(source?.points_possible != null && source.points_possible > 0 ? String(source.points_possible) : "");
    setRubricRows(source?.rubric ?? []);
    setAssignmentAttachments(source?.attachments ?? []);
    setStudentPickerQuery("");
    setAudienceOptionQuery("");
    setSelectedAudienceKeys([]);
    setAutoMenuRubricId(null);
  };

  useEffect(() => {
    if (!open) return;
    reset(assignment);
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
        const studentIds = ((memberRows ?? []) as any[]).map((row) => row.user_id);
        const [{ data: profileRows }, { data: committeeMemberRows }, { data: caucusMemberRows }, { data: lobbyistMemberRows }] = studentIds.length
          ? await Promise.all([
              supabase.from("profiles").select("user_id,display_name,party").in("user_id", studentIds),
              supabase.from("committee_members").select("user_id,committee_id,committees!inner(class_id)").in("user_id", studentIds).eq("committees.class_id", classId),
              supabase.from("caucus_members").select("user_id,caucus_id,caucuses!inner(class_id)").in("user_id", studentIds).eq("caucuses.class_id", classId),
              supabase.from("lobbyist_group_members").select("user_id,group_id,lobbyist_groups!inner(class_id)").in("user_id", studentIds).eq("lobbyist_groups.class_id", classId),
            ])
          : ([{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as any);
        const profiles = ((profileRows ?? []) as any[]) as Array<{ user_id: string; display_name?: string | null; party?: string | null }>;
        const profileMap = new Map(profiles.map((row) => [row.user_id, row]));
        const nextStudents = sortByName(
          studentIds.map((userId) => {
            const profile = profileMap.get(userId);
            return {
              user_id: userId,
              display_name: profile?.display_name ?? "Student",
              party: profile?.party ?? null,
              name: profile?.display_name ?? "Student",
            };
          }),
        ).map(({ user_id, display_name, party }) => ({ user_id, display_name, party }));
        const usersByParty = new Map<string, string[]>();
        for (const student of nextStudents) {
          if (!student.party) continue;
          const name = displayPartyName(student.party);
          usersByParty.set(name, [...(usersByParty.get(name) ?? []), student.user_id]);
        }
        const usersByCommittee = new Map<string, string[]>();
        for (const row of committeeMemberRows ?? []) usersByCommittee.set((row as any).committee_id, [...(usersByCommittee.get((row as any).committee_id) ?? []), (row as any).user_id]);
        const usersByCaucus = new Map<string, string[]>();
        for (const row of caucusMemberRows ?? []) usersByCaucus.set((row as any).caucus_id, [...(usersByCaucus.get((row as any).caucus_id) ?? []), (row as any).user_id]);
        const usersByLobbyist = new Map<string, string[]>();
        for (const row of lobbyistMemberRows ?? []) usersByLobbyist.set((row as any).group_id, [...(usersByLobbyist.get((row as any).group_id) ?? []), (row as any).user_id]);

        setStudents(nextStudents);
        setParties(sortByName(((pRows ?? []) as any[]).map((party) => {
          const name = displayPartyName(party.name);
          return { id: party.id, name, userIds: usersByParty.get(name) ?? [] };
        })));
        setCommittees(sortByName(((cRows ?? []) as any[]).map((committee) => ({ id: committee.id, name: committee.name, userIds: usersByCommittee.get(committee.id) ?? [] }))));
        setCaucuses(sortByName(((caRows ?? []) as any[]).map((caucus) => ({ id: caucus.id, name: caucus.title ?? "Caucus", userIds: usersByCaucus.get(caucus.id) ?? [] }))));
        setLobbyists(sortByName(((lRows ?? []) as any[]).map((group) => ({ id: group.id, name: group.name, userIds: usersByLobbyist.get(group.id) ?? [] }))));
      } catch (error: any) {
        toast.error(error.message || "Could not load assignment options");
      } finally {
        setLoadingOptions(false);
      }
    };
    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId, assignment?.id]);

  useEffect(() => {
    if (!autoMenuRubricId) return;
    const close = (event: PointerEvent) => {
      if (autoMenuRef.current?.contains(event.target as Node)) return;
      setAutoMenuRubricId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [autoMenuRubricId]);

  const audienceOptions = useMemo<AudienceOption[]>(() => {
    const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));
    const groupOptions = [
      { key: "all-parties", label: "All parties", description: `${unique(parties.flatMap((party) => party.userIds ?? [])).length} students`, userIds: unique(parties.flatMap((party) => party.userIds ?? [])), tone: "bg-blue-50 text-blue-800 border-blue-200" },
      { key: "all-committees", label: "All committees", description: `${unique(committees.flatMap((committee) => committee.userIds ?? [])).length} students`, userIds: unique(committees.flatMap((committee) => committee.userIds ?? [])), tone: "bg-orange-50 text-orange-800 border-orange-200" },
      { key: "all-caucuses", label: "All caucuses", description: `${unique(caucuses.flatMap((caucus) => caucus.userIds ?? [])).length} students`, userIds: unique(caucuses.flatMap((caucus) => caucus.userIds ?? [])), tone: "bg-purple-50 text-purple-800 border-purple-200" },
      { key: "all-lobbyists", label: "All lobbyist groups", description: `${unique(lobbyists.flatMap((group) => group.userIds ?? [])).length} students`, userIds: unique(lobbyists.flatMap((group) => group.userIds ?? [])), tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
      ...parties.map((party) => ({ key: `party:${party.id}`, label: party.name, description: `Party - ${(party.userIds ?? []).length} students`, userIds: party.userIds ?? [], tone: "bg-blue-50 text-blue-800 border-blue-200" })),
      ...committees.map((committee) => ({ key: `committee:${committee.id}`, label: committee.name, description: `Committee - ${(committee.userIds ?? []).length} students`, userIds: committee.userIds ?? [], tone: "bg-orange-50 text-orange-800 border-orange-200" })),
      ...caucuses.map((caucus) => ({ key: `caucus:${caucus.id}`, label: caucus.name, description: `Caucus - ${(caucus.userIds ?? []).length} students`, userIds: caucus.userIds ?? [], tone: "bg-purple-50 text-purple-800 border-purple-200" })),
      ...lobbyists.map((group) => ({ key: `lobbyist:${group.id}`, label: group.name, description: `Lobbyist group - ${(group.userIds ?? []).length} students`, userIds: group.userIds ?? [], tone: "bg-emerald-50 text-emerald-800 border-emerald-200" })),
      ...students.map((student) => ({ key: `student:${student.user_id}`, label: student.display_name, description: "Individual student", userIds: [student.user_id], tone: "bg-gray-50 text-gray-800 border-gray-200" })),
    ];
    return groupOptions.filter((option) => option.key.startsWith("student:") || option.userIds.length > 0);
  }, [caucuses, committees, lobbyists, parties, students]);

  const filteredAudienceOptions = useMemo(() => {
    const q = audienceOptionQuery.trim().toLowerCase();
    if (!q) return [];
    return audienceOptions.filter((option) => option.label.toLowerCase().includes(q) || option.description.toLowerCase().includes(q)).slice(0, 40);
  }, [audienceOptionQuery, audienceOptions]);
  const selectedStudents = useMemo(() => {
    const ids = new Set(selectedStudentIds);
    return students.filter((student) => ids.has(student.user_id));
  }, [selectedStudentIds, students]);
  const filteredStudents = useMemo(() => {
    const q = studentPickerQuery.trim().toLowerCase();
    return students.filter((student) => !q || student.display_name.toLowerCase().includes(q));
  }, [studentPickerQuery, students]);

  const normalizedRubric = useMemo(() => normalizeRubric(rubricRows), [rubricRows]);
  const rubricCriteria = useMemo(() => normalizeCriteria(criteriaFromRubric(normalizedRubric)), [normalizedRubric]);
  const reflectedPoints = normalizedRubric.length ? rubricTotal(normalizedRubric) : Math.max(0, Number(newPointsPossible) || 0);

  const toggleSelectedStudent = (userId: string) => {
    setSelectedStudentIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const toggleAudienceOption = (option: AudienceOption) => {
    setSelectedAudienceKeys((current) => {
      const nextKeys = current.includes(option.key) ? current.filter((key) => key !== option.key) : [...current, option.key];
      const selectedOptions = audienceOptions.filter((entry) => nextKeys.includes(entry.key));
      setSelectedStudentIds(Array.from(new Set(selectedOptions.flatMap((entry) => entry.userIds))));
      return nextKeys;
    });
  };

  const updateRubricItem = (id: string, patch: Partial<RubricItem>) => {
    setRubricRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const toggleRubricAutomation = (item: RubricItem) => {
    if (item.autoCriteriaId) {
      updateRubricItem(item.id, { autoCriteriaId: "", autoTarget: 1, autoPoints: item.points, extraCredit: false });
      return;
    }
    const defaultCriteria = criterionFromOption(AUTO_CRITERIA_OPTIONS[0].id);
    updateRubricItem(item.id, {
      autoCriteriaId: defaultCriteria.id,
      autoTarget: defaultCriteria.target,
      autoPoints: defaultCriteria.points,
    });
  };

  const chooseRubricAutomation = (item: RubricItem, optionId: string) => {
    const next = criterionFromOption(optionId);
    updateRubricItem(item.id, {
      autoCriteriaId: next.id,
      autoTarget: next.target,
      autoPoints: item.points || next.points,
    });
    setAutoMenuRubricId(null);
  };

  const importRubric = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      if (!rubricFileCanBeReadAsText(file)) {
        setRubricRows([{ ...newRubricItem(), title: file.name.replace(/\.[^.]+$/, "") || "Uploaded rubric", description: `Rubric file uploaded: ${file.name}. Add or edit criteria after reviewing the document.`, points: 0 }]);
        toast.success("Rubric file selected");
        return;
      }
      const rows = parseRubricImport(await file.text());
      if (!rows.length) return toast.error("No rubric rows found in that file");
      setRubricRows(rows);
      toast.success("Rubric imported");
    } catch (error: any) {
      toast.error(error.message || "Could not import rubric");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!classId || !newTitle.trim()) return;
    const audienceType = newAudienceType === "all" ? "all" : "selected_students";
    if (audienceType === "selected_students" && selectedStudentIds.length === 0) return toast.error("Select at least one student or group");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sign in required");
      const dueAt = newDueDate.trim() === "" ? null : new Date(`${newDueDate}T${(newDueTime || "23:59").trim()}:00`).toISOString();
      const payload = {
        task_type: "assignment",
        audience_type: audienceType,
        audience_id: null,
        audience_user_ids: audienceType === "selected_students" ? selectedStudentIds : [],
        title: newTitle.trim(),
        description: newDescription.trim(),
        due_at: dueAt,
        points_possible: reflectedPoints,
        grading_mode: rubricCriteria.length ? "auto" : "manual",
        manual_submission_required: true,
        allow_late_submissions: allowLateSubmissions,
        rubric: normalizedRubric,
        auto_criteria: rubricCriteria,
        attachments: assignmentAttachments,
        integration_targets: [],
      } as any;
      const query = assignment?.id
        ? supabase.from("class_tasks").update(payload).eq("id", assignment.id).select(assignmentSelect).single()
        : supabase.from("class_tasks").insert({ ...payload, class_id: classId, created_by: uid }).select(assignmentSelect).single();
      const { data, error } = await query;
      if (error) throw error;
      const saved = normalizeAssignment(data);
      await onSaved?.(saved);
      toast.success(assignment?.id ? "Assignment updated" : "Assignment created");
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
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{assignment?.id ? "Edit assignment" : "Create assignment"}</h2>
          </div>
          <button onClick={close} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.95fr)]">
          <section className="space-y-4 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assignment details</h3>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Bill draft and committee memo" className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Due date</span>
                <input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Due time</span>
                <input type="time" value={newDueTime} onChange={(event) => setNewDueTime(event.target.value)} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={allowLateSubmissions} onChange={(event) => setAllowLateSubmissions(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Allow late submissions
              </label>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Assigned to</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewAudienceType("all");
                    setNewAudienceId("");
                    setAudienceOptionQuery("");
                    setSelectedStudentIds([]);
                    setSelectedAudienceKeys([]);
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${newAudienceType === "all" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setNewAudienceType("selected_students")}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${newAudienceType === "selected_students" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                >
                  Select students or groups
                </button>
              </div>

            {newAudienceType === "selected_students" ? (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700">Search students or groups</div>
                  <div className="text-xs text-gray-500">{selectedStudentIds.length} selected</div>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={audienceOptionQuery} onChange={(event) => setAudienceOptionQuery(event.target.value)} placeholder="Search a student, party, committee, caucus, or lobbyist group..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredAudienceOptions.map((option) => {
                    const selected = selectedAudienceKeys.includes(option.key);
                    return (
                      <button key={option.key} type="button" onClick={() => toggleAudienceOption(option)} className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${selected ? "border-blue-300 bg-blue-50 text-blue-800" : `${option.tone} hover:brightness-[0.98]`}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{option.label}</span>
                          <span className="block text-xs opacity-80">{option.description}</span>
                        </span>
                        {selected ? <Check className="h-4 w-4 flex-shrink-0 text-blue-600" /> : null}
                      </button>
                    );
                  })}
                  {!audienceOptionQuery.trim() ? <div className="p-2 text-sm text-gray-500">Start typing to find students or groups.</div> : null}
                  {audienceOptionQuery.trim() && filteredAudienceOptions.length === 0 ? <div className="p-2 text-sm text-gray-500">{loadingOptions ? "Loading..." : "No matches."}</div> : null}
                </div>
                {selectedStudents.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedStudents.slice(0, 12).map((student) => (
                      <span key={student.user_id} className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{student.display_name}</span>
                    ))}
                    {selectedStudents.length > 12 ? <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">+{selectedStudents.length - 12} more</span> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>

            <div className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
              <div className="rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500">
                <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={5} placeholder="Instructions, resources, and what students should submit." className="w-full resize-y border-0 px-3 py-2 font-normal outline-none" />
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-2">
                  <span className="text-xs text-gray-500">Attach bills, records, or letters students should reference.</span>
                  <AttachmentPicker value={assignmentAttachments} onChange={setAssignmentAttachments} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">Rubric</h3>
                <p className="text-sm text-gray-600">Attach no rubric and just use points, upload a rubric, or create a rubric on Gavel with optional auto-graded criteria.</p>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Points possible</span>
                <input
                  type="number"
                  min="0"
                  readOnly={normalizedRubric.length > 0}
                  value={normalizedRubric.length ? reflectedPoints : newPointsPossible}
                  onChange={(event) => setNewPointsPossible(event.target.value)}
                  placeholder="None"
                  className={`w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 ${normalizedRubric.length ? "bg-gray-100 text-gray-600" : ""}`}
                />
              </label>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".txt,.doc,.docx,.pdf,.csv,.xls,.xlsx,.json" className="hidden" onChange={(event) => void importRubric(event.target.files?.[0])} />
                <button type="button" onClick={() => setRubricRows((rows) => [...rows, newRubricItem()])} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Add criterion
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Upload rubric
                </button>
              </div>
            </div>

            {rubricRows.length ? (
              <div className="divide-y divide-gray-100">
                {rubricRows.map((item, index) => {
                  const option = AUTO_CRITERIA_OPTIONS.find((entry) => entry.id === item.autoCriteriaId);
                  return (
                    <div key={item.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_auto]">
                        <input value={item.title} onChange={(event) => updateRubricItem(item.id, { title: event.target.value })} placeholder={`Criterion ${index + 1}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="number" min="0" value={item.points} onChange={(event) => updateRubricItem(item.id, { points: Math.max(0, Number(event.target.value) || 0), autoPoints: item.autoCriteriaId ? Math.max(0, Number(event.target.value) || 0) : item.autoPoints })} className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        <button type="button" onClick={() => setRubricRows((rows) => rows.filter((row) => row.id !== item.id))} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Remove rubric item">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea value={item.description} onChange={(event) => updateRubricItem(item.id, { description: event.target.value })} placeholder="What earns credit for this criterion?" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">Auto-grade</div>
                          <div className="text-xs text-gray-500">{option ? option.description : "No auto-graded criterion attached."}</div>
                        </div>
                        <div ref={autoMenuRubricId === item.id ? autoMenuRef : null} className="relative">
                          <button
                            type="button"
                            onClick={() => setAutoMenuRubricId((current) => (current === item.id ? null : item.id))}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${item.autoCriteriaId ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                          >
                            <span>{option ? option.label : "Auto-grade"}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          {autoMenuRubricId === item.id ? (
                            <div className="absolute bottom-full right-0 z-[160] mb-1 max-h-72 w-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl">
                              {AUTO_CRITERIA_OPTIONS.map((entry) => (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => chooseRubricAutomation(item, entry.id)}
                                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${item.autoCriteriaId === entry.id ? "bg-blue-50" : ""}`}
                                >
                                  <span className="block font-semibold text-gray-900">{entry.label}</span>
                                  <span className="mt-0.5 block text-xs leading-4 text-gray-500">{entry.description}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {item.autoCriteriaId ? (
                          <div className="basis-full grid gap-2 sm:grid-cols-[5rem_7rem_auto_auto]">
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-gray-600">#</span>
                              <input type="number" min="1" value={item.autoTarget ?? 1} onChange={(event) => updateRubricItem(item.id, { autoTarget: Math.max(1, Number(event.target.value) || 1) })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-gray-600">Points per #</span>
                              <input type="number" min="0" value={item.autoPoints ?? item.points} onChange={(event) => updateRubricItem(item.id, { autoPoints: Math.max(0, Number(event.target.value) || 0) })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </label>
                            <label className="flex h-9 cursor-pointer items-center gap-2 self-end text-xs font-medium text-gray-700">
                              <input type="checkbox" checked={Boolean(item.extraCredit)} onChange={(event) => updateRubricItem(item.id, { extraCredit: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                              Extra credit
                            </label>
                            <button type="button" onClick={() => toggleRubricAutomation(item)} className="self-end rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No rubric yet. Use points possible alone, add criteria, or upload a rubric.
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-5">
          <button onClick={close} className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
            Cancel
          </button>
          <button onClick={() => void save()} disabled={!newTitle.trim() || saving} className="flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {saving ? "Saving..." : assignment?.id ? "Save assignment" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
