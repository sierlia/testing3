import { Bell } from "lucide-react";
import { Link } from "react-router";

export function NotificationBadge() {
  // Notifications feed is intentionally not implemented yet.
  // Users can manage notification preferences in Settings.
  return (
    <div className="relative">
      <Link
        to="/settings/notifications"
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors inline-flex"
        title="Notification Settings"
      >
        <span className="sr-only">Notification Settings</span>
        <Bell className="w-6 h-6" />
      </Link>
    </div>
  );
}
