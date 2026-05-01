import { ChevronDown, Building2, LogOut, Settings, User, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { NotificationBadge } from "./NotificationBadge";
import { useAuth } from "../utils/AuthContext";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "./DefaultAvatar";

export function Navigation() {
  const [organizationsOpen, setOrganizationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [unreadLetters, setUnreadLetters] = useState(0);
  const orgCloseTimerRef = useRef<number | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setAvatarUrl(null);
        setActiveClassId(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("avatar_url,class_id").eq("user_id", user.id).maybeSingle();
      setAvatarUrl((data as any)?.avatar_url ?? null);
      setActiveClassId((data as any)?.class_id ?? null);
    };
    void load();
  }, [user?.id]);

  const openOrganizations = () => {
    if (orgCloseTimerRef.current) {
      window.clearTimeout(orgCloseTimerRef.current);
      orgCloseTimerRef.current = null;
    }
    setOrganizationsOpen(true);
  };

  const closeOrganizationsSoon = () => {
    if (orgCloseTimerRef.current) window.clearTimeout(orgCloseTimerRef.current);
    orgCloseTimerRef.current = window.setTimeout(() => {
      setOrganizationsOpen(false);
      orgCloseTimerRef.current = null;
    }, 320);
  };

  const refreshUnreadLetters = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from("dear_colleague_recipients")
      .select("letter_id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    setUnreadLetters(count ?? 0);
  };

  useEffect(() => {
    void refreshUnreadLetters();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`letters:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dear_colleague_recipients", filter: `recipient_user_id=eq.${user.id}` },
        () => {
          void refreshUnreadLetters();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Show navigation for bypassed users (when on dashboard but no user)
  const currentPath = window.location.pathname;
  const isOnDashboard = currentPath === '/dashboard' || currentPath.startsWith('/teacher/') || 
                        currentPath.startsWith('/bills') || currentPath.startsWith('/caucuses') ||
                        currentPath.startsWith('/committee') || currentPath.startsWith('/dear-colleague') ||
                        currentPath.startsWith('/notifications') || currentPath.startsWith('/members') ||
                        currentPath.startsWith('/parties') || currentPath.startsWith('/committees') ||
                        currentPath.startsWith('/settings') ||
                        currentPath === '/elections' || currentPath === '/floor-session' || 
                        currentPath === '/calendar' || currentPath.startsWith('/profile') ||
                        currentPath === '/resources' || currentPath.startsWith('/tess-');
  
  // If no user and not on dashboard pages, don't show navigation (for landing/auth pages)
  if (!user && !isOnDashboard) {
    return null;
  }

  const dashboardLink =
    user?.user_metadata?.role === "teacher"
      ? "/teacher/dashboard"
      : activeClassId
        ? `/class/${activeClassId}/dashboard`
        : "/settings/classes";

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Link to={dashboardLink}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  <h1 className="text-xl font-semibold text-gray-900">
                    Gavel
                  </h1>
                </div>
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/bills"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Legislation
              </Link>

              <div className="relative" onMouseEnter={openOrganizations} onMouseLeave={closeOrganizationsSoon}>
                <button
                  onClick={() => navigate("/parties")}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Organizations
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${organizationsOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {organizationsOpen && (
                  <div className="absolute top-full left-0 mt-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10" onMouseEnter={openOrganizations} onMouseLeave={closeOrganizationsSoon}>
                    <Link
                      to="/parties"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Party
                    </Link>
                    <Link
                      to="/committees"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Committee
                    </Link>
                    <Link
                      to="/caucuses"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Caucus
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/members"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Members
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBadge />
            <Link to="/dear-colleague/inbox" className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors" title="Dear Colleague Inbox">
              <Mail className="w-6 h-6" />
              {unreadLetters > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadLetters}
                </span>
              )}
            </Link>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-8 h-8 object-cover" />
                ) : (
                  <DefaultAvatar className="w-8 h-8" iconClassName="w-4 h-4 text-gray-500" />
                )}
              </button>
              
              {userMenuOpen && user && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.user_metadata?.name}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <Link
                    to={`/profile/${user?.id}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </Link>
                  <Link
                    to="/settings/notifications"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
              {userMenuOpen && !user && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      Dev Mode
                    </p>
                    <p className="text-xs text-gray-500">Bypassed Authentication</p>
                  </div>
                  <Link
                    to="/signin"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
