import { useState } from "react";
import { Bell, Mail, X, MessageSquare } from "lucide-react";
import { Link } from "react-router";

interface Notification {
  id: string;
  type: 'letter' | 'mention' | 'vote' | 'caucus_reply';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export function NotificationBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "caucus_reply",
      title: "New Reply in testing Caucus",
      message: "Less Tin has replied to your announcement in the testing caucus",
      timestamp: "5 minutes ago",
      read: false,
      link: "/tess-caucuses/1",
    },
    {
      id: "2",
      type: "letter",
      title: "New Dear Colleague Letter",
      message: "Alice Johnson sent you a letter about H.R. 101",
      timestamp: "2 hours ago",
      read: false,
      link: "/letters/1",
    },
    {
      id: "3",
      type: "vote",
      title: "Floor Vote Starting",
      message: "Vote is now open for H.R. 104",
      timestamp: "1 day ago",
      read: false,
      link: "/floor-session",
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleRemove = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <Link
              to="/notifications"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => setIsOpen(false)}
            >
              View All
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'letter' ? 'bg-blue-100' :
                        notification.type === 'vote' ? 'bg-green-100' :
                        notification.type === 'caucus_reply' ? 'bg-purple-100' :
                        'bg-purple-100'
                      }`}>
                        {notification.type === 'letter' && <Mail className="w-5 h-5 text-blue-600" />}
                        {notification.type === 'vote' && <Bell className="w-5 h-5 text-green-600" />}
                        {notification.type === 'caucus_reply' && <MessageSquare className="w-5 h-5 text-purple-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {notification.timestamp}
                          </span>
                          {!notification.read && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                          {notification.link && (
                            <Link
                              to={notification.link}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View
                            </Link>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemove(notification.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}