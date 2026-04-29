import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Users, Tag, Send, ThumbsUp, Heart, Star } from "lucide-react";
import { useParams } from "react-router";

interface Announcement {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  reactions: Record<string, number>;
}

export function CaucusDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'announcements'>('about');
  const [newAnnouncement, setNewAnnouncement] = useState("");
  
  // Mock data
  const caucus = {
    id: id || "1",
    name: "Environmental Action Caucus",
    description: "Focused on climate change, conservation, and renewable energy policies. We meet weekly to discuss legislation and coordinate advocacy efforts.",
    issueAreas: ["environment", "energy", "conservation"],
    chair: "Emma Davis",
    isMember: true,
    isChair: false,
  };

  const members = [
    { id: "1", name: "Emma Davis", role: "Chair", party: "Green" },
    { id: "2", name: "Alice Johnson", role: "Member", party: "Democratic" },
    { id: "3", name: "Frank Wilson", role: "Member", party: "Democratic" },
  ];

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "1",
      author: "Emma Davis",
      content: "Great work everyone on H.R. 102! Let's keep the momentum going for next week's committee hearing.",
      timestamp: "2026-02-09 10:30 AM",
      reactions: { thumbsup: 5, heart: 3, star: 2 },
    },
    {
      id: "2",
      author: "Emma Davis",
      content: "Reminder: Weekly caucus meeting this Friday at 3 PM. We'll be discussing our strategy for the upcoming floor vote.",
      timestamp: "2026-02-08 2:15 PM",
      reactions: { thumbsup: 8, heart: 1, star: 0 },
    },
  ]);

  const handleReaction = (announcementId: string, reactionType: string) => {
    setAnnouncements(announcements.map(a =>
      a.id === announcementId
        ? { ...a, reactions: { ...a.reactions, [reactionType]: (a.reactions[reactionType] || 0) + 1 } }
        : a
    ));
  };

  const handlePostAnnouncement = () => {
    if (newAnnouncement.trim() && caucus.isChair) {
      const newPost: Announcement = {
        id: Date.now().toString(),
        author: "You (Chair)",
        content: newAnnouncement,
        timestamp: new Date().toLocaleString(),
        reactions: { thumbsup: 0, heart: 0, star: 0 },
      };
      setAnnouncements([newPost, ...announcements]);
      setNewAnnouncement("");
    }
  };

  const reactionEmojis = [
    { type: 'thumbsup', icon: ThumbsUp, label: '👍' },
    { type: 'heart', icon: Heart, label: '❤️' },
    { type: 'star', icon: Star, label: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{caucus.name}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                {caucus.issueAreas.map(area => (
                  <span key={area} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {area}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-600">Chair: {caucus.chair}</p>
            </div>
            <button
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                caucus.isMember
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {caucus.isMember ? 'Leave Caucus' : 'Join Caucus'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                activeTab === 'about'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                activeTab === 'members'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                activeTab === 'announcements'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Announcements
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'about' && (
              <div>
                <p className="text-gray-700">{caucus.description}</p>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <h3 className="font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.party}</p>
                    </div>
                    {member.role === 'Chair' && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                        Chair
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="space-y-4">
                {/* Post form (chair only) */}
                {caucus.isChair && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <textarea
                      placeholder="Post an announcement to caucus members..."
                      value={newAnnouncement}
                      onChange={(e) => setNewAnnouncement(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-3"
                    />
                    <button
                      onClick={handlePostAnnouncement}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Post Announcement
                    </button>
                  </div>
                )}

                {/* Announcements feed */}
                {announcements.map(announcement => (
                  <div key={announcement.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{announcement.author}</h4>
                        <p className="text-xs text-gray-500">{announcement.timestamp}</p>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-3">{announcement.content}</p>
                    
                    {/* Reactions */}
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                      {reactionEmojis.map(({ type, icon: Icon, label }) => (
                        <button
                          key={type}
                          onClick={() => handleReaction(announcement.id, type)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-sm"
                        >
                          <span>{label}</span>
                          {announcement.reactions[type] > 0 && (
                            <span className="font-medium text-gray-700">{announcement.reactions[type]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
