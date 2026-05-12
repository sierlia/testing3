import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Plus, Users, Copy, Check, Search, GripVertical } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Navigation } from '../components/Navigation';

interface ClassData {
  id: string;
  name: string;
  class_code: string;
  student_count: number;
  created_at: string;
  invite_status?: "approved" | "invited" | "pending";
}

const CLASS_REORDER_ENABLED_KEY = "gavel:teacher-classes:reorder-enabled";
const CLASS_ORDER_KEY = "gavel:teacher-classes:manual-order";

function createdDesc(a: ClassData, b: ClassData) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function savedClassOrder() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLASS_ORDER_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reorderEnabled, setReorderEnabled] = useState(() => window.localStorage.getItem(CLASS_REORDER_ENABLED_KEY) === "true");
  const [draggedClassId, setDraggedClassId] = useState<string | null>(null);
  const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before");

  const applyClassOrder = (rows: ClassData[]) => {
    if (!reorderEnabled) return [...rows].sort(createdDesc);
    const order = savedClassOrder();
    const index = new Map(order.map((id, orderIndex) => [id, orderIndex]));
    return [...rows].sort((a, b) => {
      const ai = index.has(a.id) ? index.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.id) ? index.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ai - bi || createdDesc(a, b);
    });
  };

  useEffect(() => {
    loadUserAndClasses();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CLASS_REORDER_ENABLED_KEY, String(reorderEnabled));
    setClasses((current) => applyClassOrder(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderEnabled]);

  const loadUserAndClasses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        setLoading(false);
        return;
      }

      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        setUserName(user?.user_metadata?.name || 'Teacher');

        const [{ data: ownedRows, error }, { data: membershipRows }] = await Promise.all([
          supabase
            .from('classes')
            .select('id, name, class_code, created_at')
            .eq('teacher_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('class_memberships')
            .select('class_id,status')
            .eq('user_id', session.user.id)
            .eq('role', 'teacher'),
        ]);
        if (error) throw error;
        const membershipClassIds = [...new Set((membershipRows ?? []).map((row: any) => row.class_id).filter(Boolean))];
        const { data: membershipClasses } = membershipClassIds.length
          ? await supabase.from('classes').select('id,name,class_code,created_at').in('id', membershipClassIds)
          : ({ data: [] } as any);
        const membershipClassMap = new Map((membershipClasses ?? []).map((row: any) => [row.id, row]));
        const classMap = new Map<string, any>();
        for (const c of ownedRows ?? []) classMap.set((c as any).id, { ...(c as any), invite_status: "approved" });
        for (const row of membershipRows ?? []) {
          const cls = membershipClassMap.get((row as any).class_id);
          if (cls) classMap.set(cls.id, { ...cls, invite_status: (row as any).status ?? "approved" });
        }
        const classRows = Array.from(classMap.values()).sort(createdDesc);

        const normalizedIds = (classRows ?? []).map((c) => c.id).filter(Boolean);
        const { data: studentMemberships } = normalizedIds.length
          ? await supabase
              .from('class_memberships')
              .select('class_id')
              .in('class_id', normalizedIds)
              .eq('role', 'student')
              .eq('status', 'approved')
          : ({ data: [] } as any);
        const studentCounts = new Map<string, number>();
        for (const row of studentMemberships ?? []) {
          const id = (row as any).class_id as string;
          studentCounts.set(id, (studentCounts.get(id) ?? 0) + 1);
        }
        const normalized = (classRows ?? []).map((c) => ({ ...c, student_count: studentCounts.get(c.id) ?? 0 }));
        setClasses(applyClassOrder(normalized as any));
      }
    } catch {
      toast.error('Error loading classes');
    } finally {
      setLoading(false);
    }
  };

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Join code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const setActiveClass = async (classId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').upsert({
        user_id: user.id,
        class_id: classId,
        role: 'teacher',
        display_name: user.user_metadata?.name ?? null,
      });
    } catch {
      // best-effort
    }
  };

  const openClass = async (classId: string) => {
    await setActiveClass(classId);
    navigate("/dashboard");
  };

  const updateInvitation = async (classId: string, accepted: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = accepted
      ? await supabase
          .from('class_memberships')
          .update({ status: 'approved', approved_at: new Date().toISOString() } as any)
          .eq('class_id', classId)
          .eq('user_id', user.id)
      : await supabase.from('class_memberships').delete().eq('class_id', classId).eq('user_id', user.id);
    if (error) return toast.error(error.message || 'Could not update invitation');
    if (accepted) await setActiveClass(classId);
    toast.success(accepted ? 'Invitation accepted' : 'Invitation declined');
    await loadUserAndClasses();
  };

  const moveClass = (fromId: string, toId: string, position: "before" | "after") => {
    setClasses((current) => {
      const fromIndex = current.findIndex((item) => item.id === fromId);
      const toIndex = current.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      const targetIndex = next.findIndex((classItem) => classItem.id === toId);
      next.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, item);
      window.localStorage.setItem(CLASS_ORDER_KEY, JSON.stringify(next.map((classItem) => classItem.id)));
      return next;
    });
  };

  const visibleClasses = classes.filter((classItem) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || classItem.name.toLowerCase().includes(query) || classItem.class_code.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Classes</h2>
            <p className="text-gray-600 mt-1">Manage your legislative simulation classes</p>
          </div>
          <Button size="lg" onClick={() => navigate('/teacher/create-class')}>
            <Plus className="w-5 h-5 mr-2" />
            Create New Class
          </Button>
        </div>

        {classes.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search classes..."
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {classes.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setReorderEnabled((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${reorderEnabled ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  <GripVertical className="h-4 w-4" />
                  {reorderEnabled ? "Class reordering enabled" : "Enable class reordering"}
                </button>
                <span className="text-xs text-gray-500">{reorderEnabled ? (searchQuery.trim() ? "Clear search to drag classes." : "Drag classes by their rows.") : "Uses the newest-created order until enabled."}</span>
              </div>
            )}
          </div>
        )}

        {classes.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first class to start a legislative simulation
              </p>
              <Button onClick={() => navigate('/teacher/create-class')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {visibleClasses.map((classItem) => {
              const canDrag = reorderEnabled && !searchQuery.trim();
              const showDropLine = canDrag && draggedClassId && draggedClassId !== classItem.id && dragOverClassId === classItem.id;
              return (
              <div key={classItem.id} className="relative">
                {showDropLine && dragOverPosition === "before" && <div className="absolute left-0 right-0 top-0 z-10 h-0.5 bg-blue-500" />}
                <div
                  role="button"
                  tabIndex={0}
                  draggable={canDrag}
                  onDragStart={(event) => {
                    if (!canDrag) return;
                    setDraggedClassId(classItem.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", classItem.id);
                  }}
                  onDragOver={(event) => {
                    if (!canDrag || !draggedClassId) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDragOverClassId(classItem.id);
                    setDragOverPosition(event.clientY > rect.top + rect.height / 2 ? "after" : "before");
                  }}
                  onDragEnd={() => {
                    setDraggedClassId(null);
                    setDragOverClassId(null);
                  }}
                  onDrop={(event) => {
                    if (!canDrag) return;
                    event.preventDefault();
                    const fromId = event.dataTransfer.getData("text/plain") || draggedClassId;
                    if (fromId && fromId !== classItem.id) moveClass(fromId, classItem.id, dragOverPosition);
                    setDraggedClassId(null);
                    setDragOverClassId(null);
                  }}
                  onClick={() => classItem.invite_status === 'approved' ? void openClass(classItem.id) : undefined}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && classItem.invite_status === 'approved') void openClass(classItem.id);
                  }}
                  className={`flex w-full flex-col gap-4 border-b border-gray-200 p-4 text-left transition-colors last:border-b-0 hover:bg-gray-50 md:flex-row md:items-center md:justify-between ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggedClassId === classItem.id ? "opacity-50" : ""}`}
                >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {canDrag && <GripVertical className="h-5 w-5 flex-shrink-0 text-gray-400" />}
                    <h3 className="truncate text-lg font-semibold text-gray-900">{classItem.name}</h3>
                  </div>
                  {classItem.invite_status !== 'approved' && <p className="mt-1 text-sm font-medium text-blue-700">Pending teacher invitation</p>}
                  <p className="text-sm text-gray-500">Created {new Date(classItem.created_at).toLocaleDateString()}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{classItem.student_count} students enrolled</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {classItem.invite_status !== 'approved' && (
                    <div className="flex gap-2">
                      <Button onClick={(event) => { event.stopPropagation(); void updateInvitation(classItem.id, true); }}>Accept</Button>
                      <Button variant="outline" onClick={(event) => { event.stopPropagation(); void updateInvitation(classItem.id, false); }}>Decline</Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-md bg-blue-50 px-3 py-2">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Join Code</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xl font-bold text-blue-600">
                            {classItem.class_code}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyJoinCode(classItem.class_code);
                            }}
                          >
                            {copiedCode === classItem.class_code ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
                {showDropLine && dragOverPosition === "after" && <div className="absolute bottom-0 left-0 right-0 z-10 h-0.5 bg-blue-500" />}
              </div>
            );
            })}
            {visibleClasses.length === 0 && <div className="p-8 text-center text-sm text-gray-500">No classes match your search.</div>}
          </div>
        )}
      </main>
    </div>
  );
}
