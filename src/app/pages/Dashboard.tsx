import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { supabase } from '../utils/supabase';

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [joinedClass, setJoinedClass] = useState<{id:string; name:string; class_code:string} | null>(null);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/signin');
    const { data: profile } = await supabase.from('profiles').select('class_id').eq('user_id', user.id).single();
    if (!profile?.class_id) { setLoading(false); return; }
    const { data: cls } = await supabase.from('classes').select('id,name,class_code').eq('id', profile.class_id).single();
    setJoinedClass(cls as any); setLoading(false);
  })(); }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!joinedClass) return <div className="min-h-screen bg-gray-50"><Navigation /><main className="max-w-3xl mx-auto p-8"><Card><CardHeader><CardTitle>Join a Class to Continue</CardTitle></CardHeader><CardContent><Button onClick={()=>navigate('/join-class')}>Join Class</Button></CardContent></Card></main></div>;

  return <div className="min-h-screen bg-gray-50"><Navigation /><main className="max-w-5xl mx-auto p-8"><Card><CardHeader><CardTitle>{joinedClass.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Join code: <span className="font-mono font-semibold">{joinedClass.class_code}</span></p><div className="mt-4"><Button onClick={() => navigate(`/profile/me`)}>Go to profile</Button></div></CardContent></Card></main></div>;
}
