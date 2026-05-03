import { supabase } from "../utils/supabase";

export type ClassActivityType = "bill" | "letter" | "caucus" | "committee" | "comment";

export type ClassActivity = {
  id: string;
  studentId: string;
  studentName: string;
  action: string;
  timestamp: Date;
  type: ClassActivityType;
  contextName?: string;
  detail?: string;
};

function billAction(status: string, billNumber: string | number | null, title: string | null) {
  const verb = status === "draft" ? "drafted" : "submitted";
  return `${verb} H.R. ${billNumber ?? ""} - ${title ?? "Untitled bill"}`.trim();
}

function clip(value: string | null | undefined, max = 120) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

export async function fetchClassActivity(classId: string, limit = 100): Promise<ClassActivity[]> {
  const [committeeRows, caucusRows] = await Promise.all([
    supabase.from("committees").select("id,name").eq("class_id", classId),
    supabase.from("caucuses").select("id,title").eq("class_id", classId),
  ]);
  const committeeMap = new Map((committeeRows.data ?? []).map((c: any) => [c.id, c.name]));
  const caucusMap = new Map((caucusRows.data ?? []).map((c: any) => [c.id, c.title]));
  const committeeIds = Array.from(committeeMap.keys());
  const caucusIds = Array.from(caucusMap.keys());
  const [committeeAnnouncements, caucusAnnouncements] = await Promise.all([
    committeeIds.length
      ? supabase.from("committee_announcements").select("id,committee_id").in("committee_id", committeeIds)
      : Promise.resolve({ data: [] as any[] } as any),
    caucusIds.length
      ? supabase.from("caucus_announcements").select("id,caucus_id").in("caucus_id", caucusIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const committeeAnnouncementMap = new Map((committeeAnnouncements.data ?? []).map((row: any) => [row.id, row.committee_id]));
  const caucusAnnouncementMap = new Map((caucusAnnouncements.data ?? []).map((row: any) => [row.id, row.caucus_id]));
  const committeeAnnouncementIds = Array.from(committeeAnnouncementMap.keys());
  const caucusAnnouncementIds = Array.from(caucusAnnouncementMap.keys());

  const [bills, committeeMembers, caucusMembers, letters, caucusComments, committeeComments] = await Promise.all([
    supabase.from("bills").select("id,title,bill_number,author_user_id,created_at,status").eq("class_id", classId).order("created_at", { ascending: false }).limit(limit),
    committeeIds.length
      ? supabase.from("committee_members").select("committee_id,user_id,created_at").in("committee_id", committeeIds).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] as any[] } as any),
    caucusIds.length
      ? supabase.from("caucus_members").select("caucus_id,user_id,created_at").in("caucus_id", caucusIds).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] as any[] } as any),
    supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,created_at").eq("class_id", classId).order("created_at", { ascending: false }).limit(limit),
    caucusAnnouncementIds.length
      ? supabase.from("caucus_comments").select("id,announcement_id,author_user_id,body,created_at").in("announcement_id", caucusAnnouncementIds).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] as any[] } as any),
    committeeAnnouncementIds.length
      ? supabase.from("committee_comments").select("id,announcement_id,author_user_id,body,created_at").in("announcement_id", committeeAnnouncementIds).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const authorIds = new Set<string>();
  for (const r of bills.data ?? []) authorIds.add((r as any).author_user_id);
  for (const r of committeeMembers.data ?? []) authorIds.add((r as any).user_id);
  for (const r of caucusMembers.data ?? []) authorIds.add((r as any).user_id);
  for (const r of letters.data ?? []) authorIds.add((r as any).sender_user_id);
  for (const r of caucusComments.data ?? []) authorIds.add((r as any).author_user_id);
  for (const r of committeeComments.data ?? []) authorIds.add((r as any).author_user_id);

  const { data: authors } = await supabase
    .from("profiles")
    .select("user_id,display_name,party")
    .in("user_id", authorIds.size ? Array.from(authorIds) : ["00000000-0000-0000-0000-000000000000"]);
  const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, a]));
  const studentName = (id: string) => authorMap.get(id)?.display_name ?? "Unknown";

  const activity: ClassActivity[] = [];
  for (const r of bills.data ?? []) {
    const row = r as any;
    activity.push({
      id: row.id,
      studentId: row.author_user_id,
      studentName: studentName(row.author_user_id),
      action: billAction(row.status, row.bill_number, row.title),
      timestamp: new Date(row.created_at),
      type: "bill",
      contextName: authorMap.get(row.author_user_id)?.party ?? undefined,
    });
  }
  for (const r of committeeMembers.data ?? []) {
    const row = r as any;
    const contextName = committeeMap.get(row.committee_id) ?? "a committee";
    activity.push({
      id: `${row.committee_id}:${row.user_id}:${row.created_at}`,
      studentId: row.user_id,
      studentName: studentName(row.user_id),
      action: `joined ${contextName}`,
      timestamp: new Date(row.created_at),
      type: "committee",
      contextName,
    });
  }
  for (const r of caucusMembers.data ?? []) {
    const row = r as any;
    const contextName = caucusMap.get(row.caucus_id) ?? "a caucus";
    activity.push({
      id: `${row.caucus_id}:${row.user_id}:${row.created_at}`,
      studentId: row.user_id,
      studentName: studentName(row.user_id),
      action: `joined ${contextName}`,
      timestamp: new Date(row.created_at),
      type: "caucus",
      contextName,
    });
  }
  for (const r of letters.data ?? []) {
    const row = r as any;
    activity.push({
      id: row.id,
      studentId: row.sender_user_id,
      studentName: studentName(row.sender_user_id),
      action: `sent a Dear Colleague letter${row.subject ? `: ${row.subject}` : ""}`,
      timestamp: new Date(row.created_at),
      type: "letter",
      contextName: authorMap.get(row.sender_user_id)?.party ?? undefined,
    });
  }
  for (const r of caucusComments.data ?? []) {
    const row = r as any;
    const caucusId = caucusAnnouncementMap.get(row.announcement_id);
    const contextName = caucusId ? caucusMap.get(caucusId) ?? "a caucus" : "a caucus";
    activity.push({
      id: row.id,
      studentId: row.author_user_id,
      studentName: studentName(row.author_user_id),
      action: `commented in ${contextName}: "${clip(row.body)}"`,
      timestamp: new Date(row.created_at),
      type: "comment",
      contextName,
      detail: row.body,
    });
  }
  for (const r of committeeComments.data ?? []) {
    const row = r as any;
    const committeeId = committeeAnnouncementMap.get(row.announcement_id);
    const contextName = committeeId ? committeeMap.get(committeeId) ?? "a committee" : "a committee";
    activity.push({
      id: row.id,
      studentId: row.author_user_id,
      studentName: studentName(row.author_user_id),
      action: `commented in ${contextName}: "${clip(row.body)}"`,
      timestamp: new Date(row.created_at),
      type: "comment",
      contextName,
      detail: row.body,
    });
  }

  return activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
