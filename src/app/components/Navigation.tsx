import { ChevronDown, CircleHelp, DollarSign, Gavel, LogOut, Settings, User, Mail, Plus, Layers, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { NotificationBadge } from "./NotificationBadge";
import { useAuth } from "../utils/AuthContext";
import { supabase } from "../utils/supabase";
import { profilePath } from "../utils/profileRoute";
import { SecureAvatar } from "./SecureAvatar";

type TeacherClass = { id: string; name: string };
type OrgVisibility = { parties: boolean; committees: boolean; caucuses: boolean; lobbyists: boolean };
const defaultOrgVisibility: OrgVisibility = { parties: true, committees: true, caucuses: true, lobbyists: true };

function orgVisibilityFromSettings(settings: any): OrgVisibility {
  const organizations = settings?.organizations ?? {};
  const organizationsEnabled = organizations.enabled !== false;
  return {
    parties: organizationsEnabled && organizations.enableParties !== false,
    committees: organizationsEnabled && organizations.enableCommittees !== false,
    caucuses: organizationsEnabled && organizations.enableCaucuses !== false,
    lobbyists: organizationsEnabled && (organizations.enableLobbyists === true || settings?.lobbyists?.enabled === true),
  };
}

function isOrgVisibility(value: any): value is OrgVisibility {
  return (
    typeof value?.parties === "boolean" &&
    typeof value?.committees === "boolean" &&
    typeof value?.caucuses === "boolean" &&
    typeof value?.lobbyists === "boolean"
  );
}

function readCachedOrgVisibility(classId?: string | null) {
  try {
    const specific = classId ? JSON.parse(window.localStorage.getItem(`gavel:orgVisibility:${classId}`) ?? "null") : null;
    if (isOrgVisibility(specific)) return specific;
    const last = JSON.parse(window.localStorage.getItem("gavel:orgVisibility:last") ?? "null");
    if (isOrgVisibility(last)) return last;
  } catch {
    // ignore cache failures
  }
  return defaultOrgVisibility;
}

function cacheOrgVisibility(classId: string, visibility: OrgVisibility) {
  try {
    window.localStorage.setItem(`gavel:orgVisibility:${classId}`, JSON.stringify(visibility));
    window.localStorage.setItem("gavel:orgVisibility:last", JSON.stringify(visibility));
  } catch {
    // ignore cache failures
  }
}

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

function readCachedAvatar(userId: string) {
  try {
    return window.localStorage.getItem(`gavel:avatar:${userId}`);
  } catch {
    return null;
  }
}

function cacheAvatar(userId: string, avatarUrl: string | null) {
  try {
    if (avatarUrl) window.localStorage.setItem(`gavel:avatar:${userId}`, avatarUrl);
    else window.localStorage.removeItem(`gavel:avatar:${userId}`);
  } catch {
    // ignore storage failures
  }
}

function readCachedMoney(userId: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`gavel:money:${userId}`) ?? "null");
    if (typeof parsed?.enabled === "boolean" && typeof parsed?.balance === "number") return parsed as { enabled: boolean; balance: number };
  } catch {
    // ignore storage failures
  }
  return { enabled: false, balance: 0 };
}

function cacheMoney(userId: string, money: { enabled: boolean; balance: number }) {
  try {
    window.localStorage.setItem(`gavel:money:${userId}`, JSON.stringify(money));
  } catch {
    // ignore storage failures
  }
}

