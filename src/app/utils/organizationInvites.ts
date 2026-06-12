import { supabase } from "./supabase";

export type OrganizationInviteType = "party" | "committee" | "caucus";

export async function sendOrganizationInvite({
  classId,
  recipientUserId,
  orgType,
  orgId,
  orgName,
  href,
}: {
  classId: string;
  recipientUserId: string;
  orgType: OrganizationInviteType;
  orgId: string;
  orgName: string;
  href: string;
}) {
  const { data: prefRow } = await supabase.from("profiles").select("notification_prefs").eq("user_id", recipientUserId).maybeSingle();
  const prefs = (prefRow as any)?.notification_prefs;
  if (prefs && typeof prefs === "object" && prefs["organization.invites"] === false) {
    throw new Error("This user has disabled organization invites.");
  }
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("create_notification", {
    target_class: classId,
    recipient: recipientUserId,
    actor: auth.user?.id ?? null,
    org_type: orgType,
    org_id: orgId,
    event_key: "organization.invite",
    title: `Invitation to ${orgName}`,
    message: `You have been invited to join ${orgName}.`,
    href,
  });
  if (error) throw error;
}
