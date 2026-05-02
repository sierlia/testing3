import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Plus, Users, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Navigation } from '../components/Navigation';

interface ClassData {
  id: string;
  name: string;
  class_code: string;
  student_count: number;
  created_at: string;
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndClasses();
  }, []);

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

        const { data: classRows, error } = await supabase
          .from('classes')
          .select('id, name, class_code, created_at')
          .eq('teacher_id', session.user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const normalized = await Promise.all((classRows ?? []).map(async (c) => {
          const { count } = await supabase
            .from('class_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id)
            .eq('role', 'student')
            .eq('status', 'approved');
          return { ...c, student_count: count ?? 0 };
        }));
        setClasses(normalized as any);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
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
      <main className="container mx-auto px-4 py-8">
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
            {classes.map((classItem) => (
              <div key={classItem.id} className="flex flex-col gap-4 border-b border-gray-200 p-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-gray-900">{classItem.name}</h3>
                  <p className="text-sm text-gray-500">Created {new Date(classItem.created_at).toLocaleDateString()}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{classItem.student_count} students enrolled</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Join Code</p>
                        <p className="font-mono text-xl font-bold text-blue-600">
                          {classItem.class_code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyJoinCode(classItem.class_code)}
                      >
                        {copiedCode === classItem.class_code ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                  </div>

                  <Button
                    size="sm"
                    className="sm:w-28"
                    onClick={async () => {
                      await setActiveClass(classItem.id);
                      navigate(`/teacher/class/${classItem.id}`);
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
