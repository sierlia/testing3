import { Bell, MessageSquare, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/AuthContext";

export function NotificationBadge() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; title: string; message: string; href: string; created_at: string; read_at: string | null; kind: "comment" | "reaction" }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = async () => {
    if (!user?.id) return;
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,title,message,href,created_at,read_at,event_key")
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", user.id)
        .is("read_at", null),
    ]);
    const mapped = (rows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      href: r.href || "/notifications",
      created_at: r.created_at,
      read_at: r.read_at,
      kind: (r.event_key?.includes("reactions") ? "reaction" : "comment") as "comment" | "reaction",
    }));
    setItems(mapped);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          setItems((prev) => [
            {
              id: row.id,
              title: row.title,
              message: row.message,
              href: row.href || "/notifications",
              created_at: row.created_at,
              read_at: row.read_at ?? null,
              kind: (row.event_key?.includes("reactions") ? "reaction" : "comment") as any,
            },
            ...prev,
          ].slice(0, 10));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  };
  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: i.read_at ?? new Date().toISOString() } : i)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };
  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen((p) => !p);
          void refresh();
        }}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
        title="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="font-semibold text-gray-900">Notifications</div>
            <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Mark all read
              </button>
            )}
              <Link to="/settings/notifications" className="text-sm text-blue-600 hover:text-blue-700 font-medium" onClick={() => setIsOpen(false)}>
                Settings
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No notifications yet</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {items.map((n) => (
                  <div key={n.id} className={`p-4 hover:bg-gray-50 transition-colors ${!n.read_at ? "bg-blue-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.kind === "comment" ? "bg-blue-100" : "bg-purple-100"}`}>
                        {n.kind === "comment" ? <MessageSquare className="w-5 h-5 text-blue-600" /> : <ThumbsUp className="w-5 h-5 text-purple-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 mb-1">{n.title}</div>
                        <div className="text-sm text-gray-600 mb-2 line-clamp-2">{n.message}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                          {!n.read_at && (
                            <button onClick={() => void markRead(n.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                              Mark read
                            </button>
                          )}
                          <Link to={n.href} className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={() => setIsOpen(false)}>
                            View
                          </Link>
                        </div>
                      </div>

                      <button onClick={() => void remove(n.id)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Remove notification">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
