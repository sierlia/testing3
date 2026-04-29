import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Plus, X, Calendar, Users } from "lucide-react";

interface Deadline {
  id: string;
  task: string;
  dueDate: string;
  dueTime: string;
  targetAudience: "all" | "caucus" | "party" | "committee";
  specificTarget?: string;
}

export function TeacherDeadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([
    {
      id: "1",
      task: "Submit Bill Proposal",
      dueDate: "2026-03-20",
      dueTime: "17:00",
      targetAudience: "all",
    },
    {
      id: "2",
      task: "Committee Meeting Preparation",
      dueDate: "2026-03-22",
      dueTime: "14:00",
      targetAudience: "caucus",
      specificTarget: "testing",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newTargetAudience, setNewTargetAudience] = useState<"all" | "caucus" | "party" | "committee">("all");
  const [newSpecificTarget, setNewSpecificTarget] = useState("");

  const handleAddDeadline = () => {
    if (!newTask || !newDueDate) return;

    const deadline: Deadline = {
      id: Date.now().toString(),
      task: newTask,
      dueDate: newDueDate,
      dueTime: newDueTime || "23:59",
      targetAudience: newTargetAudience,
      specificTarget: newTargetAudience !== "all" ? newSpecificTarget : undefined,
    };

    setDeadlines([...deadlines, deadline]);
    setShowModal(false);
    setNewTask("");
    setNewDueDate("");
    setNewDueTime("");
    setNewTargetAudience("all");
    setNewSpecificTarget("");
  };

  const handleDeleteDeadline = (id: string) => {
    setDeadlines(deadlines.filter(d => d.id !== id));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTargetText = (deadline: Deadline) => {
    if (deadline.targetAudience === "all") return "All Students";
    if (deadline.targetAudience === "caucus" && deadline.specificTarget) {
      return `Caucus: ${deadline.specificTarget}`;
    }
    if (deadline.targetAudience === "party" && deadline.specificTarget) {
      return `Party: ${deadline.specificTarget}`;
    }
    if (deadline.targetAudience === "committee" && deadline.specificTarget) {
      return `Committee: ${deadline.specificTarget}`;
    }
    return deadline.targetAudience;
  };

  const sortedDeadlines = [...deadlines].sort((a, b) => {
    const dateA = new Date(`${a.dueDate}T${a.dueTime}`);
    const dateB = new Date(`${b.dueDate}T${b.dueTime}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deadlines & Assignments</h1>
            <p className="text-gray-600 mt-1">Manage student deadlines and tasks</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Deadline
          </button>
        </div>

        {/* Deadlines List */}
        <div className="space-y-4">
          {sortedDeadlines.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No deadlines yet</h3>
              <p className="text-gray-600">Click "Add Deadline" to create your first assignment</p>
            </div>
          ) : (
            sortedDeadlines.map(deadline => (
              <div key={deadline.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{deadline.task}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {formatDate(deadline.dueDate)} at {formatTime(deadline.dueTime)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{getTargetText(deadline)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDeadline(deadline.id)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-red-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add Deadline Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add New Deadline</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Task Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task / Assignment
                </label>
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g., Submit Bill Proposal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Due Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Time (Optional)
                </label>
                <input
                  type="time"
                  value={newDueTime}
                  onChange={(e) => setNewDueTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <select
                  value={newTargetAudience}
                  onChange={(e) => {
                    setNewTargetAudience(e.target.value as "all" | "caucus" | "party" | "committee");
                    setNewSpecificTarget("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="all">All Students</option>
                  <option value="caucus">Specific Caucus</option>
                  <option value="party">Specific Party</option>
                  <option value="committee">Specific Committee</option>
                </select>
              </div>

              {/* Specific Target */}
              {newTargetAudience === "caucus" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Caucus
                  </label>
                  <select
                    value={newSpecificTarget}
                    onChange={(e) => setNewSpecificTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Choose a caucus...</option>
                    <option value="testing">testing</option>
                  </select>
                </div>
              )}

              {newTargetAudience === "party" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Party
                  </label>
                  <select
                    value={newSpecificTarget}
                    onChange={(e) => setNewSpecificTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Choose a party...</option>
                    <option value="Democratic">Democratic Party</option>
                    <option value="Republican">Republican Party</option>
                  </select>
                </div>
              )}

              {newTargetAudience === "committee" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Committee
                  </label>
                  <select
                    value={newSpecificTarget}
                    onChange={(e) => setNewSpecificTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Choose a committee...</option>
                    <option value="" disabled>No committees available</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddDeadline}
                disabled={!newTask || !newDueDate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Add Deadline
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
