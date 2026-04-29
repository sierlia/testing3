import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { GripVertical, Clock, AlertCircle } from "lucide-react";

interface Committee {
  id: string;
  name: string;
  description: string;
  meetingTime: string;
  notes?: string;
  tags: string[];
}

interface DraggableCommitteeCardProps {
  committee: Committee;
  index: number;
  moveCommittee: (dragIndex: number, hoverIndex: number) => void;
  rank: number;
  disabled?: boolean;
}

const ITEM_TYPE = "COMMITTEE";

export function DraggableCommitteeCard({
  committee,
  index,
  moveCommittee,
  rank,
  disabled = false,
}: DraggableCommitteeCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !disabled,
  });

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    hover: (item: { index: number }) => {
      if (!ref.current || disabled) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      moveCommittee(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`
        bg-white border-2 rounded-lg p-4 transition-all
        ${isDragging ? 'opacity-50 border-blue-300' : 'border-gray-200'}
        ${!disabled ? 'cursor-move hover:border-gray-300' : 'cursor-default'}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Rank indicator */}
        <div className="flex-shrink-0">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
            ${rank === 1 ? 'bg-blue-600 text-white' : ''}
            ${rank === 2 ? 'bg-blue-100 text-blue-700' : ''}
            ${rank === 3 ? 'bg-blue-50 text-blue-600' : ''}
            ${rank > 3 ? 'bg-gray-100 text-gray-600' : ''}
          `}>
            {rank}
          </div>
        </div>

        {/* Committee info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="font-semibold text-gray-900 text-lg">{committee.name}</h3>
            {!disabled && (
              <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
          </div>
          
          <p className="text-gray-600 text-sm mb-3">{committee.description}</p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{committee.meetingTime}</span>
            </div>
            
            {committee.notes && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>{committee.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
