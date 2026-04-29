import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Calendar, Clock, Save, Send, GripVertical } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

interface Bill {
  id: string;
  number: string;
  title: string;
  committee: string;
}

interface ScheduledBill {
  billId: string;
  day: string;
  timeSlot: string;
}

const DraggableBill = ({ bill }: { bill: Bill }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'bill',
    item: { bill },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`p-3 bg-white border border-gray-200 rounded-md cursor-move hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm font-semibold text-gray-900 block">
            {bill.number}
          </span>
          <p className="text-sm text-gray-700 line-clamp-2">{bill.title}</p>
          <p className="text-xs text-gray-500 mt-1">{bill.committee}</p>
        </div>
      </div>
    </div>
  );
};

const TimeSlot = ({ 
  day, 
  time, 
  scheduledBill, 
  bills, 
  onDrop 
}: { 
  day: string; 
  time: string; 
  scheduledBill?: ScheduledBill;
  bills: Bill[];
  onDrop: (billId: string, day: string, time: string) => void;
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'bill',
    drop: (item: { bill: Bill }) => {
      onDrop(item.bill.id, day, time);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const bill = scheduledBill ? bills.find(b => b.id === scheduledBill.billId) : null;

  return (
    <div
      ref={drop}
      className={`min-h-[80px] p-2 border border-gray-200 rounded transition-colors ${
        isOver ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {bill && (
        <div className="p-2 bg-blue-100 border border-blue-300 rounded text-sm">
          <span className="font-mono font-semibold text-blue-900 block">{bill.number}</span>
          <p className="text-xs text-blue-700 line-clamp-1">{bill.title}</p>
        </div>
      )}
    </div>
  );
};

export function CalendarScheduling() {
  const userRole = 'leadership'; // or 'teacher' or 'student'
  const isTeacher = false;

  const [readyBills] = useState<Bill[]>([
    { id: "1", number: "H.R. 101", title: "Education Funding Enhancement Act", committee: "Education" },
    { id: "2", number: "H.R. 104", title: "Criminal Justice Reform Act", committee: "Judiciary" },
    { id: "3", number: "H.R. 105", title: "Agricultural Sustainability Act", committee: "Agriculture" },
  ]);

  const [scheduled, setScheduled] = useState<ScheduledBill[]>([]);
  const [isDraft, setIsDraft] = useState(true);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"];

  const handleDrop = (billId: string, day: string, time: string) => {
    // Remove bill from other slots
    const filtered = scheduled.filter(s => s.billId !== billId);
    setScheduled([...filtered, { billId, day, timeSlot: time }]);
  };

  const handleSaveDraft = () => {
    console.log("Saving draft:", scheduled);
    alert("Draft saved!");
  };

  const handleSubmit = () => {
    console.log("Submitting schedule:", scheduled);
    setIsDraft(false);
    alert("Schedule submitted! Awaiting teacher approval.");
  };

  const unscheduledBills = readyBills.filter(
    bill => !scheduled.some(s => s.billId === bill.id)
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Floor Calendar Scheduling</h1>
              <p className="text-gray-600">
                {userRole === 'leadership' 
                  ? 'Schedule bills for floor debate'
                  : 'View the published floor calendar'}
              </p>
            </div>
            {isDraft && (
              <div className="flex items-center gap-2 text-sm px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                <Clock className="w-4 h-4" />
                Draft
              </div>
            )}
          </div>

          {userRole === 'leadership' ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left panel - Ready bills */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-gray-900">Ready to Schedule</h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Drag bills to calendar slots
                  </p>
                  <div className="space-y-3">
                    {unscheduledBills.map(bill => (
                      <DraggableBill key={bill.id} bill={bill} />
                    ))}
                    {unscheduledBills.length === 0 && (
                      <p className="text-sm text-gray-500 italic">All bills scheduled</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Main panel - Calendar */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                    <h2 className="text-lg font-semibold">This Week's Schedule</h2>
                    <p className="text-sm text-blue-100">
                      {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 4), 'MMMM d, yyyy')}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-24">
                            Time
                          </th>
                          {days.map(day => (
                            <th key={day.toString()} className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                              <div>{format(day, 'EEEE')}</div>
                              <div className="text-gray-500 font-normal">{format(day, 'MMM d')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {timeSlots.map(time => (
                          <tr key={time}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-700 align-top">
                              {time}
                            </td>
                            {days.map(day => {
                              const dayStr = format(day, 'yyyy-MM-dd');
                              const scheduledBill = scheduled.find(
                                s => s.day === dayStr && s.timeSlot === time
                              );
                              return (
                                <td key={dayStr} className="px-2 py-2">
                                  <TimeSlot
                                    day={dayStr}
                                    time={time}
                                    scheduledBill={scheduledBill}
                                    bills={readyBills}
                                    onDrop={handleDrop}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={handleSaveDraft}
                    className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Submit Schedule
                  </button>
                </div>

                {isTeacher && (
                  <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-900 mb-2">Teacher Controls</h3>
                    <p className="text-sm text-amber-700 mb-3">
                      Configure whether submitted schedules are instantly visible or require approval
                    </p>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="approval" className="text-blue-600" defaultChecked />
                        <span className="text-sm text-gray-700">Require approval</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="approval" className="text-blue-600" />
                        <span className="text-sm text-gray-700">Auto-publish</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Public view - Published calendar only
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <h2 className="text-lg font-semibold">Published Floor Calendar</h2>
                <p className="text-sm text-blue-100">
                  {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 4), 'MMMM d, yyyy')}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-24">
                        Time
                      </th>
                      {days.map(day => (
                        <th key={day.toString()} className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                          <div>{format(day, 'EEEE')}</div>
                          <div className="text-gray-500 font-normal">{format(day, 'MMM d')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {timeSlots.map(time => (
                      <tr key={time}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-700 align-top">
                          {time}
                        </td>
                        {days.map(day => {
                          const dayStr = format(day, 'yyyy-MM-dd');
                          const scheduledBill = scheduled.find(
                            s => s.day === dayStr && s.timeSlot === time
                          );
                          const bill = scheduledBill ? readyBills.find(b => b.id === scheduledBill.billId) : null;

                          return (
                            <td key={dayStr} className="px-2 py-2">
                              <div className="min-h-[60px] p-2">
                                {bill && (
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                    <span className="font-mono font-semibold text-blue-900 block">{bill.number}</span>
                                    <p className="text-xs text-blue-700 line-clamp-1">{bill.title}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </DndProvider>
  );
}
