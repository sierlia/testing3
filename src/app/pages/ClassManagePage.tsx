import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Copy, Check, UserX } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Navigation } from '../components/Navigation';

interface Student { id: string; name: string; email: string; joinedAt: string; status: "approved" | "pending"; }
interface ClassDetails { id: string; name: string; description: string; joinCode: string; createdAt: string; }

export function ClassManagePage() {
  const { classId } = useParams(); const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true); const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => { loadClassData(); }, [classId]);

  const loadClassData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && classId) {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          class_id: classId,
          role: 'teacher',
          display_name: user.user_metadata?.name ?? null,
        });
      }

      const { data: cls, error: cErr } = await supabase.from('classes').select('id,name,class_code,created_at,settings').eq('id', classId).single();
      if (cErr) throw cErr;
      setClassDetails({ id: cls.id, name: cls.name, joinCode: cls.class_code, createdAt: cls.created_at, description: cls.settings?.description ?? '' });

      const { data: roster, error: rErr } = await supabase
        .from('class_memberships')
        .select('user_id, created_at, status, email')
        .eq('class_id', classId)
        .eq('role', 'student');
      if (rErr) throw rErr;

      const userIds = (roster ?? []).map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id,display_name')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const rows = (roster ?? []).map((r: any) => ({
        id: r.user_id,
        name: profileMap.get(r.user_id)?.display_name ?? 'Student',
        email: r.email ?? 'N/A',
        joinedAt: r.created_at,
        status: (r.status ?? 'approved') as 'approved' | 'pending',
      }));
      setStudents(rows);
    } catch (error) { console.error('Error loading class data:', error); toast.error('Failed to load class data'); }
    finally { setLoading(false); }
  };

  const removeStudent = async (studentId: string) => {
    const { error } = await supabase.from('class_memberships').delete().eq('user_id', studentId).eq('class_id', classId);
    if (error) return toast.error('Failed to remove student');
    toast.success('Student removed'); loadClassData();
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!classDetails) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Button onClick={() => navigate('/teacher/dashboard')}>Back</Button></div>;

  return <div className="min-h-screen bg-gray-50"><Navigation />
  <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-8"><h1 className="text-3xl font-bold text-gray-900">{classDetails.name}</h1><p className="text-sm text-gray-600 mt-1">Class Management</p></div><div className="grid lg:grid-cols-2 gap-6 mb-8"><Card><CardHeader><CardTitle className="text-lg">Join Code</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"><div className="text-3xl font-bold text-blue-600 font-mono">{classDetails.joinCode}</div><Button size="sm" variant="ghost" onClick={() => {navigator.clipboard.writeText(classDetails.joinCode);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),1500)}}>{copiedCode ? <Check className="w-5 h-5 text-green-600"/> : <Copy className="w-5 h-5"/>}</Button></div></CardContent></Card>
  <Card><CardHeader><CardTitle className="text-lg">Total Students</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold text-gray-900">{students.length}</div></CardContent></Card></div>
  <Tabs defaultValue="students"><TabsList><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
  <TabsContent value="students"><Card><CardHeader><CardTitle>Student Roster</CardTitle></CardHeader><CardContent>{students.length===0? <div className="py-8 text-center"><Users className="w-10 h-10 mx-auto text-gray-400"/><p>No students yet.</p></div> : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{students.map(s=><TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.email}</TableCell><TableCell>{new Date(s.joinedAt).toLocaleDateString()}</TableCell><TableCell><Badge variant="default">{s.status === 'pending' ? 'approved' : s.status}</Badge></TableCell><TableCell className="text-right space-x-2"><Button variant="ghost" size="sm" onClick={()=>removeStudent(s.id)}><UserX className="w-4 h-4"/></Button></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card></TabsContent>
  <TabsContent value="settings"><Card><CardHeader><CardTitle>Class Settings</CardTitle><CardDescription>{classDetails.description || 'No description set.'}</CardDescription></CardHeader></Card></TabsContent></Tabs></main></div>;
}
