export interface BillRecord {
  id: string;
  hr_label: string;
  bill_number?: number;
  title: string;
  status: string;
  created_at: string;
  legislative_text: string;
  supporting_text: string | null;
  author_user_id: string;
  class_id?: string;
  profiles?: {
    user_id?: string;
    display_name: string | null;
    party: string | null;
    constituency_name?: string | null;
  } | null;
  committee_name?: string | null;
  cosponsor_count?: number;
  cosponsors?: Array<{
    user_id: string;
    display_name: string | null;
    party: string | null;
    constituency_name?: string | null;
  }>;
}
