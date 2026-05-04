import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router";
import { CheckSquare, FileText, Mail, Save, Settings, ShieldCheck, UserCog, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../utils/supabase";
import { defaultPartyColor } from "../components/PartyCreateForm";
import { ProfileLayoutEditor } from "./TeacherProfileLayoutEditor";

type TabId = "parties" | "committees" | "bills" | "organizations" | "elections" | "profiles" | "permissions" | "joining";

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
  { id: "organizations", label: "Organizations", icon: Users },
  { id: "elections", label: "Elections", icon: Vote },
  { id: "profiles", label: "Profiles", icon: UserCog },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "joining", label: "Joining & Invites", icon: Mail },
];

const setupTabIds: TabId[] = ["parties", "committees"];
const settingsTabIds: TabId[] = ["bills", "organizations", "elections", "profiles", "permissions", "joining"];

type AuthorityTag = { id: string; label: string; type: "teacher" | "role" | "member"; locked?: boolean };
type MemberOption = { id: string; name: string; email: string; role: string };

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (next: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
      <span>
        <span className="block text-base font-semibold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-600">{description}</span>
      </span>
    </label>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SettingSelect({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function WordLimitInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-base font-semibold text-gray-900">{label}</span>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(1, Number(event.target.value) || 1)))}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="mt-1 block text-xs text-gray-500">Maximum allowed: {max.toLocaleString()} words</span>
    </label>
  );
}

function TeacherSettingsPage({ mode }: { mode: "setup" | "settings" }) {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(mode === "setup" ? "parties" : "bills");
  const [activeClassId, setActiveClassId] = useState<string | null>(params.classId ?? null);
  const [hasChanges, setHasChanges] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [authoritySearch, setAuthoritySearch] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
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
    billAssignmentAuthorityTags: [] as AuthorityTag[],
    allowDrafts: true,
    billTabs: ["legislative text", "supporting text"] as string[],
    committeeVoteRequired: true,
    billsVotedAfterCommittee: true,
    committeeVotePassThresholdPct: 50,
    cosponsorshipMode: "always",
    showCosponsors: true,
    cosponsorAfterCommitteeReport: false,
    enableFloor: true,
    enableParties: true,
    enableCommittees: true,
    enableCaucuses: true,
    enableHouseLeadershipElection: true,
    enableOrganizationElections: true,
    houseLeadershipElectionMode: "student-vote",
    organizationElectionMode: "student-vote",
    calendarAutoPublish: true,
    floorResultsBinding: true,
    floorVoteThreshold: "simple-majority",
    showVoteResultsLive: true,
    profileDistrictRequired: true,
    profilePartyRequired: true,
    profilesEnabled: true,
    teacherPermissions: "full",
    studentPermissions: "standard",
    leadershipPermissions: "moderate",
    notifyOnAnnouncements: true,
    notifyOnCalendaredBills: true,
    requireJoinApproval: false,
    profileLongResponseWordLimit: 1000,
    billWordLimit: 5000,
    committeeReportWordLimit: 2000,
    organizationDescriptionWordLimit: 500,
    announcementWordLimit: 1000,
    commentWordLimit: 500,
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
        const classId = params.classId ?? (prof as any)?.class_id ?? null;
        setActiveClassId(classId);
        if (!classId) return;
        const [{ data: cls }, { data: memberships }] = await Promise.all([
          supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
          supabase
            .from("class_memberships")
            .select("user_id,email,role,status,profiles(display_name)")
            .eq("class_id", classId)
            .eq("status", "approved"),
        ]);
        const members = (memberships ?? []).map((row: any) => ({
          id: row.user_id,
          email: row.email ?? "",
          role: row.role ?? "student",
          name: row.profiles?.display_name ?? row.email ?? "Member",
        })) as MemberOption[];
        setMemberOptions(members);
        const teacherTags: AuthorityTag[] = members
          .filter((member) => member.role === "teacher")
          .map((member) => ({ id: member.id, label: member.name, type: "teacher" as const, locked: true }));
        const s = (cls as any)?.settings ?? {};
        const savedAuthorityTags = (s?.bills?.assignmentAuthorityTags ?? []) as AuthorityTag[];
        const mergedAuthorityTags = [
          ...teacherTags,
          ...savedAuthorityTags.filter((tag) => tag.type !== "teacher" && !teacherTags.some((teacher) => teacher.id === tag.id)),
        ];
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
          enableParties: s?.organizations?.enableParties ?? prev.enableParties,
          enableCommittees: s?.organizations?.enableCommittees ?? prev.enableCommittees,
          enableCaucuses: s?.organizations?.enableCaucuses ?? prev.enableCaucuses,
          partyLeadershipElectionMode: s?.parties?.leadershipElectionMode ?? prev.partyLeadershipElectionMode,
          billAssignmentAuthority: s?.bills?.assignmentAuthority ?? prev.billAssignmentAuthority,
          billAssignmentAuthorityTags: mergedAuthorityTags,
          allowDrafts: s?.bills?.allowDrafts ?? prev.allowDrafts,
          billTabs: s?.bills?.tabs ?? prev.billTabs,
          committeeVoteRequired: s?.bills?.committeeVoteRequired ?? prev.committeeVoteRequired,
          billsVotedAfterCommittee: s?.bills?.votedAfterCommittee ?? s?.bills?.committeeVoteRequired ?? prev.billsVotedAfterCommittee,
          committeeVotePassThresholdPct: s?.committees?.votePassThresholdPct ?? prev.committeeVotePassThresholdPct,
          cosponsorshipMode: s?.bills?.cosponsorshipMode ?? (s?.bills?.cosponsorAfterCommitteeReport ? "after_report" : prev.cosponsorshipMode),
          showCosponsors: s?.bills?.showCosponsors ?? prev.showCosponsors,
          cosponsorAfterCommitteeReport: s?.bills?.cosponsorAfterCommitteeReport ?? prev.cosponsorAfterCommitteeReport,
          enableFloor: s?.floor?.enabled ?? prev.enableFloor,
          calendarAutoPublish: s?.floor?.calendarAutoPublish ?? prev.calendarAutoPublish,
          floorResultsBinding: s?.floor?.binding ?? prev.floorResultsBinding,
          floorVoteThreshold: s?.floor?.voteThreshold ?? prev.floorVoteThreshold,
          showVoteResultsLive: s?.floor?.showVoteResultsLive ?? prev.showVoteResultsLive,
          enableHouseLeadershipElection: s?.elections?.houseLeadership?.enabled ?? prev.enableHouseLeadershipElection,
          enableOrganizationElections: s?.elections?.organizations?.enabled ?? prev.enableOrganizationElections,
          houseLeadershipElectionMode: s?.elections?.houseLeadership?.mode ?? prev.houseLeadershipElectionMode,
          organizationElectionMode: s?.elections?.organizations?.mode ?? prev.organizationElectionMode,
          profilesEnabled: s?.profiles?.enabled ?? prev.profilesEnabled,
          profileDistrictRequired: s?.profiles?.districtRequired ?? prev.profileDistrictRequired,
          profilePartyRequired: s?.profiles?.partyRequired ?? prev.profilePartyRequired,
          teacherPermissions: s?.permissions?.teacher ?? prev.teacherPermissions,
          studentPermissions: s?.permissions?.student ?? prev.studentPermissions,
          leadershipPermissions: s?.permissions?.leadership ?? prev.leadershipPermissions,
          notifyOnAnnouncements: s?.notifications?.announcements ?? prev.notifyOnAnnouncements,
          notifyOnCalendaredBills: s?.notifications?.calendaredBills ?? prev.notifyOnCalendaredBills,
          requireJoinApproval: s?.students?.requireJoinApproval ?? prev.requireJoinApproval,
          profileLongResponseWordLimit: s?.wordLimits?.profileLongResponse ?? prev.profileLongResponseWordLimit,
          billWordLimit: s?.wordLimits?.bill ?? prev.billWordLimit,
          committeeReportWordLimit: s?.wordLimits?.committeeReport ?? prev.committeeReportWordLimit,
          organizationDescriptionWordLimit: s?.wordLimits?.organizationDescription ?? prev.organizationDescriptionWordLimit,
          announcementWordLimit: s?.wordLimits?.announcement ?? prev.announcementWordLimit,
          commentWordLimit: s?.wordLimits?.comment ?? prev.commentWordLimit,
        }));
      } catch (e: any) {
        toast.error(e.message || "Could not load settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.classId]);

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
        ...(mode === "setup"
          ? {
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
              organizations: {
                ...(existing?.organizations ?? {}),
                enableParties: settings.enableParties,
                enableCommittees: settings.enableCommittees,
                enableCaucuses: settings.enableCaucuses,
              },
            }
          : {
              organizations: {
                ...(existing?.organizations ?? {}),
                enableParties: settings.enableParties,
                enableCommittees: settings.enableCommittees,
                enableCaucuses: settings.enableCaucuses,
              },
              parties: {
                ...(existing?.parties ?? {}),
                leadershipElectionMode: settings.partyLeadershipElectionMode,
              },
              committees: {
                ...(existing?.committees ?? {}),
                chairElectionMode: settings.chairElectionMode,
                chairVoteThresholdPct: settings.chairVoteThresholdPct,
                votePassThresholdPct: Math.min(100, Math.max(1, Number(settings.committeeVotePassThresholdPct) || 50)),
              },
              bills: {
                ...(existing?.bills ?? {}),
                assignmentAuthority: settings.billAssignmentAuthority,
                assignmentAuthorityTags: settings.billAssignmentAuthorityTags,
                allowDrafts: settings.allowDrafts,
                tabs: settings.billTabs,
                committeeVoteRequired: settings.committeeVoteRequired,
                votedAfterCommittee: settings.billsVotedAfterCommittee,
                cosponsorshipMode: settings.cosponsorshipMode,
                cosponsorAfterCommitteeReport: settings.cosponsorshipMode === "after_report",
                showCosponsors: settings.showCosponsors,
              },
              floor: {
                ...(existing?.floor ?? {}),
                enabled: settings.enableFloor,
                binding: settings.floorResultsBinding,
                voteThreshold: settings.floorVoteThreshold,
                showVoteResultsLive: settings.showVoteResultsLive,
                calendarAutoPublish: settings.calendarAutoPublish,
              },
              elections: {
                ...(existing?.elections ?? {}),
                houseLeadership: { ...(existing?.elections?.houseLeadership ?? {}), enabled: settings.enableHouseLeadershipElection, mode: settings.houseLeadershipElectionMode },
                organizations: { ...(existing?.elections?.organizations ?? {}), enabled: settings.enableOrganizationElections, mode: settings.organizationElectionMode },
              },
              profiles: {
                ...(existing?.profiles ?? {}),
                enabled: settings.profilesEnabled,
                districtRequired: settings.profileDistrictRequired,
                partyRequired: settings.profilePartyRequired,
              },
              permissions: {
                ...(existing?.permissions ?? {}),
                teacher: settings.teacherPermissions,
                student: settings.studentPermissions,
                leadership: settings.leadershipPermissions,
              },
              notifications: {
                ...(existing?.notifications ?? {}),
                announcements: settings.notifyOnAnnouncements,
                calendaredBills: settings.notifyOnCalendaredBills,
              },
              students: {
                ...(existing?.students ?? {}),
                requireJoinApproval: settings.requireJoinApproval,
              },
              wordLimits: {
                ...(existing?.wordLimits ?? {}),
                profileLongResponse: Math.min(2000, Math.max(1, Number(settings.profileLongResponseWordLimit) || 1000)),
                bill: Math.min(5000, Math.max(1, Number(settings.billWordLimit) || 5000)),
                committeeReport: Math.min(2000, Math.max(1, Number(settings.committeeReportWordLimit) || 2000)),
                organizationDescription: Math.min(500, Math.max(1, Number(settings.organizationDescriptionWordLimit) || 500)),
                announcement: Math.min(1000, Math.max(1, Number(settings.announcementWordLimit) || 1000)),
                comment: Math.min(500, Math.max(1, Number(settings.commentWordLimit) || 500)),
              },
            }),
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings }).eq("id", activeClassId);
      if (error) throw error;
      if (mode === "setup") await syncPartiesAndCommittees(activeClassId);
      toast.success("Settings saved");
      setHasChanges(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save settings");
    }
  };

  const inviteMember = async () => {
    if (!activeClassId || !inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      toast.error("please enter a valid email address");
      return;
    }
    setInviteBusy(true);
    try {
      const email = inviteEmail.trim();
      const [studentInvite, teacherInvite] = await Promise.all([
        supabase.rpc("invite_student_to_class", { target_class: activeClassId, student_email: email }),
        supabase.rpc("invite_teacher_to_class", { target_class: activeClassId, teacher_email: email }),
      ]);
      if (studentInvite.error && teacherInvite.error && studentInvite.error.message === "EMAIL_REQUIRED") throw studentInvite.error;
      toast.success("invitation sent if user exists");
      setInviteEmail("");
    } catch (e: any) {
      toast.error(e.message === "EMAIL_REQUIRED" ? "please enter a valid email address" : "invitation sent if user exists");
    } finally {
      setInviteBusy(false);
    }
  };

  const addAuthorityTag = (tag: AuthorityTag) => {
    if (settings.billAssignmentAuthorityTags.some((item) => item.id === tag.id && item.type === tag.type)) return;
    setSettings({ billAssignmentAuthorityTags: [...settings.billAssignmentAuthorityTags, tag] });
    setAuthoritySearch("");
  };

  const removeAuthorityTag = (tag: AuthorityTag) => {
    if (tag.locked) return;
    setSettings({ billAssignmentAuthorityTags: settings.billAssignmentAuthorityTags.filter((item) => !(item.id === tag.id && item.type === tag.type)) });
  };

  const authorityCandidates = [
    { id: "committee-chair", label: "Committee chairs", type: "role" as const },
    { id: "ranking-member", label: "Ranking members", type: "role" as const },
    { id: "party-leadership", label: "Party leadership", type: "role" as const },
    ...memberOptions
      .filter((member) => member.role !== "teacher")
      .map((member) => ({ id: member.id, label: member.name, type: "member" as const })),
  ].filter((tag) => tag.label.toLowerCase().includes(authoritySearch.trim().toLowerCase()));

  const section = () => {
    if (activeTab === "parties") {
      return (
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-base font-semibold text-gray-900">Allowed Parties</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {allParties.map((party) => (
                <Toggle key={party} checked={settings.allowedParties.includes(party)} onChange={() => setSettings({ allowedParties: settings.allowedParties.includes(party) ? settings.allowedParties.filter((p) => p !== party) : [...settings.allowedParties, party] })} title={party} description="Create and approve this party for the class." />
              ))}
            </div>
          </div>
          <Toggle checked={settings.allowStudentCreatedParties} onChange={(v) => setSettings({ allowStudentCreatedParties: v })} title="Allow student-created parties" description="Students can propose custom parties from the organizations area." />
          <Toggle checked={settings.requirePartyApproval} onChange={(v) => setSettings({ requirePartyApproval: v })} title="Require approval for new parties" description="Student-created parties stay pending until approved." />
          <div>
            <label className="mb-2 block text-base font-semibold text-gray-900">Party leadership</label>
            <SettingSelect value={settings.partyLeadershipElectionMode} onValueChange={(value) => setSettings({ partyLeadershipElectionMode: value })}>
              <SelectItem value="elected">Members elect leadership</SelectItem>
              <SelectItem value="teacher-assigned">Teacher assigns leadership</SelectItem>
            </SettingSelect>
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
              <label className="mb-2 block text-base font-semibold text-gray-900">Assignment mode</label>
              <SettingSelect value={settings.committeeAssignmentMode} onValueChange={(value) => setSettings({ committeeAssignmentMode: value })}>
                <SelectItem value="preference">Preference assigned</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="self-join">Self join</SelectItem>
              </SettingSelect>
            </div>
            <div>
              <label className="mb-2 block text-base font-semibold text-gray-900">Chair selection</label>
              <SettingSelect value={settings.chairElectionMode} onValueChange={(value) => setSettings({ chairElectionMode: value })}>
                <SelectItem value="elected">Committee vote</SelectItem>
                <SelectItem value="teacher-assigned">Teacher assigned</SelectItem>
              </SettingSelect>
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === "bills") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Text">
            <Toggle checked={settings.allowDrafts} onChange={(v) => setSettings({ allowDrafts: v })} title="Allow bill drafts" description="Students can save bills before submitting." />
            <WordLimitInput label="Bill word limit" value={settings.billWordLimit} max={5000} onChange={(value) => setSettings({ billWordLimit: value })} />
          </SettingsGroup>
          <SettingsGroup title="Cosponsorship">
            <div>
              <label className="mb-2 block text-base font-semibold text-gray-900">Allow cosponsorship</label>
              <SettingSelect value={settings.cosponsorshipMode} onValueChange={(value) => setSettings({ cosponsorshipMode: value, cosponsorAfterCommitteeReport: value === "after_report" })}>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="before_report">Before the bill is reported from committee</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SettingSelect>
            </div>
            <Toggle checked={settings.showCosponsors} onChange={(v) => setSettings({ showCosponsors: v })} title="Show cosponsors" description="Display cosponsors on bill pages and lists." />
          </SettingsGroup>
          <SettingsGroup title="Floor">
            <Toggle checked={settings.enableFloor} onChange={(v) => setSettings({ enableFloor: v })} title="Enable floor" description="Use the floor page for debate queues and final votes." />
            <Toggle checked={settings.floorResultsBinding} onChange={(v) => setSettings({ floorResultsBinding: v })} title="Floor vote results determine outcome" description="Passed or failed status is applied when floor votes are posted." />
            <div>
              <label className="mb-2 block text-base font-semibold text-gray-900">Floor pass threshold</label>
              <SettingSelect value={settings.floorVoteThreshold} onValueChange={(value) => setSettings({ floorVoteThreshold: value })}>
                <SelectItem value="simple-majority">Simple majority</SelectItem>
                <SelectItem value="absolute-majority">Majority of enrolled students</SelectItem>
                <SelectItem value="two-thirds">Two-thirds</SelectItem>
              </SettingSelect>
            </div>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "organizations") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Available organizations">
            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle checked={settings.enableParties} onChange={(v) => setSettings({ enableParties: v })} title="Enable parties" description="Students can join parties and use party spaces." />
              <Toggle checked={settings.enableCommittees} onChange={(v) => setSettings({ enableCommittees: v })} title="Enable committees" description="Students can review and vote on referred bills." />
              <Toggle checked={settings.enableCaucuses} onChange={(v) => setSettings({ enableCaucuses: v })} title="Enable caucuses" description="Students can form caucuses and post announcements." />
            </div>
          </SettingsGroup>
          <SettingsGroup title="Text limits">
            <div className="grid gap-4 sm:grid-cols-2">
              <WordLimitInput label="Name and description word limit" value={settings.organizationDescriptionWordLimit} max={500} onChange={(value) => setSettings({ organizationDescriptionWordLimit: value })} />
              <WordLimitInput label="Committee report word limit" value={settings.committeeReportWordLimit} max={2000} onChange={(value) => setSettings({ committeeReportWordLimit: value })} />
              <WordLimitInput label="Announcement word limit" value={settings.announcementWordLimit} max={1000} onChange={(value) => setSettings({ announcementWordLimit: value })} />
              <WordLimitInput label="Comment word limit" value={settings.commentWordLimit} max={500} onChange={(value) => setSettings({ commentWordLimit: value })} />
            </div>
          </SettingsGroup>
          <SettingsGroup title="Bill assignment authority">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                {settings.billAssignmentAuthorityTags.map((tag) => (
                  <button
                    key={`${tag.type}:${tag.id}`}
                    type="button"
                    onClick={() => removeAuthorityTag(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${tag.locked ? "cursor-default bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {tag.label}{tag.locked ? "" : " x"}
                  </button>
                ))}
                <input value={authoritySearch} onChange={(event) => setAuthoritySearch(event.target.value)} placeholder="Add committee roles or people..." className="min-w-[14rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none" />
              </div>
              {authoritySearch.trim() && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                  {authorityCandidates.length ? authorityCandidates.slice(0, 8).map((tag) => (
                    <button key={`${tag.type}:${tag.id}`} type="button" onClick={() => addAuthorityTag(tag)} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">
                      {tag.label}
                    </button>
                  )) : <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
                </div>
              )}
            </div>
          </SettingsGroup>
          <SettingsGroup title="Committee voting">
            <Toggle checked={settings.billsVotedAfterCommittee} onChange={(v) => setSettings({ billsVotedAfterCommittee: v, committeeVoteRequired: v })} title="Bills are voted on after committee review" description="Committee members vote before a bill can be reported." />
            <div>
              <label className="mb-1 block text-base font-semibold text-gray-900">Committee vote pass threshold</label>
              <input type="number" min={1} max={100} value={settings.committeeVotePassThresholdPct} onChange={(event) => setSettings({ committeeVotePassThresholdPct: Math.min(100, Math.max(1, Number(event.target.value) || 50)) })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "elections") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="House leadership election">
            <Toggle checked={settings.enableHouseLeadershipElection} onChange={(v) => setSettings({ enableHouseLeadershipElection: v })} title="Enable House leadership election" description="Students can vote for Speaker of the House from the floor page." />
            <SettingSelect value={settings.houseLeadershipElectionMode} onValueChange={(value) => setSettings({ houseLeadershipElectionMode: value })}>
              <SelectItem value="student-vote">Student vote</SelectItem>
              <SelectItem value="teacher-posted">Teacher posts result</SelectItem>
            </SettingSelect>
          </SettingsGroup>
          <SettingsGroup title="Organization elections">
            <Toggle checked={settings.enableOrganizationElections} onChange={(v) => setSettings({ enableOrganizationElections: v })} title="Enable organization elections" description="Parties, committees, and caucuses can run their leadership elections." />
            <SettingSelect value={settings.organizationElectionMode} onValueChange={(value) => setSettings({ organizationElectionMode: value })}>
              <SelectItem value="student-vote">Members vote</SelectItem>
              <SelectItem value="teacher-posted">Teacher posts result</SelectItem>
            </SettingSelect>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "profiles") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Profile availability">
            <Toggle checked={settings.profilesEnabled} onChange={(v) => setSettings({ profilesEnabled: v })} title="Enable profiles" description="Students can view and complete profile sections." />
            <WordLimitInput label="Profile long response word limit" value={settings.profileLongResponseWordLimit} max={2000} onChange={(value) => setSettings({ profileLongResponseWordLimit: value })} />
          </SettingsGroup>
          <SettingsGroup title="Profile layout editor">
            <ProfileLayoutEditor embedded />
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "permissions") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Role permissions">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-base font-semibold text-gray-900">Teachers</label>
                <SettingSelect value={settings.teacherPermissions} onValueChange={(value) => setSettings({ teacherPermissions: value })}>
                  <SelectItem value="full">Full control</SelectItem>
                  <SelectItem value="moderate">Moderation only</SelectItem>
                </SettingSelect>
              </div>
              <div>
                <label className="mb-2 block text-base font-semibold text-gray-900">Students</label>
                <SettingSelect value={settings.studentPermissions} onValueChange={(value) => setSettings({ studentPermissions: value })}>
                  <SelectItem value="standard">Standard participation</SelectItem>
                  <SelectItem value="restricted">Read and vote only</SelectItem>
                </SettingSelect>
              </div>
              <div>
                <label className="mb-2 block text-base font-semibold text-gray-900">Organization leadership</label>
                <SettingSelect value={settings.leadershipPermissions} onValueChange={(value) => setSettings({ leadershipPermissions: value })}>
                  <SelectItem value="moderate">Moderate organization spaces</SelectItem>
                  <SelectItem value="post-only">Post announcements only</SelectItem>
                  <SelectItem value="standard">Same as members</SelectItem>
                </SettingSelect>
              </div>
            </div>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "joining") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Joining">
            <Toggle checked={settings.requireJoinApproval} onChange={(v) => setSettings({ requireJoinApproval: v })} title="Require student join approval" description="New students appear in the pending roster until approved." />
          </SettingsGroup>
          <SettingsGroup title="Invite member">
            <div className="flex max-w-xl gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="member@email.com"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => void inviteMember()} disabled={inviteBusy || !inviteEmail.trim() || !activeClassId} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Invite
              </button>
            </div>
          </SettingsGroup>
        </div>
      );
    }
    return null;
  };

  const visibleTabs = tabs.filter((tab) => (mode === "setup" ? setupTabIds.includes(tab.id) : settingsTabIds.includes(tab.id)));
  const heading = mode === "setup" ? "Set Up Class" : "Simulation Settings";
  const description = mode === "setup" ? "Choose the default parties and committees for this class." : "Configure class-wide simulation rules and defaults.";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="h-7 w-7 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>
              <p className="mt-1 text-gray-600">{description}</p>
            </div>
          </div>
          {mode === "settings" && <TeacherClassTabs classId={activeClassId} active="settings" />}
        </div>
        {loading ? <div className="mb-4 text-sm text-gray-600">Loading settings...</div> : null}

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${activeTab === id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold text-gray-900">{visibleTabs.find((tab) => tab.id === activeTab)?.label}</h2>
            {section()}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-end px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => void handleSave()} disabled={!hasChanges} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeacherSetup() {
  return <TeacherSettingsPage mode="setup" />;
}

export function SimulationSettings() {
  return <TeacherSettingsPage mode="settings" />;
}
