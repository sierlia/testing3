import { useState } from "react";
import { Building2, Settings, Hand, Play } from "lucide-react";

interface Bill {
  id: string;
  number: string;
  committee: string;
  currentStatus: string;
  hasHold: boolean;
}

interface BillActionsProps {
  bill: Bill;
  userRole: 'student' | 'teacher' | 'leadership';
  currentUserId: string;
}

export function BillActions({ bill, userRole, currentUserId }: BillActionsProps) {
  const [selectedCommittee, setSelectedCommittee] = useState(bill.committee);
  const [selectedStatus, setSelectedStatus] = useState(bill.currentStatus);

  const committees = [
    "Education Committee",
    "Environment & Energy Committee",
    "Healthcare Committee",
    "Judiciary Committee",
    "Agriculture Committee",
  ];

  const statuses = [
    "Draft",
    "In Committee",
    "Reported",
    "Calendared",
    "Voted - Passed",
    "Voted - Failed",
    "Sent to Senate",
    "Signed",
    "Vetoed",
  ];

  const handleAssignCommittee = () => {
    console.log("Assigning to committee:", selectedCommittee);
    alert(`Bill assigned to ${selectedCommittee}`);
  };

  const handleOverrideStatus = () => {
    console.log("Overriding status to:", selectedStatus);
    alert(`Status changed to ${selectedStatus}`);
  };

  // Only show actions for leadership and teachers
  if (userRole === 'student') {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          {userRole === 'leadership' ? 'Leadership Actions' : 'Teacher Actions'}
        </h2>
      </div>

      <div className="space-y-4">
        {/* Leadership: Assign to Committee */}
        {userRole === 'leadership' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Assign to Committee</h3>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedCommittee}
                onChange={(e) => setSelectedCommittee(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              >
                {committees.map(committee => (
                  <option key={committee} value={committee}>{committee}</option>
                ))}
              </select>
              <button
                onClick={handleAssignCommittee}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Assign
              </button>
            </div>
          </div>
        )}

        {/* Teacher: Override Status */}
        {userRole === 'teacher' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Hand className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-amber-900">Override Bill Status</h3>
            </div>
            <p className="text-sm text-amber-700 mb-3">
              As a teacher, you can manually change the bill's status for educational purposes.
            </p>
            <div className="flex items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button
                onClick={handleOverrideStatus}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium text-sm"
              >
                Override
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
