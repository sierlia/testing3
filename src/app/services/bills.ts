import { supabase } from '../utils/supabase';
import { BillRecord } from '../types/domain';

export async function fetchBillsForCurrentClass() {
  const { data, error } = await supabase
    .from('bill_display')
    .select(`
      id, hr_label, title, status, created_at, legislative_text, supporting_text, author_user_id,
      profiles:author_user_id(display_name, party)
    `)
    .order('bill_number', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as BillRecord[];
}
