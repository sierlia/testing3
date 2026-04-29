import { Check, Circle, Clock } from "lucide-react";

interface TimelineStage {
  stage: string;
  status: 'completed' | 'current' | 'upcoming';
  date: string | null;
}

interface BillStatusTimelineProps {
  timeline: TimelineStage[];
}

export function BillStatusTimeline({ timeline }: BillStatusTimelineProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Timeline</h2>
      
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />

        {/* Timeline items */}
        <div className="space-y-4">
          {timeline.map((item, index) => (
            <div key={index} className="relative flex items-start gap-4">
              {/* Icon */}
              <div className="relative z-10 flex-shrink-0">
                {item.status === 'completed' && (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                {item.status === 'current' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                )}
                {item.status === 'upcoming' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Circle className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className={`font-medium ${
                    item.status === 'upcoming' ? 'text-gray-500' : 'text-gray-900'
                  }`}>
                    {item.stage}
                  </h3>
                  {item.date && (
                    <span className="text-sm text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {item.status === 'current' && (
                  <p className="text-sm text-blue-600 mt-1">Current stage</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
