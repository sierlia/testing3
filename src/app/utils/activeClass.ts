export const ACTIVE_CLASS_CHANGED_EVENT = "gavel:active-class-changed";

function activeClassCookieName(userId: string) {
  return `gavel_active_class_${userId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function activeClassStorageKey(userId: string) {
  return `gavel:activeClass:${userId}`;
}

export function readActiveClassPreference(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const cookieName = activeClassCookieName(userId);
  const cookieValue = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.split("=")[1];
  if (cookieValue) return decodeURIComponent(cookieValue);

  try {
    const parsed = JSON.parse(window.localStorage.getItem(activeClassStorageKey(userId)) ?? "null") as { classId?: string } | null;
    return parsed?.classId ?? null;
  } catch {
    return null;
  }
}

export function saveActiveClassPreference(userId: string, classId: string, className?: string) {
  if (typeof window === "undefined") return;
  const cookieName = activeClassCookieName(userId);
  document.cookie = `${cookieName}=${encodeURIComponent(classId)}; Max-Age=31536000; Path=/; SameSite=Lax`;
  try {
    window.localStorage.setItem(activeClassStorageKey(userId), JSON.stringify({ classId, className: className ?? null, updatedAt: new Date().toISOString() }));
  } catch {
    // The cookie is the durable preference. Local storage only keeps display metadata.
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_CLASS_CHANGED_EVENT, { detail: { classId, className } }));
}

export function clearActiveClassPreference(userId: string) {
  if (typeof window === "undefined") return;
  document.cookie = `${activeClassCookieName(userId)}=; Max-Age=0; Path=/; SameSite=Lax`;
  try {
    window.localStorage.removeItem(activeClassStorageKey(userId));
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_CLASS_CHANGED_EVENT, { detail: { classId: null } }));
}
