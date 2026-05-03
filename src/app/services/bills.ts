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

  const billIds = (data ?? []).map((b: any) => b.id);
  const { data: cosponsorRows, error: cosponsorError } = billIds.length
    ? await supabase.from('bill_cosponsors').select('bill_id,user_id').in('bill_id', billIds)
    : ({ data: [] } as any);
  if (cosponsorError) throw cosponsorError;

  const { data: referralRows, error: referralError } = billIds.length
    ? await supabase.from('bill_referrals').select('bill_id,committees(name)').eq('class_id', classId).in('bill_id', billIds)
    : ({ data: [] } as any);
  if (referralError) throw referralError;

  const authorIds = [...new Set((data ?? []).map((b: any) => b.author_user_id))];
  const cosponsorIds = [...new Set((cosponsorRows ?? []).map((r: any) => r.user_id))];
  const profileIds = [...new Set([...authorIds, ...cosponsorIds])];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, party, constituency_name')
    .in('user_id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
  const cosponsorsByBill = new Map<string, any[]>();
  for (const row of cosponsorRows ?? []) {
    const billId = (row as any).bill_id as string;
    const profile = profileMap.get((row as any).user_id);
    cosponsorsByBill.set(billId, [...(cosponsorsByBill.get(billId) ?? []), profile ?? { user_id: (row as any).user_id, display_name: 'Unknown', party: null }]);
  }
  const committeeByBill = new Map((referralRows ?? []).map((r: any) => [r.bill_id, r.committees?.name ?? null]));

  return (data ?? []).map((b: any) => ({
    ...b,
    profiles: profileMap.get(b.author_user_id) ?? null,
    committee_name: committeeByBill.get(b.id) ?? null,
    cosponsor_count: cosponsorsByBill.get(b.id)?.length ?? 0,
    cosponsors: cosponsorsByBill.get(b.id) ?? [],
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
    .select('user_id,created_at')
    .eq('bill_id', billId);
  if (cErr) throw cErr;

  const cosponsorIds = (cos ?? []).map((r: any) => r.user_id);
  const { data: cosponsors } = await supabase
    .from('profiles')
    .select('user_id, display_name, party, constituency_name')
    .in('user_id', cosponsorIds.length ? cosponsorIds : ['00000000-0000-0000-0000-000000000000']);
  const cosponsorMap = new Map((cosponsors ?? []).map((p: any) => [p.user_id, p]));

  const { data: referral } = await supabase
    .from('bill_referrals')
    .select('committee_id,referred_at,committees(name)')
    .eq('bill_id', billId)
    .maybeSingle();

  const referralCommitteeId = (referral as any)?.committee_id as string | undefined;
  const [{ data: committeeDoc }, { data: committeeVotes }, { data: calendar }, { data: floorSession }, { data: floorVotes }] = await Promise.all([
    referralCommitteeId
      ? supabase
          .from('committee_bill_docs')
          .select('updated_at,committee_report_submitted_at,committee_vote_closed_at,committee_vote_finalized_at,ydoc_base64,committee_report_ydoc_base64')
          .eq('bill_id', billId)
          .eq('committee_id', referralCommitteeId)
          .maybeSingle()
      : ({ data: null } as any),
    referralCommitteeId
      ? supabase
          .from('bill_committee_votes')
          .select('vote,created_at,updated_at')
          .eq('bill_id', billId)
          .eq('committee_id', referralCommitteeId)
      : ({ data: [] } as any),
    supabase
      .from('bill_calendar')
      .select('scheduled_at,created_at,published')
      .eq('bill_id', billId)
      .eq('class_id', classId)
      .maybeSingle(),
    supabase
      .from('bill_floor_sessions')
      .select('status,opened_at,closed_at,created_at')
      .eq('bill_id', billId)
      .eq('class_id', classId)
      .maybeSingle(),
    supabase
      .from('bill_floor_votes')
      .select('vote,created_at')
      .eq('bill_id', billId)
      .eq('class_id', classId),
  ]);

  return {
    bill: bill as any,
    sponsor: sponsor as any,
    cosponsors: (cos ?? []).map((row: any) => ({
      ...(cosponsorMap.get(row.user_id) ?? { user_id: row.user_id, display_name: 'Unknown', party: null, constituency_name: null }),
      cosponsored_at: row.created_at,
    })),
    cosponsorIds,
    referral: referral
      ? {
          committee_id: (referral as any).committee_id as string,
          committee_name: (referral as any).committees?.name as string | undefined,
          referred_at: (referral as any).referred_at as string,
        }
      : null,
    committeeDoc: (committeeDoc as any) ?? null,
    committeeVotes: (committeeVotes ?? []) as any[],
    calendar: (calendar as any) ?? null,
    floorSession: (floorSession as any) ?? null,
    floorVotes: (floorVotes ?? []) as any[],
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

export async function getCurrentProfileClass() {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error('Not signed in');
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('class_id,role,display_name,party')
    .eq('user_id', me)
    .maybeSingle();
  if (error) throw error;
  const classId = (profile as any)?.class_id as string | null;
  if (!classId) throw new Error('Select a class first');
  return { userId: me, classId, profile: profile as any };
}

export async function fetchCalendaredBillsForCurrentClass() {
  const { classId } = await getCurrentProfileClass();
  const { data: rows, error } = await supabase
    .from('bill_calendar')
    .select('id,bill_id,scheduled_at,duration_minutes,published')
    .eq('class_id', classId)
    .eq('published', true)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  const billIds = (rows ?? []).map((r: any) => r.bill_id);
  const { data: bills, error: billError } = await supabase
    .from('bill_display')
    .select('id,hr_label,title,status,author_user_id,class_id,created_at,legislative_text,supporting_text,bill_number')
    .in('id', billIds.length ? billIds : ['00000000-0000-0000-0000-000000000000']);
  if (billError) throw billError;
  const billMap = new Map((bills ?? []).map((b: any) => [b.id, b]));
  const authorIds = Array.from(new Set((bills ?? []).map((b: any) => b.author_user_id).filter(Boolean)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id,display_name,party')
    .in('user_id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
  return (rows ?? []).map((r: any) => ({
    id: r.id as string,
    bill_id: r.bill_id as string,
    scheduled_at: r.scheduled_at as string,
    duration_minutes: r.duration_minutes as number,
    bill: {
      ...billMap.get(r.bill_id),
      profiles: profileMap.get(billMap.get(r.bill_id)?.author_user_id) ?? null,
    } as BillRecord,
  })).filter((r) => r.bill?.id);
}

export async function fetchReportedBillsForTeacherCalendar() {
  const { classId } = await getCurrentProfileClass();
  const [{ data: bills, error: bErr }, { data: calendar, error: cErr }, { data: referrals }] = await Promise.all([
    supabase
      .from('bill_display')
      .select('id,hr_label,title,status,created_at,legislative_text,supporting_text,author_user_id,bill_number,class_id')
      .eq('class_id', classId)
      .in('status', ['reported', 'calendared', 'floor']),
    supabase.from('bill_calendar').select('id,bill_id,scheduled_at,duration_minutes,published').eq('class_id', classId),
    supabase.from('bill_referrals').select('bill_id,committees(name)').eq('class_id', classId),
  ]);
  if (bErr) throw bErr;
  if (cErr) throw cErr;
  const calendarMap = new Map((calendar ?? []).map((r: any) => [r.bill_id, r]));
  const committeeMap = new Map((referrals ?? []).map((r: any) => [r.bill_id, r.committees?.name ?? 'Committee']));
  return (bills ?? []).map((bill: any) => ({
    ...bill,
    calendar: calendarMap.get(bill.id) ?? null,
    committee_name: committeeMap.get(bill.id) ?? '',
  }));
}

export async function saveBillCalendarEntry(billId: string, scheduledAt: string, durationMinutes = 30) {
  const { userId, classId } = await getCurrentProfileClass();
  const { error } = await supabase.from('bill_calendar').upsert(
    {
      class_id: classId,
      bill_id: billId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      published: true,
      created_by: userId,
    } as any,
    { onConflict: 'class_id,bill_id' },
  );
  if (error) throw error;
  await supabase.from('bills').update({ status: 'calendared' } as any).eq('id', billId).eq('class_id', classId);
}

export async function reportBillFromCommittee(billId: string) {
  const { classId } = await getCurrentProfileClass();
  const { error } = await supabase.from('bills').update({ status: 'reported' } as any).eq('id', billId).eq('class_id', classId);
  if (error) throw error;
}

export async function proposeBillForCommitteeVote(billId: string) {
  const { classId } = await getCurrentProfileClass();
  const { error } = await supabase.from('bills').update({ status: 'committee_vote' } as any).eq('id', billId).eq('class_id', classId);
  if (error) throw error;
}

export async function closeCommitteeVote(billId: string, committeeId: string) {
  const { classId } = await getCurrentProfileClass();
  const { error } = await supabase.from('committee_bill_docs').upsert(
    {
      bill_id: billId,
      committee_id: committeeId,
      class_id: classId,
      committee_vote_closed_at: new Date().toISOString(),
    } as any,
    { onConflict: 'bill_id,committee_id' },
  );
  if (error) throw error;
}

export async function finalizeCommitteeVote(billId: string, committeeId: string, approved: boolean) {
  const { classId } = await getCurrentProfileClass();
  const now = new Date().toISOString();
  const { data: existingDoc } = await supabase
    .from('committee_bill_docs')
    .select('committee_vote_closed_at')
    .eq('bill_id', billId)
    .eq('committee_id', committeeId)
    .maybeSingle();
  const { error: docError } = await supabase.from('committee_bill_docs').upsert(
    {
      bill_id: billId,
      committee_id: committeeId,
      class_id: classId,
      committee_vote_closed_at: (existingDoc as any)?.committee_vote_closed_at ?? now,
      committee_vote_finalized_at: now,
    } as any,
    { onConflict: 'bill_id,committee_id' },
  );
  if (docError) throw docError;

  const { error } = await supabase
    .from('bills')
    .update({ status: approved ? 'reported' : 'failed' } as any)
    .eq('id', billId)
    .eq('class_id', classId);
  if (error) throw error;
}

export async function submitCommitteeReport(billId: string, committeeId: string) {
  const { classId } = await getCurrentProfileClass();
  const { error } = await supabase.from('committee_bill_docs').upsert(
    {
      bill_id: billId,
      committee_id: committeeId,
      class_id: classId,
      committee_report_submitted_at: new Date().toISOString(),
    } as any,
    { onConflict: 'bill_id,committee_id' },
  );
  if (error) throw error;
}
