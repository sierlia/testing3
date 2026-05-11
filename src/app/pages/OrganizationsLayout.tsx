import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { InfoTooltip } from "../components/InfoTooltip";
import { useAuth } from "../utils/AuthContext";
import { supabase } from "../utils/supabase";

type OrganizationTab = "parties" | "committees" | "caucuses" | "lobbyists" | "members";

export function OrganizationsLayout({ active, children }: { active: OrganizationTab; children: ReactNode }) {
  const { user } = useAuth();
  const [visibility, setVisibility] = useState({ parties: true, committees: true, caucuses: true, lobbyists: false });

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", user.id).maybeSingle();
      const classId = (profile as any)?.class_id;
      if (!classId) return;
      const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
      const organizations = (cls as any)?.settings?.organizations ?? {};
      const enabled = organizations.enabled !== false;
      setVisibility({
        parties: enabled && organizations.enableParties !== false,
        committees: enabled && organizations.enableCommittees !== false,
        caucuses: enabled && organizations.enableCaucuses !== false,
        lobbyists: enabled && organizations.enableLobbyists === true,
      });
    };
    void load();
  }, [user?.id]);

  const tabs = useMemo(
    () => [
      visibility.parties ? { to: "/parties", key: "parties" as const, label: "Parties" } : null,
      visibility.committees ? { to: "/committees", key: "committees" as const, label: "Committees" } : null,
      visibility.caucuses ? { to: "/caucuses", key: "caucuses" as const, label: "Caucuses" } : null,
      visibility.lobbyists ? { to: "/lobbyists", key: "lobbyists" as const, label: "Lobbyists" } : null,
      { to: "/members", key: "members" as const, label: "Members" },
    ].filter(Boolean) as Array<{ to: string; key: OrganizationTab; label: string }>,
    [visibility],
  );

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
            {tabs.map((tab) => (
              <Tab key={tab.key} to={tab.to} active={active === tab.key}>
                {tab.label}
              </Tab>
            ))}
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
