import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";
import { demoAccounts, DemoAccountKey, switchDemoAccount } from "../utils/demoAccounts";
import { useAuth } from "../utils/AuthContext";

const storageKey = "gavel:demoSwitcherPosition:v2";
const buttonSize = { width: 92, height: 52 };

function readPosition() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed as { x: number; y: number };
  } catch {
    // ignore
  }
  return null;
}

export function DemoAccountSwitcher() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<DemoAccountKey | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [demoActive, setDemoActive] = useState(() => window.localStorage.getItem("gavel:demoActive") === "1");
  const [launchOverlayVisible, setLaunchOverlayVisible] = useState(() => window.localStorage.getItem("gavel:demoLaunchOverlay") === "1");
  const [launchOverlayFading, setLaunchOverlayFading] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(() => window.localStorage.getItem("gavel:demoLaunchLoading") === "1");
  const [launchProgress, setLaunchProgress] = useState(() => Number(window.localStorage.getItem("gavel:demoLaunchProgress") ?? (window.localStorage.getItem("gavel:demoLaunchLoading") === "1" ? 5 : 100)));
  const [launchProgressTarget, setLaunchProgressTarget] = useState(() => Number(window.localStorage.getItem("gavel:demoLaunchProgress") ?? (window.localStorage.getItem("gavel:demoLaunchLoading") === "1" ? 5 : 100)));
  const [burst, setBurst] = useState(false);
  const [justAppeared, setJustAppeared] = useState(false);
  const [dragHintMounted, setDragHintMounted] = useState(false);
  const [dragHintVisible, setDragHintVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const dragHintTimerRef = useRef<number | null>(null);
  const launchCompletionTimerRef = useRef<number | null>(null);
  const overlayFadeTimerRef = useRef<number | null>(null);

  const centerButton = () => {
    const centered = {
      x: Math.max(8, Math.round(window.innerWidth / 2 - buttonSize.width / 2)),
      y: Math.max(8, Math.round(window.innerHeight / 2 - buttonSize.height / 2)),
    };
    positionRef.current = centered;
    setPosition(centered);
    window.localStorage.setItem(storageKey, JSON.stringify(centered));
  };

  const hideDragHint = () => {
    if (dragHintTimerRef.current) window.clearTimeout(dragHintTimerRef.current);
    dragHintTimerRef.current = null;
    setDragHintVisible(false);
    window.setTimeout(() => setDragHintMounted(false), 300);
  };

  const fadeLaunchOverlay = () => {
    if (overlayFadeTimerRef.current) window.clearTimeout(overlayFadeTimerRef.current);
    setLaunchOverlayFading(true);
    window.localStorage.removeItem("gavel:demoLaunchOverlay");
    overlayFadeTimerRef.current = window.setTimeout(() => {
      setLaunchOverlayVisible(false);
      setLaunchOverlayFading(false);
      overlayFadeTimerRef.current = null;
    }, 220);
  };

  const playLaunchEffectsIfNeeded = () => {
    if (window.localStorage.getItem("gavel:demoConfetti") !== "1") return;
    window.localStorage.removeItem("gavel:demoConfetti");
    if (window.localStorage.getItem("gavel:demoCenter") === "1") {
      window.localStorage.removeItem("gavel:demoCenter");
      centerButton();
    }
    setBurst(true);
    setJustAppeared(true);
    setDragHintMounted(true);
    window.requestAnimationFrame(() => setDragHintVisible(true));
    window.setTimeout(() => setBurst(false), 1000);
    window.setTimeout(() => setJustAppeared(false), 450);
  };

  useEffect(() => {
    const saved = readPosition();
    if (window.localStorage.getItem("gavel:demoCenter") === "1" || window.localStorage.getItem("gavel:demoLaunchOverlay") === "1") {
      centerButton();
      return;
    }
    const initial = saved ?? { x: Math.max(16, window.innerWidth - 96), y: Math.max(16, window.innerHeight - 76) };
    positionRef.current = initial;
    setPosition(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const startLaunch = () => {
      if (launchCompletionTimerRef.current) window.clearTimeout(launchCompletionTimerRef.current);
      if (overlayFadeTimerRef.current) window.clearTimeout(overlayFadeTimerRef.current);
      setDemoActive(true);
      setOpen(false);
      setBurst(false);
      setJustAppeared(false);
      setDragHintMounted(false);
      setDragHintVisible(false);
      setLaunchOverlayVisible(true);
      setLaunchOverlayFading(false);
      setLaunchLoading(true);
      setLaunchProgress(5);
      setLaunchProgressTarget(5);
      centerButton();
    };
    const cancelLaunch = () => {
      if (launchCompletionTimerRef.current) window.clearTimeout(launchCompletionTimerRef.current);
      if (overlayFadeTimerRef.current) window.clearTimeout(overlayFadeTimerRef.current);
      setDemoActive(false);
      setOpen(false);
      setLaunchOverlayVisible(false);
      setLaunchOverlayFading(false);
      setLaunchLoading(false);
      setLaunchProgress(100);
      setLaunchProgressTarget(100);
      setBurst(false);
      setJustAppeared(false);
      setDragHintMounted(false);
      setDragHintVisible(false);
    };
    const completeLaunch = () => {
      if (window.localStorage.getItem("gavel:demoActive") !== "1") return;
      if (window.localStorage.getItem("gavel:demoLaunchLoading") !== "1" && window.localStorage.getItem("gavel:demoConfetti") !== "1") return;
      if (launchCompletionTimerRef.current) window.clearTimeout(launchCompletionTimerRef.current);
      setDemoActive(true);
      setOpen(false);
      setLaunchOverlayVisible(window.localStorage.getItem("gavel:demoLaunchOverlay") === "1");
      setLaunchOverlayFading(false);
      setLaunchProgressTarget(100);
      setLaunchProgress(100);
      launchCompletionTimerRef.current = window.setTimeout(() => {
        window.localStorage.removeItem("gavel:demoLaunchLoading");
        window.localStorage.removeItem("gavel:demoLaunchProgress");
        setLaunchLoading(false);
        launchCompletionTimerRef.current = window.setTimeout(() => {
          playLaunchEffectsIfNeeded();
        }, 40);
      }, 520);
    };
    const onLaunchProgress = (event: Event) => {
      const next = Number((event as CustomEvent<{ progress?: number }>).detail?.progress ?? 0);
      if (!Number.isFinite(next)) return;
      setLaunchProgressTarget((current) => Math.max(current, Math.min(96, next)));
    };
    const onDemoOpened = () => {
      setDemoActive(true);
      if (window.localStorage.getItem("gavel:demoLaunchLoading") !== "1") playLaunchEffectsIfNeeded();
    };
    const onDemoEnded = () => {
      setDemoActive(false);
      setOpen(false);
      setLaunchOverlayVisible(false);
      setLaunchOverlayFading(false);
      setLaunchLoading(false);
      setLaunchProgress(100);
      setLaunchProgressTarget(100);
      window.localStorage.removeItem("gavel:demoLaunchOverlay");
      window.localStorage.removeItem("gavel:demoLaunchLoading");
      window.localStorage.removeItem("gavel:demoLaunchProgress");
    };
    window.addEventListener("gavel:demo-launch-start", startLaunch);
    window.addEventListener("gavel:demo-launch-cancel", cancelLaunch);
    window.addEventListener("gavel:demo-launch-progress", onLaunchProgress);
    window.addEventListener("gavel:demo-opened", onDemoOpened);
    window.addEventListener("gavel:demo-ended", onDemoEnded);
    window.addEventListener("gavel:dashboard-ready", completeLaunch);
    const openedAt = Number(window.localStorage.getItem("gavel:demoOpenedAt") ?? 0);
    if (Date.now() - openedAt < 2000) onDemoOpened();
    return () => {
      window.removeEventListener("gavel:demo-launch-start", startLaunch);
      window.removeEventListener("gavel:demo-launch-cancel", cancelLaunch);
      window.removeEventListener("gavel:demo-launch-progress", onLaunchProgress);
      window.removeEventListener("gavel:demo-opened", onDemoOpened);
      window.removeEventListener("gavel:demo-ended", onDemoEnded);
      window.removeEventListener("gavel:dashboard-ready", completeLaunch);
      if (launchCompletionTimerRef.current) window.clearTimeout(launchCompletionTimerRef.current);
      if (overlayFadeTimerRef.current) window.clearTimeout(overlayFadeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!demoActive) return;
    if (launchLoading) return;
    playLaunchEffectsIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive, user?.id, launchLoading]);

  useEffect(() => {
    if (!launchLoading) return;
    const timer = window.setInterval(() => {
      setLaunchProgress((value) => {
        if (value >= launchProgressTarget) return value;
        const distance = launchProgressTarget - value;
        return Math.min(launchProgressTarget, value + Math.max(0.35, distance * 0.12));
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [launchLoading, launchProgressTarget]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = {
        x: Math.min(window.innerWidth - 96, Math.max(8, drag.baseX + event.clientX - drag.startX)),
        y: Math.min(window.innerHeight - 64, Math.max(8, drag.baseY + event.clientY - drag.startY)),
      };
      const moved = Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4;
      drag.moved = drag.moved || moved;
      if (moved) {
        hideDragHint();
        if (launchOverlayVisible && !launchLoading) {
          fadeLaunchOverlay();
        }
      }
      positionRef.current = next;
      setPosition(next);
    };
    const onUp = () => {
      const current = positionRef.current;
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
  }, [launchLoading, launchOverlayVisible]);

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
  if (!demoActive || (!user && !launchOverlayVisible && !launchLoading)) return null;
  const menuVerticalClass = position.y > window.innerHeight - 300 ? "bottom-full mb-2" : "top-full mt-2";
  const menuHorizontalClass = position.x > window.innerWidth - 240 ? "right-0" : "left-0";
  const activeKey = (user?.email?.split("@")[0] ?? "") as DemoAccountKey;

  return (
    <>
    {launchOverlayVisible && <div className={`fixed inset-0 z-[60] bg-gray-50 transition-opacity duration-200 ${launchOverlayFading ? "opacity-0" : "opacity-100"}`} aria-hidden="true" />}
    <div
      ref={rootRef}
      className={`fixed select-none touch-none ${launchOverlayVisible ? "z-[70]" : "z-50"}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        if (launchLoading) return;
        dragRef.current = { startX: event.clientX, startY: event.clientY, baseX: position.x, baseY: position.y, moved: false };
      }}
    >
      <div className={`relative rounded-full border border-blue-700 bg-blue-600 p-1 text-white shadow-lg transition-transform duration-300 ${justAppeared ? "scale-110" : "scale-100"}`}>
        {launchLoading && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[calc(100%+18px)] w-[calc(100%+34px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-white/80 bg-white/80 shadow-lg" aria-hidden="true">
            <div className="h-full rounded-full bg-blue-500/25 transition-[width] duration-200 ease-out" style={{ width: `${launchProgress}%` }} />
          </div>
        )}
        <div className="relative rounded-full bg-blue-600">
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
          disabled={launchLoading}
          onClick={() => {
            if (dragRef.current?.moved) return;
            if (launchLoading) return;
            setOpen((value) => !value);
          }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-default disabled:hover:bg-blue-600"
        >
          <User className="h-4 w-4" />
          Demo
        </button>
        </div>
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
    </>
  );
}