export function Navigation() {
  const [organizationsOpen, setOrganizationsOpen] = useState(false);
  const [legislationOpen, setLegislationOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [moneyMenuOpen, setMoneyMenuOpen] = useState(false);
  const [adBidOpen, setAdBidOpen] = useState(false);
  const [adBidDraft, setAdBidDraft] = useState({ message: "", amount: "0", lobbyistGroupId: "" });
  const [adBidRows, setAdBidRows] = useState<Array<{ id: string; bidder: string; message: string; amount: number }>>([]);
  const [myLobbyistGroups, setMyLobbyistGroups] = useState<Array<{ id: string; name: string }>>([]);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeClassName, setActiveClassName] = useState<string>("");
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [unreadLetters, setUnreadLetters] = useState(0);
  const [money, setMoney] = useState<{ enabled: boolean; balance: number }>(() => (user?.id ? readCachedMoney(user.id) : { enabled: false, balance: 0 }));
  const [orgVisibility, setOrgVisibility] = useState<OrgVisibility>(() => readCachedOrgVisibility());
  const classMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const moneyMenuRef = useRef<HTMLDivElement | null>(null);
  const orgCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const current = `${location.pathname}${location.search}`;
    const previous = window.sessionStorage.getItem("gavel:currentPath");
    if (previous && previous !== current) window.sessionStorage.setItem("gavel:lastPath", previous);
    window.sessionStorage.setItem("gavel:currentPath", current);
  }, [location.pathname, location.search]);
  const legislationCloseTimerRef = useRef<number | null>(null);
  const floorCloseTimerRef = useRef<number | null>(null);
  const isActivePath = (paths: string[]) =>
    paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const navItemClass = (active: boolean) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
    }`;
  const navButtonClass = (active: boolean) =>
    `flex items-center gap-1 ${navItemClass(active)}`;
  const dropdownItemClass = (active: boolean) =>
    `block px-4 py-2 text-sm ${active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`;

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
        setMoney({ enabled: false, balance: 0 });
        setOrgVisibility(defaultOrgVisibility);
        return;
      }
      setMoney(readCachedMoney(user.id));
      const cachedAvatar = readCachedAvatar(user.id);
      if (cachedAvatar) setAvatarUrl(cachedAvatar);
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
      const nextAvatar = (data as any)?.avatar_url ?? null;
      setAvatarUrl(nextAvatar);
      cacheAvatar(user.id, nextAvatar);
      let classId = routeClassId ?? (data as any)?.class_id ?? null;
      if (classId) {
        setOrgVisibility(readCachedOrgVisibility(classId));
        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        const settings = (cls as any)?.settings ?? {};
        const nextOrgVisibility = orgVisibilityFromSettings(settings);
        setOrgVisibility(nextOrgVisibility);
        cacheOrgVisibility(classId, nextOrgVisibility);
        if (settings?.money?.enabled) {
          const [{ data: sent }, { data: received }] = await Promise.all([
            supabase.from("lobbyist_contributions").select("amount").eq("class_id", classId).eq("from_user_id", user.id),
            supabase.from("lobbyist_contributions").select("amount").eq("class_id", classId).eq("recipient_type", "member").eq("recipient_id", user.id),
          ]);
          const spent = (sent ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
          const incoming = (received ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0);
          const nextMoney = { enabled: true, balance: Number(settings.money.startingAmount ?? 1000) - spent + incoming };
          setMoney(nextMoney);
          cacheMoney(user.id, nextMoney);
        } else {
          const nextMoney = { enabled: false, balance: 0 };
          setMoney(nextMoney);
          cacheMoney(user.id, nextMoney);
        }
      } else {
        setOrgVisibility(defaultOrgVisibility);
      }
      if ((user.user_metadata as any)?.role === "teacher") {
        const [{ data: ownedClasses }, { data: membershipRows }] = await Promise.all([
          supabase
            .from("classes")
            .select("id,name,created_at")
            .eq("teacher_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("class_memberships")
            .select("status,classes(id,name,created_at)")
            .eq("user_id", user.id)
            .eq("role", "teacher")
            .eq("status", "approved"),
        ]);
        const classMap = new Map<string, any>();
        for (const c of ownedClasses ?? []) classMap.set((c as any).id, c);
        for (const row of membershipRows ?? []) {
          const c = (row as any).classes;
          if (c) classMap.set(c.id, c);
        }
        const rows = Array.from(classMap.values())
          .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
          .map((c) => ({ id: c.id, name: c.name }));
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

  useEffect(() => {
    if (!classMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && classMenuRef.current?.contains(target)) return;
      setClassMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [classMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && userMenuRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!moneyMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && moneyMenuRef.current?.contains(target)) return;
      setMoneyMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [moneyMenuOpen]);

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
      navigate("/dashboard");
      return;
    }
    navigate(0);
  };

  const openOrganizations = () => {
    if (orgCloseTimerRef.current) {
      window.clearTimeout(orgCloseTimerRef.current);
      orgCloseTimerRef.current = null;
    }
    if (legislationCloseTimerRef.current) {
      window.clearTimeout(legislationCloseTimerRef.current);
      legislationCloseTimerRef.current = null;
    }
    setLegislationOpen(false);
    setFloorOpen(false);
    setOrganizationsOpen(true);
  };

  const closeOrganizationsSoon = () => {
    if (orgCloseTimerRef.current) window.clearTimeout(orgCloseTimerRef.current);
    orgCloseTimerRef.current = window.setTimeout(() => {
      setOrganizationsOpen(false);
      orgCloseTimerRef.current = null;
    }, 140);
  };

  const openLegislation = () => {
    if (legislationCloseTimerRef.current) {
      window.clearTimeout(legislationCloseTimerRef.current);
      legislationCloseTimerRef.current = null;
    }
    if (orgCloseTimerRef.current) {
      window.clearTimeout(orgCloseTimerRef.current);
      orgCloseTimerRef.current = null;
    }
    setOrganizationsOpen(false);
    setFloorOpen(false);
    setLegislationOpen(true);
  };

  const closeLegislationSoon = () => {
    if (legislationCloseTimerRef.current) window.clearTimeout(legislationCloseTimerRef.current);
    legislationCloseTimerRef.current = window.setTimeout(() => {
      setLegislationOpen(false);
      legislationCloseTimerRef.current = null;
    }, 140);
  };

  const openFloor = () => {
    if (floorCloseTimerRef.current) {
      window.clearTimeout(floorCloseTimerRef.current);
      floorCloseTimerRef.current = null;
    }
    setLegislationOpen(false);
    setOrganizationsOpen(false);
    setFloorOpen(true);
  };

  const closeFloorSoon = () => {
    if (floorCloseTimerRef.current) window.clearTimeout(floorCloseTimerRef.current);
    floorCloseTimerRef.current = window.setTimeout(() => {
      setFloorOpen(false);
      floorCloseTimerRef.current = null;
    }, 140);
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

  const loadAdBids = async () => {
    if (!activeClassId || !user?.id) return;
    const [{ data: memberships }, { data: last }] = await Promise.all([
      supabase.from("lobbyist_group_members").select("group_id,lobbyist_groups(id,name)").eq("user_id", user.id),
      supabase.from("custom_records").select("created_at").eq("class_id", activeClassId).eq("type", "newsletter").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const since = (last as any)?.created_at ?? "1970-01-01T00:00:00.000Z";
    const { data: bids } = await supabase
      .from("newsletter_ad_bids")
      .select("id,bidder_user_id,message,amount,status,lobbyist_groups(name)")
      .eq("class_id", activeClassId)
      .gt("created_at", since)
      .order("amount", { ascending: false });
    const bidderIds = [...new Set(((bids ?? []) as any[]).map((bid) => bid.bidder_user_id).filter(Boolean))];
    const { data: profiles } = bidderIds.length
      ? await supabase.from("profiles").select("user_id,display_name").in("user_id", bidderIds)
      : ({ data: [] } as any);
    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
    setMyLobbyistGroups(((memberships ?? []) as any[]).map((row) => row.lobbyist_groups).filter(Boolean));
    setAdBidRows(((bids ?? []) as any[])
      .filter((bid) => bid.status === "pending")
      .map((bid) => ({
        id: bid.id,
        bidder: bid.lobbyist_groups?.name ?? profileMap.get(bid.bidder_user_id) ?? "Member",
        message: bid.message,
        amount: Number(bid.amount ?? 0),
      })));
  };

  const openAdBid = () => {
    setMoneyMenuOpen(false);
    setAdBidOpen(true);
    void loadAdBids();
  };

  const submitAdBid = async () => {
    if (!activeClassId || !user?.id || !adBidDraft.message.trim()) return;
    const wordCount = adBidDraft.message.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 250) {
      toast.error("Advertisement notes are limited to 250 words.");
      return;
    }
    const { error } = await supabase.from("newsletter_ad_bids").insert({
      class_id: activeClassId,
      bidder_user_id: user.id,
      lobbyist_group_id: myLobbyistGroups[0]?.id ?? null,
      message: adBidDraft.message.trim(),
      amount: Math.max(0, Number(adBidDraft.amount) || 0),
    } as any);
    if (error) {
      toast.error(error.message || "Could not submit advertisement bid");
      return;
    }
    toast.success("Advertisement bid submitted");
    setAdBidDraft({ message: "", amount: "0", lobbyistGroupId: "" });
    await loadAdBids();
  };

  useEffect(() => {
    void refreshUnreadLetters();
  }, [user?.id]);

  useEffect(() => {
    const onAvatarUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; avatarUrl: string | null }>).detail;
      if (!detail || detail.userId !== user?.id) return;
      setAvatarUrl(detail.avatarUrl);
      cacheAvatar(detail.userId, detail.avatarUrl);
    };
    window.addEventListener("gavel:avatar-updated", onAvatarUpdated);
    return () => window.removeEventListener("gavel:avatar-updated", onAvatarUpdated);
  }, [user?.id]);

  useEffect(() => {
    const onClassRenamed = (event: Event) => {
      const detail = (event as CustomEvent<{ classId: string; name: string }>).detail;
      if (!detail || !user?.id) return;
      setTeacherClasses((current) => {
        const next = current.map((classItem) => classItem.id === detail.classId ? { ...classItem, name: detail.name } : classItem);
        cacheTeacherClasses(user.id, next);
        return next;
      });
      if (activeClassId === detail.classId) {
        const active = { id: detail.classId, name: detail.name };
        setActiveClassName(detail.name);
        cacheActiveTeacherClass(user.id, active);
      }
    };
    window.addEventListener("gavel:class-renamed", onClassRenamed);
    return () => window.removeEventListener("gavel:class-renamed", onClassRenamed);
  }, [activeClassId, user?.id]);

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
                        currentPath.startsWith('/lobbyists') ||
                        currentPath.startsWith('/settings') ||
                        currentPath.startsWith('/assignments') ||
                        currentPath === '/elections' || currentPath === '/floor-session' || currentPath === '/floor' ||
                        currentPath === '/calendar' || currentPath.startsWith('/profile') ||
                        currentPath === '/resources' || currentPath.startsWith('/tess-');
  
  // If no user and not on dashboard pages, don't show navigation (for landing/auth pages)
  if (!user && !isOnDashboard) {
    return null;
  }

  const dashboardLink =
    user?.user_metadata?.role === "teacher"
      ? activeClassId
        ? "/dashboard"
        : "/classes"
      : activeClassId
        ? "/dashboard"
        : "/settings/classes";
  const showLobbyists = orgVisibility.lobbyists || isActivePath(["/lobbyists"]);
  const organizationLinks = [
    orgVisibility.parties ? { to: "/parties", label: "Parties", active: isActivePath(["/parties"]) } : null,
    orgVisibility.committees ? { to: "/committees", label: "Committees", active: isActivePath(["/committees", "/committee"]) } : null,
    orgVisibility.caucuses ? { to: "/caucuses", label: "Caucuses", active: isActivePath(["/caucuses"]) } : null,
    showLobbyists ? { to: "/lobbyists", label: "Lobbyists", active: isActivePath(["/lobbyists"]) } : null,
    { to: "/members", label: "Members", active: isActivePath(["/members"]) },
  ].filter(Boolean) as Array<{ to: string; label: string; active: boolean }>;
  const primaryOrganizationPath = organizationLinks[0]?.to ?? "/organizations";

  return (
    <>
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Link to={dashboardLink}>
                <div className="flex items-center gap-2">
                  <Gavel className="w-6 h-6 text-blue-600" />
                  <h1 className="text-xl font-semibold text-gray-900">
                    Gavel
                  </h1>
                </div>
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {!user && (
                <>
                  <Link
                    to="/"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    to="/"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Demo
                  </Link>
                  <Link
                    to="/about"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Contact
                  </Link>
                </>
              )}
              <div className="relative" onMouseEnter={openLegislation} onMouseLeave={closeLegislationSoon}>
                <button
                  onClick={() => navigate("/bills")}
                  className={navButtonClass(isActivePath(["/bills"]))}
                >
                  Legislation
                  <ChevronDown className={`w-4 h-4 transition-transform ${legislationOpen ? "rotate-180" : ""}`} />
                </button>

                {legislationOpen && (
                  <div className="absolute top-full left-0 mt-0 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10" onMouseEnter={openLegislation} onMouseLeave={closeLegislationSoon}>
                    <Link to="/bills" className={dropdownItemClass(location.pathname === "/bills")}>
                      All Bills
                    </Link>
                    <Link to="/bills/my" className={dropdownItemClass(isActivePath(["/bills/my"]))}>
                      My Bills
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/records"
                className={navItemClass(isActivePath(["/records", "/newsletters"]))}
              >
                Records
              </Link>

              <div className="relative" onMouseEnter={openOrganizations} onMouseLeave={closeOrganizationsSoon}>
                <button
                  onClick={() => navigate(primaryOrganizationPath)}
                  className={navButtonClass(isActivePath(["/parties", "/committees", "/caucuses", "/lobbyists", "/committee", "/members"]))}
                >
                  Organizations
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${organizationsOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {organizationsOpen && (
                  <div className="absolute top-full left-0 mt-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10" onMouseEnter={openOrganizations} onMouseLeave={closeOrganizationsSoon}>
                    {organizationLinks.length ? organizationLinks.map((item) => (
                      <div key={item.to}>
                        {item.label === "Lobbyists" || (item.label === "Members" && organizationLinks.some((link) => link.label === "Lobbyists")) ? (
                          <div className="my-1 border-t border-gray-300" aria-hidden="true" />
                        ) : null}
                        <Link to={item.to} className={dropdownItemClass(item.active)}>
                          {item.label}
                        </Link>
                      </div>
                    )) : (
                      <div className="px-4 py-2 text-sm text-gray-500">Organizations disabled</div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative" onMouseEnter={openFloor} onMouseLeave={closeFloorSoon}>
                <button
                  onClick={() => navigate("/floor")}
                  className={navButtonClass(isActivePath(["/floor", "/calendar"]))}
                >
                  Floor
                  <ChevronDown className={`w-4 h-4 transition-transform ${floorOpen ? "rotate-180" : ""}`} />
                </button>
                {floorOpen && (
                  <div className="absolute top-full left-0 mt-0 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10" onMouseEnter={openFloor} onMouseLeave={closeFloorSoon}>
                    <Link to="/floor" className={dropdownItemClass(isActivePath(["/floor"]))}>
                      Live
                    </Link>
                    <Link to="/calendar" className={dropdownItemClass(isActivePath(["/calendar"]))}>
                      Calendar
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/assignments"
                className={navItemClass(isActivePath(["/assignments", "/teacher/assignments", "/teacher/deadlines"]))}
              >
                Assignments
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBadge />
            <Link to="/inbox" className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors" title="Dear Colleague Inbox">
              <Mail className="w-6 h-6" />
              {unreadLetters > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadLetters}
                </span>
              )}
            </Link>
            {money.enabled && (
              <div className="relative" ref={moneyMenuRef}>
                <button type="button" onClick={() => setMoneyMenuOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-100" title="Campaign money">
                  <DollarSign className="h-4 w-4" />
                  {money.balance.toLocaleString()}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moneyMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {moneyMenuOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                    <Link
                      to={user?.id ? `/records?type=campaign_contribution&user=${user.id}` : "/records?type=campaign_contribution"}
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setMoneyMenuOpen(false)}
                    >
                      <span className="block font-medium text-gray-900">Contribution history</span>
                      <span className="text-xs text-gray-500">View campaign contribution records.</span>
                    </Link>
                    <button type="button" onClick={openAdBid} className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                      <span className="block font-medium text-gray-900">Purchase advertisement</span>
                      <span className="text-xs text-gray-500">Bid for one of three newsletter spots.</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {user?.user_metadata?.role === "teacher" && (
              <div className="relative" ref={classMenuRef}>
                <button
                  type="button"
                  onClick={() => setClassMenuOpen((open) => !open)}
                  className="flex min-w-[180px] items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  <span className="min-w-0">
                    <span className="block min-h-[20px] truncate text-sm font-semibold text-gray-900">{activeClassName || "N/A"}</span>
                    <span className="block text-xs text-gray-500">Switch classes</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${classMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {classMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="border-b border-gray-200 px-4 pb-2 pt-4 text-xs font-semibold text-gray-500">
                      My classes
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {teacherClasses.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">N/A</div>
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
                        to="/classes"
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
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
              >
                <SecureAvatar src={avatarUrl} alt="Profile" className="w-8 h-8 object-cover" fallbackClassName="w-8 h-8" iconClassName="w-4 h-4 text-gray-500" />
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
                    to={profilePath(user?.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <Link
                    to="/help"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <CircleHelp className="w-4 h-4" />
                    Help
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
    {adBidOpen && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Purchase Newsletter Advertisement</h2>
              <p className="text-sm text-gray-500">The top three active bids will be placed in the next newsletter.</p>
            </div>
            <button type="button" onClick={() => setAdBidOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_1.1fr]">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Live Bids</h3>
              <div className="space-y-2">
                {adBidRows.length ? adBidRows.slice(0, 3).map((bid, index) => (
                  <div key={bid.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900">Spot {index + 1}</span>
                      <span className="font-semibold text-green-700">${bid.amount.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-600">{bid.bidder}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-gray-500">{bid.message}</div>
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">No bids yet.</div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Bid amount</span>
                <span className="relative block">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={adBidDraft.amount} onChange={(event) => setAdBidDraft({ ...adBidDraft, amount: event.target.value.replace(/[^\d]/g, "") })} className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Message</span>
                <textarea value={adBidDraft.message} onChange={(event) => setAdBidDraft({ ...adBidDraft, message: event.target.value })} rows={5} placeholder="Advertisement message for the next newsletter" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                <span className="mt-1 block text-xs text-gray-500">{adBidDraft.message.trim() ? adBidDraft.message.trim().split(/\s+/).length : 0}/250 words</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={() => setAdBidOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
            <button type="button" onClick={() => void submitAdBid()} disabled={!adBidDraft.message.trim()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Submit bid</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
