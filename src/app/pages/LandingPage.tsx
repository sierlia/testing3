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
    `rounded-full px-3 py-2 text-sm font-semibold transition ${
      active === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-black tracking-tight text-slate-950">Gavel</span>
        </Link>

        <nav className="order-3 col-span-2 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-3 md:order-none md:col-span-1 md:w-auto md:border-t-0 md:pt-0">
          <Link to="/" className={navLinkClass("home")}>
            Home
          </Link>
          <Link to="/about" className={navLinkClass("contact")}>
            Contact
          </Link>
          <button
            type="button"
            onClick={startDemo}
            className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Open Demo
          </button>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <Link
            to="/signin"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent" />

      <div className="absolute right-[-7rem] top-24 hidden w-[42rem] max-w-[43vw] xl:block">
        <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-4 shadow-2xl shadow-slate-300/50">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Teacher view</div>
              <div className="mt-1 text-xl font-black text-slate-950">Capitol Hill Simulation</div>
            </div>
            <div className="flex gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Roster</span>
              <span className="rounded-full bg-blue-600 px-3 py-1.5 text-white">Settings</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Records</span>
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
                  ["H.R. 18", "Student Civic Media Act", "Education and Workforce", "committee revision"],
                  ["H.R. 21", "Veterans Mental Health Act", "Veterans' Affairs", "calendared"],
                ].map(([number, title, committee, status], index) => (
                  <div
                    key={number}
                    className={`gavel-bill-row rounded-xl border p-3 ${
                      index === 0 ? "gavel-hero-bill-row border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50"
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
                          <span className="gavel-hero-refer-button whitespace-nowrap rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                            Refer
                          </span>
                        ) : null}
                        <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
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
                  <Vote className="h-5 w-5 text-blue-300" />
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
                    <span className="font-bold text-blue-700">ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="gavel-route-fill absolute left-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500" />
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
            <div className="gavel-hero-stage-popup pointer-events-none absolute left-[19%] top-[-2.35rem] rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-blue-700 shadow-lg">
              Referred to committee
            </div>
          </div>
        </div>

        <MousePointer2 className="gavel-action-cursor absolute left-0 top-0 h-5 w-5 fill-slate-950 text-slate-950 drop-shadow-lg" />
        <span className="gavel-click-pulse gavel-click-one absolute h-7 w-7 rounded-full border-2 border-blue-500" />
        <span className="gavel-click-pulse gavel-click-two absolute h-7 w-7 rounded-full border-2 border-blue-500" />
        <span className="gavel-click-pulse gavel-click-three absolute h-7 w-7 rounded-full border-2 border-blue-500" />
      </div>
    </div>
  );
}

