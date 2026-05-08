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
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-[#f4f4f2]/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white">
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroScene() {
  const editorCursors = [
    { name: "Maya", color: "border-blue-200 bg-blue-50 text-blue-700", className: "gavel-editor-cursor-maya" },
    { name: "Jordan", color: "border-emerald-200 bg-emerald-50 text-emerald-700", className: "gavel-editor-cursor-jordan" },
    { name: "Avery", color: "border-rose-200 bg-rose-50 text-rose-700", className: "gavel-editor-cursor-avery" },
  ];

  return (
    <div className="pointer-events-none relative mt-12 w-full overflow-hidden rounded-[1.25rem] border border-neutral-300 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Committee live editor</div>
          <div className="mt-1 text-lg font-black text-slate-950">H.R. 42 - Student Transit Access Act</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
            Meeting open
          </span>
          <span className="gavel-editor-status rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
            Submitted
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="relative min-h-[25rem] overflow-hidden rounded-2xl border border-neutral-200 bg-[#fcfcfb] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <div className="text-sm font-black text-slate-950">Revised bill text</div>
            <span className="gavel-editor-submit rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white">
              Submit revisions
            </span>
          </div>

          <div className="mt-5 space-y-4 font-serif text-[15px] leading-7 text-slate-800">
            <p>
              <span className="font-mono text-xs font-black text-slate-500">SECTION 1.</span> This Act may be cited as
              the Student Transit Access Act.
            </p>
            <p>
              <span className="font-mono text-xs font-black text-slate-500">SEC. 2.</span> The Secretary of Transportation
              shall establish a grant program to help school districts provide{" "}
              <span className="gavel-edit-highlight gavel-edit-one rounded px-1">safe evening transit routes</span> for
              students participating in debate, athletics, tutoring, and career programs.
            </p>
            <p>
              Eligible districts shall submit a plan describing student demand, proposed stops, and coordination with{" "}
              <span className="gavel-edit-highlight gavel-edit-two rounded px-1">local transit agencies and county offices</span>.
            </p>
            <p className="gavel-edit-line rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm leading-6 text-slate-700">
              Added: Each recipient shall publish quarterly access data and report barriers identified by students and
              families.
            </p>
          </div>

          <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-4 text-xs font-bold text-slate-500">
              <span>Committee collaborators</span>
              <span>Autosaved</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {editorCursors.map((cursor) => (
                <span key={cursor.name} className={`rounded-full border px-3 py-1 text-xs font-black ${cursor.color}`}>
                  {cursor.name}
                </span>
              ))}
            </div>
          </div>

          {editorCursors.map((cursor) => (
            <div
              key={cursor.name}
              className={`absolute hidden items-start gap-1 sm:flex ${cursor.className}`}
              aria-hidden="true"
            >
              <MousePointer2 className="h-5 w-5 fill-current" />
              <span className={`rounded-full border px-2 py-0.5 text-xs font-black ${cursor.color}`}>
                {cursor.name}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-black text-slate-950">Committee queue</div>
            <div className="mt-3 space-y-2">
              <div
                className="gavel-queue-primary rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900"
              >
                H.R. 42 - Student Transit Access Act
              </div>
              <div className="gavel-queue-secondary rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-slate-700">
                H.R. 57 - Community Solar Schools Act
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold text-slate-500">
                H.R. 63 - Civic Service Credit Act
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-black text-slate-950">Activity</div>
            <div className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
              <div className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
                Maya clarifies grant eligibility.
              </div>
              <div className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />
                Jordan adds reporting language.
              </div>
              <div className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-rose-600" />
                Avery submits the revision.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteMotionStyles() {
  return (
    <style>{`
      @keyframes gavelEditorCursorMaya {
        0%, 5% { opacity: 0; transform: translate(86px, 92px); }
        10%, 26% { opacity: 1; transform: translate(268px, 148px); }
        36%, 52% { opacity: 1; transform: translate(386px, 154px); }
        66%, 78% { opacity: 1; transform: translate(488px, 28px); }
        88%, 100% { opacity: 0; transform: translate(560px, 300px); }
      }

      @keyframes gavelEditorCursorJordan {
        0%, 13% { opacity: 0; transform: translate(96px, 182px); }
        18%, 38% { opacity: 1; transform: translate(325px, 204px); }
        48%, 61% { opacity: 1; transform: translate(468px, 210px); }
        72%, 84% { opacity: 1; transform: translate(510px, 28px); }
        93%, 100% { opacity: 0; transform: translate(586px, 320px); }
      }

      @keyframes gavelEditorCursorAvery {
        0%, 28% { opacity: 0; transform: translate(118px, 252px); }
        34%, 54% { opacity: 1; transform: translate(245px, 286px); }
        62%, 78% { opacity: 1; transform: translate(530px, 28px); }
        86%, 100% { opacity: 0; transform: translate(610px, 330px); }
      }

      @keyframes gavelEditOne {
        0%, 11% { background-color: transparent; }
        16%, 82% { background-color: #dbeafe; }
        94%, 100% { background-color: transparent; }
      }

      @keyframes gavelEditTwo {
        0%, 21% { background-color: transparent; }
        28%, 84% { background-color: #dcfce7; }
        96%, 100% { background-color: transparent; }
      }

      @keyframes gavelEditLine {
        0%, 34% { opacity: 0; transform: translateY(8px); }
        44%, 84% { opacity: 1; transform: translateY(0); }
        96%, 100% { opacity: 0; transform: translateY(8px); }
      }

      @keyframes gavelEditorSubmit {
        0%, 58%, 100% { background-color: #2563eb; transform: translateY(0); }
        67%, 77% { background-color: #0f172a; transform: translateY(-1px); }
      }

      @keyframes gavelEditorStatus {
        0%, 60%, 100% { opacity: 0.35; }
        68%, 82% { opacity: 1; }
      }

      @keyframes gavelQueuePrimary {
        0%, 68% { background-color: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
        78%, 100% { background-color: #fafafa; border-color: #e5e5e5; color: #64748b; }
      }

      @keyframes gavelQueueSecondary {
        0%, 68% { background-color: #fafafa; border-color: #e5e5e5; color: #475569; }
        78%, 100% { background-color: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
      }

      .gavel-editor-cursor-maya,
      .gavel-editor-cursor-jordan,
      .gavel-editor-cursor-avery {
        z-index: 20;
      }

      .gavel-editor-cursor-maya { animation: gavelEditorCursorMaya 11s ease-in-out infinite; }
      .gavel-editor-cursor-jordan { animation: gavelEditorCursorJordan 11s ease-in-out infinite; }
      .gavel-editor-cursor-avery { animation: gavelEditorCursorAvery 11s ease-in-out infinite; }
      .gavel-edit-one { animation: gavelEditOne 11s ease-in-out infinite; }
      .gavel-edit-two { animation: gavelEditTwo 11s ease-in-out infinite; }
      .gavel-edit-line { animation: gavelEditLine 11s ease-in-out infinite; }
      .gavel-editor-submit { animation: gavelEditorSubmit 11s ease-in-out infinite; }
      .gavel-editor-status { animation: gavelEditorStatus 11s ease-in-out infinite; }
      .gavel-queue-primary { animation: gavelQueuePrimary 11s ease-in-out infinite; }
      .gavel-queue-secondary { animation: gavelQueueSecondary 11s ease-in-out infinite; }

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
        0%, 38%, 60%, 100% { transform: scale(1); outline: 0 solid transparent; }
        43%, 56% { transform: scale(1.025); outline: 4px solid rgba(96, 165, 250, 0.18); }
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
        0%, 100% { outline: 0 solid transparent; }
        45%, 58% { outline: 4px solid rgba(37, 99, 235, 0.12); }
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
        .gavel-editor-cursor-maya,
        .gavel-editor-cursor-jordan,
        .gavel-editor-cursor-avery,
        .gavel-edit-one,
        .gavel-edit-two,
        .gavel-edit-line,
        .gavel-editor-submit,
        .gavel-editor-status,
        .gavel-queue-primary,
        .gavel-queue-secondary,
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
                  className="group flex min-h-72 flex-col rounded-[1.25rem] border border-neutral-300 bg-white p-5 transition hover:border-blue-300"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-6 flex items-start justify-between gap-3">
                    <h3 className="text-xl font-black leading-tight text-slate-950">{card.title}</h3>
                    <ArrowRight className="mt-1 h-5 w-5 flex-none text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
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
  return (
    <section id="bill-timeline" className="py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.55fr_0.45fr] lg:px-8">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Complete legislative process</h2>
          <div className="mt-8 rounded-[1rem] border border-neutral-300 bg-white p-5">
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

        <div className="rounded-[1rem] border border-neutral-300 bg-white p-6">
          <div className="relative">
            <div className="absolute bottom-6 left-[0.55rem] top-6 border-l border-dashed border-slate-300" />
            <div className="space-y-2">
              {billTimelineStages.map((stage) => (
                <div key={stage.label} className="relative grid grid-cols-[1.5rem_1fr] gap-4 rounded-md px-1 py-2 text-left">
                  <span className="relative z-10 mt-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">{stage.label}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600">
                      <span className="font-semibold text-slate-800">{stage.title}.</span> {stage.body}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
  const [autoAdvance, setAutoAdvance] = useState(true);
  const cycleMs = 5200;

  useEffect(() => {
    if (!autoAdvance) return undefined;

    const id = window.setInterval(() => {
      setActiveItem((item) => (item + 1) % items.length);
    }, cycleMs);

    return () => window.clearInterval(id);
  }, [autoAdvance, items.length]);

  const active = items[activeItem];
  const Icon = active.icon;

  return (
    <section id={id} className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-12 grid min-h-[32rem] overflow-hidden rounded-[1.25rem] border border-neutral-300 bg-white lg:grid-cols-[0.42fr_0.58fr]">
            <div className="bg-white py-4 lg:border-r lg:border-neutral-200">
              {items.map((item, index) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setActiveItem(index);
                      setAutoAdvance(false);
                    }}
                    className={`relative mx-4 flex w-[calc(100%-2rem)] items-center gap-3 border-b border-neutral-200 px-3 py-5 text-left transition last:border-b-0 ${
                      activeItem === index
                        ? "text-blue-700"
                        : "bg-white text-slate-700 hover:bg-neutral-50 hover:text-slate-950"
                    }`}
                  >
                    <ItemIcon className="h-5 w-5 flex-none" />
                    <span className="text-sm font-black">{item.label}</span>
                    {activeItem === index && autoAdvance ? (
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
    <div className="rounded-[1rem] border border-neutral-300 bg-white p-4">
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
    <div className="min-h-screen bg-[#f4f4f2] text-slate-950">
      <SiteMotionStyles />
      <PublicNav active="home" />

      <main className="bg-[#f4f4f2]">
        <section className="relative isolate overflow-hidden bg-[#f4f4f2]">
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <Reveal>
                <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                  Mock Congress, from first bill to final grade.
                </h1>
                <p className="mt-5 max-w-3xl text-xl leading-8 text-slate-700">
                  Centralize bills, cosponsors, committee edits, floor debate, organizations, letters, records, rubrics,
                  exports, and Synergy sync in one teacher-run workspace.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-black text-white transition hover:bg-blue-700"
                  >
                    Create a free simulation
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={startDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-base font-black text-slate-950 transition hover:bg-neutral-50"
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
                  <div key={String(label)} className="flex items-center gap-3 rounded-[1rem] border border-neutral-300 bg-white p-4">
                    <Icon className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Gavel className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">
                Start a teacher-run Mock Congress simulation for free.
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Set up a class, choose the rules, and keep the work organized from draft to grade.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-black text-white transition hover:bg-blue-700"
                >
                  Sign up free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={startDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-base font-black text-slate-950 transition hover:bg-neutral-50"
                >
                  Open Demo
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-[#f4f4f2]">
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
