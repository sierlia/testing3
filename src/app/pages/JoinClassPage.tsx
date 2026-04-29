import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

export function JoinClassPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const joinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/signin');

      const { data: classRow, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('class_code', joinCode.toUpperCase())
        .single();
      if (classError || !classRow) throw new Error('Invalid class code');

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        class_id: classRow.id,
        role: 'student',
        display_name: user.user_metadata?.name ?? null,
      });
      if (profileError) throw profileError;

      toast.success(`Joined ${classRow.name}`);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Could not join class');
    } finally {
      setLoading(false);
    }
  };

  return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Join a Class</CardTitle><CardDescription>Enter your teacher's class code.</CardDescription></CardHeader><CardContent><form onSubmit={joinClass} className="space-y-4"><div><Label htmlFor="code">Class Code</Label><Input id="code" value={joinCode} onChange={(e)=>setJoinCode(e.target.value.toUpperCase())} maxLength={6} className="uppercase" required /></div><Button className="w-full" disabled={loading}>{loading ? 'Joining...' : 'Join Class'}</Button></form></CardContent></Card></div>;
}
