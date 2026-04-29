import { AlertCircle } from "lucide-react";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  status: string;
  hasHold: boolean;
}

interface BillPipelineSidebarProps {
  bills: Bill[];
  selectedBill: Bill | null;
  onSelectBill: (bill: Bill) => void;
  stage: string;
}

export function BillPipelineSidebar({ bills, selectedBill, onSelectBill, stage }: BillPipelineSidebarProps) {
  const getStageTitle = () => {
    const titles: Record<string, string> = {
      clerk: "At Clerk's Desk",
      committees: "In Committee",
      floor: "On Floor",
      calendar: "On Calendar",
    };
    return titles[stage] || "Bills";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Pending Review": "bg-gray-100 text-gray-700",
      "In Committee": "bg-blue-100 text-blue-700",
      "Floor Debate": "bg-purple-100 text-purple-700",
      "Scheduled for Vote": "bg-yellow-100 text-yellow-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <h2 className="font-semibold">{getStageTitle()}</h2>
        <p className="text-sm text-blue-100">{bills.length} bills</p>
      </div>

      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {bills.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No bills in this stage
          </div>
        ) : (
          bills.map(bill => (
            <button
              key={bill.id}
              onClick={() => onSelectBill(bill)}
              className={`w-full text-left p-4 transition-colors ${
                selectedBill?.id === bill.id
                  ? 'bg-blue-50 border-l-4 border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {bill.number}
                </span>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(bill.status)}`}>
                    {bill.status}
                  </span>
                  {bill.hasHold && (
                    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded font-medium bg-amber-100 text-amber-700">
                      <AlertCircle className="w-3 h-3" />
                      Hold
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                {bill.title}
              </h3>
              <p className="text-xs text-gray-600">Sponsor: {bill.sponsor}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
