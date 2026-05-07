import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, ChevronLeft, MessageSquare, Settings, ThumbsUp, Trash2 } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/AuthContext";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
  kind: "comment" | "reaction";
};

export function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,href,created_at,read_at,event_key")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      href: row.href || "/notifications",
      created_at: row.created_at,
      read_at: row.read_at,
      kind: row.event_key?.includes("reactions") ? "reaction" : "comment",
    })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const markRead = async (id: string) => {
    const readAt = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: readAt }).eq("id", id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: item.read_at ?? readAt } : item)));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const readAt = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: readAt }).eq("recipient_user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="mt-1 text-gray-600">Comments, reactions, and updates from your simulation.</p>
          </div>
          <div className="flex items-center gap-2">
            {items.some((item) => !item.read_at) && (
              <button type="button" onClick={() => void markAllRead()} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Mark all read
              </button>
            )}
            <Link to="/settings/notifications" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading notifications...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No notifications yet</h3>
              <p className="text-gray-600">New comments, reactions, and activity alerts will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <div key={item.id} className={`p-4 transition-colors ${!item.read_at ? "bg-blue-50" : "bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${item.kind === "comment" ? "bg-blue-100" : "bg-purple-100"}`}>
                      {item.kind === "comment" ? <MessageSquare className="h-5 w-5 text-blue-600" /> : <ThumbsUp className="h-5 w-5 text-purple-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                      <div className="mt-1 text-sm text-gray-600">{item.message}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                        {!item.read_at && (
                          <button type="button" onClick={() => void markRead(item.id)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                            Mark read
                          </button>
                        )}
                        <Link to={item.href} onClick={() => void markRead(item.id)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                          View
                        </Link>
                      </div>
                    </div>
                    <button type="button" onClick={() => void remove(item.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Remove notification">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
