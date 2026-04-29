import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Gavel, Plus, Users, Settings, Copy, Check, KeyRound } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

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
  const [bypassAuth, setBypassAuth] = useState(false);

  useEffect(() => {
    loadUserAndClasses();
  }, []);

  const loadUserAndClasses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && !bypassAuth) {
        // Show bypass button instead of navigating
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
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('class_id', c.id).eq('role', 'student');
          return { ...c, student_count: count ?? 0 };
        }));
        setClasses(normalized as any);
      } else if (bypassAuth) {
        setUserName('Teacher (Dev Mode)');
        // Mock classes for development
        setClasses([
          {
            id: '1',
            name: 'super amazing class',
            class_code: 'SAC123',
            student_count: 24,
            created_at: new Date('2026-01-15').toISOString(),
          },
          {
            id: '2',
            name: 'testing class 123',
            class_code: 'TEST99',
            student_count: 18,
            created_at: new Date('2026-02-20').toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
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

  if (!userName && !bypassAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Button onClick={() => setBypassAuth(true)}>
            <KeyRound className="w-4 h-4 mr-2" />
            Bypass Authentication (Dev Mode)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gavel className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gavel Teacher Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {userName}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{classItem.name}</CardTitle>
                  <CardDescription>
                    Created {new Date(classItem.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Join Code</p>
                        <p className="text-2xl font-bold text-blue-600 font-mono">
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

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{classItem.student_count} students enrolled</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await setActiveClass(classItem.id);
                          navigate(`/teacher/class/${classItem.id}/manage`);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await setActiveClass(classItem.id);
                          navigate(`/teacher/class/${classItem.id}`);
                        }}
                      >
                        Open Class
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
