import { Navigation } from "../components/Navigation";
import { AnnouncementsFeed } from "../components/AnnouncementsFeed";
import { QuickLinks } from "../components/QuickLinks";
import { MyStatusCard } from "../components/MyStatusCard";
import { TeacherAdminShortcuts } from "../components/TeacherAdminShortcuts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../utils/AuthContext";
import { Mail, PenSquare, KeyRound } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // Mock user role - can be 'student' or 'teacher'
  const [userRole] = useState<"student" | "teacher">("student");
  const [bypassAuth, setBypassAuth] = useState(false);

  useEffect(() => {
    if (!bypassAuth && !loading && !user) {
      navigate('/signin');
    }
  }, [user, loading, navigate, bypassAuth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !bypassAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <button
            onClick={() => setBypassAuth(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            <KeyRound className="w-4 h-4" />
            Bypass Authentication (Dev Mode)
          </button>
        </div>
      </div>
    );
  }

  // Mock announcements data
  const announcements = [
    {
      id: "1",
      author: "Mrs. McCormick",
      role: "Teacher",
      content:
        "Welcome to the Spring 2026 session! Please review the legislative calendar and committee assignments.",
      timestamp: new Date("2026-02-08T09:00:00"),
      isPinned: true,
    },
    {
      id: "2",
      author: "Ms. Beito",
      role: "Teacher",
      content:
        "Reminder: All bills must be submitted to the Clerk by Friday for next week's committee hearings.",
      timestamp: new Date("2026-02-09T14:30:00"),
      isPinned: true,
    },
    {
      id: "3",
      author: "Mr. Litzenberger",
      role: "Teacher",
      content:
        "Great work on the first round of debates! Keep up the civic engagement.",
      timestamp: new Date("2026-02-07T11:15:00"),
      isPinned: false,
    },
  ];

  // Mock student status data
  const studentStatus = {
    party: "Democratic Party",
    constituency: "California's 22nd District",
    committees: [
      "Agriculture Committee",
      "Energy & Commerce Committee",
    ],
    leadershipRoles: ["Majority Whip"],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dear Colleague Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => navigate('/dear-colleague/inbox')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            <Mail className="w-4 h-4" />
            Dear Colleague Letters
          </button>
          <button
            onClick={() => navigate('/dear-colleague/compose')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <PenSquare className="w-4 h-4" />
            Compose Letter
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-2 space-y-6">
            <AnnouncementsFeed announcements={announcements} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {userRole === "teacher" && (
              <TeacherAdminShortcuts />
            )}
            <QuickLinks />
            <MyStatusCard status={studentStatus} />
          </div>
        </div>
      </main>
    </div>
  );
}