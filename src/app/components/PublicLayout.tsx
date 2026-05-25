import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { Gavel, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { switchDemoAccount } from "../utils/demoAccounts";

export type PublicNavActive = "home" | "about" | "features" | "legal";

export function startDemo() {
  switchDemoAccount("teacher1").catch((error) => {
    const message = error instanceof Error ? error.message : "Unable to open the demo.";
    toast.error(message);
  });
}

function readCookieChoice() {
  if (typeof window === "undefined") return "pending";
  try {
    const value = window.localStorage.getItem("gavel:cookie-consent");
    if (!value) return "pending";
    const parsed = JSON.parse(value) as { choice?: string };
    return parsed.choice === "accepted" || parsed.choice === "declined" ? parsed.choice : "pending";
  } catch {
    return "pending";
  }
}

function writeCookieChoice(choice: "accepted" | "declined") {
  try {
    window.localStorage.setItem(
      "gavel:cookie-consent",
      JSON.stringify({ choice, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // If storage is unavailable, hiding the banner for this session is still the least noisy fallback.
  }
}

export function OpenDemoButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={startDemo}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-black text-slate-950 shadow-[inset_0_-2px_0_rgba(217,119,6,0.22)] hover:bg-amber-200 ${className}`}
    >
      <Sparkles className="h-4 w-4 text-amber-700" aria-hidden="true" />
      Open Demo
    </button>
  );
}

export function PublicNav({ active = "home" }: { active?: PublicNavActive }) {
  const linkClass = (key: PublicNavActive) =>
    `rounded-md px-3 py-2 text-sm font-semibold ${
      active === key ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-white">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-black tracking-tight text-slate-950">Gavel</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-1">
          <Link to="/" className={linkClass("home")}>
            Home
          </Link>
          <Link to="/about" className={linkClass("about")}>
            About
          </Link>
          <Link to="/help" className={linkClass("features")}>
            Features
          </Link>
          <OpenDemoButton />
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.35fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-950">
              <Gavel className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black">Gavel</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
            A classroom workspace for legislative simulations, student organizations, communication, records, and grading.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">Site</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-200">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/about" className="hover:text-white">About</Link>
            <Link to="/help" className="hover:text-white">Features</Link>
            <button type="button" onClick={startDemo} className="w-fit text-left hover:text-white">Open demo</button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">Account</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-200">
            <Link to="/signin" className="hover:text-white">Sign in</Link>
            <Link to="/signup" className="hover:text-white">Create account</Link>
            <Link to="/about" className="hover:text-white">Contact</Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">Policies</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-200">
            <Link to="/privacy" className="hover:text-white">Privacy policy</Link>
            <Link to="/terms" className="hover:text-white">Terms of use</Link>
            <Link to="/cookies" className="hover:text-white">Cookie policy</Link>
            <Link to="/ferpa-coppa" className="hover:text-white">FERPA/COPPA compliance</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-400">
        Copyright 2026 Gavel. All rights reserved.
      </div>
    </footer>
  );
}

export function CookieConsent() {
  const [choice, setChoice] = useState(readCookieChoice);

  if (choice !== "pending") return null;

  const choose = (nextChoice: "accepted" | "declined") => {
    writeCookieChoice(nextChoice);
    setChoice(nextChoice);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-700">
          Gavel uses essential cookies and local storage for sign-in, demo access, preferences, and security. We do not
          use advertising cookies. Read the <Link to="/cookies" className="font-semibold text-blue-700 hover:text-blue-800">cookie policy</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublicPage({
  active,
  children,
  className = "bg-[#fbfaf7]",
}: {
  active?: PublicNavActive;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-screen text-slate-950 ${className}`}>
      <PublicNav active={active} />
      {children}
      <PublicFooter />
      <CookieConsent />
    </div>
  );
}
