import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { demoAccounts, DemoAccountKey, switchDemoAccount } from "../utils/demoAccounts";
import { useAuth } from "../utils/AuthContext";

const storageKey = "gavel:demoSwitcherPosition:v2";

function readPosition() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed as { x: number; y: number };
  } catch {
    // ignore
  }
  return null;
}

function currentAppPath() {
  const hashPath = window.location.hash.replace(/^#/, "");
  return hashPath || window.location.pathname;
}

function isDashboardPath(path: string) {
  return path.includes("/dashboard") || path.startsWith("/class/") || path.startsWith("/teacher/class/");
}

export function DemoAccountSwitcher() {
  const { user, signOut } = useAuth();
  const [routePath, setRoutePath] = useState(() => currentAppPath());
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<DemoAccountKey | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [demoActive, setDemoActive] = useState(() => window.localStorage.getItem("gavel:demoActive") === "1");
  const [dashboardReady, setDashboardReady] = useState(false);
  const [burst, setBurst] = useState(false);
  const [dragHintMounted, setDragHintMounted] = useState(false);
  const [dragHintVisible, setDragHintVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const dragHintTimerRef = useRef<number | null>(null);

  const hideDragHint = () => {
    if (dragHintTimerRef.current) window.clearTimeout(dragHintTimerRef.current);
    dragHintTimerRef.current = null;
    setDragHintVisible(false);
    window.setTimeout(() => setDragHintMounted(false), 300);
  };

  const playLaunchEffectsIfNeeded = () => {
    if (window.localStorage.getItem("gavel:demoConfetti") !== "1") return;
    window.localStorage.removeItem("gavel:demoConfetti");
    if (window.localStorage.getItem("gavel:demoCenter") === "1") {
      window.localStorage.removeItem("gavel:demoCenter");
      const centered = { x: Math.max(16, Math.round(window.innerWidth / 2 - 42)), y: Math.max(16, Math.round(window.innerHeight * 0.58)) };
      setPosition(centered);
      window.localStorage.setItem(storageKey, JSON.stringify(centered));
    }
    setBurst(true);
    setDragHintMounted(true);
    window.requestAnimationFrame(() => setDragHintVisible(true));
    window.setTimeout(() => setBurst(false), 1000);
    dragHintTimerRef.current = window.setTimeout(hideDragHint, 5000);
  };

  useEffect(() => {
    const saved = readPosition();
    if (saved) setPosition(saved);
    else setPosition({ x: Math.max(16, window.innerWidth - 96), y: Math.max(16, window.innerHeight - 76) });
  }, []);

  useEffect(() => {
    const onDemoOpened = () => {
      setDemoActive(true);
      if (dashboardReady) playLaunchEffectsIfNeeded();
    };
    const onDemoEnded = () => {
      setDemoActive(false);
      setOpen(false);
    };
    window.addEventListener("gavel:demo-opened", onDemoOpened);
    window.addEventListener("gavel:demo-ended", onDemoEnded);
    const openedAt = Number(window.localStorage.getItem("gavel:demoOpenedAt") ?? 0);
    if (Date.now() - openedAt < 2000) onDemoOpened();
    return () => {
      window.removeEventListener("gavel:demo-opened", onDemoOpened);
      window.removeEventListener("gavel:demo-ended", onDemoEnded);
    };
  }, [dashboardReady]);

  useEffect(() => {
    setDemoActive(window.localStorage.getItem("gavel:demoActive") === "1");
    setDashboardReady(false);
    const onReady = () => setDashboardReady(true);
    window.addEventListener("gavel:dashboard-ready", onReady);
    const fallback = isDashboardPath(routePath) ? window.setTimeout(() => setDashboardReady(true), 1200) : null;
    return () => {
      window.removeEventListener("gavel:dashboard-ready", onReady);
      if (fallback) window.clearTimeout(fallback);
    };
  }, [routePath, user?.id]);

  useEffect(() => {
    const updateRoute = () => setRoutePath(currentAppPath());
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    const interval = window.setInterval(updateRoute, 500);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!dashboardReady || !demoActive) return;
    playLaunchEffectsIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardReady, demoActive]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = {
        x: Math.min(window.innerWidth - 96, Math.max(8, drag.baseX + event.clientX - drag.startX)),
        y: Math.min(window.innerHeight - 64, Math.max(8, drag.baseY + event.clientY - drag.startY)),
      };
      drag.moved = drag.moved || Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4;
      setPosition(next);
    };
    const onUp = () => {
      const current = position;
      if (current) window.localStorage.setItem(storageKey, JSON.stringify(current));
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [position]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const selectAccount = async (key: DemoAccountKey) => {
    setBusyKey(key);
    try {
      await switchDemoAccount(key, { preserveLocation: true });
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Could not switch demo account");
    } finally {
      setBusyKey(null);
    }
  };

  const endDemo = async () => {
    setOpen(false);
    await signOut();
    window.location.hash = "/";
  };

  if (!position) return null;
  if (!user || !demoActive) return null;
  const menuVerticalClass = position.y > window.innerHeight - 300 ? "bottom-full mb-2" : "top-full mt-2";
  const menuHorizontalClass = position.x > window.innerWidth - 240 ? "right-0" : "left-0";
  const activeKey = (user.email?.split("@")[0] ?? "") as DemoAccountKey;

  return (
    <div
      ref={rootRef}
      className="fixed z-50 select-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        hideDragHint();
        dragRef.current = { startX: event.clientX, startY: event.clientY, baseX: position.x, baseY: position.y, moved: false };
      }}
    >
      <div className="rounded-full border border-blue-700 bg-blue-600 text-white shadow-lg">
        {burst && (
          <div className="pointer-events-none absolute inset-0 scale-125 animate-pulse">
            {["-left-4 -top-3 h-3 w-3 bg-blue-500", "left-8 -top-6 h-4 w-4 bg-amber-400", "right-0 -top-5 h-3.5 w-3.5 bg-emerald-500", "-right-4 top-7 h-4 w-4 bg-pink-500", "left-2 -bottom-4 h-3 w-3 bg-purple-500", "right-8 -bottom-5 h-3.5 w-3.5 bg-sky-400"].map((classes, index) => (
              <span key={index} className={`absolute animate-ping rounded-full ${classes}`} />
            ))}
          </div>
        )}
        {dragHintMounted && (
          <div className={`absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-sm font-semibold text-blue-700 transition-all duration-300 ${dragHintVisible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}>
            Drag me!
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (dragRef.current?.moved) return;
            setOpen((value) => !value);
          }}
          className="rounded-full px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Demo
        </button>
      </div>
      {open && (
        <div className={`absolute ${menuVerticalClass} ${menuHorizontalClass} w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-xl`}>
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Switch demo users</div>
          {demoAccounts.map((account) => (
            <button
              key={account.key}
              type="button"
              disabled={busyKey !== null}
              onClick={() => void selectAccount(account.key)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium disabled:opacity-60 ${
                activeKey === account.key ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {busyKey === account.key ? "Opening..." : account.label}
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            disabled={busyKey !== null}
            onClick={() => void endDemo()}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            End demo
          </button>
        </div>
      )}
    </div>
  );
}
