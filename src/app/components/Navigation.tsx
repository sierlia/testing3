import { ChevronDown, Building2, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { NotificationBadge } from "./NotificationBadge";
import { useAuth } from "../utils/AuthContext";

export function Navigation() {
  const [billPipelineOpen, setBillPipelineOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const userInitials = user?.user_metadata?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  // Show navigation for bypassed users (when on dashboard but no user)
  const currentPath = window.location.pathname;
  const isOnDashboard = currentPath === '/dashboard' || currentPath.startsWith('/teacher/') || 
                        currentPath.startsWith('/bills') || currentPath.startsWith('/caucuses') ||
                        currentPath.startsWith('/committee') || currentPath.startsWith('/dear-colleague') ||
                        currentPath.startsWith('/notifications') || currentPath.startsWith('/members') ||
                        currentPath === '/elections' || currentPath === '/floor-session' || 
                        currentPath === '/calendar' || currentPath.startsWith('/profile') ||
                        currentPath === '/resources' || currentPath.startsWith('/tess-');
  
  // If no user and not on dashboard pages, don't show navigation (for landing/auth pages)
  if (!user && !isOnDashboard) {
    return null;
  }

  const dashboardLink = user?.user_metadata?.role === 'teacher' 
    ? '/teacher/dashboard' 
    : '/dashboard';

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
                to="/members"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Members
              </Link>

              <a
                href="#"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Organizations
              </a>

              <div className="relative">
                <button
                  onClick={() =>
                    setBillPipelineOpen(!billPipelineOpen)
                  }
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Bill Pipeline
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${billPipelineOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {billPipelineOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Clerk
                    </a>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Committees
                    </a>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Floor
                    </a>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Calendar
                    </a>
                  </div>
                )}
              </div>

              <a
                href="#"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Resources
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBadge />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {userInitials}
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