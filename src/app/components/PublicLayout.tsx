import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Gavel } from "lucide-react";
import { toast } from "sonner";

import { switchDemoAccount } from "../utils/demoAccounts";

export type PublicNavActive = "home" | "about" | "features" | "legal";

export function startDemo() {
  switchDemoAccount("teacher1", { confetti: true }).catch((error) => {
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
    return parsed.choice === "accepted" ? parsed.choice : "pending";
  } catch {
    return "pending";
  }
}

function writeCookieChoice(choice: "accepted") {
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
      className={`inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 ${className}`}
    >
      Open Demo
    </button>
  );
}

export function PublicNav({ active = "home" }: { active?: PublicNavActive }) {
  const linkClass = (key: PublicNavActive) =>
    `px-2 py-2 text-sm font-semibold transition ${
      active === key ? "text-slate-950" : "text-slate-600 hover:text-slate-950"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <Gavel className="h-6 w-6 text-blue-600" aria-hidden="true" />
          <span className="text-xl font-semibold text-slate-950">Gavel</span>
        </Link>

        <nav className="order-3 col-span-2 flex w-full items-center justify-center gap-5 border-t border-slate-200 pt-3 md:order-none md:col-span-1 md:w-auto md:border-t-0 md:pt-0">
          <Link to="/" className={linkClass("home")}>
            Home
          </Link>
          <Link to="/about" className={linkClass("about")}>
            About
          </Link>
          <Link to="/help" className={linkClass("features")}>
            Features
          </Link>
          <button type="button" onClick={startDemo} className="px-2 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
            Open Demo
          </button>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <Link
            to="/signin"
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Sign up
          </Link>
        </div>
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
            <Gavel className="h-6 w-6 text-blue-400" aria-hidden="true" />
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
            <button type="button" onClick={startDemo} className="w-fit text-left text-sm text-slate-200 hover:text-white">Open Demo</button>
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
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">Legal</h2>
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

  const choose = (nextChoice: "accepted") => {
    writeCookieChoice(nextChoice);
    setChoice(nextChoice);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-700">
          Gavel uses essential cookies and local storage for sign-in, demo access, preferences, and security. These are
          required for the app to work. Read the <Link to="/cookies" className="font-semibold text-blue-700 hover:text-blue-800">cookie policy</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublicPage({
  active,
  children,
  className = "bg-white",
}: {
  active?: PublicNavActive;
  children: ReactNode;
  className?: string;
}) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  return (
    <div className={`min-h-screen text-slate-950 ${className}`}>
      <PublicNav active={active} />
      {children}
      <PublicFooter />
      <CookieConsent />
    </div>
  );
}
