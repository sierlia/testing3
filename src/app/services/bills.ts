import { supabase } from '../utils/supabase';
import { BillRecord } from '../types/domain';

export async function fetchBillsForCurrentClass() {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('user_id', me)
    .maybeSingle();
  if (profileError) throw profileError;
  const classId = (profile as any)?.class_id;
  if (!classId) return [];

  const { data, error } = await supabase
    .from('bill_display')
    .select('id, hr_label, title, status, created_at, legislative_text, supporting_text, author_user_id, bill_number, class_id')
    .eq('class_id', classId)
    .neq('status', 'draft')
    .order('bill_number', { ascending: true });
  if (error) throw error;

  const authorIds = [...new Set((data ?? []).map((b: any) => b.author_user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, party')
    .in('user_id', authorIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

  return (data ?? []).map((b: any) => ({
    ...b,
    profiles: profileMap.get(b.author_user_id) ?? null,
  })) as BillRecord[];
}

export async function createBillForCurrentClass(input: {
  title: string;
  legislativeText: string;
  supportingText?: string | null;
  status?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data: p, error: pErr } = await supabase.from('profiles').select('class_id').eq('user_id', me).maybeSingle();
  if (pErr) throw pErr;
  const classId = (p as any)?.class_id;
  if (!classId) throw new Error('Join a class first');

  const { data, error } = await supabase
    .from('bills')
    .insert({
      class_id: classId,
      author_user_id: me,
      title: input.title,
      legislative_text: input.legislativeText,
      supporting_text: input.supportingText ?? null,
      status: input.status ?? 'submitted',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function fetchMyBillsForCurrentClass() {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('user_id', me)
    .maybeSingle();
  if (profileError) throw profileError;
  const classId = (profile as any)?.class_id;
  if (!classId) return [];

  const { data, error } = await supabase
    .from('bill_display')
    .select('id, hr_label, title, status, created_at, legislative_text, supporting_text, author_user_id, bill_number, class_id')
    .eq('class_id', classId)
    .eq('author_user_id', me)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillRecord[];
}

export async function updateBillDraftForCurrentClass(
  billId: string,
  input: {
    title: string;
    legislativeText: string;
    supportingText?: string | null;
    status?: 'draft' | 'submitted';
  },
) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('bills')
    .update({
      title: input.title,
      legislative_text: input.legislativeText,
      supporting_text: input.supportingText ?? null,
      status: input.status ?? 'draft',
    } as any)
    .eq('id', billId)
    .eq('author_user_id', me)
    .eq('status', 'draft')
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function fetchBillDetail(billId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('user_id', me)
    .maybeSingle();
  if (profileError) throw profileError;
  const classId = (profile as any)?.class_id;
  if (!classId) throw new Error('Select a class first');

  const { data: bill, error: bErr } = await supabase
    .from('bill_display')
    .select('id, hr_label, bill_number, title, status, created_at, legislative_text, supporting_text, author_user_id, class_id')
    .eq('id', billId)
    .eq('class_id', classId)
    .single();
  if (bErr) throw bErr;

  const { data: sponsor } = await supabase
    .from('profiles')
    .select('user_id, display_name, party, constituency_name')
    .eq('user_id', (bill as any).author_user_id)
    .maybeSingle();

  const { data: cos, error: cErr } = await supabase
    .from('bill_cosponsors')
    .select('user_id')
    .eq('bill_id', billId);
  if (cErr) throw cErr;

  const cosponsorIds = (cos ?? []).map((r: any) => r.user_id);
  const { data: cosponsors } = await supabase
    .from('profiles')
    .select('user_id, display_name, party')
    .in('user_id', cosponsorIds.length ? cosponsorIds : ['00000000-0000-0000-0000-000000000000']);

  const { data: referral } = await supabase
    .from('bill_referrals')
    .select('committee_id,referred_at,committees(name)')
    .eq('bill_id', billId)
    .maybeSingle();

  return {
    bill: bill as any,
    sponsor: sponsor as any,
    cosponsors: cosponsors ?? [],
    cosponsorIds,
    referral: referral
      ? {
          committee_id: (referral as any).committee_id as string,
          committee_name: (referral as any).committees?.name as string | undefined,
          referred_at: (referral as any).referred_at as string,
        }
      : null,
  };
}

export async function toggleCosponsor(billId: string, shouldCosponsor: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');

  if (shouldCosponsor) {
    const { error } = await supabase.from('bill_cosponsors').insert({ bill_id: billId, user_id: me });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('bill_cosponsors').delete().eq('bill_id', billId).eq('user_id', me);
    if (error) throw error;
  }
}