function SiteMotionStyles() {
  return (
    <style>{`
      @keyframes gavelCursorPath {
        0%, 8% { transform: translate(0, 0); opacity: 0; }
        12%, 28% { transform: translate(362px, 185px); opacity: 1; }
        40%, 56% { transform: translate(205px, 458px); opacity: 1; }
        68%, 84% { transform: translate(562px, 145px); opacity: 1; }
        94%, 100% { transform: translate(610px, 255px); opacity: 0; }
      }

      @keyframes gavelClickOne {
        0%, 11%, 19%, 100% { opacity: 0; transform: scale(0.55); }
        13%, 17% { opacity: 1; transform: scale(1.25); }
      }

      @keyframes gavelClickTwo {
        0%, 42%, 50%, 100% { opacity: 0; transform: scale(0.55); }
        44%, 48% { opacity: 1; transform: scale(1.25); }
      }

      @keyframes gavelClickThree {
        0%, 70%, 78%, 100% { opacity: 0; transform: scale(0.55); }
        72%, 76% { opacity: 1; transform: scale(1.25); }
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
        18%, 32% { transform: translateX(8px); border-color: #2563eb; background: #dbeafe; }
      }

      @keyframes gavelHeroStage {
        0%, 36%, 63%, 100% { transform: translateY(0) scale(1); background: #ffffff; color: #334155; border-color: #e2e8f0; }
        43%, 56% { transform: translateY(-2px) scale(1.05); background: #2563eb; color: #ffffff; border-color: #2563eb; }
      }

      @keyframes gavelHeroFloorStage {
        0%, 64%, 90%, 100% { transform: translateY(0) scale(1); background: #ffffff; color: #334155; border-color: #e2e8f0; }
        70%, 83% { transform: translateY(-2px) scale(1.05); background: #0f172a; color: #ffffff; border-color: #0f172a; }
      }

      @keyframes gavelHeroStagePopup {
        0%, 38%, 60%, 100% { opacity: 0; transform: translateY(8px) scale(0.96); }
        43%, 55% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes gavelHeroVoteCard {
        0%, 64%, 88%, 100% { transform: scale(1); box-shadow: none; }
        70%, 83% { transform: scale(1.025); box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18); }
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

      .gavel-small-cursor {
        clip-path: polygon(0 0, 0 100%, 28% 76%, 48% 100%, 63% 91%, 43% 68%, 76% 68%);
      }

      .gavel-action-cursor { animation: gavelCursorPath 9s ease-in-out infinite; }
      .gavel-click-one { left: 349px; top: 172px; animation: gavelClickOne 9s ease-out infinite; }
      .gavel-click-two { left: 192px; top: 445px; animation: gavelClickTwo 9s ease-out infinite; }
      .gavel-click-three { left: 549px; top: 132px; animation: gavelClickThree 9s ease-out infinite; }
      .gavel-route-fill { animation: gavelRouteFill 9s ease-in-out infinite; }
      .gavel-vote-bar { animation: gavelVoteBar 4s ease-in-out infinite; }
      .gavel-bill-row:first-child { animation: gavelBillAttention 9s ease-in-out infinite; }
      .gavel-hero-bill-row { animation: gavelHeroBillRow 9s ease-in-out infinite; }
      .gavel-hero-refer-button { animation: gavelHeroReferButton 9s ease-in-out infinite; }
      .gavel-hero-stage-committee { animation: gavelHeroStage 9s ease-in-out infinite; }
      .gavel-hero-stage-floor { animation: gavelHeroFloorStage 9s ease-in-out infinite; }
      .gavel-hero-stage-popup { animation: gavelHeroStagePopup 9s ease-in-out infinite; }
      .gavel-hero-vote-card { animation: gavelHeroVoteCard 9s ease-in-out infinite; }
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

      @media (prefers-reduced-motion: reduce) {
        .gavel-action-cursor,
        .gavel-small-cursor,
        .gavel-click-pulse,
        .gavel-route-fill,
        .gavel-vote-bar,
        .gavel-bill-row,
        .gavel-hero-bill-row,
        .gavel-hero-refer-button,
        .gavel-hero-stage-committee,
        .gavel-hero-stage-floor,
        .gavel-hero-stage-popup,
        .gavel-hero-vote-card,
        .gavel-progress-fill,
        .gavel-step-focus,
        .gavel-tab-cycle,
        .gavel-bill-token,
        .gavel-bill-timeline-fill,
        .gavel-bill-popup-draft,
        .gavel-bill-popup-cosponsor,
        .gavel-bill-popup-committee,
        .gavel-bill-popup-floor,
        .gavel-bill-popup-record {
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
    description: "Create work tied to bills, letters, reports, floor speeches, and participation.",
    detail: "due dates",
  },
  {
    icon: CheckCircle2,
    title: "Rubrics and auto-grading",
    description: "Score submissions against teacher criteria while keeping review and overrides available.",
    detail: "criteria",
  },
  {
    icon: Users,
    title: "Roster tools",
    description: "Import students, reorder columns, hide fields, add custom columns, and export clean sheets.",
    detail: "columns",
  },
  {
    icon: Settings2,
    title: "Simulation rules",
    description: "Adjust realism, committee rules, speaker lists, organizations, profiles, and money systems.",
    detail: "settings",
  },
  {
    icon: Vote,
    title: "Floor and vote controls",
    description: "Run screen-share views, speaker queues, live vote counts, and final vote records.",
    detail: "floor",
  },
  {
    icon: Download,
    title: "Exports and SIS sync",
    description: "Export participation and grades, then sync selected scores to Synergy SIS.",
    detail: "grades",
  },
];

function TeacherToolsShowcase() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <Reveal>
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-600">Teacher tools</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Everything teachers usually juggle is listed, trackable, and ready to export.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Gavel keeps the teacher view practical: setup, grading, roster management, records, exports, and live floor
            controls live together instead of across disconnected files.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70">
            <div className="absolute bottom-6 left-[2.35rem] top-6 w-px bg-slate-200" />
            <ol className="relative space-y-1">
              {teacherTools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <li
                    key={tool.title}
                    className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <div className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">{tool.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{tool.description}</p>
                    </div>
                    <span
                      className={`hidden rounded-full px-3 py-1.5 text-xs font-black sm:inline-flex ${
                        index === 1 || index === 5 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
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

function BillFlowVisual() {
  const stages = [
    { label: "Draft", x: "5%", popupClass: "gavel-bill-popup-draft", note: "Bill created", detail: "H.R. 31 enters the docket." },
    {
      label: "Cosponsor",
      x: "27%",
      popupClass: "gavel-bill-popup-cosponsor",
      note: "Support grows",
      detail: "Five members add their names.",
    },
    {
      label: "Committee",
      x: "50%",
      popupClass: "gavel-bill-popup-committee",
      note: "Referred",
      detail: "Energy and Commerce starts markup.",
    },
    { label: "Floor", x: "72%", popupClass: "gavel-bill-popup-floor", note: "Calendared", detail: "Speakers sign up for debate." },
    { label: "Record", x: "94%", popupClass: "gavel-bill-popup-record", note: "Finalized", detail: "Vote report is saved to records." },
  ];

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Student workflow</div>
          <div className="mt-1 text-lg font-black text-slate-950">Bill draft to floor action</div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          Search legislation
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4 rounded-xl bg-white p-4">
          <div>
            <div className="font-mono text-sm font-black text-blue-700">H.R. 31</div>
            <div className="mt-1 text-lg font-black text-slate-950">Local Food Security Act</div>
            <div className="mt-1 text-sm text-slate-500">Sponsored by Rep. Elena Park</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">tracked live</span>
        </div>

        <div className="relative mt-6 min-h-[18rem] overflow-hidden rounded-2xl bg-white p-5">
          <div className="absolute left-5 right-5 top-[7.35rem] h-1 rounded-full bg-slate-200" />
          <div className="gavel-bill-timeline-fill absolute left-5 top-[7.35rem] h-1 rounded-full bg-blue-600" />
          <div className="gavel-bill-token absolute top-[6.45rem] z-20 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-lg">
            H.R. 31
          </div>

          {stages.map((stage, index) => (
            <div key={stage.label}>
              <div
                className="absolute top-[6.95rem] z-10 h-4 w-4 -translate-x-1/2 rounded-full border-4 border-white bg-blue-600 shadow"
                style={{ left: stage.x }}
              />
              <div
                className="absolute top-[8.75rem] -translate-x-1/2 text-center text-[11px] font-black uppercase tracking-wide text-slate-500"
                style={{ left: stage.x }}
              >
                {stage.label}
              </div>
              <div
                className={`${stage.popupClass} absolute top-0 w-44 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl ${
                  index === 0 ? "left-0" : index === stages.length - 1 ? "right-0" : "-translate-x-1/2"
                }`}
                style={index === 0 || index === stages.length - 1 ? undefined : { left: stage.x }}
              >
                <div className="text-xs font-black text-blue-700">{stage.note}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">{stage.detail}</div>
              </div>
            </div>
          ))}

          <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-950">Committee editor</div>
              <div className="mt-1 text-xs text-slate-500">Markup opens during meetings.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-950">Speaker list</div>
              <div className="mt-1 text-xs text-slate-500">For and against speakers queue.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-950">Vote record</div>
              <div className="mt-1 text-xs text-slate-500">Member votes are archived.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrganizationVisual() {
  const orgs = [
    ["Parties", "leadership, platforms, whips"],
    ["Committees", "chairs, reports, meetings"],
    ["Caucuses", "coalitions and issue groups"],
    ["Media groups", "letters and announcements"],
    ["Lobbyists", "money, access, records"],
  ];

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
      <div className="flex flex-wrap items-center gap-2">
        {orgs.map(([title], index) => (
          <span
            key={title}
            className={`rounded-full border border-slate-200 px-3 py-2 text-xs font-bold ${
              index === 1 ? "gavel-tab-cycle" : "bg-white text-slate-600"
            }`}
          >
            {title}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black text-slate-950">Energy and Commerce</div>
              <div className="mt-1 text-sm text-slate-500">Chair: Rep. Morgan Lee</div>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600">18/22 members</span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <div className="rounded-xl bg-white p-3">Subcommittees: Health, Energy, Oversight</div>
            <div className="rounded-xl bg-white p-3">Announcement board visible to members</div>
            <div className="rounded-xl bg-white p-3">Leadership election opens Friday</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Mail className="h-4 w-4 text-blue-600" />
            Dear colleague letters
          </div>
          <div className="mt-3 space-y-2">
            {["Request for cosponsors", "Committee hearing notice", "Caucus floor strategy"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{item}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsVisual() {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-blue-600">
        <Settings2 className="h-4 w-4" />
        Simulation settings
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["Virtual features", "Enable all tools", "bg-blue-600 text-white"],
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
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
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

      <main>
        <section className="relative isolate min-h-[84vh] overflow-hidden">
          <HeroScene />
          <div className="relative z-10 mx-auto flex min-h-[84vh] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
                  <Gavel className="h-4 w-4" />
                  Free Mock Congress simulations with no class limits
                </div>
                <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                  Gavel keeps Mock Congress organized from first bill to final grade.
                </h1>
                <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
                  Centralize the work teachers usually track across documents, spreadsheets, email, and class discussion.
                  Students draft bills, build support, revise in committee, debate on the floor, and leave a record that is
                  easy to review, export, and grade.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-base font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                  >
                    Create a free simulation
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={startDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-black text-slate-950 shadow-sm transition hover:bg-slate-50"
                  >
                    <MousePointer2 className="h-5 w-5" />
                    Open Demo
                  </button>
                </div>
                <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                  {["No simulation limits", "Teacher view built for grading", "Realistic or class-friendly rules"].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <TeacherToolsShowcase />

        <section className="py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal>
              <TeacherConsoleVisual />
            </Reveal>
            <Reveal delay={120}>
              <FeatureText
                eyebrow="Teacher operations"
                title="A complete control room for grading and running the simulation."
                points={[
                  "Create assignments, attach rubrics, auto-grade against teacher criteria, and export what happened.",
                  "Roster tools support custom columns, imports, hidden columns, and spreadsheet exports.",
                  "Grade data can sync to Synergy SIS so the online record connects to the gradebook.",
                ]}
              >
                Gavel is built to save time during a long simulation. Teachers can see the class status, manage settings,
                review submissions, generate records, and keep grading evidence in one place.
              </FeatureText>
            </Reveal>
          </div>
        </section>

        <section className="bg-slate-50 py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="lg:order-2">
              <BillFlowVisual />
            </Reveal>
            <Reveal className="lg:order-1" delay={120}>
              <FeatureText
                eyebrow="Legislation"
                title="Students move bills through a process that feels like Congress."
                points={[
                  "Bills can be cosponsored, referred to one or more committees, revised live, reported, calendared, and debated.",
                  "Committee members can work in shared editors when meetings are open.",
                  "Records preserve votes, reports, newsletters, contributions, and teacher-created entries.",
                ]}
              >
                The workflow maps to real congressional patterns, while settings let teachers choose exactly how much
                structure, automation, and simplification their class needs.
              </FeatureText>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal>
              <OrganizationVisual />
            </Reveal>
            <Reveal delay={120}>
              <FeatureText
                eyebrow="Student engagement"
                title="The social side of Congress is part of the system."
                points={[
                  "Organizations have membership, leadership, announcement boards, roles, elections, and inboxes.",
                  "Parties, committees, caucuses, media groups, and lobbyist groups create real relationship tensions.",
                  "Students contact each other through dear colleague letters instead of scattered external messages.",
                ]}
              >
                Gavel gives students reasons to negotiate, persuade, join coalitions, and respond to institutional pressure,
                without making the teacher manually coordinate every interaction.
              </FeatureText>
            </Reveal>
          </div>
        </section>

        <section className="bg-slate-950 py-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="lg:order-2">
              <SettingsVisual />
            </Reveal>
            <Reveal className="lg:order-1" delay={120}>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">Customization</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Run a realistic simulation or choose quality-of-life settings that make class easier.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Teachers can enable or disable full sections, choose assignment modes, control speaker lists, manage
                committee rules, turn money systems on, and decide whether students use editors or upload PDFs.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  [Settings2, "Flexible rule presets"],
                  [Users, "Membership and leadership controls"],
                  [Megaphone, "Floor debate and screen share tools"],
                  [BadgeDollarSign, "Optional lobbyist and campaign money"],
                ].map(([Icon, label]) => (
                  <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Icon className="h-5 w-5 text-blue-300" />
                    <span className="font-bold text-slate-100">{label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Gavel className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">
                Start a full Mock Congress simulation without paying for seats, classes, or usage.
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Create a free simulation, open the demo, or sign in to continue managing your class.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-base font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  Sign up free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={startDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-black text-slate-950 shadow-sm transition hover:bg-slate-50"
                >
                  Open Demo
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Gavel className="h-4 w-4" />
            Gavel
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/about" className="hover:text-slate-950">
              Contact
            </Link>
            <Link to="/signin" className="hover:text-slate-950">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-slate-950">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
