import { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import { CommitteeAssignmentColumn } from "../components/CommitteeAssignmentColumn";
import { Play, Save, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  preferences: string[];
  preferenceLabels?: string[];
  assignedCommittees: string[];
}

interface Committee {
  id: string;
  name: string;
  capacity: number;
}

export function TeacherCommitteeAssignments() {
  const navigate = useNavigate();
  const [assignmentStage, setAssignmentStage] = useState<'pending' | 'preview' | 'published'>('pending');

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [globalCapacity, setGlobalCapacity] = useState(0);
  const [assignmentsPerStudent, setAssignmentsPerStudent] = useState(1);
  const [classSettings, setClassSettings] = useState<any>({});
  const [submissionCount, setSubmissionCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;
        const { data: prof } = await supabase.from("profiles").select("class_id,role").eq("user_id", me).maybeSingle();
        const cid = (prof as any)?.class_id ?? null;
        setClassId(cid);
        if (!cid) return;
        const { data: classRow } = await supabase.from("classes").select("settings").eq("id", cid).maybeSingle();
        const settings = (classRow as any)?.settings ?? {};
        setClassSettings(settings);
        const savedCapacities = settings?.committees?.capacities ?? {};
        setAssignmentsPerStudent(Math.max(1, Number(settings?.committees?.assignmentsPerStudent ?? 1) || 1));

        const { data: committeeRows, error: cErr } = await supabase
          .from("committees")
          .select("id,name")
          .eq("class_id", cid)
          .order("created_at", { ascending: true });
        if (cErr) throw cErr;

        const { data: studentRows, error: sErr } = await supabase
          .from("profiles")
          .select("user_id,display_name,role,class_id")
          .eq("class_id", cid)
          .eq("role", "student")
          .order("display_name", { ascending: true });
        if (sErr) throw sErr;

        const numStudents = (studentRows ?? []).length;
        const numCommittees = Math.max(1, (committeeRows ?? []).length);
        const baseCap = Math.ceil(numStudents / numCommittees);

        const nextCommittees = (committeeRows ?? []).map((c: any) => ({ id: c.id, name: c.name, capacity: Math.max(1, Number(savedCapacities[c.id] ?? baseCap) || baseCap) }));
        setCommittees(nextCommittees);
        setGlobalCapacity(baseCap);

        const studentIds = (studentRows ?? []).map((s: any) => s.user_id);
        const { data: prefRows } = await supabase
          .from("committee_preferences")
          .select("user_id,committee_id,rank")
          .eq("class_id", cid)
          .in("user_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

        const { count: submittedCount } = await supabase
          .from("committee_preference_submissions")
          .select("*", { count: "exact", head: true })
          .eq("class_id", cid)
          .in("user_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
        setSubmissionCount(submittedCount ?? 0);

        const prefsByUser = new Map<string, string[]>();
        for (const r of prefRows ?? []) {
          const uid = (r as any).user_id as string;
          const arr = prefsByUser.get(uid) ?? [];
          arr.push((r as any).committee_id as string);
          prefsByUser.set(uid, arr);
        }
        // ensure sorted by rank
        const rankBy = new Map<string, number>();
        for (const r of prefRows ?? []) rankBy.set(`${(r as any).user_id}|${(r as any).committee_id}`, (r as any).rank);
        for (const [uid, arr] of prefsByUser.entries()) {
          arr.sort((a, b) => (rankBy.get(`${uid}|${a}`) ?? 999) - (rankBy.get(`${uid}|${b}`) ?? 999));
        }

        const { data: existingMemberships } = await supabase.from("committee_members").select("committee_id,user_id").in("user_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
        const assignedByUser = new Map<string, string[]>();
        for (const r of existingMemberships ?? []) {
          const uid = (r as any).user_id;
          assignedByUser.set(uid, [...(assignedByUser.get(uid) ?? []), (r as any).committee_id]);
        }
        if (assignedByUser.size > 0) setAssignmentStage("published");

        setStudents(
          (studentRows ?? []).map((s: any) => ({
            id: s.user_id,
            name: s.display_name ?? "Student",
            preferences: prefsByUser.get(s.user_id) ?? [],
            assignedCommittees: assignedByUser.get(s.user_id) ?? [],
          })),
        );
      } catch (e: any) {
        toast.error(e.message || "Could not load committee assignment data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const runAssignmentAlgorithm = () => {
    if (committees.length === 0) return;
    const newStudents = students.map((student) => ({ ...student, assignedCommittees: [] as string[] }));
    const committeeCounts: Record<string, number> = {};
    committees.forEach(c => committeeCounts[c.id] = 0);
    const randomMode = classSettings?.committees?.assignmentMode === "random";
    const randomCommitteeIds = () => committees.map((committee) => committee.id).sort(() => Math.random() - 0.5);

    for (let round = 0; round < assignmentsPerStudent; round += 1) {
      const ordered = randomMode
        ? [...newStudents].sort(() => Math.random() - 0.5)
        : [...newStudents].sort((a, b) => {
            const aChoice = a.preferences[round] ? 0 : 1;
            const bChoice = b.preferences[round] ? 0 : 1;
            return aChoice - bChoice || a.name.localeCompare(b.name);
          });

      for (const student of ordered) {
        const rankedChoices = randomMode
          ? randomCommitteeIds()
          : [...student.preferences, ...committees.map((committee) => committee.id)].filter((id, index, arr) => arr.indexOf(id) === index);
        for (const committeeId of rankedChoices) {
          const committee = committees.find(c => c.id === committeeId);
          if (!committee || student.assignedCommittees.includes(committeeId)) continue;
          if (committeeCounts[committeeId] < committee.capacity) {
            student.assignedCommittees.push(committeeId);
            committeeCounts[committeeId]++;
            break;
          }
        }
      }
    }

    const unfilled = newStudents.filter((student) => student.assignedCommittees.length < assignmentsPerStudent).length;
    if (unfilled) toast.warning(`${unfilled} student${unfilled === 1 ? "" : "s"} could not receive all requested committee assignments because capacity is full.`);

    setStudents(newStudents);
    setAssignmentStage('preview');
  };

  const moveStudent = (studentId: string, toCommitteeId: string) => {
    const newStudents = students.map((s) => {
      if (s.id !== studentId) return s;
      if (toCommitteeId === "unassigned") return { ...s, assignedCommittees: [] };
      const next = s.assignedCommittees.includes(toCommitteeId)
        ? s.assignedCommittees.filter((id) => id !== toCommitteeId)
        : [...(s.assignedCommittees.length >= assignmentsPerStudent ? s.assignedCommittees.slice(1) : s.assignedCommittees), toCommitteeId];
      return { ...s, assignedCommittees: next };
    });
    setStudents(newStudents);
    if (assignmentStage === "published") setAssignmentStage("preview");
  };

  const applyGlobalCapacity = () => {
    setCommittees((prev) => prev.map((committee) => ({ ...committee, capacity: Math.max(1, globalCapacity) })));
  };

  const saveCapacitySettings = async (nextCommittees = committees, nextAssignmentsPerStudent = assignmentsPerStudent) => {
    if (!classId) return;
    const capacities = Object.fromEntries(nextCommittees.map((committee) => [committee.id, committee.capacity]));
    const nextSettings = {
      ...classSettings,
      committees: {
        ...(classSettings.committees ?? {}),
        capacities,
        assignmentsPerStudent: nextAssignmentsPerStudent,
      },
    };
    setClassSettings(nextSettings);
    await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
  };

  const saveAssignments = () => {
    void (async () => {
      if (!classId) return;
      try {
        const committeeIds = committees.map((c) => c.id);
        const studentIds = students.map((s) => s.id);
        // Clear existing committee memberships for these committees, then insert assigned
        // (delete filter by committee_id only to match RLS teacher policy)
        if (committeeIds.length) {
          await supabase.from("committee_members").delete().in("committee_id", committeeIds);
        }
        const rows = students.flatMap((s) => s.assignedCommittees.map((committeeId) => ({ committee_id: committeeId, user_id: s.id, role: "member" })));
        if (rows.length) {
          const { error } = await supabase.from("committee_members").insert(rows as any);
          if (error) throw error;
        }
        await saveCapacitySettings();
        toast.success("Assignments saved");
        setAssignmentStage('published');
      } catch (e: any) {
        toast.error(e.message || "Could not save assignments");
      }
    })();
  };

  const getStudentsForCommittee = (committeeId: string) => {
    return students.filter(s => s.assignedCommittees.includes(committeeId));
  };

  const getUnassignedStudents = () => {
    return students.filter(s => s.assignedCommittees.length === 0);
  };

  const withPreferenceLabels = (rows: Student[]) => {
    const names = new Map(committees.map((committee) => [committee.id, committee.name]));
    return rows.map((student) => ({ ...student, preferenceLabels: student.preferences.map((id) => names.get(id) ?? id) }));
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Committee Assignments</h1>
            <p className="text-gray-600">
              Run the assignment algorithm, preview results, and make manual adjustments
            </p>
          </div>

          {/* Action bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {assignmentStage === 'pending' && (
                  <button
                    onClick={runAssignmentAlgorithm}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Play className="w-4 h-4" />
                    {classSettings?.committees?.assignmentMode === "random" ? "Run Random Assignment" : "Run Assignment Algorithm"}
                  </button>
                )}
                
                {(assignmentStage === 'preview' || assignmentStage === 'published') && (
                  <>
                    <button
                      onClick={saveAssignments}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save Assignments
                    </button>
                  </>
                )}

                {assignmentStage === 'published' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-md border border-green-200">
                    <Save className="w-4 h-4" />
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600">
                {classSettings?.committees?.assignmentMode === "random"
                  ? `${students.length} total students • ${committees.length} committees`
                  : `${submissionCount} of ${students.length} students submitted preferences • ${committees.length} committees`}
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                Committees per student
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, committees.length)}
                  value={assignmentsPerStudent}
                  onChange={(event) => setAssignmentsPerStudent(Math.max(1, Math.min(committees.length || 1, Number(event.target.value) || 1)))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Set all max capacities
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={globalCapacity}
                    onChange={(event) => setGlobalCapacity(Math.max(1, Number(event.target.value) || 1))}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2"
                  />
                  <button type="button" onClick={applyGlobalCapacity} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Apply
                  </button>
                </div>
              </label>
              <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                Hover a student card to see their submitted committee rankings.
              </div>
            </div>
          </div>

          {assignmentStage === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-blue-900 mb-2">Ready to Assign Committees</h3>
              <p className="text-blue-700 text-sm mb-4">
                {classSettings?.committees?.assignmentMode === "random"
                  ? "Click \"Run Random Assignment\" to randomly assign students to committees."
                  : "Click \"Run Assignment Algorithm\" to automatically assign students to committees based on their preferences."}
              </p>
              <p className="text-blue-600 text-xs">
                You'll be able to review, make manual adjustments, and save the assignments.
              </p>
            </div>
          )}

          {(assignmentStage === 'preview' || assignmentStage === 'published') && (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div>
                <CommitteeAssignmentColumn
                  committee={{ id: 'unassigned', name: 'Unassigned Students', capacity: 999 }}
                  students={withPreferenceLabels(getUnassignedStudents())}
                  moveStudent={moveStudent}
                  isUnassigned
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {committees.map(committee => (
                  <div key={committee.id} className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Max capacity
                      <input
                        type="number"
                        min={1}
                        value={committee.capacity}
                        onChange={(event) => setCommittees((prev) => prev.map((row) => row.id === committee.id ? { ...row, capacity: Math.max(1, Number(event.target.value) || 1) } : row))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-medium normal-case tracking-normal"
                      />
                    </label>
                    <CommitteeAssignmentColumn
                      committee={committee}
                      students={withPreferenceLabels(getStudentsForCommittee(committee.id))}
                      moveStudent={moveStudent}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </DndProvider>
  );
}
