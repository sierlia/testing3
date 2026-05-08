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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
            <Gavel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-black tracking-tight text-slate-950">Gavel</span>
        </Link>

        <nav className="order-3 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-3 md:order-none md:ml-6 md:w-auto md:border-t-0 md:pt-0">
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

        <div className="ml-auto flex items-center gap-2">
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

      <div className="absolute right-[-6rem] top-16 hidden w-[50rem] max-w-[58vw] lg:block">
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
                      index === 0 ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50"
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
                      <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
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
              {["Drafted", "Committee", "Reported", "Floor", "Records"].map((stage) => (
                <span key={stage} className="rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
                  {stage}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="gavel-action-cursor absolute left-7 top-7 h-8 w-7 bg-slate-950 shadow-lg">
          <span className="absolute left-6 top-5 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-bold text-white shadow">
            click
          </span>
        </div>
        <span className="gavel-click-pulse gavel-click-one absolute h-8 w-8 rounded-full border-2 border-blue-500" />
        <span className="gavel-click-pulse gavel-click-two absolute h-8 w-8 rounded-full border-2 border-blue-500" />
        <span className="gavel-click-pulse gavel-click-three absolute h-8 w-8 rounded-full border-2 border-blue-500" />
      </div>
    </div>
  );
}

function SiteMotionStyles() {
  return (
    <style>{`
      @keyframes gavelCursorPath {
        0%, 8% { transform: translate(0, 0); opacity: 0; }
        12%, 30% { transform: translate(118px, 162px); opacity: 1; }
        40%, 58% { transform: translate(445px, 290px); opacity: 1; }
        68%, 84% { transform: translate(585px, 90px); opacity: 1; }
        94%, 100% { transform: translate(620px, 255px); opacity: 0; }
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

      .gavel-action-cursor,
      .gavel-small-cursor {
        clip-path: polygon(0 0, 0 100%, 28% 76%, 48% 100%, 63% 91%, 43% 68%, 76% 68%);
      }

      .gavel-action-cursor { animation: gavelCursorPath 9s ease-in-out infinite; }
      .gavel-click-one { left: 168px; top: 202px; animation: gavelClickOne 9s ease-out infinite; }
      .gavel-click-two { left: 492px; top: 328px; animation: gavelClickTwo 9s ease-out infinite; }
      .gavel-click-three { left: 632px; top: 128px; animation: gavelClickThree 9s ease-out infinite; }
      .gavel-route-fill { animation: gavelRouteFill 9s ease-in-out infinite; }
      .gavel-vote-bar { animation: gavelVoteBar 4s ease-in-out infinite; }
      .gavel-bill-row:first-child { animation: gavelBillAttention 9s ease-in-out infinite; }
      .gavel-progress-fill { animation: gavelProgress 5s ease-in-out infinite alternate; }
      .gavel-step-focus { animation: gavelStepFocus 6s ease-in-out infinite; }
      .gavel-tab-cycle { animation: gavelTabCycle 7s ease-in-out infinite; }
      .gavel-small-cursor { animation: gavelCursorTap 7s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .gavel-action-cursor,
        .gavel-small-cursor,
        .gavel-click-pulse,
        .gavel-route-fill,
        .gavel-vote-bar,
        .gavel-bill-row,
        .gavel-progress-fill,
        .gavel-step-focus,
        .gavel-tab-cycle {
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
  return (
    <div className="relative rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {[
            ["H.R. 31", "Local Food Security Act", "5 cosponsors"],
            ["H.R. 34", "Clean Transit Grants Act", "committee revision"],
            ["H.R. 39", "Civic Archives Act", "reported favorably"],
          ].map(([number, title, status], index) => (
            <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-950">
                    {number} - {title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Sponsored by Rep. Elena Park</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    index === 1 ? "bg-blue-100 text-blue-700" : "bg-white text-slate-600"
                  }`}
                >
                  {status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-slate-950">Committee live editor</div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Meeting open
            </div>
          </div>
          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <p>
              Section 2. The Secretary shall establish grant criteria for transit agencies serving students and
              workers.
            </p>
            <p className="rounded-lg bg-blue-100 px-2 py-1 text-blue-900">
              Amendment: priority shall be given to districts with documented transportation gaps.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
            <span className="rounded-xl bg-slate-100 px-2 py-2">Draft</span>
            <span className="rounded-xl bg-blue-600 px-2 py-2 text-white">Revision</span>
            <span className="rounded-xl bg-slate-100 px-2 py-2">Report</span>
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

        <section className="border-y border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[
              ["Bills", "Cosponsors, referrals, live committee editing, floor debate, and final records."],
              ["Organizations", "Parties, committees, caucuses, media groups, and lobbyists with membership and elections."],
              ["Letters", "Dear colleague letters and inboxes keep communication inside the simulation."],
              ["Grades", "Assignments, rubrics, exports, auto-grading, and Synergy SIS sync are built into the teacher view."],
            ].map(([title, text], index) => (
              <Reveal key={title} delay={index * 80}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-lg font-black text-slate-950">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

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
