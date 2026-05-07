import { Bell } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/AuthContext";

export function NotificationBadge() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <Link to="/notifications" className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors" title="Notifications">
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
