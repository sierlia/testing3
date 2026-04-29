import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Navigation } from '../components/Navigation';
import { supabase } from '../utils/supabase';
import { MapPin, Flag, PenSquare, Save, X } from 'lucide-react';
import constituencies from '../data/constituencies.json';

export function StudentProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [billsAuthored, setBillsAuthored] = useState<any[]>([]);
  const [billsCosponsored, setBillsCosponsored] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});

  const allParties = useMemo(() => ['Democrat', 'Republican', 'Independent', 'Green', 'Libertarian'], []);

  useEffect(() => { (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = id === 'me' || !id ? auth.user?.id : id;
    if (!uid) return;

    const { data: p } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    setProfile(p ?? { user_id: uid, display_name: '', party: null, constituency_name: null, personal_statement: '' });

    const { data: ba } = await supabase.from('bill_display').select('id,hr_label,title,status').eq('author_user_id', uid).order('bill_number');
    setBillsAuthored(ba ?? []);

    const { data: bc } = await supabase
      .from('bill_cosponsors')
      .select('bill_id,bills!inner(id,title,bill_number,status)')
      .eq('user_id', uid);
    setBillsCosponsored((bc ?? []).map((r:any)=>({id:r.bills.id,hr_label:`H.R. ${r.bills.bill_number}`,title:r.bills.title,status:r.bills.status})));

    const classId = p?.class_id;
    if (classId) {
      const { data: cm } = await supabase.from('class_memberships').select('class_id,role').eq('user_id', uid);
      setMemberships(cm ?? []);
    }
  })(); }, [id]);

  const saveField = async (field: string) => {
    const next = { ...profile, [field]: draft[field] };
    const { error } = await supabase.from('profiles').upsert({ user_id: profile.user_id, [field]: draft[field], role: profile.role ?? 'student', class_id: profile.class_id ?? null });
    if (!error) setProfile(next);
    setEditing(null);
  };

  const selectConstituency = async (c: any) => {
    const patch = { constituency_name: c.name, constituency_url: c.wikipedia_url || null, constituency_population: c.population, constituency_cook_pvi: c.cook_pvi };
    await supabase.from('profiles').upsert({ user_id: profile.user_id, ...patch, role: profile.role ?? 'student', class_id: profile.class_id ?? null });
    setProfile({ ...profile, ...patch });
    setEditing(null);
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return <div className="min-h-screen bg-gray-50"><Navigation />
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between"><div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{profile.display_name || 'N/A'}</h1><button onClick={()=>{setDraft({...draft,display_name:profile.display_name||''});setEditing('display_name')}}><PenSquare className="w-4 h-4 text-gray-500"/></button></div>
          <div className="mt-2 text-sm text-gray-700 space-y-1">
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span>{profile.constituency_name || 'N/A'}</span><button onClick={()=>setEditing('constituency')} className="text-blue-600">Select District</button></div>
            <div className="flex items-center gap-2"><Flag className="w-4 h-4" /><span>{profile.party || 'N/A'}</span><button onClick={()=>setEditing('party')} className="text-blue-600">Select Party</button></div>
          </div>
        </div></div>
      </div>

      <div className="bg-white rounded-lg border p-6"><div className="flex items-center gap-2 mb-2"><h2 className="font-semibold">Personal Statement</h2><button onClick={()=>{setDraft({...draft,personal_statement:profile.personal_statement||''});setEditing('personal_statement')}}><PenSquare className="w-4 h-4 text-gray-500"/></button></div><p className="text-gray-700 whitespace-pre-wrap">{profile.personal_statement || 'N/A'}</p></div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6"><h3 className="font-semibold mb-3">Legislation Written</h3>{billsAuthored.length===0?<p className="text-sm text-gray-500">N/A</p>:<ul className="space-y-2 text-sm">{billsAuthored.map((b:any)=><li key={b.id}>{b.hr_label}: {b.title}</li>)}</ul>}</div>
        <div className="bg-white rounded-lg border p-6"><h3 className="font-semibold mb-3">Legislation Cosponsored</h3>{billsCosponsored.length===0?<p className="text-sm text-gray-500">N/A</p>:<ul className="space-y-2 text-sm">{billsCosponsored.map((b:any)=><li key={b.id}>{b.hr_label}: {b.title}</li>)}</ul>}</div>
      </div>

      <div className="bg-white rounded-lg border p-6"><h3 className="font-semibold mb-3">Groups & Memberships</h3>{memberships.length===0?<p className="text-sm text-gray-500">N/A</p>:<ul className="text-sm space-y-1">{memberships.map((m:any,idx:number)=><li key={idx}>Class {m.class_id.slice(0,8)} ({m.role})</li>)}</ul>}</div>
    </main>

    {editing==='display_name' && <Modal title="Edit Name" onClose={()=>setEditing(null)}><input className="w-full border rounded p-2" value={draft.display_name ?? ''} onChange={(e)=>setDraft({...draft,display_name:e.target.value})}/><ModalActions onSave={()=>saveField('display_name')} onCancel={()=>setEditing(null)} /></Modal>}
    {editing==='personal_statement' && <Modal title="Edit Personal Statement" onClose={()=>setEditing(null)}><textarea className="w-full border rounded p-2 min-h-32" value={draft.personal_statement ?? ''} onChange={(e)=>setDraft({...draft,personal_statement:e.target.value})}/><ModalActions onSave={()=>saveField('personal_statement')} onCancel={()=>setEditing(null)} /></Modal>}
    {editing==='party' && <Modal title="Select Party" onClose={()=>setEditing(null)}><div className="space-y-2">{allParties.map(p=><button key={p} className="w-full text-left border rounded p-2 hover:bg-gray-50" onClick={()=>{setDraft({...draft,party:p}); saveField('party');}}>{p}</button>)}</div></Modal>}
    {editing==='constituency' && <Modal title="Select District" onClose={()=>setEditing(null)}><div className="max-h-80 overflow-auto space-y-2">{(constituencies as any[]).map(c=><button key={c.name} className="w-full text-left border rounded p-2 hover:bg-gray-50" onClick={()=>selectConstituency(c)}><div className="font-medium">{c.name}</div><div className="text-xs text-gray-500">Cook PVI: {c.cook_pvi || 'N/A'} • Population: {c.population ?? 'N/A'}</div></button>)}</div></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: any) { return <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg p-4 w-full max-w-xl"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold">{title}</h3><button onClick={onClose}><X className="w-4 h-4"/></button></div>{children}</div></div>; }
function ModalActions({ onSave, onCancel }: any) { return <div className="flex justify-end gap-2 mt-3"><button className="px-3 py-2 border rounded" onClick={onCancel}>Cancel</button><button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={onSave}><Save className="w-4 h-4 inline mr-1"/>Save</button></div>; }
