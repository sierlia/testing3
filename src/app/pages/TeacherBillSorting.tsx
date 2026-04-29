import { useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { FileText, Eye, GripVertical, Check, X } from "lucide-react";

interface Bill {
  id: string;
  number: string;
  title: string;
  text: string;
  assignedCommittee?: string;
}

interface Committee {
  id: string;
  name: string;
}

interface DragItem {
  id: string;
  type: string;
}

function DraggableBill({
  bill,
  onViewText,
}: {
  bill: Bill;
  onViewText: (bill: Bill) => void;
}) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: "bill",
    item: { id: bill.id, type: "bill" },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={preview}
      className={`bg-white rounded-lg border-2 border-gray-200 p-4 transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div ref={drag} className="cursor-move">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <div className="font-mono text-sm font-semibold text-gray-900">
            {bill.number}
          </div>
          <div className="text-sm text-gray-700">{bill.title}</div>
        </div>
        <button
          onClick={() => onViewText(bill)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View
        </button>
      </div>
    </div>
  );
}

function CommitteeDropZone({
  committee,
  bills,
  onDrop,
  onViewText,
}: {
  committee: Committee;
  bills: Bill[];
  onDrop: (billId: string, committeeId: string) => void;
  onViewText: (bill: Bill) => void;
}) {
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: "bill",
    drop: (item: DragItem) => {
      onDrop(item.id, committee.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const assignedBills = bills.filter((b) => b.assignedCommittee === committee.id);

  return (
    <div
      ref={drop}
      className={`bg-white rounded-xl shadow-lg border-2 p-6 transition-all min-h-[300px] ${
        isOver
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200"
      }`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{committee.name}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {assignedBills.length} bill{assignedBills.length !== 1 ? "s" : ""} assigned
        </p>
      </div>

      <div className="space-y-3">
        {assignedBills.length > 0 ? (
          assignedBills.map((bill) => (
            <div
              key={bill.id}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="font-mono text-sm font-semibold text-gray-900">
                    {bill.number}
                  </div>
                  <div className="text-sm text-gray-700">{bill.title}</div>
                </div>
                <button
                  onClick={() => onViewText(bill)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Drag bills here to assign</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TeacherBillSorting() {
  const [bills, setBills] = useState<Bill[]>([
    {
      id: "6",
      number: "H.R. 6",
      title: "wowabill",
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    },
    {
      id: "7",
      number: "H.R. 7",
      title: "yayabill",
      text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
    },
  ]);

  const committees: Committee[] = [
    { id: "1", name: "testingcommitteename" },
    { id: "2", name: "Agriculture Committee" },
  ];

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleDrop = (billId: string, committeeId: string) => {
    setBills(
      bills.map((b) =>
        b.id === billId ? { ...b, assignedCommittee: committeeId } : b
      )
    );
  };

  const handleViewText = (bill: Bill) => {
    setSelectedBill(bill);
  };

  const handleConfirm = () => {
    setShowConfirmModal(true);
  };

  const confirmAssignments = () => {
    console.log("Confirmed assignments:", bills);
    alert("Bill assignments confirmed!");
    setShowConfirmModal(false);
  };

  const unassignedBills = bills.filter((b) => !b.assignedCommittee);
  const hasAssignments = bills.some((b) => b.assignedCommittee);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Sort Bills into Committees
              </h1>
              <p className="text-gray-600">
                Drag and drop bills to assign them to committees
              </p>
            </div>
            {hasAssignments && (
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                <Check className="w-5 h-5" />
                Confirm Assignments
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Unassigned bills */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden sticky top-8">
                <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-5 text-white">
                  <h2 className="text-xl font-semibold">Unassigned Bills</h2>
                  <p className="text-sm text-gray-300 mt-1">
                    {unassignedBills.length} bill{unassignedBills.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="p-6 space-y-3">
                  {unassignedBills.length > 0 ? (
                    unassignedBills.map((bill) => (
                      <DraggableBill
                        key={bill.id}
                        bill={bill}
                        onViewText={handleViewText}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">All bills assigned!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Committees */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                {committees.map((committee) => (
                  <CommitteeDropZone
                    key={committee.id}
                    committee={committee}
                    bills={bills}
                    onDrop={handleDrop}
                    onViewText={handleViewText}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Bill text viewer modal */}
        {selectedBill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <span className="font-mono font-bold text-lg">
                  {selectedBill.number}
                </span>
                <h2 className="text-2xl font-bold mt-2">{selectedBill.title}</h2>
                {selectedBill.assignedCommittee && (
                  <p className="text-sm text-blue-100 mt-2">
                    Assigned to:{" "}
                    {committees.find((c) => c.id === selectedBill.assignedCommittee)
                      ?.name}
                  </p>
                )}
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <p className="text-gray-700 leading-relaxed">{selectedBill.text}</p>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-end">
                <button
                  onClick={() => setSelectedBill(null)}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                  Confirm Assignments
                </h3>
                <p className="text-gray-600 mb-4 text-center">
                  Are you sure you want to confirm these committee assignments?
                </p>

                <div className="space-y-2 mb-6">
                  {bills
                    .filter((b) => b.assignedCommittee)
                    .map((bill) => (
                      <div
                        key={bill.id}
                        className="p-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <span className="font-semibold">{bill.number}</span> →{" "}
                        <span className="text-blue-600">
                          {
                            committees.find((c) => c.id === bill.assignedCommittee)
                              ?.name
                          }
                        </span>
                      </div>
                    ))}
                </div>

                {unassignedBills.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> {unassignedBills.length} bill
                      {unassignedBills.length !== 1 ? "s" : ""} remain unassigned.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAssignments}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium"
                >
                  <Check className="w-5 h-5" />
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
