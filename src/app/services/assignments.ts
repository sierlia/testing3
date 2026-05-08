import { supabase } from "../utils/supabase";

export type AudienceType = "all" | "caucus" | "party" | "committee";
export type TaskType = "deadline" | "assignment";
export type AssignmentProvider = "synergy" | "schoology" | "powerschool" | "google_classroom";

export type RubricItem = {
  id: string;
  title: string;
  description: string;
  points: number;
};

export type AutoCriteriaConfig = {
  id: string;
  target: number;
  points: number;
};

export type AutoCriteriaResult = {
  id: string;
  label: string;
  value: number;
  target: number;
  points: number;
  earned: number;
  complete: boolean;
};

export type AttachmentOption = {
  id: string;
  type: "bill" | "cosponsored_bill" | "letter" | "profile";
  label: string;
  description: string;
  href: string;
};

export type AssignmentTask = {
  id: string;
  task_type: TaskType;
  title: string;
  description: string;
  due_at: string | null;
  audience_type: AudienceType;
  audience_id: string | null;
  points_possible: number;
  rubric: RubricItem[];
  auto_criteria: AutoCriteriaConfig[];
  integration_targets: AssignmentProvider[];
  created_at: string;
};

export const PROVIDERS: Array<{ id: AssignmentProvider; label: string; description: string }> = [
  { id: "synergy", label: "Synergy SIS", description: "Prepare returned grades for a Synergy gradebook column." },
  { id: "schoology", label: "Schoology", description: "Prepare assignment scores for a Schoology course." },
  { id: "powerschool", label: "PowerSchool", description: "Prepare returned grades for PowerSchool gradebook sync." },
  { id: "google_classroom", label: "Google Classroom", description: "Prepare submissions and scores for Classroom coursework." },
];

export const AUTO_CRITERIA_OPTIONS: Array<{
  id: string;
  label: string;
  description: string;
  unit: string;
  defaultTarget: number;
  defaultPoints: number;
}> = [
  {
    id: "write_bills",
    label: "Write bills",
    description: "Counts submitted, non-deleted bills authored by the student.",
    unit: "bills",
    defaultTarget: 2,
    defaultPoints: 20,
  },
  {
    id: "cosponsor_bills",
    label: "Cosponsor bills",
    description: "Counts bills the student has cosponsored.",
    unit: "cosponsorships",
    defaultTarget: 2,
    defaultPoints: 10,
  },
  {
    id: "complete_profile",
    label: "Complete profile",
    description: "Checks that the profile has a name, constituency, and at least one written profile response.",
    unit: "profile",
    defaultTarget: 1,
    defaultPoints: 10,
  },
  {
    id: "select_constituency",
    label: "Select constituency",
    description: "Checks whether the student selected a constituency.",
    unit: "constituency",
    defaultTarget: 1,
    defaultPoints: 5,
  },
  {
    id: "join_party",
    label: "Join a party",
    description: "Checks whether the student selected a party.",
    unit: "party",
    defaultTarget: 1,
    defaultPoints: 5,
  },
  {
    id: "join_committee",
    label: "Join committees",
    description: "Counts committee memberships in the class.",
    unit: "committees",
    defaultTarget: 1,
    defaultPoints: 10,
  },
  {
    id: "join_caucus",
    label: "Join caucuses",
    description: "Counts caucus memberships in the class.",
    unit: "caucuses",
    defaultTarget: 1,
    defaultPoints: 5,
  },
  {
    id: "send_letters",
    label: "Send Dear Colleague letters",
    description: "Counts Dear Colleague letters sent by the student.",
    unit: "letters",
    defaultTarget: 1,
    defaultPoints: 10,
  },
  {
    id: "cast_committee_votes",
    label: "Cast committee votes",
    description: "Counts committee votes cast by the student.",
    unit: "votes",
    defaultTarget: 1,
    defaultPoints: 10,
  },
  {
    id: "cast_floor_votes",
    label: "Cast floor votes",
    description: "Counts floor votes cast by the student.",
    unit: "votes",
    defaultTarget: 1,
    defaultPoints: 10,
  },
  {
    id: "submit_committee_preferences",
    label: "Submit committee preferences",
    description: "Checks whether the student submitted ranked committee preferences.",
    unit: "submission",
    defaultTarget: 1,
    defaultPoints: 5,
  },
];

export function newRubricItem(): RubricItem {
  return { id: crypto.randomUUID(), title: "", description: "", points: 10 };
}

