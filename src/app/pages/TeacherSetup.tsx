import { useEffect, useState } from "react";
import { Bell, Calendar, CheckSquare, FileText, Save, Scale, Send, Settings, UserCog, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { defaultPartyColor } from "../components/PartyCreateForm";

type TabId = "parties" | "committees" | "bills" | "floor" | "leadership" | "calendar" | "profiles" | "notifications";

const allParties = ["Democratic Party", "Republican Party", "Green Party", "Libertarian Party", "Independent Party"];
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

const tabs: Array<{ id: TabId; label: string; icon: any }> = [
  { id: "parties", label: "Parties", icon: Users },
  { id: "committees", label: "Committees", icon: CheckSquare },
  { id: "bills", label: "Bills", icon: FileText },
  { id: "floor", label: "Floor", icon: Scale },
  { id: "leadership", label: "Leadership", icon: Vote },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "profiles", label: "Profiles", icon: UserCog },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (next: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-600">{description}</span>
      </span>
    </label>
  );
}

export function TeacherSetup() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("parties");
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettingsState] = useState({
    allowedParties: ["Democratic Party", "Republican Party"],
    allowStudentCreatedParties: false,
    requirePartyApproval: true,
    autoApproveParties: [] as string[],
    enabledCommittees: allCommittees.slice(0, 5),
    allowSelfJoinCommittees: false,
    committeeAssignmentMode: "preference",
    chairElectionMode: "elected",
    chairVoteThresholdPct: 50,
    partyLeadershipElectionMode: "elected",
    billAssignmentAuthority: "teacher",
    allowDrafts: true,
    billTabs: ["legislative text", "supporting text"] as string[],
    committeeVoteRequired: true,
    cosponsorAfterCommitteeReport: false,
    calendarAutoPublish: true,
    floorResultsBinding: true,
    floorVoteThreshold: "simple-majority",
    showVoteResultsLive: true,
    profileDistrictRequired: true,
    profilePartyRequired: true,
    notifyOnAnnouncements: true,
    notifyOnCalendaredBills: true,
  });

  const setSettings = (patch: Partial<typeof settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
        const classId = (prof as any)?.class_id ?? null;
        setActiveClassId(classId);
        if (!classId) return;
        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        const s = (cls as any)?.settings ?? {};
        setSettingsState((prev) => ({
          ...prev,
          allowedParties: s?.parties?.allowed ?? prev.allowedParties,
          allowStudentCreatedParties: s?.parties?.allowStudentCreated ?? prev.allowStudentCreatedParties,
          requirePartyApproval: s?.parties?.requireApproval ?? prev.requirePartyApproval,
          autoApproveParties: s?.parties?.autoApprove ?? prev.autoApproveParties,
          enabledCommittees: s?.committees?.enabled ?? prev.enabledCommittees,
          allowSelfJoinCommittees: !!s?.committees?.allowSelfJoin,
          committeeAssignmentMode: s?.committees?.assignmentMode ?? prev.committeeAssignmentMode,
          chairElectionMode: s?.committees?.chairElectionMode ?? prev.chairElectionMode,
          chairVoteThresholdPct: s?.committees?.chairVoteThresholdPct ?? prev.chairVoteThresholdPct,
          partyLeadershipElectionMode: s?.parties?.leadershipElectionMode ?? prev.partyLeadershipElectionMode,
          billAssignmentAuthority: s?.bills?.assignmentAuthority ?? prev.billAssignmentAuthority,
          allowDrafts: s?.bills?.allowDrafts ?? prev.allowDrafts,
          billTabs: s?.bills?.tabs ?? prev.billTabs,
          committeeVoteRequired: s?.bills?.committeeVoteRequired ?? prev.committeeVoteRequired,
          cosponsorAfterCommitteeReport: s?.bills?.cosponsorAfterCommitteeReport ?? prev.cosponsorAfterCommitteeReport,
          calendarAutoPublish: s?.floor?.calendarAutoPublish ?? prev.calendarAutoPublish,
          floorResultsBinding: s?.floor?.binding ?? prev.floorResultsBinding,
          floorVoteThreshold: s?.floor?.voteThreshold ?? prev.floorVoteThreshold,
          showVoteResultsLive: s?.floor?.showVoteResultsLive ?? prev.showVoteResultsLive,
          profileDistrictRequired: s?.profiles?.districtRequired ?? prev.profileDistrictRequired,
          profilePartyRequired: s?.profiles?.partyRequired ?? prev.profilePartyRequired,
          notifyOnAnnouncements: s?.notifications?.announcements ?? prev.notifyOnAnnouncements,
          notifyOnCalendaredBills: s?.notifications?.calendaredBills ?? prev.notifyOnCalendaredBills,
        }));
      } catch (e: any) {
        toast.error(e.message || "Could not load settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const syncPartiesAndCommittees = async (classId: string) => {
    if (settings.allowedParties.length) {
      await supabase.from("parties").upsert(
        settings.allowedParties.map((name) => ({ class_id: classId, name, platform: "", color: defaultPartyColor(name), approved: true })),
        { onConflict: "class_id,name" },
      );
    }
    const { data: existing } = await supabase.from("committees").select("id,name").eq("class_id", classId);
    const existingNames = new Set((existing ?? []).map((c: any) => c.name));
    const toInsert = settings.enabledCommittees.filter((name) => !existingNames.has(name)).map((name) => ({ class_id: classId, name, description: "" }));
    if (toInsert.length) await supabase.from("committees").insert(toInsert);
  };

  const handleSave = async () => {
    if (!activeClassId) return toast.error("Open a class first");
    try {
      const { data: cls, error: clsErr } = await supabase.from("classes").select("settings").eq("id", activeClassId).maybeSingle();
      if (clsErr) throw clsErr;
      const existing = ((cls as any)?.settings ?? {}) as any;
      const nextSettings = {
        ...existing,
        parties: {
          ...(existing?.parties ?? {}),
          allowed: settings.allowedParties,
          allowStudentCreated: settings.allowStudentCreatedParties,
          requireApproval: settings.requirePartyApproval,
          autoApprove: settings.autoApproveParties,
          leadershipElectionMode: settings.partyLeadershipElectionMode,
        },
        committees: {
          ...(existing?.committees ?? {}),
          enabled: settings.enabledCommittees,
          assignmentMode: settings.allowSelfJoinCommittees ? "self-join" : settings.committeeAssignmentMode,
          chairElectionMode: settings.chairElectionMode,
          chairVoteThresholdPct: settings.chairVoteThresholdPct,
          allowSelfJoin: settings.allowSelfJoinCommittees,
        },
        bills: {
          ...(existing?.bills ?? {}),
          assignmentAuthority: settings.billAssignmentAuthority,
          allowDrafts: settings.allowDrafts,
          tabs: settings.billTabs,
          committeeVoteRequired: settings.committeeVoteRequired,
          cosponsorAfterCommitteeReport: settings.cosponsorAfterCommitteeReport,
        },
        floor: {
          ...(existing?.floor ?? {}),
          binding: settings.floorResultsBinding,
          voteThreshold: settings.floorVoteThreshold,
          showVoteResultsLive: settings.showVoteResultsLive,
          calendarAutoPublish: settings.calendarAutoPublish,
        },
        profiles: {
          ...(existing?.profiles ?? {}),
          districtRequired: settings.profileDistrictRequired,
          partyRequired: settings.profilePartyRequired,
        },
        notifications: {
          ...(existing?.notifications ?? {}),
          announcements: settings.notifyOnAnnouncements,
          calendaredBills: settings.notifyOnCalendaredBills,
        },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings }).eq("id", activeClassId);
      if (error) throw error;
      await syncPartiesAndCommittees(activeClassId);
      toast.success("Simulation settings saved");
      setHasChanges(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save settings");
    }
  };

  const section = () => {
    if (activeTab === "parties") {
      return (
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-900">Allowed Parties</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {allParties.map((party) => (
                <Toggle key={party} checked={settings.allowedParties.includes(party)} onChange={() => setSettings({ allowedParties: settings.allowedParties.includes(party) ? settings.allowedParties.filter((p) => p !== party) : [...settings.allowedParties, party] })} title={party} description="Create and approve this party for the class." />
              ))}
            </div>
          </div>
          <Toggle checked={settings.allowStudentCreatedParties} onChange={(v) => setSettings({ allowStudentCreatedParties: v })} title="Allow student-created parties" description="Students can propose custom parties from the organizations area." />
          <Toggle checked={settings.requirePartyApproval} onChange={(v) => setSettings({ requirePartyApproval: v })} title="Require approval for new parties" description="Student-created parties stay pending until approved." />
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Party leadership</label>
            <select value={settings.partyLeadershipElectionMode} onChange={(e) => setSettings({ partyLeadershipElectionMode: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="elected">Members elect leadership</option>
              <option value="teacher-assigned">Teacher assigns leadership</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeTab === "committees") {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setSettings({ enabledCommittees: [...allCommittees] })} className="text-sm font-medium text-blue-600">Select all</button>
            <button onClick={() => setSettings({ enabledCommittees: [] })} className="text-sm font-medium text-blue-600">Deselect all</button>
          </div>
          <div className="grid gap-3">
            {allCommittees.map((committee) => (
              <Toggle key={committee} checked={settings.enabledCommittees.includes(committee)} onChange={() => setSettings({ enabledCommittees: settings.enabledCommittees.includes(committee) ? settings.enabledCommittees.filter((c) => c !== committee) : [...settings.enabledCommittees, committee] })} title={committee} description="Enable this committee for bill referrals and membership." />
            ))}
          </div>
          <Toggle checked={settings.allowSelfJoinCommittees} onChange={(v) => setSettings({ allowSelfJoinCommittees: v })} title="Allow students to join committees on their own" description="When off, students submit preference rankings." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Assignment mode</label>
              <select value={settings.committeeAssignmentMode} onChange={(e) => setSettings({ committeeAssignmentMode: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="preference">Preference assigned</option>
                <option value="random">Random</option>
                <option value="self-join">Self join</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Chair selection</label>
              <select value={settings.chairElectionMode} onChange={(e) => setSettings({ chairElectionMode: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="elected">Committee vote</option>
                <option value="teacher-assigned">Teacher assigned</option>
              </select>
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === "bills") {
      return (
        <div className="space-y-5">
          <Toggle checked={settings.allowDrafts} onChange={(v) => setSettings({ allowDrafts: v })} title="Allow bill drafts" description="Students can save bills before submitting." />
          <Toggle checked={settings.committeeVoteRequired} onChange={(v) => setSettings({ committeeVoteRequired: v })} title="Require committee vote before reporting" description="Committees should vote before reporting bills." />
          <Toggle checked={settings.cosponsorAfterCommitteeReport} onChange={(v) => setSettings({ cosponsorAfterCommitteeReport: v })} title="Limit cosponsorship until report" description="Students can cosponsor or withdraw only after a committee report has been submitted." />
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Bill assignment authority</label>
            <select value={settings.billAssignmentAuthority} onChange={(e) => setSettings({ billAssignmentAuthority: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="teacher">Teacher only</option>
              <option value="leadership">Majority leadership</option>
              <option value="clerk">Clerk automatic</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeTab === "floor") {
      return (
        <div className="space-y-5">
          <Toggle checked={settings.floorResultsBinding} onChange={(v) => setSettings({ floorResultsBinding: v })} title="Floor vote results determine outcome" description="Passed/failed status is applied when votes close." />
          <Toggle checked={settings.showVoteResultsLive} onChange={(v) => setSettings({ showVoteResultsLive: v })} title="Show floor results live" description="Students can see vote totals as ballots come in." />
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Pass threshold</label>
            <select value={settings.floorVoteThreshold} onChange={(e) => setSettings({ floorVoteThreshold: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="simple-majority">Simple majority</option>
              <option value="absolute-majority">Majority of enrolled students</option>
              <option value="two-thirds">Two-thirds</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeTab === "leadership") {
      return (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Committee leadership</label>
            <select value={settings.chairElectionMode} onChange={(e) => setSettings({ chairElectionMode: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="elected">Members elect chair/ranking member</option>
              <option value="teacher-assigned">Teacher assigns roles</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Party leadership</label>
            <select value={settings.partyLeadershipElectionMode} onChange={(e) => setSettings({ partyLeadershipElectionMode: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="elected">Party members elect leadership</option>
              <option value="teacher-assigned">Teacher assigns roles</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeTab === "calendar") {
      return (
        <div className="space-y-5">
          <Toggle checked={settings.calendarAutoPublish} onChange={(v) => setSettings({ calendarAutoPublish: v })} title="Publish calendared bills immediately" description="Students see bills as soon as the teacher calendars them." />
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">Teachers calendar bills from the Floor Calendar page after committees report them.</div>
        </div>
      );
    }
    if (activeTab === "profiles") {
      return (
        <div className="space-y-5">
          <Toggle checked={settings.profileDistrictRequired} onChange={(v) => setSettings({ profileDistrictRequired: v })} title="Require constituency" description="Students should choose a district for their profile." />
          <Toggle checked={settings.profilePartyRequired} onChange={(v) => setSettings({ profilePartyRequired: v })} title="Require party" description="Students should choose or join a party." />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <Toggle checked={settings.notifyOnAnnouncements} onChange={(v) => setSettings({ notifyOnAnnouncements: v })} title="Announcement notifications" description="Class organization announcements can notify students." />
        <Toggle checked={settings.notifyOnCalendaredBills} onChange={(v) => setSettings({ notifyOnCalendaredBills: v })} title="Calendared bill notifications" description="Notify students when bills are placed on the floor calendar." />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Settings className="h-7 w-7 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Simulation Settings</h1>
          </div>
          <p className="mt-1 text-gray-600">Configure class-wide simulation rules and defaults.</p>
        </div>
        {loading ? <div className="mb-4 text-sm text-gray-600">Loading settings...</div> : null}

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${activeTab === id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold text-gray-900">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
            {section()}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-sm text-gray-600">{hasChanges ? <span className="font-medium text-amber-600">You have unsaved changes</span> : "Settings are saved"}</div>
          <div className="flex items-center gap-3">
            <button onClick={() => void handleSave()} disabled={!hasChanges} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Save className="h-4 w-4" />
              Save Settings
            </button>
            <button onClick={() => void handleSave()} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Send className="h-4 w-4" />
              Publish to Students
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
