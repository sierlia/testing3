import { useRef } from "react";
import { useDrag } from "react-dnd";
import { GripVertical, Star } from "lucide-react";

interface Student {
  id: string;
  name: string;
  preferences: string[];
  preferenceLabels?: string[];
  assignedCommittees?: string[];
  inLobbyistGroup?: boolean;
}

interface DraggableStudentCardProps {
  student: Student;
  currentCommitteeId: string;
  disabled?: boolean;
}

const STUDENT_ITEM_TYPE = "STUDENT";

export function DraggableStudentCard({
  student,
  currentCommitteeId,
  disabled = false,
}: DraggableStudentCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: STUDENT_ITEM_TYPE,
    item: { studentId: student.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !disabled,
  });

  drag(ref);

  // Determine if this is a preferred assignment
  const preferenceRank = student.preferences.indexOf(currentCommitteeId);
  const isTopChoice = preferenceRank === 0;
  const isInPreferences = preferenceRank >= 0;

  return (
    <div
      ref={ref}
      title={student.preferences.length ? `Rankings: ${(student.preferenceLabels ?? student.preferences).map((pref, index) => `${index + 1}. ${pref}`).join(", ")}` : "No rankings submitted"}
      className={`
        bg-gray-50 border rounded-md px-3 py-2 flex items-center justify-between gap-2 transition-all
        ${isDragging ? 'opacity-50' : ''}
        ${!disabled ? 'cursor-move hover:bg-gray-100' : 'cursor-default opacity-70'}
        ${isTopChoice ? 'border-green-300 bg-green-50' : 'border-gray-200'}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {student.name}
          </span>
          {isTopChoice && (
            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex-shrink-0">
              <Star className="w-3 h-3" />
              <span>1st choice</span>
            </div>
          )}
          {!isTopChoice && isInPreferences && (
            <div className="text-xs text-gray-500 flex-shrink-0">
              {preferenceRank + 1}
              {preferenceRank === 1 ? 'nd' : preferenceRank === 2 ? 'rd' : 'th'} choice
            </div>
          )}
        </div>
        {student.inLobbyistGroup && (
          <div className="mt-0.5 text-xs text-gray-500">
            Already in a lobbyist group.
          </div>
        )}
      </div>
      {!disabled && (
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}
    </div>
  );
}
