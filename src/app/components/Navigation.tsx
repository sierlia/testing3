import { ChevronDown, Building2, LogOut, Settings, User, Mail, Plus, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { NotificationBadge } from "./NotificationBadge";
import { useAuth } from "../utils/AuthContext";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "./DefaultAvatar";

type TeacherClass = { id: string; name: string };

function readTeacherClasses(userId: string): TeacherClass[] {
  try {
    return JSON.parse(window.localStorage.getItem(`gavel:teacherClasses:${userId}`) ?? "[]") as TeacherClass[];
  } catch {
    return [];
  }
}

function cacheTeacherClasses(userId: string, classes: TeacherClass[]) {
  window.localStorage.setItem(`gavel:teacherClasses:${userId}`, JSON.stringify(classes));
}

function readActiveTeacherClass(userId: string): TeacherClass | null {
  try {
    return JSON.parse(window.localStorage.getItem(`gavel:activeTeacherClass:${userId}`) ?? "null") as TeacherClass | null;
  } catch {
    return null;
  }
}

function cacheActiveTeacherClass(userId: string, active: TeacherClass) {
  window.localStorage.setItem(`gavel:activeTeacherClass:${userId}`, JSON.stringify(active));
}

export function Navigation() {
  const [organizationsOpen, setOrganizationsOpen] = useState(false);
  const [legislationOpen, setLegislationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeClassName, setActiveClassName] = useState<string>("");
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [unreadLetters, setUnreadLetters] = useState(0);
  const orgCloseTimerRef = useRef<number | null>(null);
  const legislationCloseTimerRef = useRef<number | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setAvatarUrl(null);
        setActiveClassId(null);
        setActiveClassName("");
        setTeacherClasses([]);
        return;
      }
      const routeClassId = location.pathname.match(/^\/(?:teacher\/class|class)\/([^/]+)/)?.[1] ?? null;
      if ((user.user_metadata as any)?.role === "teacher") {
        const cachedClasses = readTeacherClasses(user.id);
        const cachedActive = readActiveTeacherClass(user.id);
        if (cachedClasses.length) setTeacherClasses(cachedClasses);
        const cachedRouteClass = routeClassId ? cachedClasses.find((c) => c.id === routeClassId) : null;
        const immediateClass = cachedRouteClass ?? cachedActive;
        if (immediateClass) {
          setActiveClassId(routeClassId ?? immediateClass.id);
          setActiveClassName(immediateClass.name);
        }
      }
      const { data } = await supabase.from("profiles").select("avatar_url,class_id,role").eq("user_id", user.id).maybeSingle();
      setAvatarUrl((data as any)?.avatar_url ?? null);
      let classId = routeClassId ?? (data as any)?.class_id ?? null;
      if ((user.user_metadata as any)?.role === "teacher") {
        const { data: classes } = await supabase
          .from("classes")
          .select("id,name")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false });
        const rows = ((classes ?? []) as any[]).map((c) => ({ id: c.id, name: c.name }));
        setTeacherClasses(rows);
        cacheTeacherClasses(user.id, rows);
        if (!classId && rows[0]) {
          classId = rows[0].id;
          await supabase.from("profiles").upsert({
            user_id: user.id,
            class_id: classId,
            role: "teacher",
            display_name: user.user_metadata?.name ?? null,
          } as any);
        }
        const active = rows.find((c) => c.id === classId);
        if (active) {
          setActiveClassName(active.name);
          cacheActiveTeacherClass(user.id, active);
        }
      }
      setActiveClassId(classId);
    };
    void load();
  }, [user?.id, location.pathname]);

  const switchClass = async (classId: string) => {
    if (!user?.id) return;
    const next = teacherClasses.find((c) => c.id === classId);
    await supabase.from("profiles").upsert({
      user_id: user.id,
      class_id: classId,
      role: "teacher",
      display_name: user.user_metadata?.name ?? null,
    } as any);
    setActiveClassId(classId);
    setActiveClassName(next?.name ?? "Class");
    if (next) cacheActiveTeacherClass(user.id, next);
    setClassMenuOpen(false);
    const current = location.pathname;
    const teacherClassMatch = current.match(/^\/teacher\/class\/[^/]+(\/.*)?$/);
    if (teacherClassMatch) {
      navigate(`/teacher/class/${classId}${teacherClassMatch[1] ?? ""}`);
      return;
    }
    if (current === "/teacher/dashboard") {
      navigate(`/teacher/class/${classId}`);
      return;
    }
    navigate(0);
  };

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

  const openLegislation = () => {
    if (legislationCloseTimerRef.current) {
      window.clearTimeout(legislationCloseTimerRef.current);
      legislationCloseTimerRef.current = null;
    }
    setLegislationOpen(true);
  };

  const closeLegislationSoon = () => {
    if (legislationCloseTimerRef.current) window.clearTimeout(legislationCloseTimerRef.current);
    legislationCloseTimerRef.current = window.setTimeout(() => {
      setLegislationOpen(false);
      legislationCloseTimerRef.current = null;
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
      ? activeClassId
        ? `/teacher/class/${activeClassId}`
        : "/teacher/dashboard"
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
              <div className="relative" onMouseEnter={openLegislation} onMouseLeave={closeLegislationSoon}>
                <button
                  onClick={() => navigate("/bills")}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Legislation
                  <ChevronDown className={`w-4 h-4 transition-transform ${legislationOpen ? "rotate-180" : ""}`} />
                </button>

                {legislationOpen && (
                  <div className="absolute top-full left-0 mt-0 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10" onMouseEnter={openLegislation} onMouseLeave={closeLegislationSoon}>
                    <Link to="/bills" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      All Bills
                    </Link>
                    <Link to="/bills/my" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      My Bills
                    </Link>
                  </div>
                )}
              </div>

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
            {user?.user_metadata?.role === "teacher" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClassMenuOpen((open) => !open)}
                  className="flex min-w-[180px] items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  <span className="min-w-0">
                    <span className="block min-h-[20px] truncate text-sm font-semibold text-gray-900">{activeClassName}</span>
                    <span className="block text-xs text-gray-500">Switch classes</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${classMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {classMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="max-h-72 overflow-y-auto py-1">
                      {teacherClasses.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No classes yet</div>
                      ) : (
                        teacherClasses.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => void switchClass(c.id)}
                            className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                              c.id === activeClassId ? "bg-blue-50 font-medium text-blue-700" : "text-gray-700"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="border-t border-gray-200 py-1">
                      <Link
                        to="/teacher/create-class"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setClassMenuOpen(false)}
                      >
                        <Plus className="h-4 w-4" />
                        Add class
                      </Link>
                      <Link
                        to="/teacher/dashboard"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setClassMenuOpen(false)}
                      >
                        <Layers className="h-4 w-4" />
                        Manage classes
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
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
