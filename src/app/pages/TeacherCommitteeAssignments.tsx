import { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { CommitteeAssignmentColumn } from "../components/CommitteeAssignmentColumn";
import { Play, Save, AlertCircle } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  preferences: string[];
  assignedCommittee?: string;
}

interface Committee {
  id: string;
  name: string;
  capacity: number;
}

export function TeacherCommitteeAssignments() {
  const [assignmentStage, setAssignmentStage] = useState<'pending' | 'preview' | 'published'>('pending');

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

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

        setCommittees((committeeRows ?? []).map((c: any) => ({ id: c.id, name: c.name, capacity: baseCap })));

        const studentIds = (studentRows ?? []).map((s: any) => s.user_id);
        const { data: prefRows } = await supabase
          .from("committee_preferences")
          .select("user_id,committee_id,rank")
          .eq("class_id", cid)
          .in("user_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

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
        const assignedByUser = new Map<string, string>();
        for (const r of existingMemberships ?? []) assignedByUser.set((r as any).user_id, (r as any).committee_id);
        if (assignedByUser.size > 0) setAssignmentStage("published");

        setStudents(
          (studentRows ?? []).map((s: any) => ({
            id: s.user_id,
            name: s.display_name ?? "Student",
            preferences: prefsByUser.get(s.user_id) ?? [],
            assignedCommittee: assignedByUser.get(s.user_id),
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
    const newStudents = [...students];
    const committeeCounts: Record<string, number> = {};
    
    // Initialize counts
    committees.forEach(c => committeeCounts[c.id] = 0);

    // Sort students randomly to be fair
    const shuffled = [...newStudents].sort(() => Math.random() - 0.5);

    shuffled.forEach(student => {
      student.assignedCommittee = undefined;
      // Try preferences in order
      for (const pref of student.preferences) {
        const committee = committees.find(c => c.id === pref);
        if (committee && committeeCounts[pref] < committee.capacity) {
          student.assignedCommittee = pref;
          committeeCounts[pref]++;
          break;
        }
      }
      
      // If no preference available, assign to first available committee
      if (!student.assignedCommittee) {
        for (const committee of committees) {
          if (committeeCounts[committee.id] < committee.capacity) {
            student.assignedCommittee = committee.id;
            committeeCounts[committee.id]++;
            break;
          }
        }
      }
    });

    setStudents(newStudents);
    setAssignmentStage('preview');
  };

  const moveStudent = (studentId: string, toCommitteeId: string) => {
    const newStudents = students.map(s => 
      s.id === studentId ? { ...s, assignedCommittee: toCommitteeId === "unassigned" ? undefined : toCommitteeId } : s
    );
    setStudents(newStudents);
    if (assignmentStage === "published") setAssignmentStage("preview");
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
        const rows = students.filter((s) => s.assignedCommittee).map((s) => ({ committee_id: s.assignedCommittee, user_id: s.id, role: "member" }));
        if (rows.length) {
          const { error } = await supabase.from("committee_members").insert(rows as any);
          if (error) throw error;
        }
        toast.success("Assignments saved");
        setAssignmentStage('published');
      } catch (e: any) {
        toast.error(e.message || "Could not save assignments");
      }
    })();
  };

  const getStudentsForCommittee = (committeeId: string) => {
    return students.filter(s => s.assignedCommittee === committeeId);
  };

  const getUnassignedStudents = () => {
    return students.filter(s => !s.assignedCommittee);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
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
                    Run Assignment Algorithm
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
                {students.length} total students • {committees.length} committees
              </div>
            </div>
          </div>

          {assignmentStage === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-blue-900 mb-2">Ready to Assign Committees</h3>
              <p className="text-blue-700 text-sm mb-4">
                Click "Run Assignment Algorithm" to automatically assign students to committees based on their preferences.
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
                  students={getUnassignedStudents()}
                  moveStudent={moveStudent}
                  isUnassigned
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {committees.map(committee => (
                  <CommitteeAssignmentColumn
                    key={committee.id}
                    committee={committee}
                    students={getStudentsForCommittee(committee.id)}
                    moveStudent={moveStudent}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </DndProvider>
  );
}
