import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { supabase } from '../utils/supabase';

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Array<{id:string; name:string; class_code:string}>>([]);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/signin');
    const { data: memberships } = await supabase.from('class_memberships').select('class_id').eq('user_id', user.id);
    const classIds = (memberships ?? []).map((m:any) => m.class_id);
    if (classIds.length === 0) { setLoading(false); return; }
    const { data: cls } = await supabase.from('classes').select('id,name,class_code').in('id', classIds);
    setClasses((cls ?? []) as any); setLoading(false);
  })(); }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return <div className="min-h-screen bg-gray-50"><Navigation /><main className="max-w-5xl mx-auto p-8"><div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Classes</h2><Button onClick={()=>navigate('/join-class')}>Join Class</Button></div>{classes.length===0 ? <Card><CardHeader><CardTitle>Join a Class to Continue</CardTitle></CardHeader><CardContent><Button onClick={()=>navigate('/join-class')}>Join Class</Button></CardContent></Card> : <div className="grid md:grid-cols-2 gap-4">{classes.map(c=><Card key={c.id}><CardHeader><CardTitle>{c.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600 mb-3">Join code: <span className="font-mono font-semibold">{c.class_code}</span></p><Button onClick={() => navigate('/bills')}>Go to Dashboard</Button></CardContent></Card>)}</div>}</main></div>;
}
