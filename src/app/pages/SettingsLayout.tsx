import { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Navigation } from "../components/Navigation";

export function SettingsLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  const tabs = [
    { label: "Notifications", to: "/settings/notifications" },
    { label: "Classes", to: "/settings/classes" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account preferences</p>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            {tabs.map((tab) => {
              const active = path === tab.to;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {children}
      </main>
    </div>
  );
}