export function criterionFromOption(id: string): AutoCriteriaConfig {
  const option = AUTO_CRITERIA_OPTIONS.find((entry) => entry.id === id) ?? AUTO_CRITERIA_OPTIONS[0];
  return { id: option.id, target: option.defaultTarget, points: option.defaultPoints };
}

export function normalizeRubric(value: unknown): RubricItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      id: String(item?.id || crypto.randomUUID()),
      title: String(item?.title || ""),
      description: String(item?.description || ""),
      points: Math.max(0, Number(item?.points ?? 0) || 0),
    }))
    .filter((item) => item.title.trim() || item.description.trim() || item.points > 0);
}

export function normalizeCriteria(value: unknown): AutoCriteriaConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      id: String(item?.id || ""),
      target: Math.max(1, Number(item?.target ?? 1) || 1),
      points: Math.max(0, Number(item?.points ?? 0) || 0),
    }))
    .filter((item) => AUTO_CRITERIA_OPTIONS.some((option) => option.id === item.id));
}

export function normalizeAssignment(row: any): AssignmentTask {
  return {
    id: row.id,
    task_type: row.task_type,
    title: row.title,
    description: row.description ?? "",
    due_at: row.due_at ?? null,
    audience_type: row.audience_type ?? "all",
    audience_id: row.audience_id ?? null,
    points_possible: Number(row.points_possible ?? 100),
    rubric: normalizeRubric(row.rubric),
    auto_criteria: normalizeCriteria(row.auto_criteria),
    integration_targets: Array.isArray(row.integration_targets) ? row.integration_targets.filter((id: string) => PROVIDERS.some((provider) => provider.id === id)) : [],
    created_at: row.created_at,
  };
}

