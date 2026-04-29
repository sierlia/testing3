import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Navigation } from '../components/Navigation';
import { supabase } from '../utils/supabase';
import { MapPin, Flag, Pencil, FileText, Users, Mail } from 'lucide-react';
import constituencies from '../data/constituencies.json';

const BOX_KEYS = ['personal_statement', 'constituency_description', 'key_issues'];

export function StudentProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [billsAuthored, setBillsAuthored] = useState<any[]>([]);
  const [billsCosponsored, setBillsCosponsored] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const allParties = useMemo(() => ['Democrat', 'Republican', 'Independent', 'Green', 'Libertarian'], []);

  useEffect(() => { (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = id === 'me' || !id ? auth.user?.id : id;
    if (!uid) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    const pr = p ?? { user_id: uid, display_name: '', party: null, constituency_name: null, written_responses: {} };
    setProfile(pr); setUpdatedAt(pr.updated_at || pr.created_at || new Date().toISOString());

    const { data: ba } = await supabase.from('bill_display').select('id,hr_label,title,status').eq('author_user_id', uid).order('bill_number');
    setBillsAuthored(ba ?? []);
    const { data: bc } = await supabase.from('bill_cosponsors').select('bill_id,bills!inner(id,title,bill_number,status)').eq('user_id', uid);
    setBillsCosponsored((bc ?? []).map((r:any)=>({id:r.bills.id,hr_label:`H.R. ${r.bills.bill_number}`,title:r.bills.title,status:r.bills.status})));
  })(); }, [id]);

  const saveProfile = async (patch: any, syncName = false) => {
    const payload = { user_id: profile.user_id, role: profile.role ?? 'student', class_id: profile.class_id ?? null, ...patch, updated_at: new Date().toISOString() };
    await supabase.from('profiles').upsert(payload);
    if (syncName && patch.display_name) await supabase.auth.updateUser({ data: { name: patch.display_name } });
    setProfile({ ...profile, ...patch }); setUpdatedAt(new Date().toISOString());
  };

  const updateResponse = (key: string, value: string) => {
    const next = { ...(profile.written_responses || {}), [key]: value };
    setProfile({ ...profile, written_responses: next });
    saveProfile({ written_responses: next });
  };

  const uploadAvatar = async (f: File) => {
    const ext = f.name.split('.').pop(); const path = `${profile.user_id}/${Date.now()}.${ext}`;
    await supabase.storage.from('avatars').upload(path, f, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await saveProfile({ avatar_url: data.publicUrl });
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  const district = (constituencies as any[]).find(c => c.name === profile.constituency_name);

  return <div className="min-h-screen bg-gray-50"><Navigation />
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-lg border p-6 relative">
        <div className="absolute top-3 right-3 text-xs text-gray-500 flex items-center gap-2">{new Date(updatedAt).toLocaleString()} <Pencil className="w-3 h-3 text-blue-600" /></div>
        <div className="flex items-start gap-4">
          <label className="cursor-pointer">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover"/> : <div className="w-16 h-16 rounded-full bg-blue-100"/>}
            <input type="file" className="hidden" accept="image/*" onChange={(e)=>e.target.files?.[0]&&uploadAvatar(e.target.files[0])} />
          </label>
          <div className="flex-1">
            <input className="text-2xl font-bold w-full" value={profile.display_name || ''} onChange={(e)=>setProfile({...profile,display_name:e.target.value})} onBlur={()=>saveProfile({display_name:profile.display_name}, true)} placeholder="Your name" />
            <div className="mt-2 text-sm text-gray-700 space-y-1">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span>{profile.constituency_name || 'N/A'}</span><button onClick={()=>setEditing('constituency')} className="text-blue-600">Select District</button></div>
              <div className="flex items-center gap-2"><Flag className="w-4 h-4" /><span>{profile.party || 'N/A'}</span><button onClick={()=>setEditing('party')} className="text-blue-600">Select Party</button></div>
              <div className="text-xs text-gray-500">Population: {district?.population ?? 'N/A'} • Cook PVI: {district?.cook_pvi ?? 'N/A'} {district?.wikipedia_url ? <a href={district.wikipedia_url} target="_blank" className="text-blue-600">Wikipedia</a> : null}</div>
            </div>
          </div>
        </div>
      </div>

      {BOX_KEYS.map((k) => (
        <div key={k} className="bg-white rounded-lg border p-6 relative">
          <div className="absolute top-3 right-3 text-xs text-gray-500 flex items-center gap-2">{new Date(updatedAt).toLocaleString()} <Pencil className="w-3 h-3 text-blue-600" /></div>
          <h3 className="font-semibold mb-2">{k.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}</h3>
          <textarea className="w-full min-h-28 border rounded p-2" value={(profile.written_responses||{})[k] || ''} onChange={(e)=>updateResponse(k,e.target.value)} placeholder="Write here..." />
        </div>
      ))}

      <div className="grid md:grid-cols-3 gap-6">
        <Section icon={<FileText className="w-4 h-4"/>} title="Legislation Written" items={billsAuthored.map((b:any)=>`${b.hr_label}: ${b.title}`)} />
        <Section icon={<Users className="w-4 h-4"/>} title="Legislation Cosponsored" items={billsCosponsored.map((b:any)=>`${b.hr_label}: ${b.title}`)} />
        <Section icon={<Mail className="w-4 h-4"/>} title="Dear Colleague Letters" items={[]} />
      </div>
    </main>

    {editing==='party' && <Picker title="Select Party" options={allParties} onPick={(p)=>{saveProfile({party:p});setEditing(null);}} onClose={()=>setEditing(null)} />}
    {editing==='constituency' && <Picker title="Select District" options={(constituencies as any[]).map(c=>c.name)} onPick={(name)=>{saveProfile({constituency_name:name});setEditing(null);}} onClose={()=>setEditing(null)} />}
  </div>;
}

function Section({ icon, title, items }: any) { return <div className="bg-white rounded-lg border p-6"><div className="flex items-center gap-2 font-semibold mb-2">{icon}{title}</div>{items.length===0?<p className="text-sm text-gray-500">N/A</p>:<ul className="text-sm space-y-1">{items.map((i:string)=><li key={i}>{i}</li>)}</ul>}</div>; }
function Picker({ title, options, onPick, onClose }: any){ return <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg p-4 w-full max-w-xl"><div className="flex justify-between mb-2"><h3 className="font-semibold">{title}</h3><button onClick={onClose}>Close</button></div><div className="max-h-80 overflow-auto space-y-2">{options.map((o:string)=><button key={o} className="w-full text-left border rounded p-2 hover:bg-gray-50" onClick={()=>onPick(o)}>{o}</button>)}</div></div></div>; }
