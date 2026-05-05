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
  { id: "joining", label: "Joins and Invites", icon: Mail },
];

const setupTabIds: TabId[] = ["parties", "committees"];
const settingsTabIds: TabId[] = ["bills", "organizations", "elections", "profiles", "permissions", "joining"];

type AuthorityTag = { id: string; label: string; type: "teacher" | "role" | "member"; locked?: boolean };
type MemberOption = { id: string; name: string; email: string; role: string };

function Toggle({ checked, onChange, title, description, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; title: string; description?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 rounded-lg p-2 transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"} disabled:cursor-not-allowed`}
        aria-pressed={checked}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-gray-900">{title}</span>
        {description && <span className="block text-sm text-gray-600">{description}</span>}
      </span>
    </label>
  );
}

function SwitchControl({ checked, onChange, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"} disabled:cursor-not-allowed disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function SettingsGroup({ title, children, disabled = false, action }: { title: string; children: ReactNode; disabled?: boolean; action?: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`space-y-4 ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>
    </section>
  );
}

function SettingRow({ title, description, control }: { title: string; description?: string; control: ReactNode }) {
  return (
    <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <div className="text-base font-semibold text-gray-900">{title}</div>
        {description && <div className="text-sm text-gray-600">{description}</div>}
      </div>
      <div className="md:justify-self-start">{control}</div>
    </div>
  );
}