export function autoCriteriaLabel(id: string) {
  return AUTO_CRITERIA_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function autoScoreTotal(scores: Record<string, AutoCriteriaResult> | null | undefined) {
  if (!scores) return 0;
  return Object.values(scores).reduce((sum, score) => sum + Number(score.earned ?? 0), 0);
}

export function rubricTotal(rubric: RubricItem[]) {
  return rubric.reduce((sum, item) => sum + Number(item.points ?? 0), 0);
}

async function countRows(query: PromiseLike<{ count: number | null; error: any }>) {
  const result = await query;
  if (result.error) return 0;
  return result.count ?? 0;
}

export async function computeAutoCriteriaScores(classId: string, userId: string, criteria: AutoCriteriaConfig[]) {
  if (!criteria.length) return {};

  const needed = new Set(criteria.map((criterion) => criterion.id));
  const values: Record<string, number> = {};

  const profilePromise = needed.has("complete_profile") || needed.has("select_constituency") || needed.has("join_party")
    ? supabase.from("profiles").select("display_name,party,constituency_name,written_responses").eq("user_id", userId).maybeSingle()
    : Promise.resolve({ data: null, error: null } as any);

  const [
    profileResult,
    authoredBillCount,
    cosponsorRows,
    committeeRows,
    caucusRows,
    letterCount,
    committeeVoteCount,
    floorVoteCount,
    preferenceCount,
  ] = await Promise.all([
    profilePromise,
    needed.has("write_bills")
      ? countRows(
          supabase
            .from("bill_display")
            .select("id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("author_user_id", userId)
            .neq("status", "draft")
            .neq("status", "deleted") as any,
        )
      : Promise.resolve(0),
    needed.has("cosponsor_bills")
      ? supabase
          .from("bill_cosponsors")
          .select("bill_id,bills!inner(class_id,status)")
          .eq("user_id", userId)
          .eq("bills.class_id", classId)
          .neq("bills.status", "deleted")
      : Promise.resolve({ data: [] as any[], error: null } as any),
    needed.has("join_committee")
      ? supabase
          .from("committee_members")
          .select("committee_id,committees!inner(class_id)")
          .eq("user_id", userId)
          .eq("committees.class_id", classId)
      : Promise.resolve({ data: [] as any[], error: null } as any),
    needed.has("join_caucus")
      ? supabase
          .from("caucus_members")
          .select("caucus_id,caucuses!inner(class_id)")
          .eq("user_id", userId)
          .eq("caucuses.class_id", classId)
      : Promise.resolve({ data: [] as any[], error: null } as any),
    needed.has("send_letters")
      ? countRows(
          supabase
            .from("dear_colleague_letters")
            .select("id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("sender_user_id", userId) as any,
        )
      : Promise.resolve(0),
    needed.has("cast_committee_votes")
      ? countRows(
          supabase
            .from("bill_committee_votes")
            .select("bill_id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("user_id", userId) as any,
        )
      : Promise.resolve(0),
    needed.has("cast_floor_votes")
      ? countRows(
          supabase
            .from("bill_floor_votes")
            .select("session_id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("user_id", userId) as any,
        )
      : Promise.resolve(0),
    needed.has("submit_committee_preferences")
      ? countRows(
          supabase
            .from("committee_preference_submissions")
            .select("user_id", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("user_id", userId) as any,
        )
      : Promise.resolve(0),
  ]);

  const profile = (profileResult as any)?.data ?? null;
  const writtenResponses = profile?.written_responses && typeof profile.written_responses === "object" ? profile.written_responses : {};
  values.write_bills = authoredBillCount;
  values.cosponsor_bills = ((cosponsorRows as any)?.data ?? []).length;
  values.join_committee = ((committeeRows as any)?.data ?? []).length;
  values.join_caucus = ((caucusRows as any)?.data ?? []).length;
  values.send_letters = letterCount;
  values.cast_committee_votes = committeeVoteCount;
  values.cast_floor_votes = floorVoteCount;
  values.submit_committee_preferences = preferenceCount > 0 ? 1 : 0;
  values.select_constituency = profile?.constituency_name ? 1 : 0;
  values.join_party = profile?.party ? 1 : 0;
  values.complete_profile =
    profile?.display_name && profile?.constituency_name && Object.values(writtenResponses).some((entry) => String(entry ?? "").trim())
      ? 1
      : 0;

  return Object.fromEntries(
    criteria.map((criterion) => {
      const option = AUTO_CRITERIA_OPTIONS.find((entry) => entry.id === criterion.id);
      const target = Math.max(1, Number(criterion.target) || 1);
      const points = Math.max(0, Number(criterion.points) || 0);
      const value = Math.max(0, Number(values[criterion.id] ?? 0) || 0);
      const complete = value >= target;
      const earned = Math.round(Math.min(value / target, 1) * points * 100) / 100;
      const result: AutoCriteriaResult = {
        id: criterion.id,
        label: option?.label ?? criterion.id,
        value,
        target,
        points,
        earned,
        complete,
      };
      return [criterion.id, result];
    }),
  );
}

export async function loadAttachmentOptions(classId: string, userId: string): Promise<AttachmentOption[]> {
  const [authoredBills, cosponsoredBills, letters] = await Promise.all([
    supabase
      .from("bill_display")
      .select("id,hr_label,title,status,created_at")
      .eq("class_id", classId)
      .eq("author_user_id", userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),
    supabase
      .from("bill_cosponsors")
      .select("bill_id,bills!inner(id,bill_number,title,status,class_id)")
      .eq("user_id", userId)
      .eq("bills.class_id", classId)
      .neq("bills.status", "deleted"),
    supabase
      .from("dear_colleague_letters")
      .select("id,subject,created_at")
      .eq("class_id", classId)
      .eq("sender_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const options: AttachmentOption[] = [
    {
      id: `profile:${userId}`,
      type: "profile",
      label: "My profile",
      description: "Attach your profile page.",
      href: `/members/${userId}`,
    },
  ];

  for (const bill of ((authoredBills as any).data ?? []) as any[]) {
    options.push({
      id: `bill:${bill.id}`,
      type: "bill",
      label: `${bill.hr_label}: ${bill.title}`,
      description: `Authored bill - ${String(bill.status ?? "").replace(/_/g, " ")}`,
      href: `/bills/${bill.id}`,
    });
  }

  for (const row of ((cosponsoredBills as any).data ?? []) as any[]) {
    const bill = row.bills;
    if (!bill?.id) continue;
    options.push({
      id: `cosponsored_bill:${bill.id}`,
      type: "cosponsored_bill",
      label: `H.R. ${bill.bill_number}: ${bill.title}`,
      description: "Cosponsored bill",
      href: `/bills/${bill.id}`,
    });
  }

  for (const letter of ((letters as any).data ?? []) as any[]) {
    options.push({
      id: `letter:${letter.id}`,
      type: "letter",
      label: letter.subject || "Untitled Dear Colleague letter",
      description: "Dear Colleague letter",
      href: `/letters/${letter.id}`,
    });
  }

  return options;
}
