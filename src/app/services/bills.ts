import { supabase } from '../utils/supabase';
import { BillRecord } from '../types/domain';

export async function fetchBillsForCurrentClass() {
  const { data, error } = await supabase
    .from('bill_display')
    .select('id, hr_label, title, status, created_at, legislative_text, supporting_text, author_user_id, bill_number')
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
