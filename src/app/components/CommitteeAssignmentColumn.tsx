import { useDrop } from "react-dnd";
import { DraggableStudentCard } from "./DraggableStudentCard";
import { Users, AlertTriangle } from "lucide-react";

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

interface CommitteeAssignmentColumnProps {
  committee: Committee;
  students: Student[];
  moveStudent: (studentId: string, toCommitteeId: string) => void;
  disabled?: boolean;
  isUnassigned?: boolean;
}

const STUDENT_ITEM_TYPE = "STUDENT";

export function CommitteeAssignmentColumn({
  committee,
  students,
  moveStudent,
  disabled = false,
  isUnassigned = false,
}: CommitteeAssignmentColumnProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: STUDENT_ITEM_TYPE,
    drop: (item: { studentId: string }) => {
      moveStudent(item.studentId, committee.id);
    },
    canDrop: () => !disabled && (!isUnassigned ? students.length < committee.capacity : true),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const isOverCapacity = students.length > committee.capacity;
  const isAtCapacity = students.length === committee.capacity;

  return (
    <div
      ref={drop}
      className={`
        bg-white rounded-lg shadow-sm border-2 p-4 transition-all min-h-[200px]
        ${isUnassigned ? 'border-red-300 bg-red-50' : 'border-gray-200'}
        ${isOver && canDrop ? 'border-blue-400 bg-blue-50' : ''}
        ${isOver && !canDrop ? 'border-red-400 bg-red-50' : ''}
      `}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-semibold ${isUnassigned ? 'text-red-900' : 'text-gray-900'}`}>
            {committee.name}
          </h3>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span className={`font-medium ${
              isOverCapacity ? 'text-red-600' : 
              isAtCapacity ? 'text-amber-600' : 
              'text-gray-600'
            }`}>
              {students.length}{!isUnassigned && ` / ${committee.capacity}`}
            </span>
          </div>
        </div>

        {isOverCapacity && !isUnassigned && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            <AlertTriangle className="w-3 h-3" />
            <span>Over capacity by {students.length - committee.capacity}</span>
          </div>
        )}
      </div>

      {/* Students */}
      <div className="space-y-2">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {isUnassigned ? 'No unassigned students' : 'Drag students here'}
          </div>
        ) : (
          students.map((student) => (
            <DraggableStudentCard
              key={student.id}
              student={student}
              currentCommitteeId={committee.id}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}
