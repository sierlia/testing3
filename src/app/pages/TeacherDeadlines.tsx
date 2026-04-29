import { useEffect, useMemo, useState } from "react";
import { Plus, X, Calendar, Users, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";

type AudienceType = "all" | "caucus" | "party" | "committee";
type TaskType = "deadline" | "assignment";

type TaskRow = {
  id: string;
  task_type: TaskType;
  title: string;
  description: string;
  due_at: string | null;
  audience_type: AudienceType;
  audience_id: string | null;
  created_at: string;
};

export function TeacherDeadlines() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [newTaskType, setNewTaskType] = useState<TaskType>("deadline");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newAudienceType, setNewAudienceType] = useState<AudienceType>("all");
  const [newAudienceId, setNewAudienceId] = useState<string>("");

  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  const [committees, setCommittees] = useState<Array<{ id: string; name: string }>>([]);
  const [caucuses, setCaucuses] = useState<Array<{ id: string; name: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const [{ data: tRows, error: tErr }, { data: pRows }, { data: cRows }, { data: caRows }] = await Promise.all([
        supabase
          .from("class_tasks")
          .select("id,task_type,title,description,due_at,audience_type,audience_id,created_at")
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase.from("parties").select("id,name").order("name"),
        supabase.from("committees").select("id,name").order("name"),
        supabase.from("caucuses").select("id,name").order("name"),
      ]);
      if (tErr) throw tErr;
      setTasks((tRows ?? []) as any);
      setParties((pRows ?? []) as any);
      setCommittees((cRows ?? []) as any);
      setCaucuses((caRows ?? []) as any);
    } catch (e: any) {
      toast.error(e.message || "Could not load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetModal = () => {
    setShowModal(false);
    setNewTaskType("deadline");
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setNewDueTime("");
    setNewAudienceType("all");
    setNewAudienceId("");
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: pRow, error: pErr } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      if (pErr) throw pErr;
      const classId = (pRow as any)?.class_id as string | null;
      if (!classId) {
        toast.error("No active class selected");
        return;
      }

      const dueAt =
        newDueDate.trim() === ""
          ? null
          : new Date(`${newDueDate}T${(newDueTime || "23:59").trim()}:00`).toISOString();

      const audienceId = newAudienceType === "all" ? null : newAudienceId || null;
      if (newAudienceType !== "all" && !audienceId) {
        toast.error("Select a target for this task");
        return;
      }

      const { data, error } = await supabase
        .from("class_tasks")
        .insert({
          class_id: classId,
          created_by: uid,
          task_type: newTaskType,
          audience_type: newAudienceType,
          audience_id: audienceId,
          title: newTitle.trim(),
          description: newDescription.trim(),
          due_at: dueAt,
        } as any)
        .select("id,task_type,title,description,due_at,audience_type,audience_id,created_at")
        .single();
      if (error) throw error;
      setTasks((prev) => [...prev, data as any].sort((a: any, b: any) => (a.due_at || "9999").localeCompare(b.due_at || "9999")));
      toast.success("Task created");
      resetModal();
    } catch (e: any) {
      toast.error(e.message || "Could not create task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("class_tasks").delete().eq("id", id);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task deleted");
    } catch (e: any) {
      toast.error(e.message || "Could not delete task");
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "No due date";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const targetLabel = useMemo(() => {
    const partyMap = new Map(parties.map((p) => [p.id, p.name]));
    const committeeMap = new Map(committees.map((c) => [c.id, c.name]));
    const caucusMap = new Map(caucuses.map((c) => [c.id, c.name]));
    return (t: TaskRow) => {
      if (t.audience_type === "all") return "All students";
      if (t.audience_type === "party") return `Party: ${partyMap.get(t.audience_id || "") || "Unknown"}`;
      if (t.audience_type === "committee") return `Committee: ${committeeMap.get(t.audience_id || "") || "Unknown"}`;
      if (t.audience_type === "caucus") return `Caucus: ${caucusMap.get(t.audience_id || "") || "Unknown"}`;
      return t.audience_type;
    };
  }, [parties, committees, caucuses]);

  const specificOptions =
    newAudienceType === "party" ? parties : newAudienceType === "committee" ? committees : newAudienceType === "caucus" ? caucuses : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deadlines & Assignments</h1>
            <p className="text-gray-600 mt-1">Create tasks that show up on student dashboards</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Task
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">Loadingâ€¦</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks yet</h3>
            <p className="text-gray-600">Click "Add Task" to create your first deadline or assignment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((t) => (
              <div key={t.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium">
                        {t.task_type === "deadline" ? "Deadline" : "Assignment"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">{targetLabel(t)}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.title}</h3>
                    {t.description ? <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{t.description}</p> : null}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDateTime(t.due_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{targetLabel(t)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => void handleDelete(t.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Add Task</h2>
              </div>
              <button onClick={resetModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                Ã—
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="deadline">Deadline</option>
                  <option value="assignment">Assignment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Submit bill draft"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Time</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select
                  value={newAudienceType}
                  onChange={(e) => {
                    setNewAudienceType(e.target.value as AudienceType);
                    setNewAudienceId("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="all">All students</option>
                  <option value="party">Specific party</option>
                  <option value="committee">Specific committee</option>
                  <option value="caucus">Specific caucus</option>
                </select>
              </div>

              {newAudienceType !== "all" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select</label>
                  <select
                    value={newAudienceId}
                    onChange={(e) => setNewAudienceId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Choose...</option>
                    {specificOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button onClick={resetModal} className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={!newTitle.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

