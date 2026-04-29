import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { CommitteeAssignmentColumn } from "../components/CommitteeAssignmentColumn";
import { Play, Eye, Send, AlertCircle } from "lucide-react";

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
  
  // Mock committees
  const committees: Committee[] = [
    { id: "education", name: "Education Committee", capacity: 6 },
    { id: "environment", name: "Environment & Energy Committee", capacity: 6 },
    { id: "healthcare", name: "Healthcare Committee", capacity: 5 },
    { id: "judiciary", name: "Judiciary Committee", capacity: 5 },
    { id: "agriculture", name: "Agriculture Committee", capacity: 4 },
  ];

  // Mock students with preferences
  const initialStudents: Student[] = [
    { id: "s1", name: "Alice Johnson", preferences: ["education", "environment", "healthcare"] },
    { id: "s2", name: "Bob Smith", preferences: ["environment", "judiciary", "education"] },
    { id: "s3", name: "Carol Martinez", preferences: ["healthcare", "education", "environment"] },
    { id: "s4", name: "David Lee", preferences: ["judiciary", "agriculture", "education"] },
    { id: "s5", name: "Emma Davis", preferences: ["environment", "healthcare", "judiciary"] },
    { id: "s6", name: "Frank Wilson", preferences: ["education", "agriculture", "healthcare"] },
    { id: "s7", name: "Grace Taylor", preferences: ["healthcare", "environment", "education"] },
    { id: "s8", name: "Henry Brown", preferences: ["judiciary", "education", "environment"] },
    { id: "s9", name: "Iris Chen", preferences: ["agriculture", "environment", "healthcare"] },
    { id: "s10", name: "Jack Anderson", preferences: ["education", "judiciary", "agriculture"] },
    { id: "s11", name: "Karen White", preferences: ["environment", "education", "healthcare"] },
    { id: "s12", name: "Liam Garcia", preferences: ["healthcare", "judiciary", "education"] },
    { id: "s13", name: "Maya Robinson", preferences: ["education", "healthcare", "environment"] },
    { id: "s14", name: "Noah Clark", preferences: ["judiciary", "environment", "agriculture"] },
    { id: "s15", name: "Olivia Lewis", preferences: ["agriculture", "education", "healthcare"] },
  ];

  const [students, setStudents] = useState<Student[]>(initialStudents);

  const runAssignmentAlgorithm = () => {
    // Simple algorithm: Try to assign students to their highest preference available
    const newStudents = [...students];
    const committeeCounts: Record<string, number> = {};
    
    // Initialize counts
    committees.forEach(c => committeeCounts[c.id] = 0);

    // Sort students randomly to be fair
    const shuffled = [...newStudents].sort(() => Math.random() - 0.5);

    shuffled.forEach(student => {
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
      s.id === studentId ? { ...s, assignedCommittee: toCommitteeId } : s
    );
    setStudents(newStudents);
  };

  const publishAssignments = () => {
    setAssignmentStage('published');
    console.log("Publishing assignments:", students);
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
                
                {assignmentStage === 'preview' && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">Preview Mode</span>
                    </div>
                    <button
                      onClick={publishAssignments}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Publish Assignments
                    </button>
                  </>
                )}

                {assignmentStage === 'published' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-md border border-green-200">
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Published</span>
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
                You'll be able to review and make manual adjustments before publishing.
              </p>
            </div>
          )}

          {(assignmentStage === 'preview' || assignmentStage === 'published') && (
            <>
              {/* Committee columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {committees.map(committee => (
                  <CommitteeAssignmentColumn
                    key={committee.id}
                    committee={committee}
                    students={getStudentsForCommittee(committee.id)}
                    moveStudent={moveStudent}
                    disabled={assignmentStage === 'published'}
                  />
                ))}
              </div>

              {/* Unassigned students */}
              {getUnassignedStudents().length > 0 && (
                <CommitteeAssignmentColumn
                  committee={{ id: 'unassigned', name: 'Unassigned Students', capacity: 999 }}
                  students={getUnassignedStudents()}
                  moveStudent={moveStudent}
                  disabled={assignmentStage === 'published'}
                  isUnassigned
                />
              )}
            </>
          )}
        </main>
      </div>
    </DndProvider>
  );
}
