import { ReactNode } from "react";
import { Link } from "react-router";

export function OrganizationsLayout({ active, children }: { active: "parties" | "committees" | "caucuses"; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
        <p className="text-gray-600">Parties, committees, and caucuses for your class</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex gap-2">
        <Tab to="/parties" active={active === "parties"}>Parties</Tab>
        <Tab to="/committees" active={active === "committees"}>Committees</Tab>
        <Tab to="/caucuses" active={active === "caucuses"}>Caucuses</Tab>
      </div>

      {children}
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

