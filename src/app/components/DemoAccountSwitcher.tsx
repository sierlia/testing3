import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { demoAccounts, DemoAccountKey, switchDemoAccount } from "../utils/demoAccounts";

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

export function DemoAccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<DemoAccountKey | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const saved = readPosition();
    if (saved) setPosition(saved);
    else setPosition({ x: Math.max(16, window.innerWidth - 96), y: Math.max(16, window.innerHeight - 76) });
  }, []);

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
      await switchDemoAccount(key);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Could not switch demo account");
    } finally {
      setBusyKey(null);
    }
  };

  if (!position) return null;
  const menuVerticalClass = position.y < 220 ? "top-full mt-2" : "bottom-full mb-2";
  const menuHorizontalClass = position.x < 176 ? "left-0" : "right-0";

  return (
    <div
      ref={rootRef}
      className="fixed z-50 select-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        dragRef.current = { startX: event.clientX, startY: event.clientY, baseX: position.x, baseY: position.y, moved: false };
      }}
    >
      <div className="rounded-full border border-gray-200 bg-white shadow-lg">
        <button
          type="button"
          onClick={() => {
            if (dragRef.current?.moved) return;
            setOpen((value) => !value);
          }}
          className="rounded-full px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Demo
        </button>
      </div>
      {open && (
        <div className={`absolute ${menuVerticalClass} ${menuHorizontalClass} w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-xl`}>
          {demoAccounts.map((account) => (
            <button
              key={account.key}
              type="button"
              disabled={busyKey !== null}
              onClick={() => void selectAccount(account.key)}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"
            >
              {busyKey === account.key ? "Opening..." : account.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
