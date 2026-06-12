import type { User } from "@supabase/supabase-js";
import { SchoolOption } from "../services/schools";
import { supabase } from "./supabase";

const PENDING_OAUTH_SIGNUP_KEY = "gavel:pendingOAuthSignup";
const OAUTH_RETURN_PATH_KEY = "gavel:oauthReturnPath";

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

function normalizeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/signin") || raw.startsWith("/signup")) return fallback;
  return raw;
}

function normalizedBaseUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function oauthRedirectUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? import.meta.env.VITE_SITE_URL ?? "").trim();
  const configuredUrl = configured ? normalizedBaseUrl(configured) : "";
  if (configuredUrl) return configuredUrl;

  const current = new URL(window.location.href);
  current.hash = "";
  current.search = "";
  return current.toString();
}

export function saveOAuthReturnPath(path: string) {
  window.localStorage.setItem(OAUTH_RETURN_PATH_KEY, normalizeInternalPath(path));
}

export function consumeOAuthReturnPath() {
  const path = normalizeInternalPath(window.localStorage.getItem(OAUTH_RETURN_PATH_KEY), "");
  window.localStorage.removeItem(OAUTH_RETURN_PATH_KEY);
  return path || null;
}

export function clearOAuthReturnPath() {
  window.localStorage.removeItem(OAUTH_RETURN_PATH_KEY);
}

export function readOAuthErrorFromLocation() {
  const url = new URL(window.location.href);
  const hash = url.hash.replace(/^#/, "");
  const hashParams = hash.startsWith("error=") || hash.includes("&error=") ? new URLSearchParams(hash) : null;
  const description = url.searchParams.get("error_description") ?? hashParams?.get("error_description");
  const code = url.searchParams.get("error_code") ?? hashParams?.get("error_code");
  if (!description && !code) return null;
  return description ? safeDecode(description) : code;
}

export function clearOAuthErrorFromLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  if (url.hash.startsWith("#error=")) url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
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
