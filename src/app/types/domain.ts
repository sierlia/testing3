export interface BillRecord {
  id: string;
  hr_label: string;
  title: string;
  status: string;
  created_at: string;
  legislative_text: string;
  supporting_text: string | null;
  author_user_id: string;
  profiles?: {
    display_name: string | null;
    party: string | null;
  } | null;
}
