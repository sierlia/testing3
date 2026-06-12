import { Bell, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/AuthContext";

type NotificationPreview = {
  id: string;
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

let cachedUnreadCount = 0;

function announceUnreadCount(count: number) {
  window.dispatchEvent(new CustomEvent("gavel:notifications-read", { detail: { unreadCount: count } }));
}

export function NotificationBadge() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(cachedUnreadCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const clearUnreadCount = () => {
    cachedUnreadCount = 0;
    setUnreadCount(0);
    announceUnreadCount(0);
  };

  const markNotificationsRead = async () => {
    if (!user?.id) return;
    const readAt = new Date().toISOString();
    clearUnreadCount();
    setItems((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    if (error) void refreshCount();
  };

  const refreshCount = async () => {
    if (!user?.id) return;
    if (open) {
      clearUnreadCount();
      return;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    cachedUnreadCount = count ?? 0;
    setUnreadCount(cachedUnreadCount);
  };

  const loadPreview = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,href,created_at,read_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);
    const next = ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      href: row.href || "/notifications",
      created_at: row.created_at,
      read_at: row.read_at,
    }));
    setItems(next);
    const readAt = new Date().toISOString();
    const hadUnread = next.some((item) => !item.read_at) || cachedUnreadCount > 0;
    if (hadUnread) {
      setItems((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })));
      clearUnreadCount();
      void markNotificationsRead();
    }
    setLoading(false);
  };

  useEffect(() => {
    void refreshCount();
  }, [user?.id]);

  useEffect(() => {
    const sync = (event: Event) => {
      const unreadCount = (event as CustomEvent<{ unreadCount?: number }>).detail?.unreadCount;
      if (typeof unreadCount === "number") {
        cachedUnreadCount = open ? 0 : Math.max(0, unreadCount);
        setUnreadCount(cachedUnreadCount);
        return;
      }
      void refreshCount();
    };
    window.addEventListener("gavel:notifications-read", sync);
    return () => window.removeEventListener("gavel:notifications-read", sync);
  }, [open, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` }, () => {
        if (open) {
          void markNotificationsRead();
          void loadPreview();
          return;
        }
        void refreshCount();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    void markNotificationsRead();
    void loadPreview();
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) void markNotificationsRead();
          setOpen((current) => !current);
        }}
        className="relative p-2 text-gray-600 transition-colors hover:text-gray-900"
        title="Notifications"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold leading-none text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">Notifications</div>
            <Link to="/notifications" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
              Full page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : items.length ? (
              items.map((item) => (
                <Link key={item.id} to={item.href} onClick={() => setOpen(false)} className={`block border-b border-gray-100 px-4 py-3 last:border-b-0 ${item.read_at ? "bg-white hover:bg-gray-50" : "bg-blue-50 hover:bg-blue-100"}`}>
                  <div className="line-clamp-1 text-sm font-semibold text-gray-900">{item.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-gray-600">{item.message}</div>
                  <div className="mt-1 text-[11px] text-gray-400">{new Date(item.created_at).toLocaleString()}</div>
                </Link>
              ))
            ) : (
              <div className="p-4 text-sm text-gray-500">No notifications.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
