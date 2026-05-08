import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  Mail,
  Megaphone,
  MousePointer2,
  NotebookText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
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

function TeacherToolsShowcase() {
  const gradingCards = [
    {
      icon: BarChart3,
      tone: "bg-blue-600",
      title: "Detailed dashboards",
      description: "Access class and student information in one click, so clicks do not multiply for every student.",
    },
    {
      icon: ClipboardCheck,
      tone: "bg-emerald-600",
      title: "Assignments & automated rubrics",
      description:
        "Create assignments with resources, grade manually with feedback, or set requirements like Write 2 Bills for Gavel to track.",
    },
    {
      icon: GraduationCap,
      tone: "bg-amber-600",
      title: "SIS syncing",
      description: "Sync grades automatically to Synergy SIS, Schoology, and PowerSchool.",
    },
    {
      icon: Vote,
      tone: "bg-rose-600",
      title: "Comprehensive activity tracking",
      description: "Track all simulation activity from bills and votes to letters, records, and organization work.",
    },
    {
      icon: NotebookText,
      tone: "bg-slate-950",
      title: "See all teacher documentation",
      description: "Open the help center for documentation covering every teacher tool in Gavel.",
    },
  ];

  return (
    <section id="grading" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Built for grading</h2>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {gradingCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  to="/help"
                  className="group flex min-h-72 flex-col rounded-[1.25rem] bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-black leading-tight text-slate-950">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                  <ArrowRight className="mt-auto h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </Link>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const billTimelineStages = [
  {
    label: "Introduced",
    title: "Bill introduced",
    body: "The bill is filed, labeled, tied to a sponsor, and added to the class bill list.",
  },
  {
    label: "Referred",
    title: "Committee referral",
    body: "The teacher or authorized member sends the bill to one or more committees for review.",
  },
  {
    label: "Revised and discussed in committee",
    title: "Committee work",
    body: "Committee members revise text, discuss changes, write reports, and vote on whether to report the bill.",
  },
  {
    label: "Calendared",
    title: "Calendar placement",
    body: "The bill moves onto the calendar so speakers can prepare and floor time can be managed.",
  },
  {
    label: "Debated and voted on floor",
    title: "Floor action",
    body: "The class debates, votes, and generates a record teachers can use for grading and reflection.",
  },
];

function BillTimelineSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || activeStage >= billTimelineStages.length - 1) return;

    const id = window.setTimeout(() => {
      setActiveStage((stage) => Math.min(stage + 1, billTimelineStages.length - 1));
    }, 3600);

    return () => window.clearTimeout(id);
  }, [activeStage, started]);

  return (
    <section ref={sectionRef} id="bill-timeline" className="py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.55fr_0.45fr] lg:px-8">
        <Reveal>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Complete legislative process</h2>
            <div className="mt-8 rounded-[1rem] bg-white p-5 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
              <div className="font-mono text-sm font-black text-blue-700">H.R. 31</div>
              <div className="mt-1 text-2xl font-black text-slate-950">Local Food Security Act</div>
              <div className="mt-1 text-sm text-slate-500">Sponsored by Rep. Elena Park</div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Example text: To expand school food donation partnerships and reduce waste while supporting local food banks.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-blue-700">
                {["Rep. Morgan Lee", "Rep. Ava Patel", "Rep. Jordan Miles"].map((name) => (
                  <span key={name} className="rounded-full bg-blue-50 px-3 py-1.5">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[1rem] bg-white p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
            <div className="relative">
              <div className="absolute bottom-6 left-[0.55rem] top-6 border-l border-dashed border-slate-300" />
              <div className="space-y-2">
                {billTimelineStages.map((stage, index) => {
                  const isRevealed = index <= activeStage;
                  return (
                    <button
                      key={stage.label}
                      type="button"
                      onClick={() => setActiveStage((stageIndex) => Math.max(stageIndex, index))}
                      className={`relative grid w-full grid-cols-[1.5rem_1fr] gap-4 rounded-md px-1 py-2 text-left transition ${
                        index > activeStage ? "cursor-pointer hover:bg-[#fbfaf8]" : "cursor-default"
                      }`}
                    >
                      <span
                        className={`relative z-10 mt-1 h-3 w-3 rounded-full ring-4 ring-white transition ${
                          isRevealed ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-black text-slate-950">{stage.label}</span>
                        <span
                          className={`block overflow-hidden text-sm leading-6 text-slate-600 transition-all duration-500 ${
                            isRevealed ? "mt-1 max-h-28 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <span className="font-semibold text-slate-800">{stage.title}.</span> {stage.body}
                        </span>
                      </span>
                    </button>
                  );
                })}
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
];

const messagingItems = [
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
  {
    label: "Committee editing",
    title: "Live editing keeps discussion productive.",
    body: "Committee work can include live collaborative editing when a meeting is open.",
    icon: ClipboardCheck,
    details: [
      "Teachers control when committee editing is available.",
      "Revision, discussion, and reporting stay connected to the bill.",
      "Committees can work online while still supporting in-person debate.",
    ],
  },
];

type ExplorerItem = (typeof organizationItems)[number] | (typeof messagingItems)[number];

function ListDetailShowcase({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: ExplorerItem[];
}) {
  const [activeItem, setActiveItem] = useState(0);
  const cycleMs = 5200;

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveItem((item) => (item + 1) % items.length);
    }, cycleMs);

    return () => window.clearInterval(id);
  }, [items.length]);

  const active = items[activeItem];
  const Icon = active.icon;

  return (
    <section id={id} className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-12 grid min-h-[32rem] overflow-hidden rounded-[1.25rem] bg-white shadow-[0_16px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[0.42fr_0.58fr]">
            <div className="bg-white py-4 lg:border-r lg:border-neutral-200">
              {items.map((item, index) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveItem(index)}
                    className={`relative mx-4 flex w-[calc(100%-2rem)] items-center gap-3 border-b border-neutral-200 px-3 py-5 text-left transition last:border-b-0 ${
                      activeItem === index
                        ? "text-blue-700"
                        : "bg-white text-slate-700 hover:bg-neutral-50 hover:text-slate-950"
                    }`}
                  >
                    <ItemIcon className="h-5 w-5 flex-none" />
                    <span className="text-sm font-black">{item.label}</span>
                    {activeItem === index ? (
                      <span
                        key={activeItem}
                        className="gavel-org-progress absolute bottom-0 left-0 h-1 bg-blue-600"
                        style={{ animationDuration: `${cycleMs}ms` }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="bg-white p-8 lg:p-10">
              <div className="flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-600 text-white">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="mt-6 text-4xl font-black tracking-tight text-slate-950">{active.title}</h3>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{active.body}</p>
              <ul className="mt-8 max-w-3xl divide-y divide-neutral-200">
                {active.details.map((detail) => (
                  <li key={detail} className="flex gap-3 py-4 text-base leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-blue-600" />
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
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-black text-white shadow-sm transition hover:bg-blue-700"
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

        <TeacherToolsShowcase />

        <BillTimelineSection />

        <ListDetailShowcase id="organizations" title="Organizations" items={organizationItems} />

        <ListDetailShowcase id="messaging" title="Messaging" items={messagingItems} />

        <section id="customization" className="py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="lg:order-2">
              <SettingsVisual />
            </Reveal>
            <Reveal className="lg:order-1" delay={120}>
              <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Highly customizable</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Adjust time, complexity, and realism so the same simulation can fit a short unit, a semester project, or a
                full-year course for middle school, high school, college, civics, government, history, or debate.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  [Settings2, "Duration: single unit to full year"],
                  [Users, "Complexity: middle school to college"],
                  [Megaphone, "Realism: authentic or streamlined"],
                  [BadgeDollarSign, "Optional layers: money, lobbying, media"],
                ].map(([Icon, label]) => (
                  <div key={String(label)} className="flex items-center gap-3 rounded-[1rem] bg-white p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
                    <Icon className="h-5 w-5 text-blue-600" />
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
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-black text-white shadow-sm transition hover:bg-blue-700"
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
        <div className="mx-auto flex max-w-7xl justify-center gap-8 px-4 py-8 text-sm font-semibold text-slate-600 sm:px-6 lg:px-8">
          <Link to="/" className="hover:text-slate-950">
            Home
          </Link>
          <Link to="/about" className="hover:text-slate-950">
            Contact
          </Link>
          <button type="button" onClick={startDemo} className="hover:text-slate-950">
            Open Demo
          </button>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
