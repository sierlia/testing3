import { Link } from "react-router";
import { ArrowRight, BookOpen, CalendarDays, Gavel, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { switchDemoAccount } from "../utils/demoAccounts";

export function PublicNav({ active }: { active: "home" | "contact" }) {
  const linkClass = (id: "home" | "contact") =>
    `text-lg font-bold transition-colors ${active === id ? "text-blue-700" : "text-gray-700 hover:text-gray-900"}`;
  return (
    <header className="border-b bg-white/90 backdrop-blur-sm">
      <div className="container relative mx-auto flex items-center gap-8 px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <Gavel className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Gavel</h1>
        </Link>
        <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-7">
          <Link to="/" className={linkClass("home")}>Home</Link>
          <Link to="/about" className={linkClass("contact")}>Contact</Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await switchDemoAccount("teacher1", { confetti: true });
              } catch (error: any) {
                toast.error(error.message || "Could not open demo");
              }
            }}
            className="text-lg font-bold text-gray-700 transition-colors hover:text-gray-900"
          >
            Enter Demo
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm font-medium">
          <Button variant="outline" asChild><Link to="/signin">Sign In</Link></Button>
          <Button asChild><Link to="/signup">Sign Up</Link></Button>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav active="home" />
      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                <Vote className="h-4 w-4" />
                Classroom government that actually runs
              </div>
              <h2 className="max-w-3xl text-5xl font-bold leading-tight text-gray-950">
                Run a full legislative simulation from bill draft to final vote.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
                Gavel gives teachers the tools to organize parties, committees, caucuses, elections, calendars, records, and floor action while students work inside a live civic simulation.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild><Link to="/signup">Create a class</Link></Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await switchDemoAccount("teacher1", { confetti: true });
                    } catch (error: any) {
                      toast.error(error.message || "Could not open demo");
                    }
                  }}
                >
                  Open demo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-2xl">
              <div className="rounded-xl bg-white p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Today</div>
                    <div className="text-2xl font-bold text-gray-950">Floor Calendar</div>
                  </div>
                  <div className="rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">Live</div>
                </div>
                <div className="space-y-3">
                  {[
                    ["H.R. 4", "Clean Water Infrastructure Act", "Floor vote open"],
                    ["H.R. 7", "Student Privacy Modernization Act", "Calendared"],
                    ["H.R. 11", "Community Solar Grants Act", "Reported"],
                  ].map(([label, title, status]) => (
                    <div key={label} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-sm font-bold text-blue-700">{label}</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{status}</div>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{title}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["24", "Members"],
                    ["6", "Committees"],
                    ["13", "Bills"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xl font-bold text-gray-950">{value}</div>
                      <div className="text-xs font-medium text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            [BookOpen, "Legislation", "Students draft bills, gather cosponsors, revise text, and follow actions through the full tracker."],
            [Users, "Organizations", "Parties, committees, and caucuses each have membership, leadership, announcements, and elections."],
            [CalendarDays, "Records and floor", "Committee reports, Dear Colleague letters, calendars, and floor votes become searchable class records."],
          ].map(([Icon, title, copy]: any) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="mb-4 h-7 w-7 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{copy}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
