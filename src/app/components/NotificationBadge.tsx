import { Bell, MessageSquare, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { loadLocalNotifications, saveLocalNotifications, type LocalNotification } from "../utils/notifications";

export function NotificationBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<LocalNotification[]>([]);

  useEffect(() => {
    setItems(loadLocalNotifications());
  }, []);

  useEffect(() => {
    saveLocalNotifications(items);
  }, [items]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const markAllRead = () => setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  const markRead = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="relative">
      <button onClick={() => setIsOpen((p) => !p)} className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors" title="Notifications">
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
                {items.slice().sort((a, b) => b.createdAt - a.createdAt).map((n) => (
                  <div key={n.id} className={`p-4 hover:bg-gray-50 transition-colors ${!n.read ? "bg-blue-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.kind === "comment" ? "bg-blue-100" : "bg-purple-100"}`}>
                        {n.kind === "comment" ? <MessageSquare className="w-5 h-5 text-blue-600" /> : <ThumbsUp className="w-5 h-5 text-purple-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 mb-1">{n.title}</div>
                        <div className="text-sm text-gray-600 mb-2 line-clamp-2">{n.message}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                          {!n.read && (
                            <button onClick={() => markRead(n.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                              Mark read
                            </button>
                          )}
                          <Link to={n.href} className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={() => setIsOpen(false)}>
                            View
                          </Link>
                        </div>
                      </div>

                      <button onClick={() => remove(n.id)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Remove notification">
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
