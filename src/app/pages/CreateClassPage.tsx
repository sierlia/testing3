import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { WandSparkles } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { Navigation } from '../components/Navigation';

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}


async function ensureClassesTableExists() {
  const { error } = await supabase.from('classes').select('id').limit(1);
  if (error && (error as any).code === 'PGRST205') {
    throw new Error("Database is not initialized yet. Run Supabase migrations first (supabase link --project-ref qrtccdwxolfuuucadosa && supabase db push).");
  }
}

export function CreateClassPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    classCode: generateClassCode(),
  });

  const canSubmit = useMemo(() => formData.name.trim().length > 0 && formData.classCode.length === 6, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/signin');

      await ensureClassesTableExists();

      const defaultParties = ['Democratic Party', 'Republican Party'];
      const defaultCommittees = [
        'Education Committee',
        'Environment & Energy Committee',
        'Healthcare Committee',
        'Judiciary Committee',
        'Agriculture Committee',
      ];
      const settings = {
        description: formData.description,
        parties: {
          allowed: defaultParties,
          allowStudentCreated: false,
          requireApproval: true,
        },
        committees: {
          enabled: defaultCommittees,
          assignmentMode: 'preference',
          allowSelfJoin: false,
          chairElectionMode: 'elected',
          chairVoteThresholdPct: 50,
        },
        bills: { tabs: ['legislative text', 'supporting text'], assignmentAuthority: 'teacher' },
        floor: { binding: true, calendarAutoPublish: true },
        class: { joinEnabled: false },
        workflow: { stage: "setup" },
        students: { requireJoinApproval: false },
      };

      const { data: createdClass, error } = await supabase.from('classes').insert({
        teacher_id: user.id,
        name: formData.name.trim(),
        class_code: formData.classCode,
        settings,
      }).select('id').single();

      if (error) throw error;

      // Ensure teacher profile exists and is set to this class
      await supabase.from('profiles').upsert({
        user_id: user.id,
        class_id: createdClass.id,
        role: 'teacher',
        display_name: user.user_metadata?.name ?? null,
      });

      // Seed committees and parties from settings so they appear on Organizations pages
      if (defaultCommittees.length > 0) {
        await supabase.from('committees').insert(
          defaultCommittees.map((name) => ({
            class_id: createdClass.id,
            name,
            description: '',
          })),
        );
      }

      if (defaultParties.length > 0) {
        await supabase.from('parties').insert(
          defaultParties.map((name) => ({
            class_id: createdClass.id,
            name,
            platform: '',
            created_by: user.id,
            approved: true,
          })),
        );
      }

      toast.success(`Class created. Join code: ${formData.classCode}`);
      navigate('/teacher/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><Card><CardHeader><CardTitle>Create New Class</CardTitle><CardDescription>Set up your simulation and generate a class code for student enrollment.</CardDescription></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2"><Label htmlFor="name">Class Name *</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
          <div className="space-y-2"><Label>Class Code</Label><div className="flex gap-2"><Input value={formData.classCode} onChange={(e) => setFormData({ ...formData, classCode: e.target.value.toUpperCase().slice(0, 6) })} /><Button type="button" variant="outline" onClick={() => setFormData({ ...formData, classCode: generateClassCode() })}><WandSparkles className="w-4 h-4 mr-2" />Regenerate</Button></div></div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Simulation options are configured after creation from the teacher setup dashboard.
          </div>

          <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => navigate('/teacher/dashboard')} className="flex-1">Cancel</Button><Button type="submit" disabled={loading || !canSubmit} className="flex-1">{loading ? 'Creating...' : 'Create Class'}</Button></div>
        </form>
      </CardContent></Card></div></main>
    </div>
  );
}
