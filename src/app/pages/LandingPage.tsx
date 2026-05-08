import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Gavel,
  GraduationCap,
  Mail,
  Megaphone,
  MousePointer2,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { switchDemoAccount } from "../utils/demoAccounts";

type PublicNavProps = {
  active?: "home" | "contact";
};

function startDemo() {
  switchDemoAccount("teacher1", { confetti: true }).catch((error) => {
    const message = error instanceof Error ? error.message : "Unable to open the demo.";
    toast.error(message);
  });
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.18 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function PublicNav({ active = "home" }: PublicNavProps) {
  const navLinkClass = (key: "home" | "contact") =>
    `px-2 py-2 text-sm font-semibold transition ${
      active === key ? "text-slate-950" : "text-slate-600 hover:text-slate-950"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-[#fbfaf8]/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white shadow-sm">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-950">Gavel</span>
        </Link>

        <nav className="order-3 col-span-2 flex w-full items-center justify-center gap-5 border-t border-neutral-200 pt-3 md:order-none md:col-span-1 md:w-auto md:border-t-0 md:pt-0">
          <Link to="/" className={navLinkClass("home")}>
            Home
          </Link>
          <Link to="/about" className={navLinkClass("contact")}>
            Contact
          </Link>
          <button
            type="button"
            onClick={startDemo}
            className="px-2 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            Open Demo
          </button>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <Link
            to="/signin"
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-neutral-100 hover:text-slate-950"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroScene() {
  return (
    <div className="pointer-events-none relative mx-auto mt-12 hidden w-full max-w-5xl overflow-hidden rounded-[1.25rem] border border-neutral-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:block">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Teacher view</div>
          <div className="mt-1 text-lg font-black text-slate-950">Dashboard</div>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-md bg-neutral-100 px-3 py-1.5">Roster</span>
          <span className="rounded-md bg-slate-950 px-3 py-1.5 text-white">Settings</span>
          <span className="rounded-md bg-neutral-100 px-3 py-1.5">Records</span>
        </div>
      </div>

      <div className="grid gap-4 pt-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">All Bills</div>
              <div className="text-xs text-slate-500">Search, refer, calendar, and grade from one place.</div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500">
              <Search className="h-3.5 w-3.5" />
              water quality
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ["H.R. 12", "Clean Water Resilience Act", "Energy and Commerce", "ready for referral"],
              ["H.R. 18", "Civic Media Act", "Education and Workforce", "committee revision"],
              ["H.R. 21", "Veterans Mental Health Act", "Veterans' Affairs", "calendared"],
            ].map(([number, title, committee, status], index) => (
              <div
                key={number}
                className={`gavel-bill-row rounded-xl border p-3 ${
                  index === 0 ? "gavel-hero-bill-row border-neutral-300 bg-neutral-100" : "border-slate-200 bg-slate-50"
                }`}
                style={{ animationDelay: `${index * 240}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      {number} - {title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Assigned to {committee}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {index === 0 ? (
                      <span className="gavel-hero-refer-button relative whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                        Refer
                        <span className="gavel-button-click-one pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900" />
                      </span>
                    ) : null}
                    <span className="whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
                      {status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="gavel-hero-vote-card rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black">Floor vote</div>
                <div className="text-xs text-slate-300">Live count for screen share</div>
              </div>
              <Vote className="h-5 w-5 text-neutral-300" />
            </div>
            <div className="mt-5 grid h-28 grid-cols-3 items-end gap-3">
              <div className="gavel-vote-bar h-[72%] rounded-t-xl bg-emerald-400" />
              <div className="gavel-vote-bar h-[38%] rounded-t-xl bg-rose-400" style={{ animationDelay: "500ms" }} />
              <div className="gavel-vote-bar h-[20%] rounded-t-xl bg-slate-500" style={{ animationDelay: "900ms" }} />
            </div>
            <div className="mt-2 grid grid-cols-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-300">
              <span>Yea</span>
              <span>Nay</span>
              <span>Present</span>
            </div>
            <button className="gavel-hero-live-button relative mt-4 w-full rounded-full bg-white px-3 py-2 text-xs font-black text-slate-950">
              Show live count
              <span className="gavel-button-click-two pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900" />
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <GraduationCap className="h-4 w-4 text-amber-700" />
              Grading queue
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Committee report rubric</span>
                <span className="font-bold text-emerald-700">auto-graded</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                <span>Synergy SIS sync</span>
                <span className="font-bold text-slate-700">ready</span>
              </div>
            </div>
            <button className="gavel-hero-sync-button relative mt-3 w-full rounded-full bg-amber-600 px-3 py-2 text-xs font-black text-white">
              Sync grades
              <span className="gavel-button-click-three pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="gavel-route-fill absolute left-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-950" />
        <div className="relative grid grid-cols-5 gap-3 text-center text-[11px] font-bold text-slate-700">
          {["Drafted", "Committee", "Reported", "Floor", "Records"].map((stage, index) => (
            <span
              key={stage}
              className={`rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm ${
                index === 1 ? "gavel-hero-stage-committee" : index === 3 ? "gavel-hero-stage-floor" : ""
              }`}
            >
              {stage}
            </span>
          ))}
        </div>
        <div className="gavel-hero-stage-popup pointer-events-none absolute left-[19%] top-[-2.35rem] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-800 shadow-lg">
          Referred to committee
        </div>
      </div>

      <MousePointer2 className="gavel-action-cursor absolute left-0 top-0 h-5 w-5 fill-slate-950 text-slate-950 drop-shadow-lg" />
    </div>
  );
}

function SiteMotionStyles() {
  return (
    <style>{`
      @keyframes gavelCursorPath {
        0%, 8% { transform: translate(0, 0); opacity: 0; }
        12%, 28% { transform: translate(362px, 185px); opacity: 1; }
        40%, 56% { transform: translate(520px, 298px); opacity: 1; }
        68%, 84% { transform: translate(520px, 478px); opacity: 1; }
        94%, 100% { transform: translate(610px, 255px); opacity: 0; }
      }

      @keyframes gavelClickOne {
        0%, 11%, 19%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
        13%, 17% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
      }

      @keyframes gavelClickTwo {
        0%, 42%, 50%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
        44%, 48% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
      }

      @keyframes gavelClickThree {
        0%, 70%, 78%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
        72%, 76% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
      }

      @keyframes gavelRouteFill {
        0%, 18% { width: 12%; }
        40% { width: 35%; }
        62% { width: 60%; }
        84%, 100% { width: calc(100% - 2rem); }
      }

      @keyframes gavelHeroReferButton {
        0%, 100% { transform: translateY(0) scale(1); background: #2563eb; }
        13%, 20% { transform: translateY(-1px) scale(1.08); background: #0f172a; }
      }

      @keyframes gavelHeroBillRow {
        0%, 100% { transform: translateX(0); border-color: #bfdbfe; background: rgba(239, 246, 255, 0.7); }
        18%, 32% { transform: translateX(8px); border-color: #0f172a; background: #f5f5f4; }
      }

      @keyframes gavelHeroStage {
        0%, 16%, 36%, 100% { transform: translateY(0) scale(1); background: #ffffff; color: #334155; border-color: #e2e8f0; }
        20%, 32% { transform: translateY(-2px) scale(1.05); background: #0f172a; color: #ffffff; border-color: #0f172a; }
      }

      @keyframes gavelHeroFloorStage {
        0%, 38%, 60%, 100% { transform: translateY(0) scale(1); background: #ffffff; color: #334155; border-color: #e2e8f0; }
        43%, 56% { transform: translateY(-2px) scale(1.05); background: #0f172a; color: #ffffff; border-color: #0f172a; }
      }

      @keyframes gavelHeroStagePopup {
        0%, 17%, 36%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        21%, 32% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelHeroVoteCard {
        0%, 38%, 60%, 100% { transform: scale(1); box-shadow: none; }
        43%, 56% { transform: scale(1.025); box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18); }
      }

      @keyframes gavelHeroLiveButton {
        0%, 38%, 60%, 100% { transform: translateY(0); background: #ffffff; color: #0f172a; }
        43%, 56% { transform: translateY(-1px) scale(1.04); background: #f5f5f4; color: #0f172a; }
      }

      @keyframes gavelHeroSyncButton {
        0%, 64%, 88%, 100% { transform: translateY(0); background: #d97706; }
        70%, 83% { transform: translateY(-1px) scale(1.04); background: #15803d; }
      }

      @keyframes gavelVoteBar {
        0%, 100% { transform: scaleY(0.72); transform-origin: bottom; }
        48% { transform: scaleY(1); transform-origin: bottom; }
      }

      @keyframes gavelBillAttention {
        0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        45%, 58% { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
      }

      @keyframes gavelProgress {
        0% { width: 16%; }
        45% { width: 64%; }
        100% { width: 100%; }
      }

      @keyframes gavelStepFocus {
        0%, 100% { background: #f8fafc; border-color: #e2e8f0; }
        45%, 65% { background: #dbeafe; border-color: #60a5fa; }
      }

      @keyframes gavelTabCycle {
        0%, 100% { background: #ffffff; color: #334155; }
        50% { background: #0f172a; color: #ffffff; }
      }

      @keyframes gavelCursorTap {
        0%, 8% { transform: translate(0, 0); opacity: 0; }
        18%, 42% { transform: translate(92px, 118px); opacity: 1; }
        58%, 80% { transform: translate(285px, 36px); opacity: 1; }
        92%, 100% { transform: translate(330px, 154px); opacity: 0; }
      }

      @keyframes gavelBillTokenMove {
        0%, 9% { left: 5%; }
        20%, 27% { left: 27%; }
        39%, 46% { left: 50%; }
        58%, 66% { left: 72%; }
        81%, 100% { left: 94%; }
      }

      @keyframes gavelBillTimelineFill {
        0%, 9% { width: 5%; }
        24% { width: 27%; }
        43% { width: 50%; }
        63% { width: 72%; }
        86%, 100% { width: 94%; }
      }

      @keyframes gavelBillPopupDraft {
        0%, 12%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        2%, 9% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelBillPopupCosponsor {
        0%, 19%, 31%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        22%, 28% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelBillPopupCommittee {
        0%, 38%, 50%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        41%, 47% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelBillPopupFloor {
        0%, 57%, 70%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        60%, 67% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelBillPopupRecord {
        0%, 80%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        84%, 96% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelOrgProgress {
        from { width: 0%; }
        to { width: 100%; }
      }

      .gavel-small-cursor {
        clip-path: polygon(0 0, 0 100%, 28% 76%, 48% 100%, 63% 91%, 43% 68%, 76% 68%);
      }

      .gavel-action-cursor { animation: gavelCursorPath 9s ease-in-out infinite; }
      .gavel-button-click-one { animation: gavelClickOne 9s ease-out infinite; }
      .gavel-button-click-two { animation: gavelClickTwo 9s ease-out infinite; }
      .gavel-button-click-three { animation: gavelClickThree 9s ease-out infinite; }
      .gavel-route-fill { animation: gavelRouteFill 9s ease-in-out infinite; }
      .gavel-vote-bar { animation: gavelVoteBar 4s ease-in-out infinite; }
      .gavel-bill-row:first-child { animation: gavelBillAttention 9s ease-in-out infinite; }
      .gavel-hero-bill-row { animation: gavelHeroBillRow 9s ease-in-out infinite; }
      .gavel-hero-refer-button { animation: gavelHeroReferButton 9s ease-in-out infinite; }
      .gavel-hero-stage-committee { animation: gavelHeroStage 9s ease-in-out infinite; }
      .gavel-hero-stage-floor { animation: gavelHeroFloorStage 9s ease-in-out infinite; }
      .gavel-hero-stage-popup { animation: gavelHeroStagePopup 9s ease-in-out infinite; }
      .gavel-hero-vote-card { animation: gavelHeroVoteCard 9s ease-in-out infinite; }
      .gavel-hero-live-button { animation: gavelHeroLiveButton 9s ease-in-out infinite; }
      .gavel-hero-sync-button { animation: gavelHeroSyncButton 9s ease-in-out infinite; }
      .gavel-progress-fill { animation: gavelProgress 5s ease-in-out infinite alternate; }
      .gavel-step-focus { animation: gavelStepFocus 6s ease-in-out infinite; }
      .gavel-tab-cycle { animation: gavelTabCycle 7s ease-in-out infinite; }
      .gavel-small-cursor { animation: gavelCursorTap 7s ease-in-out infinite; }
      .gavel-bill-token { animation: gavelBillTokenMove 12s ease-in-out infinite; }
      .gavel-bill-timeline-fill { animation: gavelBillTimelineFill 12s ease-in-out infinite; }
      .gavel-bill-popup-draft { animation: gavelBillPopupDraft 12s ease-in-out infinite; }
      .gavel-bill-popup-cosponsor { animation: gavelBillPopupCosponsor 12s ease-in-out infinite; }
      .gavel-bill-popup-committee { animation: gavelBillPopupCommittee 12s ease-in-out infinite; }
      .gavel-bill-popup-floor { animation: gavelBillPopupFloor 12s ease-in-out infinite; }
      .gavel-bill-popup-record { animation: gavelBillPopupRecord 12s ease-in-out infinite; }
      .gavel-org-progress { animation-name: gavelOrgProgress; animation-timing-function: linear; animation-fill-mode: forwards; }

      @media (prefers-reduced-motion: reduce) {
        .gavel-action-cursor,
        .gavel-small-cursor,
        .gavel-click-pulse,
        .gavel-button-click-one,
        .gavel-button-click-two,
        .gavel-button-click-three,
        .gavel-route-fill,
        .gavel-vote-bar,
        .gavel-bill-row,
        .gavel-hero-bill-row,
        .gavel-hero-refer-button,
        .gavel-hero-stage-committee,
        .gavel-hero-stage-floor,
        .gavel-hero-stage-popup,
        .gavel-hero-vote-card,
        .gavel-hero-live-button,
        .gavel-hero-sync-button,
        .gavel-progress-fill,
        .gavel-step-focus,
        .gavel-tab-cycle,
        .gavel-bill-token,
        .gavel-bill-timeline-fill,
        .gavel-bill-popup-draft,
        .gavel-bill-popup-cosponsor,
        .gavel-bill-popup-committee,
        .gavel-bill-popup-floor,
        .gavel-bill-popup-record,
        .gavel-org-progress {
          animation: none !important;
        }
      }
    `}</style>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

type TeacherTool = {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
};

const teacherTools: TeacherTool[] = [
  {
    icon: ClipboardCheck,
    title: "Assignments",
    description: "Create bill, letter, report, speech, and participation assignments.",
    detail: "deadlines",
  },
  {
    icon: CheckCircle2,
    title: "Rubrics",
    description: "Attach criteria to each assignment and keep review evidence in one place.",
    detail: "criteria",
  },
  {
    icon: GraduationCap,
    title: "Auto-grading",
    description: "Use teacher-created criteria to score drafts, reports, speeches, and profiles.",
    detail: "scoring",
  },
  {
    icon: Users,
    title: "Roster exports",
    description: "Track custom columns, hide fields, reorder data, and export clean spreadsheets.",
    detail: "roster",
  },
  {
    icon: Vote,
    title: "Records",
    description: "Save votes, committee reports, newsletters, contributions, and teacher-added records.",
    detail: "archive",
  },
  {
    icon: Download,
    title: "Exports and SIS sync",
    description: "Export grades and participation, then sync selected scores to Synergy SIS.",
    detail: "grades",
  },
];

function TeacherToolsShowcase() {
  return (
    <section id="grading" className="border-y border-neutral-200 bg-white py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Built for grading</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Assignments, rubrics, records, roster data, exports, and SIS sync stay connected to classroom work.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-[1rem] border border-neutral-200 bg-[#fbfaf8] p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
            <div className="absolute bottom-6 left-[2.35rem] top-6 w-px bg-neutral-200" />
            <ol className="relative space-y-1">
              {teacherTools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <li
                    key={tool.title}
                    className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <div className="relative z-10 grid h-10 w-10 place-items-center rounded-md border border-neutral-200 bg-white text-slate-900 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">{tool.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{tool.description}</p>
                    </div>
                    <span
                      className={`hidden rounded-full px-3 py-1.5 text-xs font-black sm:inline-flex ${
                        index === 1 || index === 5 ? "bg-slate-950 text-white" : "bg-neutral-100 text-slate-600"
                      }`}
                    >
                      {tool.detail}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TeacherConsoleVisual() {
  return (
    <div className="relative rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Teacher console</div>
          <div className="mt-1 text-lg font-black text-slate-950">Assignments, grading, exports</div>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Rubrics ready" value="14" />
        <MetricCard label="Bills to review" value="8" />
        <MetricCard label="Grades synced" value="92%" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            Rubric criteria
          </div>
          <div className="mt-3 space-y-2">
            {["Bill text cites constitutional authority", "Committee report includes evidence", "Floor speech responds to opposition"].map(
              (criterion, index) => (
                <div
                  key={criterion}
                  className={`gavel-step-focus flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                    index === 1 ? "" : "border-slate-200 bg-white"
                  }`}
                  style={{ animationDelay: `${index * 300}ms` }}
                >
                  <span className="text-slate-700">{criterion}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <GraduationCap className="h-4 w-4 text-blue-700" />
            Synergy SIS
          </div>
          <div className="mt-3 text-sm text-slate-600">Auto-grade against teacher criteria, then sync scores when ready.</div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
            <div className="gavel-progress-fill h-full rounded-full bg-blue-600" />
          </div>
          <div className="mt-4 rounded-xl bg-white p-3 text-xs font-semibold text-slate-600">
            Last export: period 3, participation and bill draft rubrics
          </div>
        </div>
      </div>

      <div className="gavel-small-cursor absolute left-6 top-6 h-7 w-6 bg-slate-950 shadow-lg" />
    </div>
  );
}

const billTimelineStages = [
  {
    label: "Draft",
    title: "Bill drafted",
    body: "Drafts can be written in the composer or uploaded as PDFs, depending on teacher settings.",
    meta: "H.R. 31 - Local Food Security Act",
  },
  {
    label: "Cosponsor",
    title: "Support tracked",
    body: "Cosponsors attach to the bill automatically, so support is visible before referral.",
    meta: "5 cosponsors",
  },
  {
    label: "Committee",
    title: "Committee work opens",
    body: "The bill can be referred to one or more committees, revised live, and reported back.",
    meta: "Energy and Commerce",
  },
  {
    label: "Floor",
    title: "Floor debate begins",
    body: "Teachers manage the calendar, speakers, live screen-share controls, and vote timing.",
    meta: "For and against speakers",
  },
  {
    label: "Record",
    title: "Record generated",
    body: "Votes, reports, newsletters, and final status stay searchable for grading.",
    meta: "Archived with vote counts",
  },
];

function BillTimelineSection() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveStage((stage) => (stage + 1) % billTimelineStages.length);
    }, 3200);

    return () => window.clearInterval(id);
  }, []);

  const active = billTimelineStages[activeStage];
  const progress = `${4 + (activeStage / (billTimelineStages.length - 1)) * 92}%`;

  return (
    <section id="bill-timeline" className="bg-[#fbfaf8] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Complete bill tracking</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Follow a bill from draft to record without rebuilding the timeline by hand.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-14">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="font-mono text-sm font-black text-slate-700">H.R. 31</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Local Food Security Act</div>
                <div className="mt-1 text-sm text-slate-500">Sponsored by Rep. Elena Park</div>
              </div>
              <div className="hidden rounded-md bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-neutral-200 sm:block">
                Teacher-visible status
              </div>
            </div>

            <div className="relative mt-12 pb-32 pt-10">
              <div className="absolute left-0 right-0 top-[4.3rem] h-1 rounded-full bg-slate-200" />
              <div
                className="absolute left-0 top-[4.3rem] h-1 rounded-full bg-slate-950 transition-all duration-700 ease-out"
                style={{ width: progress }}
              />
              <div
                className="absolute top-[3.45rem] z-20 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-lg transition-all duration-700 ease-out"
                style={{ left: progress }}
              >
                H.R. 31
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {billTimelineStages.map((stage, index) => (
                  <button
                    key={stage.label}
                    type="button"
                    onClick={() => setActiveStage(index)}
                    className={`group flex min-h-24 flex-col items-center justify-start rounded-2xl border bg-white px-3 py-4 text-center shadow-sm transition ${
                      activeStage === index
                        ? "border-slate-950 text-slate-950 shadow-neutral-200"
                        : "border-neutral-200 text-slate-600 hover:border-slate-400 hover:text-slate-950"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${
                        activeStage === index ? "bg-slate-950 text-white" : "bg-neutral-100 text-slate-500 group-hover:bg-neutral-200"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 text-sm font-black">{stage.label}</span>
                  </button>
                ))}
              </div>

              <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-2xl rounded-[1rem] border border-neutral-200 bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{active.meta}</div>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{active.title}</h3>
                <p className="mt-2 text-base leading-7 text-slate-600">{active.body}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const organizationItems = [
  {
    label: "Parties",
    title: "Parties organize coalitions.",
    body: "Teachers can enable party membership, leadership, elections, platforms, and announcement boards.",
    icon: Users,
    details: [
      "Membership pages show leaders, members, announcements, and elections in one place.",
      "Party tools support coalition management without separate group chats or spreadsheets.",
      "Teachers choose whether parties are central to the simulation or only lightly used.",
    ],
  },
  {
    label: "Committees",
    title: "Committees handle the substantive work.",
    body: "Committee pages include membership, roles, reports, vote tools, and live collaborative editing when meetings are open.",
    icon: Gavel,
    details: [
      "Committee meetings can open live collaborative editing for revised bill text.",
      "Reports, votes, chairs, ranking members, and subcommittee work stay attached to the committee.",
      "Teachers can keep committee work realistic or simplify it for shorter simulations.",
    ],
  },
  {
    label: "Caucuses",
    title: "Caucuses create issue-based pressure.",
    body: "Teachers can allow issue-based coalitions while controlling creation and join rules.",
    icon: Megaphone,
    details: [
      "Caucuses give students a place to organize around issues rather than parties.",
      "Membership, leadership, boards, and elections are tracked like other organizations.",
      "Teacher controls decide who can create, join, and manage caucus activity.",
    ],
  },
  {
    label: "Media groups",
    title: "Media groups add narrative pressure.",
    body: "Media organizations can publish messages and shape the public side of the simulation.",
    icon: Mail,
    details: [
      "Media groups can create coverage, announcements, and public-facing pressure.",
      "The teacher can use media groups lightly or make them a major simulation role.",
      "Messages stay inside the same system as bills, organizations, and records.",
    ],
  },
  {
    label: "Lobbyists",
    title: "Lobbyists add optional money and access.",
    body: "When enabled, lobbyist groups can track spending, contributions, and paid committee access.",
    icon: BadgeDollarSign,
    details: [
      "Lobbyist groups can receive starting funds and track contributions.",
      "Spending and access decisions can be recorded for later grading and discussion.",
      "The money layer is optional, so it can be removed for simpler courses.",
    ],
  },
  {
    label: "Message boards",
    title: "Boards keep announcements in context.",
    body: "Organization announcements and comments stay attached to the relevant group instead of scattered elsewhere.",
    icon: Megaphone,
    details: [
      "Each organization can have its own announcements and comments.",
      "Teachers can disable boards for in-person discussion or enable them for online participation.",
      "Board activity remains connected to the organization where it happened.",
    ],
  },
  {
    label: "Dear colleague letters",
    title: "Letters keep persuasion inside the site.",
    body: "Built-in inboxes support cosponsor requests, strategy messages, and member contact.",
    icon: Mail,
    details: [
      "Letters replace scattered email, chats, and shared documents.",
      "Teachers can review communication as part of participation or strategy work.",
      "The inbox supports direct political communication without leaving Gavel.",
    ],
  },
];

function OrganizationExplorerSection() {
  const [activeItem, setActiveItem] = useState(0);
  const cycleMs = 5200;

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveItem((item) => (item + 1) % organizationItems.length);
    }, cycleMs);

    return () => window.clearInterval(id);
  }, []);

  const active = organizationItems[activeItem];
  const Icon = active.icon;

  return (
    <section id="organizations" className="bg-white py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:px-8">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Organizations and messaging</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Parties, committees, caucuses, media groups, lobbyists, message boards, live committee editing, and dear
            colleague letters all stay in the same classroom system.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="grid gap-5 lg:grid-cols-[0.74fr_1.26fr]">
            <div className="overflow-hidden rounded-[1rem] border border-neutral-200 bg-white shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
              {organizationItems.map((item, index) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveItem(index)}
                    className={`relative flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 ${
                      activeItem === index
                        ? "bg-neutral-100 text-slate-950"
                        : "bg-white text-slate-700 hover:bg-neutral-50 hover:text-slate-950"
                    }`}
                  >
                    <ItemIcon className="h-5 w-5 flex-none" />
                    <span className="text-sm font-black">{item.label}</span>
                    {activeItem === index ? (
                      <span
                        key={activeItem}
                        className="gavel-org-progress absolute bottom-0 left-0 h-1 bg-slate-950"
                        style={{ animationDuration: `${cycleMs}ms` }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="min-h-[31rem] rounded-[1rem] border border-neutral-200 bg-[#fbfaf8] p-7 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                  {Math.round(cycleMs / 1000)} sec
                </div>
              </div>
              <h3 className="mt-6 text-3xl font-black tracking-tight text-slate-950">{active.title}</h3>
              <p className="mt-4 text-lg leading-8 text-slate-600">{active.body}</p>
              <ul className="mt-8 space-y-4">
                {active.details.map((detail) => (
                  <li key={detail} className="flex gap-3 text-base leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-emerald-600" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SettingsVisual() {
  return (
    <div className="rounded-[1rem] border border-neutral-200 bg-white p-4 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
        <Settings2 className="h-4 w-4" />
        Simulation settings
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["Virtual features", "Enable all tools", "bg-slate-950 text-white"],
          ["Committees", "Enabled, with subcommittees", "bg-white text-slate-700"],
          ["Speaker lists", "Request approval required", "bg-white text-slate-700"],
          ["Lobbyist groups", "Money system enabled", "bg-white text-slate-700"],
        ].map(([label, value, tone], index) => (
          <div key={label} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[10rem_1fr]">
            <div className="text-sm font-black text-slate-950">{label}</div>
            <div
              className={`rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold ${tone}`}
              style={{ animationDelay: `${index * 250}ms` }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          Realistic when you need it, simplified when class time is tight
        </div>
      </div>
    </div>
  );
}

function FeatureText({
  eyebrow,
  title,
  children,
  points,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  points: string[];
}) {
  return (
    <div>
      <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      <div className="mt-4 text-lg leading-8 text-slate-600">{children}</div>
      <div className="mt-6 space-y-3">
        {points.map((point) => (
          <div key={point} className="flex items-start gap-3 text-slate-700">
            <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-emerald-600" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <SiteMotionStyles />
      <PublicNav active="home" />

      <main className="bg-[#fbfaf8]">
        <section className="relative isolate overflow-hidden bg-[#fbfaf8]">
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                  Mock Congress, from first bill to final grade.
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-xl leading-8 text-slate-700">
                  Centralize bills, cosponsors, committee edits, floor debate, organizations, letters, records, rubrics,
                  exports, and Synergy sync in one teacher-run workspace.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-6 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Create a free simulation
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={startDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-base font-black text-slate-950 shadow-sm transition hover:bg-neutral-50"
                  >
                    <MousePointer2 className="h-5 w-5" />
                    Open Demo
                  </button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={120}>
              <HeroScene />
            </Reveal>
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-white py-10">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-slate-500">Replace scattered class tools with one workspace for</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm font-semibold text-slate-700">
              {["Google Docs", "spreadsheets", "email", "LMS assignments", "grade exports", "class discussion"].map((tool) => (
                <span key={tool} className="rounded-md border border-neutral-200 bg-[#fbfaf8] px-3 py-2">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </section>

        <TeacherToolsShowcase />

        <BillTimelineSection />

        <OrganizationExplorerSection />

        <section id="customization" className="bg-[#fbfaf8] py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="lg:order-2">
              <SettingsVisual />
            </Reveal>
            <Reveal className="lg:order-1" delay={120}>
              <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Highly customizable</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Teachers can raise or lower complexity for middle school, high school, college, civics, government,
                history, or debate courses while choosing how closely the process mirrors Congress.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  [Settings2, "Feature levels and presets"],
                  [Users, "Age and course flexibility"],
                  [Megaphone, "Realistic or streamlined procedure"],
                  [BadgeDollarSign, "Optional money and lobbying"],
                ].map(([Icon, label]) => (
                  <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Icon className="h-5 w-5 text-slate-800" />
                    <span className="font-bold text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-neutral-200">
                <Gavel className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">
                Start a teacher-run Mock Congress simulation for free.
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Set up a class, choose the rules, and keep the work organized from draft to grade.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-6 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
                >
                  Sign up free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={startDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-base font-black text-slate-950 shadow-sm transition hover:bg-neutral-50"
                >
                  Open Demo
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-[#fbfaf8]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-2 font-black text-slate-950">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white">
                <Gavel className="h-4 w-4" />
              </span>
              Gavel
            </div>
            <p className="mt-4 max-w-sm leading-6 text-slate-600">
              Customizable Mock Congress software for teachers who need bills, organizations, records, and grading in one
              place.
            </p>
          </div>

          <div>
            <div className="font-black text-slate-950">Product</div>
            <div className="mt-4 grid gap-3 text-slate-600">
              <a href="#grading" className="hover:text-slate-950">
                Grading
              </a>
              <a href="#bill-timeline" className="hover:text-slate-950">
                Bill timeline
              </a>
              <a href="#organizations" className="hover:text-slate-950">
                Organizations
              </a>
              <a href="#customization" className="hover:text-slate-950">
                Customization
              </a>
            </div>
          </div>

          <div>
            <div className="font-black text-slate-950">Account</div>
            <div className="mt-4 grid gap-3 text-slate-600">
              <Link to="/signin" className="hover:text-slate-950">
                Log in
              </Link>
              <Link to="/signup" className="hover:text-slate-950">
                Sign up
              </Link>
              <button type="button" onClick={startDemo} className="text-left hover:text-slate-950">
                Open Demo
              </button>
            </div>
          </div>

          <div>
            <div className="font-black text-slate-950">Support</div>
            <div className="mt-4 grid gap-3 text-slate-600">
              <Link to="/about" className="hover:text-slate-950">
                Contact
              </Link>
              <span>Privacy policy</span>
              <span>Terms</span>
              <span>Accessibility</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <span>Gavel for Mock Congress simulations.</span>
            <span>Built for classroom use.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
