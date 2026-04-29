import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Bell, Check, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function NotificationSettings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      id: "caucus_announcements",
      label: "Caucus Announcements",
      description: "Get notified when new announcements are posted in your caucuses",
      enabled: true,
    },
    {
      id: "caucus_replies",
      label: "Caucus Replies",
      description: "Get notified when someone replies to your caucus announcements",
      enabled: true,
    },
    {
      id: "committee_announcements",
      label: "Committee Announcements",
      description: "Get notified when new announcements are posted in your committees",
      enabled: true,
    },
    {
      id: "committee_replies",
      label: "Committee Replies",
      description: "Get notified when someone replies to your committee announcements",
      enabled: true,
    },
    {
      id: "teacher_deadlines",
      label: "Teacher Deadlines",
      description: "Get notified about new deadlines and assignments from teachers",
      enabled: true,
    },
  ]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleToggle = (id: string) => {
    setPreferences(preferences.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const handleSave = () => {
    setSaveStatus("saving");
    // Simulate saving to backend
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Notifications
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-gray-600 mt-1">Choose what notifications you want to receive</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-600">Manage your notification settings</p>
              </div>
            </div>
          </div>

          {/* Preferences List */}
          <div className="divide-y divide-gray-200">
            {preferences.map(preference => (
              <div key={preference.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {preference.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {preference.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(preference.id)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ml-4 ${
                      preference.enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        preference.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer with Save Button */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-end">
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium transition-all ${
                  saveStatus === "saved"
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saveStatus === "saving" && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {saveStatus === "saved" && <Check className="w-4 h-4" />}
                {saveStatus === "idle" && "Save Preferences"}
                {saveStatus === "saving" && "Saving..."}
                {saveStatus === "saved" && "Saved!"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}