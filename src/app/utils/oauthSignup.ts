import type { User } from "@supabase/supabase-js";
import { SchoolOption } from "../services/schools";
import { supabase } from "./supabase";

const PENDING_OAUTH_SIGNUP_KEY = "gavel:pendingOAuthSignup";

export type PendingOAuthSignup = {
  role: "teacher" | "student";
  firstName: string;
  lastName: string;
  schools: SchoolOption[];
  redirectPath: string;
  createdAt: number;
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function fullNameFromParts(firstName: string, lastName: string) {
  return [cleanName(firstName), cleanName(lastName)].filter(Boolean).join(" ");
}

export function savePendingOAuthSignup(payload: Omit<PendingOAuthSignup, "createdAt">) {
  window.localStorage.setItem(PENDING_OAUTH_SIGNUP_KEY, JSON.stringify({ ...payload, createdAt: Date.now() }));
}

export function getPendingOAuthSignup(): PendingOAuthSignup | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_OAUTH_SIGNUP_KEY) || "null");
    if (!parsed || (parsed.role !== "teacher" && parsed.role !== "student")) return null;
    if (!Array.isArray(parsed.schools)) parsed.schools = [];
    return parsed as PendingOAuthSignup;
  } catch {
    return null;
  }
}

export function clearPendingOAuthSignup() {
  window.localStorage.removeItem(PENDING_OAUTH_SIGNUP_KEY);
}

export async function completePendingOAuthSignup(user: User) {
  const pending = getPendingOAuthSignup();
  if (!pending) return null;

  const firstName = cleanName(pending.firstName);
  const lastName = cleanName(pending.lastName);
  const name = fullNameFromParts(firstName, lastName) || cleanName(user.user_metadata?.name ?? "") || "Member";
  const schools = pending.schools ?? [];
  const userData = {
    ...(user.user_metadata ?? {}),
    role: pending.role,
    name,
    first_name: firstName,
    last_name: lastName,
    schools,
    school: schools.map((school) => school.name).join(", "),
  };

  const { error: metadataError } = await supabase.auth.updateUser({ data: userData });
  if (metadataError) throw metadataError;

  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileReadError && profileReadError.code !== "PGRST116") throw profileReadError;

  if (pending.role === "student") {
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      role: "student",
      display_name: name,
      first_name: firstName,
      last_name: lastName,
      schools,
    } as any);
    if (error) throw error;
  } else if (existingProfile) {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        first_name: firstName,
        last_name: lastName,
        schools,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user.id);
    if (error) throw error;
  }

  clearPendingOAuthSignup();
  return { ...pending, name };
}
