import { ReactNode } from "react";
import { Link } from "react-router";
import { InfoTooltip } from "../components/InfoTooltip";

export function OrganizationsLayout({ active, children }: { active: "parties" | "committees" | "caucuses" | "lobbyists"; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <InfoTooltip label="What are organizations?">
            <p>Parties organize members around political goals and help choose leaders. Committees specialize in policy areas, review bills, and decide whether legislation should move forward. Caucuses are member groups formed around shared interests or priorities.</p>
            <p className="mt-2">In the simulation, students can join organizations, participate in announcements and elections, serve in leadership, and collaborate on legislative work.</p>
          </InfoTooltip>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm md:min-h-[232px]">
          <div className="flex gap-2 md:min-h-[216px] md:flex-col">
            <Tab to="/parties" active={active === "parties"}>Parties</Tab>
            <Tab to="/committees" active={active === "committees"}>Committees</Tab>
            <Tab to="/caucuses" active={active === "caucuses"}>Caucuses</Tab>
            <div className="mx-1 h-px w-8 shrink-0 self-center bg-gray-300 md:mx-auto md:my-1 md:h-px md:w-20" aria-hidden="true" />
            <Tab to="/lobbyists" active={active === "lobbyists"}>Lobbyists</Tab>
          </div>
        </div>
        <div className="min-h-[640px] min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

function Tab({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
