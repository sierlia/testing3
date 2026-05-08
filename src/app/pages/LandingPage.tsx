import { Link } from "react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gavel,
  GraduationCap,
  Mail,
  Megaphone,
  Settings2,
  Users,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import { switchDemoAccount } from "../utils/demoAccounts";

async function openDemo() {
  try {
    await switchDemoAccount("teacher1", { confetti: true });
  } catch (error: any) {
    toast.error(error.message || "Could not open demo");
  }
}

export function PublicNav({ active }: { active: "home" | "contact" }) {
  const linkClass = (id: "home" | "contact") =>
    `text-sm font-semibold transition-colors ${active === id ? "text-blue-700" : "text-gray-700 hover:text-gray-950"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Gavel className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-950">Gavel</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-6 md:flex">
          <Link to="/" className={linkClass("home")}>
            Home
          </Link>
          <Link to="/about" className={linkClass("contact")}>
            Contact
          </Link>
          <button type="button" onClick={() => void openDemo()} className="text-sm font-semibold text-gray-700 transition-colors hover:text-gray-950">
            Open demo
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/signin" className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-slate-100 hover:text-gray-950">
            Log in
          </Link>
          <Link to="/signup" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

const workflowSteps = [
  ["Draft", "Students write bills with support text and teacher-controlled composer settings."],
  ["Cosponsor", "Members gather support before committee referral and floor action."],
  ["Committee", "Live editors let committees revise text, write reports, and vote."],
  ["Calendar", "Teachers manage timing, speaker lists, debate, and floor readiness."],
  ["Floor", "Students debate, vote, and create a permanent record of outcomes."],
];

const organizationRows = [
  ["Parties", "Coalitions, whips, platforms, elections, leadership roles."],
  ["Committees", "Jurisdiction, markups, reports, chairs, ranking members."],
  ["Caucuses", "Issue blocs with membership, boards, and leadership."],
  ["Media groups", "Narrative pressure, public messaging, and coverage cycles."],
  ["Lobbyists", "Outside access, money flows, spending records, and influence."],
];

const teacherTools = [
  ["Assignments", "Create tasks, deadlines, grades, and rubrics tied to simulation work.", ClipboardCheck],
  ["Auto-grading", "Use criteria sets to score submissions consistently while keeping teacher review central.", CheckCircle2],
  ["Exports", "Download roster, participation, records, votes, and grade data for easy grading.", Download],
  ["Synergy SIS", "Sync grades to Synergy SIS so the simulation can fit into existing school workflows.", GraduationCap],
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <style>{`
        @keyframes gavelFloatA {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-1deg); }
          50% { transform: translate3d(18px, -18px, 0) rotate(1deg); }
        }
        @keyframes gavelFloatB {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(1deg); }
          50% { transform: translate3d(-16px, 14px, 0) rotate(-1deg); }
        }
        @keyframes gavelPulseLine {
          0% { transform: translateX(-18%); opacity: 0; }
          12%, 78% { opacity: 1; }
          100% { transform: translateX(118%); opacity: 0; }
        }
        @keyframes gavelMarker {
          0% { left: 2%; }
          20% { left: 25%; }
          42% { left: 48%; }
          68% { left: 72%; }
          100% { left: 96%; }
        }
        @keyframes gavelVoteBars {
          0%, 100% { height: 34%; }
          35% { height: 72%; }
          65% { height: 52%; }
        }
        @keyframes gavelOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .gavel-float-a { animation: gavelFloatA 8s ease-in-out infinite; }
        .gavel-float-b { animation: gavelFloatB 9s ease-in-out infinite; }
        .gavel-pulse-line { animation: gavelPulseLine 3.5s ease-in-out infinite; }
        .gavel-marker { animation: gavelMarker 9s ease-in-out infinite; }
        .gavel-orbit { animation: gavelOrbit 26s linear infinite; }
        .gavel-bar-one { animation: gavelVoteBars 4.8s ease-in-out infinite; }
        .gavel-bar-two { animation: gavelVoteBars 4.8s ease-in-out infinite 0.7s; }
        .gavel-bar-three { animation: gavelVoteBars 4.8s ease-in-out infinite 1.2s; }
      `}</style>

      <PublicNav active="home" />

      <main>
        <section className="relative min-h-[82vh] overflow-hidden border-b border-slate-200 bg-[#eef3f8]">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_22%,rgba(37,99,235,0.18),transparent_34%),radial-gradient(circle_at_82%_38%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.48),rgba(241,245,249,0.72))]" />

            <div className="gavel-float-a absolute left-[5%] top-[15%] hidden w-72 rounded-lg border border-white/70 bg-white/85 p-4 shadow-xl backdrop-blur md:block">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-blue-700">H.R. 18</span>
                <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Reported</span>
              </div>
              <div className="text-sm font-bold text-slate-950">Community Transit Access Act</div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-3/4 rounded-full bg-blue-600" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded bg-slate-100 py-1">Draft</span>
                <span className="rounded bg-blue-100 py-1 text-blue-700">Markup</span>
                <span className="rounded bg-slate-100 py-1">Floor</span>
              </div>
            </div>

            <div className="gavel-float-b absolute right-[6%] top-[12%] hidden w-80 rounded-lg border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur lg:block">
              <div className="mb-3 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-950">Teacher view</span>
              </div>
              {["Grade committee report", "Export roster", "Sync rubric scores", "Post floor record"].map((item, index) => (
                <div key={item} className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <span>{item}</span>
                  <span className={`h-2 w-2 rounded-full ${index < 2 ? "bg-emerald-500" : "bg-blue-500"}`} />
                </div>
              ))}
            </div>

            <div className="absolute bottom-[14%] left-1/2 hidden w-[720px] -translate-x-1/2 rounded-xl border border-white/70 bg-white/75 p-4 shadow-2xl backdrop-blur md:block">
              <div className="relative h-20">
                <div className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200">
                  <div className="gavel-pulse-line h-full w-40 rounded-full bg-blue-600" />
                </div>
                <div className="gavel-marker absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow-lg" />
                <div className="absolute inset-x-0 bottom-0 grid grid-cols-5 text-center text-xs font-bold text-slate-600">
                  {workflowSteps.map(([label]) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto flex min-h-[82vh] max-w-7xl items-center px-4 pb-20 pt-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-sm font-bold text-blue-700 shadow-sm backdrop-blur">
                <Vote className="h-4 w-4" />
                Long-term Mock Congress simulation management
              </div>
              <h1 className="text-6xl font-black tracking-tight text-slate-950 sm:text-7xl lg:text-8xl">Gavel</h1>
              <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-700">
                A comprehensive, customizable platform for running Mock Congress over weeks or months. Centralize materials online, save grading time, and give students a House of Representatives roleplay that has real procedure, real pressure, and enough quality-of-life controls to keep class moving.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700">
                  Create a free simulation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <button type="button" onClick={() => void openDemo()} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white/90 px-5 py-3 text-sm font-bold text-slate-900 shadow-sm backdrop-blur transition-colors hover:bg-white">
                  Open demo
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
                {["Free to create", "No simulation limits", "Teacher-controlled realism", "Exports for grading"].map((item) => (
                  <span key={item} className="rounded-full border border-white/80 bg-white/75 px-3 py-1 shadow-sm backdrop-blur">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-blue-700">Built for teachers</div>
              <h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">A complete teacher view for setup, grading, records, and export.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                Gavel keeps the simulation organized in one place: class settings, rosters, assignments, grades, rubrics, deadlines, records, committee work, floor votes, and exports. Teachers can run a realistic Congress or turn on supports that make the work easier to manage.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-4 shadow-xl">
              <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
              <div className="grid gap-3 md:grid-cols-2">
                {teacherTools.map(([title, copy, Icon]: any, index) => (
                  <div key={title} className={`rounded-lg border border-white/10 bg-white p-4 shadow-sm ${index % 2 === 0 ? "gavel-float-a" : "gavel-float-b"}`} style={{ animationDelay: `${index * 0.35}s` }}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className="h-5 w-5 text-blue-600" />
                      <h3 className="font-bold text-slate-950">{title}</h3>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="text-sm font-bold uppercase tracking-wide text-blue-700">Student work becomes procedure</div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Bills move through the same pressure points students read about.</h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                Members draft legislation, gather cosponsors, answer committee revisions, sign up for debate, and vote on the floor. Every stage leaves useful records for reflection and grading.
              </p>
            </div>

            <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="absolute left-8 right-8 top-1/2 hidden h-1 -translate-y-1/2 rounded-full bg-slate-200 md:block" />
              <div className="gavel-pulse-line absolute left-8 top-1/2 hidden h-1 w-48 -translate-y-1/2 rounded-full bg-blue-600 md:block" />
              <div className="relative grid gap-4 md:grid-cols-5">
                {workflowSteps.map(([title, copy], index) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">{index + 1}</div>
                    <h3 className="font-bold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-blue-700">Realistic relationships, configurable load</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Parties, committees, caucuses, media groups, and lobbyists all create the tensions that make the simulation work.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Each organization can have membership, leadership, announcement boards, elections, and records. Teachers can keep the model close to real House procedure or enable quality-of-life features that reduce setup time and classroom complexity.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {organizationRows.map(([title, copy]) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold text-slate-950">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[520px] rounded-xl border border-slate-200 bg-slate-950 p-6 shadow-xl">
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-300/30" />
              <div className="gavel-orbit absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/20" />
              <div className="absolute left-1/2 top-1/2 w-48 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 text-center shadow-xl">
                <Gavel className="mx-auto mb-2 h-7 w-7 text-blue-600" />
                <div className="font-black text-slate-950">Simulation center</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">settings, records, grades</div>
              </div>
              {[
                ["left-5 top-8", Users, "Parties"],
                ["right-6 top-20", FileText, "Committees"],
                ["left-8 bottom-20", Megaphone, "Media"],
                ["right-10 bottom-8", BadgeDollarSign, "Lobbyists"],
                ["left-1/2 top-8 -translate-x-1/2", Mail, "Letters"],
              ].map(([position, Icon, label]: any) => (
                <div key={label} className={`absolute ${position} rounded-lg border border-white/10 bg-white/95 px-4 py-3 shadow-lg`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-950">{label}</span>
                  </div>
                </div>
              ))}
              <div className="absolute bottom-6 left-6 right-6 rounded-lg border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <div className="mb-3 flex items-center justify-between text-sm font-bold">
                  <span>Floor vote</span>
                  <span>Live count</span>
                </div>
                <div className="flex h-28 items-end gap-3">
                  <div className="gavel-bar-one w-1/3 rounded-t bg-blue-400" />
                  <div className="gavel-bar-two w-1/3 rounded-t bg-emerald-400" />
                  <div className="gavel-bar-three w-1/3 rounded-t bg-amber-300" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <div className="text-sm font-bold uppercase tracking-wide text-blue-700">Realism controls</div>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Run it exactly how your class needs it.</h2>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    Start with a realistic model, then adjust participation rules, message boards, organization creation, committees, subcommittees, profiles, speaker lists, and floor procedure. The teacher decides what is authentic, what is streamlined, and what should be graded.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    ["100% realistic", "Students handle the slow work: referrals, leadership, debate, vote timing, reports, and coalition pressure."],
                    ["Teacher-guided", "Teachers initiate key actions, approve requests, and keep committees moving without losing the structure."],
                    ["Quality-of-life mode", "Centralize work online, simplify non-essential tools, and reduce time spent chasing materials."],
                  ].map(([title, copy]) => (
                    <div key={title} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="absolute inset-y-0 left-0 w-1 bg-blue-600 transition-all duration-300 group-hover:w-2" />
                      <div className="pl-3">
                        <h3 className="font-bold text-slate-950">{title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Create a simulation for free.</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Build a class, configure the rules, invite students, and keep the work organized from the first bill draft to the final floor record.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100">
                Sign up
              </Link>
              <button type="button" onClick={() => void openDemo()} className="inline-flex items-center justify-center rounded-md border border-white/25 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                Open demo
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