function DisabledBlock({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return <div className={`space-y-4 ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>;
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
    <label className="block max-w-52">
      {label && <span className="mb-1 block text-base font-semibold text-gray-900">{label}</span>}
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(1, Number(event.target.value) || 1)))}
        className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
    enableOrganizations: true,
    billAssignmentAuthorityMode: "teacher",
    announcementBoardsEnabled: true,
    announcementCommentsEnabled: true,
    announcementEmotesEnabled: true,
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
    studentCanCreateBills: true,
    studentCanComment: true,
    studentCanReact: true,
    allOrganizationsCanPost: true,
    allOrganizationsCanComment: true,
    partiesCanElectLeaders: true,
    partiesCanPostAnnouncements: true,
    committeesCanEditBills: true,
    committeesCanVoteBills: true,
    caucusesCanPostAnnouncements: true,
    caucusesCanElectLeaders: true,
    speakerCanReferBills: true,
    speakerCanCalendarBills: true,
    majorityWhipCanManageParty: true,
    minorityWhipCanManageParty: true,
    committeeChairCanManageCommittee: true,
    committeeRankingMemberCanManageCommittee: true,
    caucusChairCanManageCaucus: true,
    caucusCoChairCanManageCaucus: true,
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
          enableOrganizations: s?.organizations?.enabled ?? prev.enableOrganizations,
          partyLeadershipElectionMode: s?.parties?.leadershipElectionMode ?? prev.partyLeadershipElectionMode,
          billAssignmentAuthority: s?.bills?.assignmentAuthority ?? prev.billAssignmentAuthority,
          billAssignmentAuthorityMode: s?.bills?.assignmentAuthorityMode ?? prev.billAssignmentAuthorityMode,
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
          studentCanCreateBills: s?.permissions?.students?.createBills ?? prev.studentCanCreateBills,
          studentCanComment: s?.permissions?.students?.comment ?? prev.studentCanComment,
          studentCanReact: s?.permissions?.students?.react ?? prev.studentCanReact,
          allOrganizationsCanPost: s?.permissions?.allOrganizations?.postAnnouncements ?? prev.allOrganizationsCanPost,
          allOrganizationsCanComment: s?.permissions?.allOrganizations?.comment ?? prev.allOrganizationsCanComment,
          partiesCanElectLeaders: s?.permissions?.parties?.electLeaders ?? prev.partiesCanElectLeaders,
          partiesCanPostAnnouncements: s?.permissions?.parties?.postAnnouncements ?? prev.partiesCanPostAnnouncements,
          committeesCanEditBills: s?.permissions?.committees?.editBills ?? prev.committeesCanEditBills,
          committeesCanVoteBills: s?.permissions?.committees?.voteBills ?? prev.committeesCanVoteBills,
          caucusesCanPostAnnouncements: s?.permissions?.caucuses?.postAnnouncements ?? prev.caucusesCanPostAnnouncements,
          caucusesCanElectLeaders: s?.permissions?.caucuses?.electLeaders ?? prev.caucusesCanElectLeaders,
          announcementBoardsEnabled: s?.organizations?.announcementBoards?.enabled ?? prev.announcementBoardsEnabled,
          announcementCommentsEnabled: s?.organizations?.announcementBoards?.comments ?? prev.announcementCommentsEnabled,
          announcementEmotesEnabled: s?.organizations?.announcementBoards?.emotes ?? prev.announcementEmotesEnabled,
          speakerCanReferBills: s?.permissions?.speaker?.referBills ?? prev.speakerCanReferBills,
          speakerCanCalendarBills: s?.permissions?.speaker?.calendarBills ?? prev.speakerCanCalendarBills,
          majorityWhipCanManageParty: s?.permissions?.majorityWhip?.manageParty ?? prev.majorityWhipCanManageParty,
          minorityWhipCanManageParty: s?.permissions?.minorityWhip?.manageParty ?? prev.minorityWhipCanManageParty,
          committeeChairCanManageCommittee: s?.permissions?.committeeChair?.manageCommittee ?? prev.committeeChairCanManageCommittee,
          committeeRankingMemberCanManageCommittee: s?.permissions?.committeeRankingMember?.manageCommittee ?? prev.committeeRankingMemberCanManageCommittee,
          caucusChairCanManageCaucus: s?.permissions?.caucusChair?.manageCaucus ?? prev.caucusChairCanManageCaucus,
          caucusCoChairCanManageCaucus: s?.permissions?.caucusCoChair?.manageCaucus ?? prev.caucusCoChairCanManageCaucus,
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

  useEffect(() => {
    const markDirty = () => setHasChanges(true);
    window.addEventListener("gavel:profile-layout-dirty", markDirty);
    return () => window.removeEventListener("gavel:profile-layout-dirty", markDirty);
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
                enabled: settings.enableOrganizations,
                enableParties: settings.enableParties,
                enableCommittees: settings.enableCommittees,
                enableCaucuses: settings.enableCaucuses,
              },
            }
          : {
              organizations: {
                ...(existing?.organizations ?? {}),
                enabled: settings.enableOrganizations,
                enableParties: settings.enableParties,
                enableCommittees: settings.enableCommittees,
                enableCaucuses: settings.enableCaucuses,
                announcementBoards: {
                  ...(existing?.organizations?.announcementBoards ?? {}),
                  enabled: settings.announcementBoardsEnabled,
                  comments: settings.announcementCommentsEnabled,
                  emotes: settings.announcementEmotesEnabled,
                },
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
                assignmentAuthorityMode: settings.billAssignmentAuthorityMode,
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
                students: {
                  ...(existing?.permissions?.students ?? {}),
                  createBills: settings.studentCanCreateBills,
                  comment: settings.studentCanComment,
                  react: settings.studentCanReact,
                },
                allOrganizations: {
                  ...(existing?.permissions?.allOrganizations ?? {}),
                  postAnnouncements: settings.allOrganizationsCanPost,
                  comment: settings.allOrganizationsCanComment,
                },
                parties: {
                  ...(existing?.permissions?.parties ?? {}),
                  electLeaders: settings.partiesCanElectLeaders,
                  postAnnouncements: settings.partiesCanPostAnnouncements,
                },
                committees: {
                  ...(existing?.permissions?.committees ?? {}),
                  editBills: settings.committeesCanEditBills,
                  voteBills: settings.committeesCanVoteBills,
                },
                caucuses: {
                  ...(existing?.permissions?.caucuses ?? {}),
                  postAnnouncements: settings.caucusesCanPostAnnouncements,
                  electLeaders: settings.caucusesCanElectLeaders,
                },
                speaker: {
                  ...(existing?.permissions?.speaker ?? {}),
                  referBills: settings.speakerCanReferBills,
                  calendarBills: settings.speakerCanCalendarBills,
                },
                majorityWhip: {
                  ...(existing?.permissions?.majorityWhip ?? {}),
                  manageParty: settings.majorityWhipCanManageParty,
                },
                minorityWhip: {
                  ...(existing?.permissions?.minorityWhip ?? {}),
                  manageParty: settings.minorityWhipCanManageParty,
                },
                committeeChair: {
                  ...(existing?.permissions?.committeeChair ?? {}),
                  manageCommittee: settings.committeeChairCanManageCommittee,
                },
                committeeRankingMember: {
                  ...(existing?.permissions?.committeeRankingMember ?? {}),
                  manageCommittee: settings.committeeRankingMemberCanManageCommittee,
                },
                caucusChair: {
                  ...(existing?.permissions?.caucusChair ?? {}),
                  manageCaucus: settings.caucusChairCanManageCaucus,
                },
                caucusCoChair: {
                  ...(existing?.permissions?.caucusCoChair ?? {}),
                  manageCaucus: settings.caucusCoChairCanManageCaucus,
                },
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
      window.dispatchEvent(new CustomEvent("gavel:save-profile-layout"));
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
    { id: "speaker-of-the-house", label: "Speaker of the House", type: "role" as const },
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
          <SettingsGroup title="Text" action={<SwitchControl checked={settings.allowDrafts} onChange={(v) => setSettings({ allowDrafts: v })} />}>
            <div className="text-sm text-gray-600">Students can save bills before submitting.</div>
            <DisabledBlock disabled={!settings.allowDrafts}>
              <WordLimitInput label="Bill word limit" value={settings.billWordLimit} max={5000} onChange={(value) => setSettings({ billWordLimit: value })} />
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup
            title="Cosponsorship"
            action={
              <div className="w-64">
                <SettingSelect value={settings.cosponsorshipMode} onValueChange={(value) => setSettings({ cosponsorshipMode: value, cosponsorAfterCommitteeReport: value === "after_report" })}>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="before_report">Before the bill is reported from committee</SelectItem>
                <SelectItem value="never">Never</SelectItem>
                </SettingSelect>
              </div>
            }
          >
            <Toggle checked={settings.showCosponsors} onChange={(v) => setSettings({ showCosponsors: v })} disabled={settings.cosponsorshipMode === "never"} title="Show cosponsors" description="Display cosponsors on bill pages and lists." />
          </SettingsGroup>
          <SettingsGroup title="Floor" action={<SwitchControl checked={settings.enableFloor} onChange={(v) => setSettings({ enableFloor: v })} />}>
            <div className="text-sm text-gray-600">Use the floor page for debate queues and final votes.</div>
            <DisabledBlock disabled={!settings.enableFloor}>
              <Toggle checked={settings.floorResultsBinding} onChange={(v) => setSettings({ floorResultsBinding: v })} title="Floor vote results determine outcome" description="Passed or failed status is applied when floor votes are posted." />
              <div>
                <label className="mb-2 block text-base font-semibold text-gray-900">Floor pass threshold</label>
                <SettingSelect value={settings.floorVoteThreshold} onValueChange={(value) => setSettings({ floorVoteThreshold: value })}>
                  <SelectItem value="simple-majority">Simple majority</SelectItem>
                  <SelectItem value="absolute-majority">Majority of enrolled students</SelectItem>
                  <SelectItem value="two-thirds">Two-thirds</SelectItem>
                </SettingSelect>
              </div>
            </DisabledBlock>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "organizations") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Organizations" action={<SwitchControl checked={settings.enableOrganizations} onChange={(v) => setSettings({ enableOrganizations: v, enableParties: v, enableCommittees: v, enableCaucuses: v })} />}>
            <div className="text-sm text-gray-600">Turn parties, committees, and caucuses on or off for this class.</div>
            <DisabledBlock disabled={!settings.enableOrganizations}>
              <SettingRow
                title="Organization name and description word limit"
                description="Applies to organization names and about sections."
                control={<WordLimitInput label="" value={settings.organizationDescriptionWordLimit} max={500} onChange={(value) => setSettings({ organizationDescriptionWordLimit: value })} />}
              />
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Parties" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableParties} onChange={(v) => setSettings({ enableParties: v })} disabled={!settings.enableOrganizations} />}>
            <div className="text-sm text-gray-600">Students can join parties and use party spaces.</div>
          </SettingsGroup>
          <SettingsGroup title="Committees" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableCommittees} onChange={(v) => setSettings({ enableCommittees: v })} disabled={!settings.enableOrganizations} />}>
            <DisabledBlock disabled={!settings.enableCommittees}>
              <SettingRow title="Committee report word limit" description="Maximum words allowed in submitted committee reports." control={<WordLimitInput label="" value={settings.committeeReportWordLimit} max={2000} onChange={(value) => setSettings({ committeeReportWordLimit: value })} />} />
              <SettingRow
                title="Bill assignment authority"
                description="Choose who can assign or refer bills to committees."
                control={
                  <SettingSelect value={settings.billAssignmentAuthorityMode} onValueChange={(value) => setSettings({ billAssignmentAuthorityMode: value, billAssignmentAuthority: value })}>
                    <SelectItem value="teacher">Teachers only</SelectItem>
                    <SelectItem value="speaker">Speaker of the House</SelectItem>
                    <SelectItem value="individuals">Teachers and selected individuals</SelectItem>
                  </SettingSelect>
                }
              />
              {settings.billAssignmentAuthorityMode === "individuals" && (
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
                    <input value={authoritySearch} onChange={(event) => setAuthoritySearch(event.target.value)} placeholder="Add Speaker of the House or individuals..." className="min-w-[14rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none" />
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
              )}
              <SettingRow title="Committee voting" description="Bills are voted on after committee review." control={<SwitchControl checked={settings.billsVotedAfterCommittee} onChange={(v) => setSettings({ billsVotedAfterCommittee: v, committeeVoteRequired: v })} />} />
              <DisabledBlock disabled={!settings.billsVotedAfterCommittee}>
                <SettingRow title="Committee vote pass threshold" description="Percentage of votes needed to report a bill." control={<input type="number" min={1} max={100} value={settings.committeeVotePassThresholdPct} onChange={(event) => setSettings({ committeeVotePassThresholdPct: Math.min(100, Math.max(1, Number(event.target.value) || 50)) })} className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />} />
              </DisabledBlock>
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Caucuses" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableCaucuses} onChange={(v) => setSettings({ enableCaucuses: v })} disabled={!settings.enableOrganizations} />}>
            <div className="text-sm text-gray-600">Students can form caucuses and post announcements.</div>
          </SettingsGroup>
          <SettingsGroup title="Announcement boards" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.announcementBoardsEnabled} onChange={(v) => setSettings({ announcementBoardsEnabled: v })} disabled={!settings.enableOrganizations} />}>
            <DisabledBlock disabled={!settings.announcementBoardsEnabled}>
              <SettingRow title="Announcement word limit" description="Maximum words allowed in announcements." control={<WordLimitInput label="" value={settings.announcementWordLimit} max={1000} onChange={(value) => setSettings({ announcementWordLimit: value })} />} />
              <SettingRow title="Comment word limit" description="Maximum words allowed in announcement comments." control={<WordLimitInput label="" value={settings.commentWordLimit} max={500} onChange={(value) => setSettings({ commentWordLimit: value })} />} />
              <SettingRow title="Enable comments" description="Members can comment on announcement boards." control={<SwitchControl checked={settings.announcementCommentsEnabled} onChange={(v) => setSettings({ announcementCommentsEnabled: v })} />} />
              <SettingRow title="Enable emotes" description="Members can react to announcements and comments." control={<SwitchControl checked={settings.announcementEmotesEnabled} onChange={(v) => setSettings({ announcementEmotesEnabled: v })} />} />
            </DisabledBlock>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "elections") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="House leadership election" action={<SwitchControl checked={settings.enableHouseLeadershipElection} onChange={(v) => setSettings({ enableHouseLeadershipElection: v })} />}>
            <div className="text-sm text-gray-600">Students can vote for Speaker of the House from the floor page.</div>
            <DisabledBlock disabled={!settings.enableHouseLeadershipElection}>
              <SettingSelect value={settings.houseLeadershipElectionMode} onValueChange={(value) => setSettings({ houseLeadershipElectionMode: value })}>
                <SelectItem value="student-vote">Student vote</SelectItem>
                <SelectItem value="teacher-posted">Teacher posts result</SelectItem>
              </SettingSelect>
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Organization elections" action={<SwitchControl checked={settings.enableOrganizationElections} onChange={(v) => setSettings({ enableOrganizationElections: v })} />}>
            <div className="text-sm text-gray-600">Parties, committees, and caucuses can run their leadership elections.</div>
            <DisabledBlock disabled={!settings.enableOrganizationElections}>
              <SettingSelect value={settings.organizationElectionMode} onValueChange={(value) => setSettings({ organizationElectionMode: value })}>
                <SelectItem value="student-vote">Members vote</SelectItem>
                <SelectItem value="teacher-posted">Teacher posts result</SelectItem>
              </SettingSelect>
            </DisabledBlock>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "profiles") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Profiles" action={<SwitchControl checked={settings.profilesEnabled} onChange={(v) => setSettings({ profilesEnabled: v })} />}>
            <div className="text-sm text-gray-600">Students can view and complete profile sections.</div>
            <DisabledBlock disabled={!settings.profilesEnabled}>
              <WordLimitInput label="Profile long response word limit" value={settings.profileLongResponseWordLimit} max={2000} onChange={(value) => setSettings({ profileLongResponseWordLimit: value })} />
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Profile layout editor" disabled={!settings.profilesEnabled}>
            <ProfileLayoutEditor embedded />
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "permissions") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Students">
            <Toggle checked={settings.studentCanCreateBills} onChange={(v) => setSettings({ studentCanCreateBills: v })} title="Create bills" />
            <Toggle checked={settings.studentCanComment} onChange={(v) => setSettings({ studentCanComment: v })} title="Comment in allowed spaces" />
            <Toggle checked={settings.studentCanReact} onChange={(v) => setSettings({ studentCanReact: v })} title="React to announcements and comments" />
          </SettingsGroup>
          <SettingsGroup title="All organizations">
            <Toggle checked={settings.allOrganizationsCanPost} onChange={(v) => setSettings({ allOrganizationsCanPost: v })} title="Post announcements" />
            <Toggle checked={settings.allOrganizationsCanComment} onChange={(v) => setSettings({ allOrganizationsCanComment: v })} title="Comment on announcements" />
          </SettingsGroup>
          <SettingsGroup title="Parties" disabled={!settings.enableParties}>
            <Toggle checked={settings.partiesCanElectLeaders} onChange={(v) => setSettings({ partiesCanElectLeaders: v })} title="Run leadership elections" />
            <Toggle checked={settings.partiesCanPostAnnouncements} onChange={(v) => setSettings({ partiesCanPostAnnouncements: v })} title="Post party announcements" />
          </SettingsGroup>
          <SettingsGroup title="Committees" disabled={!settings.enableCommittees}>
            <Toggle checked={settings.committeesCanEditBills} onChange={(v) => setSettings({ committeesCanEditBills: v })} title="Edit referred bills" />
            <Toggle checked={settings.committeesCanVoteBills} onChange={(v) => setSettings({ committeesCanVoteBills: v })} title="Vote on referred bills" />
          </SettingsGroup>
          <SettingsGroup title="Caucuses" disabled={!settings.enableCaucuses}>
            <Toggle checked={settings.caucusesCanPostAnnouncements} onChange={(v) => setSettings({ caucusesCanPostAnnouncements: v })} title="Post caucus announcements" />
            <Toggle checked={settings.caucusesCanElectLeaders} onChange={(v) => setSettings({ caucusesCanElectLeaders: v })} title="Run caucus elections" />
          </SettingsGroup>
          <SettingsGroup title="Speaker of the House">
            <Toggle checked={settings.speakerCanReferBills} onChange={(v) => setSettings({ speakerCanReferBills: v })} title="Refer bills to committees" />
            <Toggle checked={settings.speakerCanCalendarBills} onChange={(v) => setSettings({ speakerCanCalendarBills: v })} title="Calendar bills" />
          </SettingsGroup>
          <SettingsGroup title="Majority Whip" disabled={!settings.enableParties}>
            <Toggle checked={settings.majorityWhipCanManageParty} onChange={(v) => setSettings({ majorityWhipCanManageParty: v })} title="Perform party administrative actions" />
          </SettingsGroup>
          <SettingsGroup title="Minority Whip" disabled={!settings.enableParties}>
            <Toggle checked={settings.minorityWhipCanManageParty} onChange={(v) => setSettings({ minorityWhipCanManageParty: v })} title="Perform party administrative actions" />
          </SettingsGroup>
          <SettingsGroup title="Committee Chair" disabled={!settings.enableCommittees}>
            <Toggle checked={settings.committeeChairCanManageCommittee} onChange={(v) => setSettings({ committeeChairCanManageCommittee: v })} title="Perform committee administrative actions" />
          </SettingsGroup>
          <SettingsGroup title="Committee Ranking Member" disabled={!settings.enableCommittees}>
            <Toggle checked={settings.committeeRankingMemberCanManageCommittee} onChange={(v) => setSettings({ committeeRankingMemberCanManageCommittee: v })} title="Perform committee administrative actions" />
          </SettingsGroup>
          <SettingsGroup title="Caucus Chair" disabled={!settings.enableCaucuses}>
            <Toggle checked={settings.caucusChairCanManageCaucus} onChange={(v) => setSettings({ caucusChairCanManageCaucus: v })} title="Perform caucus administrative actions" />
          </SettingsGroup>
          <SettingsGroup title="Caucus Co-Chair" disabled={!settings.enableCaucuses}>
            <Toggle checked={settings.caucusCoChairCanManageCaucus} onChange={(v) => setSettings({ caucusCoChairCanManageCaucus: v })} title="Perform caucus administrative actions" />
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "joining") {
      return (
        <div className="space-y-6">
          <SettingsGroup title="Joining">
            <Toggle checked={settings.requireJoinApproval} onChange={(v) => setSettings({ requireJoinApproval: v })} title="Members must be approved before entering class" description="New members appear in the pending roster until approved." />
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
