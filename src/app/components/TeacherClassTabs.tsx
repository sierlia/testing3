import { Link } from "react-router";

export function TeacherClassTabs({ classId, active }: { classId: string | null | undefined; active: "dashboard" | "roster" | "settings" }) {
  if (!classId) return null;
  const tabs = [
    { id: "dashboard", label: "Dashboard", href: `/teacher/class/${classId}` },
    { id: "roster", label: "Student roster", href: `/teacher/class/${classId}/manage` },
    { id: "settings", label: "Settings", href: `/teacher/class/${classId}/settings` },
  ] as const;
  return (
    <div className="flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.href}
          className={`rounded px-3 py-2 text-sm font-medium ${active === tab.id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
