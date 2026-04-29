import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Gavel, ArrowLeft, WandSparkles } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function CreateClassPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sessionLength: '90',
    classCode: generateClassCode(),
    allowedParties: ['Democrat', 'Republican'] as string[],
    allowStudentCreatedParties: false,
    committeeAssignmentMode: 'preference',
    chairElectionMode: 'elected',
    chairVoteThresholdPct: '50',
    billTabs: ['legislative text', 'supporting text'] as string[],
    committees: [
      'Education Committee',
      'Environment & Energy Committee',
      'Healthcare Committee',
      'Judiciary Committee',
      'Agriculture Committee',
    ] as string[],
  });

  const canSubmit = useMemo(() => formData.name.trim().length > 0 && formData.classCode.length === 6, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/signin');

      const settings = {
        description: formData.description,
        sessionLengthMinutes: Number(formData.sessionLength),
        parties: {
          allowed: formData.allowedParties,
          allowStudentCreated: formData.allowStudentCreatedParties,
        },
        committees: {
          enabled: formData.committees,
          assignmentMode: formData.committeeAssignmentMode,
          chairElectionMode: formData.chairElectionMode,
          chairVoteThresholdPct: Number(formData.chairVoteThresholdPct),
        },
        bills: { tabs: formData.billTabs },
      };

      const { error } = await supabase.from('classes').insert({
        teacher_id: user.id,
        name: formData.name.trim(),
        class_code: formData.classCode,
        settings,
      });

      if (error) throw error;
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
      <header className="bg-white border-b"><div className="container mx-auto px-4 py-4"><div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/dashboard')}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Gavel className="w-8 h-8 text-blue-600" /><h1 className="text-2xl font-bold text-gray-900">Create New Class</h1>
      </div></div></header>

      <main className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><Card><CardHeader><CardTitle>Class & Simulation Setup</CardTitle><CardDescription>Set up your simulation and generate a class code for student enrollment.</CardDescription></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2"><Label htmlFor="name">Class Name *</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="sessionLength">Session Length (minutes)</Label><Input id="sessionLength" type="number" min="30" max="180" value={formData.sessionLength} onChange={(e) => setFormData({ ...formData, sessionLength: e.target.value })} /></div>
            <div className="space-y-2"><Label>Class Code</Label><div className="flex gap-2"><Input value={formData.classCode} onChange={(e) => setFormData({ ...formData, classCode: e.target.value.toUpperCase().slice(0, 6) })} /><Button type="button" variant="outline" onClick={() => setFormData({ ...formData, classCode: generateClassCode() })}><WandSparkles className="w-4 h-4 mr-2" />Regenerate</Button></div></div>
          </div>

          <div className="space-y-2"><Label>Allowed Parties (comma-separated)</Label><Input value={formData.allowedParties.join(', ')} onChange={(e) => setFormData({ ...formData, allowedParties: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Committee Assignment</Label><select className="mt-1 w-full border rounded-md px-3 py-2" value={formData.committeeAssignmentMode} onChange={(e) => setFormData({ ...formData, committeeAssignmentMode: e.target.value })}><option value="preference">Preference Assigned</option><option value="random">Random</option><option value="self-join">Student Self-Join</option></select></div>
            <div><Label>Chair Selection</Label><select className="mt-1 w-full border rounded-md px-3 py-2" value={formData.chairElectionMode} onChange={(e) => setFormData({ ...formData, chairElectionMode: e.target.value })}><option value="elected">Member Vote</option><option value="teacher-assigned">Teacher Assigned</option></select></div>
          </div>

          <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => navigate('/teacher/dashboard')} className="flex-1">Cancel</Button><Button type="submit" disabled={loading || !canSubmit} className="flex-1">{loading ? 'Creating...' : 'Create Class & Save Settings'}</Button></div>
        </form>
      </CardContent></Card></div></main>
    </div>
  );
}
