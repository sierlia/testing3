import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Settings, Save, Send, CheckSquare, Users, Scale } from "lucide-react";

export function TeacherSetup() {
  const [settings, setSettings] = useState({
    // Party settings
    allowedParties: ["Democrat", "Republican"],
    allowStudentCreatedParties: false,
    autoApproveParties: [] as string[],
    
    // Committee settings
    enabledCommittees: [
      "Education Committee",
      "Environment & Energy Committee",
      "Healthcare Committee",
      "Judiciary Committee",
      "Agriculture Committee",
    ],
    
    // Simulation rules
    chairElectionMode: "elected", // "elected" or "teacher-assigned"
    billAssignmentAuthority: "leadership", // "leadership", "teacher", or "clerk"
    floorResultsBinding: true,
  });

  const [hasChanges, setHasChanges] = useState(false);

  const allParties = [
    "Democrat",
    "Republican",
    "Green",
    "Libertarian",
    "Independent",
  ];

  const allCommittees = [
    "Education Committee",
    "Environment & Energy Committee",
    "Healthcare Committee",
    "Judiciary Committee",
    "Agriculture Committee",
    "Budget & Appropriations Committee",
    "Foreign Affairs Committee",
    "Transportation & Infrastructure Committee",
  ];

  const handlePartyToggle = (party: string) => {
    const newParties = settings.allowedParties.includes(party)
      ? settings.allowedParties.filter(p => p !== party)
      : [...settings.allowedParties, party];
    setSettings({ ...settings, allowedParties: newParties });
    setHasChanges(true);
  };

  const handleAutoApproveToggle = (party: string) => {
    const newAutoApprove = settings.autoApproveParties.includes(party)
      ? settings.autoApproveParties.filter(p => p !== party)
      : [...settings.autoApproveParties, party];
    setSettings({ ...settings, autoApproveParties: newAutoApprove });
    setHasChanges(true);
  };

  const handleCommitteeToggle = (committee: string) => {
    const newCommittees = settings.enabledCommittees.includes(committee)
      ? settings.enabledCommittees.filter(c => c !== committee)
      : [...settings.enabledCommittees, committee];
    setSettings({ ...settings, enabledCommittees: newCommittees });
    setHasChanges(true);
  };

  const handleSelectAllCommittees = () => {
    setSettings({ ...settings, enabledCommittees: [...allCommittees] });
    setHasChanges(true);
  };

  const handleDeselectAllCommittees = () => {
    setSettings({ ...settings, enabledCommittees: [] });
    setHasChanges(true);
  };

  const handleSave = () => {
    console.log("Saving settings:", settings);
    alert("Settings saved!");
    setHasChanges(false);
  };

  const handlePublish = () => {
    console.log("Publishing to students:", settings);
    alert("Settings published to students!");
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Simulation Setup</h1>
          <p className="text-gray-600">
            Configure parties, committees, and simulation rules for your class
          </p>
        </div>

        <div className="space-y-6">
          {/* Parties Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Parties</h2>
            </div>

            {/* Allowed Parties */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Allowed Parties
              </label>
              <div className="grid grid-cols-2 gap-3">
                {allParties.map(party => (
                  <label
                    key={party}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowedParties.includes(party)}
                      onChange={() => handlePartyToggle(party)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">{party}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Student-Created Parties */}
            <div className="mb-6">
              <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowStudentCreatedParties}
                  onChange={(e) => {
                    setSettings({ ...settings, allowStudentCreatedParties: e.target.checked });
                    setHasChanges(true);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-blue-900">
                    Allow student-created parties
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Students can create and join custom political parties
                  </p>
                </div>
              </label>
            </div>

            {/* Auto-Approve Parties */}
            {settings.allowStudentCreatedParties && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Auto-approve parties from list
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Pre-approved party names will be available immediately without teacher review
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {allParties.map(party => (
                    <label
                      key={party}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={settings.autoApproveParties.includes(party)}
                        onChange={() => handleAutoApproveToggle(party)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">{party}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Committees Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Committees</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllCommittees}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleDeselectAllCommittees}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {allCommittees.map(committee => (
                <label
                  key={committee}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={settings.enabledCommittees.includes(committee)}
                    onChange={() => handleCommitteeToggle(committee)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{committee}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Simulation Rules */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Simulation Rules</h2>
            </div>

            <div className="space-y-4">
              {/* Chair Election Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Committee Chair Selection
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.chairElectionMode === "elected"}
                      onChange={() => {
                        setSettings({ ...settings, chairElectionMode: "elected" });
                        setHasChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Committee members elect chairs
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        Committee members vote for chair and ranking member
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.chairElectionMode === "teacher-assigned"}
                      onChange={() => {
                        setSettings({ ...settings, chairElectionMode: "teacher-assigned" });
                        setHasChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Teacher assigns chairs
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        You directly assign committee leadership roles
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bill Assignment Authority */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Who can assign bills to committees?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.billAssignmentAuthority === "leadership"}
                      onChange={() => {
                        setSettings({ ...settings, billAssignmentAuthority: "leadership" });
                        setHasChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Majority Leadership</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.billAssignmentAuthority === "teacher"}
                      onChange={() => {
                        setSettings({ ...settings, billAssignmentAuthority: "teacher" });
                        setHasChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Teacher Only</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.billAssignmentAuthority === "clerk"}
                      onChange={() => {
                        setSettings({ ...settings, billAssignmentAuthority: "clerk" });
                        setHasChanges(true);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Clerk (Automatic)</span>
                  </label>
                </div>
              </div>

              {/* Floor Results Binding */}
              <div>
                <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.floorResultsBinding}
                    onChange={(e) => {
                      setSettings({ ...settings, floorResultsBinding: e.target.checked });
                      setHasChanges(true);
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-blue-900">
                      Floor vote results determine final outcome
                    </span>
                    <p className="text-xs text-blue-700 mt-1">
                      If unchecked, floor votes are for practice only and don't advance bills
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {hasChanges && (
                <span className="text-amber-600 font-medium">You have unsaved changes</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
              <button
                onClick={handlePublish}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                Publish to Students
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
