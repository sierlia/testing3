import { Pin } from "lucide-react";
import { Link } from "react-router";

interface Announcement {
  id: string;
  author: string;
  role: string;
  content: string;
  timestamp: Date;
  isPinned: boolean;
  href?: string;
  isNew?: boolean;
}

interface AnnouncementsFeedProps {
  announcements: Announcement[];
}

export function AnnouncementsFeed({ announcements }: AnnouncementsFeedProps) {
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    // Pinned items first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Then by timestamp (newest first)
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
      </div>
      
      <div className="divide-y divide-gray-200">
        {sortedAnnouncements.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No announcements yet
          </div>
        ) : (
          sortedAnnouncements.map((announcement) => {
            const content = (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {announcement.isPinned && (
                      <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-900">
                      {announcement.author}
                    </span>
                    <span className="text-sm text-gray-500">
                      • {announcement.role}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                </div>
                <span className="text-sm text-gray-500 flex-shrink-0">
                  {formatTimestamp(announcement.timestamp)}
                </span>
              </div>
            );

            const className = `block px-6 py-4 ${announcement.isNew || announcement.isPinned ? "bg-blue-50" : ""} ${
              announcement.href ? "hover:bg-gray-50 transition-colors" : ""
            }`;
            return announcement.href ? (
              <Link key={announcement.id} to={announcement.href} className={className}>
                {content}
              </Link>
            ) : (
              <div key={announcement.id} className={className}>
                {content}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
