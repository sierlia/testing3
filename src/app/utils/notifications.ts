export type LocalNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  createdAt: number;
  read: boolean;
  kind: "comment" | "reaction";
};

const KEY = "gavel_notifications_v1";
const MAX = 50;

export function loadLocalNotifications(): LocalNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotifications(items: LocalNotification[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore
  }
}

export function pushLocalNotification(item: Omit<LocalNotification, "id" | "createdAt" | "read"> & { createdAt?: number }) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : `${Date.now()}_${Math.random()}`;
  const createdAt = item.createdAt ?? Date.now();
  const next: LocalNotification = { id, createdAt, read: false, ...item };
  const current = loadLocalNotifications();
  saveLocalNotifications([next, ...current].slice(0, MAX));
  return next;
}

