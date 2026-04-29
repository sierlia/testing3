import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { User, Send, Plus, MessageSquare, Pin, Edit2, Bell, ChevronDown, ChevronRight, Search, Users as UsersIcon, ArrowDown, ArrowUp } from "lucide-react";
import { useParams } from "react-router";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";

interface Reply {
  id: string;
  author: string;
  authorDistrict: string;
  authorRole: "Chair" | "Co-Chair" | "Member" | "External" | null;
  authorImage: string | null;
  content: string;
  replies?: Reply[];
}

interface Message {
  id: string;
  author: string;
  authorDistrict: string;
  authorRole: "Chair" | "Co-Chair" | null;
  authorParty: string;
  authorImage: string | null;
  content: string;
  reactions: { emoji: string; count: number }[];
  isPinned: boolean;
  replies: Reply[];
}

interface Member {
  id: string;
  name: string;
  district: string;
  role: "Chair" | "Co-Chair" | "Member";
  party: string;
  image: string | null;
}

export function TessCaucusDetail() {
  const { id } = useParams();
  
  const [caucusDescription, setCaucusDescription] = useState("hello there");
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState("hello there");
  const [isMember, setIsMember] = useState(true);
  
  const caucus = {
    id: id || "1",
    name: "testing",
    description: caucusDescription,
  };

  const [members, setMembers] = useState<Member[]>([
    { 
      id: "1", 
      name: "Tess Lin",
      district: "CA-22",
      role: "Chair", 
      party: "D",
      image: tessLinImage,
    },
    { 
      id: "2", 
      name: "Less Tin",
      district: "CA-21",
      role: "Co-Chair", 
      party: "R",
      image: null,
    },
    { 
      id: "3", 
      name: "Sset Nil",
      district: "CA-20",
      role: "Member", 
      party: "I",
      image: null,
    },
  ]);

  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSortBy, setMemberSortBy] = useState<'name' | 'role'>('name');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      author: "Tess Lin",
      authorDistrict: "CA-22",
      authorRole: "Chair",
      authorParty: "D",
      authorImage: tessLinImage,
      content: "testing pinned message 12345",
      reactions: [{ emoji: "👍", count: 1 }],
      isPinned: true,
      replies: [],
    },
    {
      id: "2",
      author: "Less Tin",
      authorDistrict: "CA-21",
      authorRole: "Co-Chair",
      authorParty: "R",
      authorImage: null,
      content: "This is a test message from the ranking member.",
      reactions: [],
      isPinned: false,
      replies: [
        {
          id: "r1",
          author: "Sset Nil",
          authorDistrict: "CA-20",
          authorRole: "Member",
          authorImage: null,
          content: "This is a test reply from a regular member.",
          replies: [],
        },
        {
          id: "r2",
          author: "Nit Ssel",
          authorDistrict: "NY-1",
          authorRole: "External",
          authorImage: null,
          content: "This is a test reply from an account not in the caucus.",
          replies: [],
        },
      ],
    },
  ]);

  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [notifyAllMembers, setNotifyAllMembers] = useState(false);
  const [announcementSortBy, setAnnouncementSortBy] = useState<'newest' | 'oldest'>('newest');
  
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [replyingToReply, setReplyingToReply] = useState<{ messageId: string; path: string[] } | null>(null);
  const [nestedReplyText, setNestedReplyText] = useState("");

  const emojis = ["👍", "❤️", "⭐", "🎉", "👏", "🔥", "✅", "👀"];

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessages(messages.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          return {
            ...msg,
            reactions: msg.reactions.map(r =>
              r.emoji === emoji ? { ...r, count: r.count + 1 } : r
            ),
          };
        } else {
          return {
            ...msg,
            reactions: [...msg.reactions, { emoji, count: 1 }],
          };
        }
      }
      return msg;
    }));
    setShowEmojiPicker(null);
  };

  const handlePostAnnouncement = () => {
    if (newAnnouncement.trim()) {
      const announcement: Message = {
        id: Date.now().toString(),
        author: "Tess Lin",
        authorDistrict: "CA-22",
        authorRole: "Chair",
        authorParty: "D",
        authorImage: tessLinImage,
        content: newAnnouncement,
        reactions: [],
        isPinned: false,
        replies: [],
      };
      setMessages([announcement, ...messages]);
      setNewAnnouncement("");
      setNotifyAllMembers(false);
    }
  };

  const handlePostReply = (messageId: string) => {
    if (replyText.trim()) {
      const newReply: Reply = {
        id: Date.now().toString(),
        author: "Tess Lin",
        authorDistrict: "CA-22",
        authorRole: "Chair",
        authorImage: tessLinImage,
        content: replyText,
        replies: [],
      };
      
      setMessages(messages.map(msg =>
        msg.id === messageId
          ? { ...msg, replies: [...msg.replies, newReply] }
          : msg
      ));
      
      setReplyText("");
      setReplyingTo(null);
      setShowReplies({ ...showReplies, [messageId]: true });
    }
  };

  const handlePostNestedReply = (messageId: string, path: string[]) => {
    if (nestedReplyText.trim()) {
      const newReply: Reply = {
        id: Date.now().toString(),
        author: "Tess Lin",
        authorDistrict: "CA-22",
        authorRole: "Chair",
        authorImage: tessLinImage,
        content: nestedReplyText,
        replies: [],
      };

      setMessages(messages.map(msg => {
        if (msg.id === messageId) {
          const updatedReplies = [...msg.replies];
          let current: Reply[] = updatedReplies;
          
          for (let i = 0; i < path.length - 1; i++) {
            const reply = current.find(r => r.id === path[i]);
            if (reply && reply.replies) {
              current = reply.replies;
            }
          }
          
          const targetReply = current.find(r => r.id === path[path.length - 1]);
          if (targetReply) {
            if (!targetReply.replies) {
              targetReply.replies = [];
            }
            targetReply.replies.push(newReply);
          }
          
          return { ...msg, replies: updatedReplies };
        }
        return msg;
      }));
      
      setNestedReplyText("");
      setReplyingToReply(null);
    }
  };

  const handleTogglePin = (messageId: string) => {
    setMessages(messages.map(msg =>
      msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
    ));
  };

  const handleSaveAbout = () => {
    setCaucusDescription(aboutText);
    setEditingAbout(false);
  };

  const handlePromoteMember = (memberId: string) => {
    setMembers(members.map(m =>
      m.id === memberId ? { ...m, role: "Co-Chair" as const } : m
    ));
  };

  const handleDemoteMember = (memberId: string) => {
    setMembers(members.map(m =>
      m.id === memberId ? { ...m, role: "Member" as const } : m
    ));
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (memberSortBy === 'role') {
      const roleOrder = { Chair: 1, "Co-Chair": 2, Member: 3 };
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return a.name.localeCompare(b.name);
  });

  const sortedMessages = [...messages].sort((a, b) => {
    if (announcementSortBy === 'newest') {
      return parseInt(b.id) - parseInt(a.id);
    }
    return parseInt(a.id) - parseInt(b.id);
  });

  const leadershipMembers = sortedMembers.filter(m => m.role === "Chair" || m.role === "Co-Chair");
  const regularMembers = sortedMembers.filter(m => m.role === "Member");

  const toggleReplies = (key: string) => {
    setShowReplies({ ...showReplies, [key]: !showReplies[key] });
  };

  const renderReply = (reply: Reply, messageId: string, path: string[] = []) => {
    const currentPath = [...path, reply.id];
    const replyKey = `${messageId}-${currentPath.join('-')}`;
    const hasReplies = reply.replies && reply.replies.length > 0;

    return (
      <div key={reply.id}>
        <div className="flex items-start gap-3">
          {reply.authorImage ? (
            <img 
              src={reply.authorImage} 
              alt={reply.author}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-blue-600">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{reply.author}</span>
              <span className="text-xs text-gray-500">({reply.authorDistrict})</span>
              {reply.authorRole === "Chair" && (
                <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-medium">
                  Chair
                </span>
              )}
              {reply.authorRole === "Co-Chair" && (
                <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded font-medium">
                  Co-Chair
                </span>
              )}
              {reply.authorRole === "External" && (
                <span className="text-xs px-2 py-0.5 bg-gray-400 text-white rounded font-medium">
                  External
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-2">{reply.content}</p>
            <button
              onClick={() => setReplyingToReply({ messageId, path: currentPath })}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors mb-2"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Reply</span>
            </button>

            {/* Nested reply box */}
            {replyingToReply?.messageId === messageId && 
             replyingToReply.path.join('-') === currentPath.join('-') && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                <textarea
                  value={nestedReplyText}
                  onChange={(e) => setNestedReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-2"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePostNestedReply(messageId, currentPath)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Send className="w-3 h-3" />
                    Post
                  </button>
                  <button
                    onClick={() => {
                      setReplyingToReply(null);
                      setNestedReplyText("");
                    }}
                    className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Nested replies */}
            {hasReplies && (
              <div className="mt-2">
                <button
                  onClick={() => toggleReplies(replyKey)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
                >
                  {showReplies[replyKey] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>{reply.replies!.length} {reply.replies!.length === 1 ? 'reply' : 'replies'}</span>
                </button>
                
                {showReplies[replyKey] && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                    {reply.replies!.map(nestedReply => renderReply(nestedReply, messageId, currentPath))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{caucus.name}</h1>
            <button
              onClick={() => setIsMember(!isMember)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isMember
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              }`}
            >
              {isMember ? 'Leave Caucus' : 'Disband Caucus'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar - About and Members */}
          <div className="lg:col-span-1 space-y-6">
            {/* About */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                <button
                  onClick={() => {
                    if (editingAbout) {
                      handleSaveAbout();
                    } else {
                      setEditingAbout(true);
                      setAboutText(caucusDescription);
                    }
                  }}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              {editingAbout ? (
                <div>
                  <textarea
                    value={aboutText}
                    onChange={(e) => setAboutText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-2"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAbout}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingAbout(false)}
                      className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700">{caucusDescription}</p>
              )}
            </div>

            {/* Members */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                  <span className="text-sm text-gray-600">{members.length}</span>
                </div>
                <UsersIcon className="w-5 h-5 text-gray-400" />
              </div>

              {/* Search and sort */}
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <select
                  value={memberSortBy}
                  onChange={(e) => setMemberSortBy(e.target.value as 'name' | 'role')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="name">Sort by Name</option>
                  <option value="role">Sort by Role</option>
                </select>
              </div>

              {/* Leadership */}
              {leadershipMembers.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Leadership</h3>
                  <div className="space-y-3">
                    {leadershipMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="relative">
                          {member.image ? (
                            <img 
                              src={member.image} 
                              alt={member.name}
                              className={`w-10 h-10 rounded-full object-cover border-2 ${
                                member.role === "Chair" ? "border-blue-600" : "border-purple-600"
                              }`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 ${
                              member.role === "Chair" ? "border-blue-600" : "border-purple-600"
                            }`}>
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 text-sm">
                              {member.name}
                            </h3>
                            <span className="text-xs text-gray-500">({member.district})</span>
                            {member.role === "Chair" && (
                              <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-medium">
                                Chair
                              </span>
                            )}
                            {member.role === "Co-Chair" && (
                              <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded font-medium">
                                Co-Chair
                              </span>
                            )}
                          </div>
                        </div>
                        {!isMember && member.role === "Co-Chair" && (
                          <button
                            onClick={() => handleDemoteMember(member.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                            Demote
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Members */}
              {regularMembers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Members</h3>
                  <div className="space-y-3">
                    {regularMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-3">
                        {member.image ? (
                          <img 
                            src={member.image} 
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 text-sm">
                              {member.name}
                            </h3>
                            <span className="text-xs text-gray-500">({member.district})</span>
                          </div>
                        </div>
                        {!isMember && (
                          <button
                            onClick={() => handlePromoteMember(member.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                            Promote
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Announcements Thread */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <select
                  value={announcementSortBy}
                  onChange={(e) => setAnnouncementSortBy(e.target.value as 'newest' | 'oldest')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              {/* New Announcement Box - only show when not a member (Disband mode) */}
              {!isMember && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <textarea
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="Post a new announcement..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-3"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyAllMembers}
                        onChange={(e) => setNotifyAllMembers(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Bell className="w-4 h-4" />
                      <span>Notify All Members</span>
                    </label>
                    <button
                      onClick={handlePostAnnouncement}
                      disabled={!newAnnouncement.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {sortedMessages.map(message => (
                  <div key={message.id}>
                    <div 
                      className={`p-4 rounded-lg relative ${
                        message.isPinned 
                          ? 'border-2 border-blue-500 bg-blue-50' 
                          : 'border border-gray-200 bg-white'
                      }`}
                    >
                      {/* Pin icon - only show in Disband mode */}
                      {!isMember && (
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={() => handleTogglePin(message.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Pin className={`w-4 h-4 ${message.isPinned ? 'text-blue-600 fill-blue-600' : 'text-gray-400'}`} />
                          </button>
                        </div>
                      )}

                      {/* Message header */}
                      <div className="flex items-start gap-3 mb-3">
                        {message.authorImage ? (
                          <img 
                            src={message.authorImage} 
                            alt={message.author}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{message.author}</span>
                            <span className="text-sm text-gray-500">({message.authorDistrict})</span>
                            {message.authorRole === "Chair" && (
                              <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded font-medium">
                                Chair
                              </span>
                            )}
                            {message.authorRole === "Co-Chair" && (
                              <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded font-medium">
                                Co-Chair
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Message content */}
                      <div className="ml-13 mb-3">
                        <p className="text-gray-700">{message.content}</p>
                      </div>

                      {/* Reactions and actions */}
                      <div className="ml-13 flex items-center gap-3 flex-wrap">
                        {/* Existing reactions */}
                        {message.reactions.map((reaction, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAddReaction(message.id, reaction.emoji)}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-sm"
                          >
                            <span>{reaction.emoji}</span>
                            <span className="text-gray-700 font-medium">{reaction.count}</span>
                          </button>
                        ))}

                        {/* Add reaction button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>

                          {/* Emoji picker */}
                          {showEmojiPicker === message.id && (
                            <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 flex gap-1">
                              {emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message.id, emoji)}
                                  className="w-8 h-8 hover:bg-gray-100 rounded transition-colors text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reply button */}
                        <button
                          onClick={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Reply</span>
                        </button>
                      </div>

                      {/* Reply box */}
                      {replyingTo === message.id && (
                        <div className="ml-13 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-2"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePostReply(message.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              <Send className="w-3 h-3" />
                              Post
                            </button>
                            <button
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {message.replies.length > 0 && (
                        <div className="ml-13 mt-3">
                          <button
                            onClick={() => toggleReplies(message.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
                          >
                            {showReplies[message.id] ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <span>{message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}</span>
                          </button>
                          
                          {showReplies[message.id] && (
                            <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                              {message.replies.map(reply => renderReply(reply, message.id))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}