import type { Session, User } from "@supabase/supabase-js";
import { SchoolOption } from "../services/schools";
import { supabase } from "./supabase";

const PENDING_OAUTH_SIGNUP_KEY = "gavel:pendingOAuthSignup";
const OAUTH_RETURN_PATH_KEY = "gavel:oauthReturnPath";
const OAUTH_CALLBACK_PATH = "/auth/callback";
const SESSION_WAIT_ATTEMPTS = 12;
const SESSION_WAIT_MS = 250;

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
    if (url.pathname.endsWith(OAUTH_CALLBACK_PATH)) {
      url.pathname = url.pathname.slice(0, -OAUTH_CALLBACK_PATH.length) || "/";
    }
    if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
    return url.toString();
  } catch {
    return "";
  }
}

function appendPath(baseUrl: string, path: string) {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function oauthHashParams() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return new URLSearchParams();
  const params = hash.startsWith("/") ? hash.split("?").slice(1).join("?") : hash;
  return new URLSearchParams(params);
}

function oauthResponseParams() {
  const params = new URLSearchParams(window.location.search);
  oauthHashParams().forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

function hasStoredOAuthState() {
  try {
    return Boolean(window.localStorage.getItem(OAUTH_RETURN_PATH_KEY) || window.localStorage.getItem(PENDING_OAUTH_SIGNUP_KEY));
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForOAuthSession(): Promise<Session | null> {
  for (let attempt = 0; attempt < SESSION_WAIT_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await delay(SESSION_WAIT_MS);
  }
  return null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function oauthAppShellUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? import.meta.env.VITE_SITE_URL ?? "").trim();
  const configuredUrl = configured ? normalizedBaseUrl(configured) : "";
  if (configuredUrl) return configuredUrl;

  const current = new URL(window.location.href);
  current.hash = "";
  current.search = "";
  return normalizedBaseUrl(current.toString());
}

export function oauthRedirectUrl() {
  return appendPath(oauthAppShellUrl(), OAUTH_CALLBACK_PATH);
}

export function oauthHashRouteUrl(path = "/") {
  const url = new URL(oauthAppShellUrl());
  url.hash = path.startsWith("/") ? path : `/${path}`;
  url.search = "";
  return url.toString();
}

export function isOAuthCallbackLocation() {
  const url = new URL(window.location.href);
  const callbackPath = new URL(oauthRedirectUrl()).pathname.replace(/\/+$/, "");
  const currentPath = url.pathname.replace(/\/+$/, "") || "/";
  const hashPath = url.hash.replace(/^#/, "").split("?")[0];
  const hashParams = oauthHashParams();
  const onCallbackPath = currentPath === callbackPath || hashPath === OAUTH_CALLBACK_PATH;
  const hasStoredState = hasStoredOAuthState();
  return (
    onCallbackPath ||
    ((url.searchParams.has("code") || url.searchParams.has("error")) && hasStoredState) ||
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("error")
  );
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
  const params = oauthResponseParams();
  const description = url.searchParams.get("error_description") ?? params.get("error_description");
  const code = url.searchParams.get("error_code") ?? params.get("error_code") ?? params.get("error");
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

export async function processOAuthRedirectFromLocation() {
  const oauthError = readOAuthErrorFromLocation();
  if (oauthError) throw new Error(oauthError);

  const params = oauthResponseParams();
  const code = params.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session ?? waitForOAuthSession();
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return data.session ?? waitForOAuthSession();
  }

  return waitForOAuthSession();
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
