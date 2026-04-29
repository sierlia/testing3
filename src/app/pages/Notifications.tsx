import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Bell, Settings, User, MessageSquare, Calendar, X } from "lucide-react";
import { Link, useNavigate } from "react-router";

interface Notification {
  id: string;
  type: "caucus_announcement" | "caucus_reply" | "committee_announcement" | "committee_reply" | "teacher_deadline";
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  relatedUser?: string;
  relatedUserImage?: string | null;
  linkTo?: string;
}

export function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "caucus_reply",
      title: "New Reply in testing Caucus",
      message: "Less Tin has replied to your announcement in the testing caucus",
      timestamp: new Date("2026-03-16T09:30:00"),
      isRead: false,
      relatedUser: "Less Tin",
      relatedUserImage: null,
      linkTo: "/tess-caucuses/1",
    },
  ]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "caucus_announcement":
      case "caucus_reply":
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case "committee_announcement":
      case "committee_reply":
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case "teacher_deadline":
        return <Calendar className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-gray-600 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={() => navigate('/notification-settings')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
              <p className="text-gray-600">You're all caught up!</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border transition-all ${
                  notification.isRead 
                    ? 'border-gray-200' 
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon or User Image */}
                    {notification.relatedUser ? (
                      notification.relatedUserImage ? (
                        <img 
                          src={notification.relatedUserImage} 
                          alt={notification.relatedUser}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`text-sm font-semibold ${notification.isRead ? 'text-gray-900' : 'text-gray-900'}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                          <button
                            onClick={() => handleDismissNotification(notification.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Dismiss notification"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{notification.message}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</span>
                        {notification.linkTo && (
                          <Link
                            to={notification.linkTo}
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View
                          </Link>
                        )}
                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs text-gray-600 hover:text-gray-900"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}