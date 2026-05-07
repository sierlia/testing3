import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router";
import { Check, CheckSquare, Copy, FileText, Mail, Save, Settings, ShieldCheck, UserCog, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../utils/supabase";
import { defaultPartyColor } from "../components/PartyCreateForm";
import { ProfileLayoutEditor } from "./TeacherProfileLayoutEditor";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

type TabId = "general" | "parties" | "committees" | "bills" | "organizations" | "elections" | "profiles" | "permissions" | "joining";

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
  { id: "general", label: "General", icon: Settings },
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
const settingsTabIds: TabId[] = ["general", "bills", "organizations", "elections", "profiles", "permissions", "joining"];

type AuthorityTag = { id: string; label: string; type: "teacher" | "role" | "member"; locked?: boolean };
type MemberOption = { id: string; name: string; email: string; role: string };
type ClassOption = { id: string; name: string; settings: any };
type RoleActionKey = "announce" | "comment" | "react" | "editTitle" | "editDescription" | "removeMembers" | "promoteMembers";
type RoleActions = Record<RoleActionKey, boolean>;

const defaultRoleActions: RoleActions = {
  announce: true,
  comment: true,
  react: true,
  editTitle: false,
  editDescription: true,
  removeMembers: true,
  promoteMembers: false,
};

function Toggle({ checked, onChange, title, description, disabled = false, indent = false }: { checked: boolean; onChange: (next: boolean) => void; title: string; description?: string; disabled?: boolean; indent?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-gray-50"}`}
      aria-pressed={checked}
    >
      <span className={`min-w-0 ${indent ? "pl-10" : "pl-7"}`}>
        <span className="block text-base font-semibold text-gray-900">{title}</span>
        {description && <span className="block text-sm leading-5 text-gray-600">{description}</span>}
      </span>
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-transparent"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function SwitchControl({ checked, onChange, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 flex-shrink-0 items-center align-middle rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"} disabled:cursor-not-allowed disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function SettingsGroup({
  title,
  children,
  disabled = false,
  action,
  actionGrow = false,
}: {
  title: string;
  children: ReactNode;
  disabled?: boolean;
  action?: ReactNode;
  actionGrow?: boolean;
}) {
  return (
    <section className="space-y-2 pb-3 last:pb-0">
      <div className="flex min-h-6 items-center gap-3">
        <h3 className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {action && !actionGrow && <span className="h-px flex-1 border-t border-dotted border-gray-300" aria-hidden="true" />}
        {action && <div className={`${actionGrow ? "flex-1" : "shrink-0"} flex items-center justify-end self-center`}>{action}</div>}
      </div>
      <div className={`space-y-2 ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  control,
  wide = false,
  indent = false,
  sub = false,
}: {
  title: string;
  description?: string;
  control: ReactNode;
  wide?: boolean;
  indent?: boolean;
  sub?: boolean;
}) {
  const leftPad = sub ? "pl-[3.5rem]" : indent ? "pl-[2.5rem]" : "pl-7";
  return (
    <div
      className={`grid cursor-pointer items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50 ${wide ? "gap-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]" : "gap-3 md:grid-cols-[minmax(0,1fr)_240px]"}`}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input,textarea,button,select,[role='combobox']")) return;
        const input = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:not([disabled]),textarea:not([disabled])");
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement && (input.type === "text" || input.type === "search" || input.type === "email" || input.type === "url")) {
            const end = input.value.length;
            window.requestAnimationFrame(() => input.setSelectionRange(end, end));
          }
          return;
        }
        const combobox = event.currentTarget.querySelector<HTMLElement>("[role='combobox']:not([aria-disabled='true'])");
        if (combobox) {
          combobox.focus();
          combobox.click();
        }
      }}
    >
      <div className={`relative ${leftPad}`}>
        {sub && <span aria-hidden="true" className="absolute -top-2 left-6 h-[calc(50%+0.5rem)] w-5 rounded-bl-lg border-b-2 border-l-2 border-dotted border-gray-300" />}
        <div className="text-base font-semibold text-gray-900">{title}</div>
        {description && <div className="text-sm leading-5 text-gray-600">{description}</div>}
      </div>
      <div className="md:justify-self-end">{control}</div>
    </div>
  );
}

function DisabledBlock({ disabled, children, tight = false }: { disabled: boolean; children: ReactNode; tight?: boolean }) {
  return <div className={`${tight ? "space-y-0.5" : "space-y-2"} ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>;
}

function SettingSelect({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(event) => onChange(Math.min(100, Math.max(1, Number(event.target.value) || 50)))}
        className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-600">%</span>
    </div>
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
      <span className="mt-1 block text-xs text-gray-500">Maximum Allowed: {max} words</span>
    </label>
  );
}

function TeacherSettingsPage({ mode }: { mode: "setup" | "settings" }) {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(mode === "setup" ? "parties" : "general");
  const [activeClassId, setActiveClassId] = useState<string | null>(params.classId ?? null);
  const [hasChanges, setHasChanges] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [authoritySearch, setAuthoritySearch] = useState("");
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassOption[]>([]);
  const [settingsCode, setSettingsCode] = useState("");
  const [selectedCopyClassId, setSelectedCopyClassId] = useState("");
  const [speakerName, setSpeakerName] = useState("No speaker selected");
  const [selectedQuickSetup, setSelectedQuickSetup] = useState<"all-online" | "blended" | "core" | null>(null);
  const [quickSetupModified, setQuickSetupModified] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
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
    enableBills: true,
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
    enableElections: true,
    houseLeadershipElectionMode: "student-vote",
    organizationElectionMode: "student-vote",
    calendarAutoPublish: true,
    floorResultsBinding: true,
    floorVoteThreshold: "simple-majority",
    floorVoteThresholdPct: 50,
    showVoteResultsLive: true,
    profileDistrictRequired: true,
    profilePartyRequired: true,
    profilesEnabled: true,
    teacherPermissions: "full",
    studentPermissions: "standard",
    leadershipPermissions: "moderate",
    studentCanCreateBills: true,
    studentCanAnnounce: true,
    studentCanComment: true,
    studentCanReact: true,
    allOrganizationsCanPost: true,
    allOrganizationsCanComment: true,
    partiesCanElectLeaders: true,
    partiesCanPostAnnouncements: true,
    committeesCanEditBills: true,
    committeesCanVoteBills: true,
    committeesCanReportBills: true,
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
    partyJoinRestriction: "none",
    caucusJoinRestriction: "none",
    majorityWhipActions: { ...defaultRoleActions },
    minorityWhipActions: { ...defaultRoleActions },
    createdPartyChairActions: { ...defaultRoleActions, editTitle: true },
    createdPartyCoChairActions: { ...defaultRoleActions, editTitle: true },
    committeeChairActions: { ...defaultRoleActions },
    committeeRankingMemberActions: { ...defaultRoleActions },
    caucusChairActions: { ...defaultRoleActions, promoteMembers: true },
    caucusCoChairActions: { ...defaultRoleActions, promoteMembers: true },
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
    if (selectedQuickSetup) setQuickSetupModified(true);
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
        const [{ data: cls }, { data: memberships }, { data: ownedClasses }, { data: coTeacherMemberships }] = await Promise.all([
          supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
          supabase
            .from("class_memberships")
            .select("user_id,email,role,status,profiles(display_name)")
            .eq("class_id", classId)
            .eq("status", "approved"),
          supabase.from("classes").select("id,name,settings").eq("teacher_id", uid).order("created_at", { ascending: false }),
          supabase
            .from("class_memberships")
            .select("class_id")
            .eq("user_id", uid)
            .eq("role", "teacher")
            .eq("status", "approved"),
        ]);
        const members = (memberships ?? []).map((row: any) => ({
          id: row.user_id,
          email: row.email ?? "",
          role: row.role ?? "student",
          name: row.profiles?.display_name ?? row.email ?? "Member",
        })) as MemberOption[];
        setMemberOptions(members);
        const { data: speakerVotes } = await supabase.from("class_speaker_votes").select("candidate_user_id").eq("class_id", classId);
        const speakerVoteCounts = new Map<string, number>();
        for (const vote of speakerVotes ?? []) {
          const candidateId = (vote as any).candidate_user_id as string | null;
          if (candidateId) speakerVoteCounts.set(candidateId, (speakerVoteCounts.get(candidateId) ?? 0) + 1);
        }
        const [speakerId] = [...speakerVoteCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
        setSpeakerName(members.find((member) => member.id === speakerId)?.name ?? "No speaker selected");
        const coTeacherClassIds = [...new Set((coTeacherMemberships ?? []).map((row: any) => row.class_id).filter(Boolean))];
        const { data: coTeacherClasses } = coTeacherClassIds.length
          ? await supabase.from("classes").select("id,name,settings").in("id", coTeacherClassIds)
          : ({ data: [] } as any);
        const classMap = new Map<string, ClassOption>();
        for (const row of ownedClasses ?? []) classMap.set((row as any).id, { id: (row as any).id, name: (row as any).name ?? "Class", settings: (row as any).settings ?? {} });
        for (const row of coTeacherClasses ?? []) classMap.set((row as any).id, { id: (row as any).id, name: (row as any).name ?? "Class", settings: (row as any).settings ?? {} });
        setTeacherClasses(Array.from(classMap.values()).filter((item) => item.id !== classId));
        const teacherTags: AuthorityTag[] = [{ id: "teachers", label: "Teachers", type: "teacher" as const, locked: true }];
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
          enableBills: s?.bills?.enabled ?? s?.bills?.allowDrafts ?? prev.enableBills,
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
          floorVoteThresholdPct: s?.floor?.voteThresholdPct ?? (s?.floor?.voteThreshold === "two-thirds" ? 67 : prev.floorVoteThresholdPct),
          showVoteResultsLive: s?.floor?.showVoteResultsLive ?? prev.showVoteResultsLive,
          enableHouseLeadershipElection: s?.elections?.houseLeadership?.enabled ?? prev.enableHouseLeadershipElection,
          enableOrganizationElections: s?.elections?.organizations?.enabled ?? prev.enableOrganizationElections,
          enableElections: s?.elections?.enabled ?? Boolean((s?.elections?.houseLeadership?.enabled ?? prev.enableHouseLeadershipElection) || (s?.elections?.organizations?.enabled ?? prev.enableOrganizationElections)),
          houseLeadershipElectionMode: s?.elections?.houseLeadership?.mode ?? prev.houseLeadershipElectionMode,
          organizationElectionMode: s?.elections?.organizations?.mode ?? prev.organizationElectionMode,
          profilesEnabled: s?.profiles?.enabled ?? prev.profilesEnabled,
          profileDistrictRequired: s?.profiles?.districtRequired ?? prev.profileDistrictRequired,
          profilePartyRequired: s?.profiles?.partyRequired ?? prev.profilePartyRequired,
          teacherPermissions: s?.permissions?.teacher ?? prev.teacherPermissions,
          studentPermissions: s?.permissions?.student ?? prev.studentPermissions,
          leadershipPermissions: s?.permissions?.leadership ?? prev.leadershipPermissions,
          studentCanCreateBills: s?.permissions?.students?.createBills ?? prev.studentCanCreateBills,
          studentCanAnnounce: s?.permissions?.students?.announce ?? prev.studentCanAnnounce,
          studentCanComment: s?.permissions?.students?.comment ?? prev.studentCanComment,
          studentCanReact: s?.permissions?.students?.react ?? prev.studentCanReact,
          allOrganizationsCanPost: s?.permissions?.allOrganizations?.postAnnouncements ?? prev.allOrganizationsCanPost,
          allOrganizationsCanComment: s?.permissions?.allOrganizations?.comment ?? prev.allOrganizationsCanComment,
          partiesCanElectLeaders: s?.permissions?.parties?.electLeaders ?? prev.partiesCanElectLeaders,
          partiesCanPostAnnouncements: s?.permissions?.parties?.postAnnouncements ?? prev.partiesCanPostAnnouncements,
          committeesCanEditBills: s?.permissions?.committees?.editBills ?? prev.committeesCanEditBills,
          committeesCanVoteBills: s?.permissions?.committees?.voteBills ?? prev.committeesCanVoteBills,
          committeesCanReportBills: s?.permissions?.committees?.committeeReport ?? prev.committeesCanReportBills,
          caucusesCanPostAnnouncements: s?.permissions?.caucuses?.postAnnouncements ?? prev.caucusesCanPostAnnouncements,
          caucusesCanElectLeaders: s?.permissions?.caucuses?.electLeaders ?? prev.caucusesCanElectLeaders,
          partyJoinRestriction: s?.permissions?.parties?.joinRestriction ?? prev.partyJoinRestriction,
          caucusJoinRestriction: s?.permissions?.caucuses?.joinRestriction ?? prev.caucusJoinRestriction,
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
          majorityWhipActions: { ...prev.majorityWhipActions, ...(s?.permissions?.majorityWhip?.actions ?? {}) },
          minorityWhipActions: { ...prev.minorityWhipActions, ...(s?.permissions?.minorityWhip?.actions ?? {}) },
          createdPartyChairActions: { ...prev.createdPartyChairActions, ...(s?.permissions?.createdPartyChair?.actions ?? {}) },
          createdPartyCoChairActions: { ...prev.createdPartyCoChairActions, ...(s?.permissions?.createdPartyCoChair?.actions ?? {}) },
          committeeChairActions: { ...prev.committeeChairActions, ...(s?.permissions?.committeeChair?.actions ?? {}) },
          committeeRankingMemberActions: { ...prev.committeeRankingMemberActions, ...(s?.permissions?.committeeRankingMember?.actions ?? {}) },
          caucusChairActions: { ...prev.caucusChairActions, ...(s?.permissions?.caucusChair?.actions ?? {}) },
          caucusCoChairActions: { ...prev.caucusCoChairActions, ...(s?.permissions?.caucusCoChair?.actions ?? {}) },
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
        setSelectedQuickSetup(null);
        setQuickSetupModified(false);
      } catch (e: any) {
        toast.error(e.message || "Could not load settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.classId]);

  useEffect(() => {
    const markDirty = () => {
      if (selectedQuickSetup) setQuickSetupModified(true);
      setHasChanges(true);
    };
    window.addEventListener("gavel:profile-layout-dirty", markDirty);
    return () => window.removeEventListener("gavel:profile-layout-dirty", markDirty);
  }, [selectedQuickSetup]);

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
                enabled: settings.enableBills,
                assignmentAuthority: settings.billAssignmentAuthority,
                assignmentAuthorityMode: settings.billAssignmentAuthorityMode,
                assignmentAuthorityTags: authorityTags,
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
                voteThresholdPct: Math.min(100, Math.max(1, Number(settings.floorVoteThresholdPct) || 50)),
                showVoteResultsLive: settings.showVoteResultsLive,
                calendarAutoPublish: settings.calendarAutoPublish,
              },
              elections: {
                ...(existing?.elections ?? {}),
                enabled: settings.enableElections,
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
                  announce: settings.studentCanAnnounce,
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
                  joinRestriction: settings.partyJoinRestriction,
                },
                committees: {
                  ...(existing?.permissions?.committees ?? {}),
                  editBills: settings.committeesCanEditBills,
                  voteBills: settings.committeesCanVoteBills,
                  committeeReport: settings.committeesCanReportBills,
                },
                caucuses: {
                  ...(existing?.permissions?.caucuses ?? {}),
                  postAnnouncements: settings.caucusesCanPostAnnouncements,
                  electLeaders: settings.caucusesCanElectLeaders,
                  joinRestriction: settings.caucusJoinRestriction,
                },
                speaker: {
                  ...(existing?.permissions?.speaker ?? {}),
                  referBills: settings.speakerCanReferBills,
                  calendarBills: settings.speakerCanCalendarBills,
                },
                majorityWhip: {
                  ...(existing?.permissions?.majorityWhip ?? {}),
                  manageParty: settings.majorityWhipCanManageParty,
                  actions: settings.majorityWhipActions,
                },
                minorityWhip: {
                  ...(existing?.permissions?.minorityWhip ?? {}),
                  manageParty: settings.minorityWhipCanManageParty,
                  actions: settings.minorityWhipActions,
                },
                createdPartyChair: {
                  ...(existing?.permissions?.createdPartyChair ?? {}),
                  actions: settings.createdPartyChairActions,
                },
                createdPartyCoChair: {
                  ...(existing?.permissions?.createdPartyCoChair ?? {}),
                  actions: settings.createdPartyCoChairActions,
                },
                committeeChair: {
                  ...(existing?.permissions?.committeeChair ?? {}),
                  manageCommittee: settings.committeeChairCanManageCommittee,
                  actions: settings.committeeChairActions,
                },
                committeeRankingMember: {
                  ...(existing?.permissions?.committeeRankingMember ?? {}),
                  manageCommittee: settings.committeeRankingMemberCanManageCommittee,
                  actions: settings.committeeRankingMemberActions,
                },
                caucusChair: {
                  ...(existing?.permissions?.caucusChair ?? {}),
                  manageCaucus: settings.caucusChairCanManageCaucus,
                  actions: settings.caucusChairActions,
                },
                caucusCoChair: {
                  ...(existing?.permissions?.caucusCoChair ?? {}),
                  manageCaucus: settings.caucusCoChairCanManageCaucus,
                  actions: settings.caucusCoChairActions,
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
    setSettings({ billAssignmentAuthorityTags: [...settings.billAssignmentAuthorityTags, tag], billAssignmentAuthorityMode: "individuals", billAssignmentAuthority: "individuals" });
    setAuthoritySearch("");
  };

  const removeAuthorityTag = (tag: AuthorityTag) => {
    if (tag.locked || tag.type === "teacher") return;
    setSettings({ billAssignmentAuthorityTags: settings.billAssignmentAuthorityTags.filter((item) => !(item.id === tag.id && item.type === tag.type)) });
  };

  const authorityCandidates = [
    { id: "speaker-of-the-house", label: `Speaker of the House: ${speakerName}`, type: "role" as const },
    ...memberOptions.filter((member) => member.role === "student").map((member) => ({ id: member.id, label: member.name, type: "member" as const })),
  ].filter((tag) => {
    const query = authoritySearch.trim().toLowerCase();
    const matches = !query || tag.label.toLowerCase().includes(query);
    const unused = !settings.billAssignmentAuthorityTags.some((item) => item.id === tag.id && item.type === tag.type);
    return matches && unused;
  });

  const authorityTags = (settings.billAssignmentAuthorityTags.some((tag) => tag.type === "teacher")
    ? settings.billAssignmentAuthorityTags
    : [{ id: "teachers", label: "Teachers", type: "teacher" as const, locked: true }, ...settings.billAssignmentAuthorityTags]
  ).map((tag) => tag.id === "speaker-of-the-house" && tag.type === "role" ? { ...tag, label: `Speaker of the House: ${speakerName}` } : tag);

  const encodeSettings = () => {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(settings))));
    } catch {
      return "";
    }
  };

  const applySettingsState = (next: Partial<typeof settings>, message = "Settings applied") => {
    setSettingsState((prev) => ({ ...prev, ...next }));
    if (selectedQuickSetup) setQuickSetupModified(true);
    setHasChanges(true);
    toast.success(message);
  };

  const applySettingsCode = () => {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(settingsCode.trim()))));
      applySettingsState(parsed, "Settings code applied");
      setSettingsCode("");
    } catch {
      toast.error("Invalid settings code");
    }
  };

  const copySettingsCode = () => {
    const code = encodeSettings();
    if (!code) return toast.error("Could not generate settings code");
    void navigator.clipboard.writeText(code);
    toast.success("Settings code copied");
  };

  const copyClassSettings = (targetClassId?: string) => {
    const classId = targetClassId ?? selectedCopyClassId;
    const selected = teacherClasses.find((item) => item.id === classId);
    if (!selected) return;
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(selected.settings ?? {}))));
    setSettingsCode(code);
    try {
      const raw = selected.settings ?? {};
      applySettingsState(
        {
          allowedParties: raw?.parties?.allowed ?? settings.allowedParties,
          allowStudentCreatedParties: raw?.parties?.allowStudentCreated ?? settings.allowStudentCreatedParties,
          requirePartyApproval: raw?.parties?.requireApproval ?? settings.requirePartyApproval,
          enabledCommittees: raw?.committees?.enabled ?? settings.enabledCommittees,
          committeeAssignmentMode: raw?.committees?.assignmentMode ?? settings.committeeAssignmentMode,
          chairElectionMode: raw?.committees?.chairElectionMode ?? settings.chairElectionMode,
          chairVoteThresholdPct: raw?.committees?.chairVoteThresholdPct ?? settings.chairVoteThresholdPct,
          committeeVotePassThresholdPct: raw?.committees?.votePassThresholdPct ?? settings.committeeVotePassThresholdPct,
          enableOrganizations: raw?.organizations?.enabled ?? settings.enableOrganizations,
          enableParties: raw?.organizations?.enableParties ?? settings.enableParties,
          enableCommittees: raw?.organizations?.enableCommittees ?? settings.enableCommittees,
          enableCaucuses: raw?.organizations?.enableCaucuses ?? settings.enableCaucuses,
          enableBills: raw?.bills?.enabled ?? raw?.bills?.allowDrafts ?? settings.enableBills,
          allowDrafts: raw?.bills?.allowDrafts ?? settings.allowDrafts,
          billTabs: raw?.bills?.tabs ?? settings.billTabs,
          billsVotedAfterCommittee: raw?.bills?.votedAfterCommittee ?? settings.billsVotedAfterCommittee,
          committeeVoteRequired: raw?.bills?.committeeVoteRequired ?? settings.committeeVoteRequired,
          cosponsorshipMode: raw?.bills?.cosponsorshipMode ?? settings.cosponsorshipMode,
          showCosponsors: raw?.bills?.showCosponsors ?? settings.showCosponsors,
          enableFloor: raw?.floor?.enabled ?? settings.enableFloor,
          floorResultsBinding: raw?.floor?.binding ?? settings.floorResultsBinding,
          floorVoteThreshold: raw?.floor?.voteThreshold ?? settings.floorVoteThreshold,
          floorVoteThresholdPct: raw?.floor?.voteThresholdPct ?? settings.floorVoteThresholdPct,
          profilesEnabled: raw?.profiles?.enabled ?? settings.profilesEnabled,
          profileDistrictRequired: raw?.profiles?.districtRequired ?? settings.profileDistrictRequired,
          profilePartyRequired: raw?.profiles?.partyRequired ?? settings.profilePartyRequired,
          announcementBoardsEnabled: raw?.organizations?.announcementBoards?.enabled ?? settings.announcementBoardsEnabled,
          announcementCommentsEnabled: raw?.organizations?.announcementBoards?.comments ?? settings.announcementCommentsEnabled,
          announcementEmotesEnabled: raw?.organizations?.announcementBoards?.emotes ?? settings.announcementEmotesEnabled,
          enableElections: raw?.elections?.enabled ?? settings.enableElections,
          enableHouseLeadershipElection: raw?.elections?.houseLeadership?.enabled ?? settings.enableHouseLeadershipElection,
          enableOrganizationElections: raw?.elections?.organizations?.enabled ?? settings.enableOrganizationElections,
          studentCanCreateBills: raw?.permissions?.students?.createBills ?? settings.studentCanCreateBills,
          studentCanAnnounce: raw?.permissions?.students?.announce ?? settings.studentCanAnnounce,
          studentCanComment: raw?.permissions?.students?.comment ?? settings.studentCanComment,
          studentCanReact: raw?.permissions?.students?.react ?? settings.studentCanReact,
          committeesCanEditBills: raw?.permissions?.committees?.editBills ?? settings.committeesCanEditBills,
          committeesCanVoteBills: raw?.permissions?.committees?.voteBills ?? settings.committeesCanVoteBills,
          committeesCanReportBills: raw?.permissions?.committees?.committeeReport ?? settings.committeesCanReportBills,
          partyJoinRestriction: raw?.permissions?.parties?.joinRestriction ?? settings.partyJoinRestriction,
          caucusJoinRestriction: raw?.permissions?.caucuses?.joinRestriction ?? settings.caucusJoinRestriction,
          profileLongResponseWordLimit: raw?.wordLimits?.profileLongResponse ?? settings.profileLongResponseWordLimit,
          billWordLimit: raw?.wordLimits?.bill ?? settings.billWordLimit,
          committeeReportWordLimit: raw?.wordLimits?.committeeReport ?? settings.committeeReportWordLimit,
          organizationDescriptionWordLimit: raw?.wordLimits?.organizationDescription ?? settings.organizationDescriptionWordLimit,
          announcementWordLimit: raw?.wordLimits?.announcement ?? settings.announcementWordLimit,
          commentWordLimit: raw?.wordLimits?.comment ?? settings.commentWordLimit,
        },
        `Settings copied from ${selected.name}`,
      );
    } catch {
      toast.error("Could not copy settings from that class");
    }
  };

  const applyQuickSetup = (kind: "all-online" | "blended" | "core") => {
    const common = {
      enableBills: true,
      allowDrafts: true,
      enableFloor: true,
      enableOrganizations: true,
      enableParties: true,
      enableCommittees: true,
      enableCaucuses: true,
      enableElections: true,
      enableHouseLeadershipElection: true,
      enableOrganizationElections: true,
      profilesEnabled: true,
      studentCanCreateBills: true,
    };
    const applyPresetState = (patch: Partial<typeof settings>, message: string) => {
      setSettingsState((prev) => ({ ...prev, ...patch }));
      setSelectedQuickSetup(kind);
      setQuickSetupModified(false);
      setHasChanges(true);
      toast.success(message);
    };
    if (kind === "all-online") {
      applyPresetState({ ...common, announcementBoardsEnabled: true, announcementCommentsEnabled: true, announcementEmotesEnabled: true }, "Fully Digital Simulation applied");
    } else if (kind === "blended") {
      applyPresetState({ ...common, announcementBoardsEnabled: false, announcementCommentsEnabled: false, announcementEmotesEnabled: false }, "Hybrid Simulation applied");
    } else {
      applyPresetState({ ...common, announcementBoardsEnabled: false, announcementCommentsEnabled: false, announcementEmotesEnabled: false, profilesEnabled: false, enableCaucuses: false, enableOrganizationElections: false }, "Essentialist Simulation applied");
    }
  };

  const requestQuickSetup = (kind: "all-online" | "blended" | "core", name: string) => {
    setConfirmDialog({
      title: `Apply ${name}?`,
      message: "This will replace the current settings on this page with the selected quick setup. You can still review the changes before saving.",
      confirmLabel: "Apply setup",
      onConfirm: () => applyQuickSetup(kind),
    });
  };

  const setRoleAction = (roleKey: keyof typeof settings, action: RoleActionKey, checked: boolean) => {
    const current = settings[roleKey] as RoleActions;
    setSettings({ [roleKey]: { ...current, [action]: checked } } as Partial<typeof settings>);
  };

  const roleActionControls = (roleKey: keyof typeof settings, options: { createdParty?: boolean; caucus?: boolean } = {}) => {
    const current = settings[roleKey] as RoleActions;
    const rows: Array<{ key: RoleActionKey; label: string; show?: boolean }> = [
      { key: "announce", label: "Make announcements in announcement boards" },
      { key: "comment", label: "Make comments in announcement boards" },
      { key: "react", label: "React to announcements and comments in announcement boards" },
      { key: "editTitle", label: "Edit title", show: options.createdParty },
      { key: "editDescription", label: "Edit description" },
      { key: "removeMembers", label: "Remove members" },
      { key: "promoteMembers", label: "Promote members", show: options.caucus },
    ];
    return (
      <div className="grid gap-2">
        {rows.filter((row) => row.show !== false).map((row) => (
          <Toggle key={row.key} checked={!!current[row.key]} onChange={(value) => setRoleAction(roleKey, row.key, value)} title={row.label} />
        ))}
      </div>
    );
  };

  const section = () => {
    if (activeTab === "general") {
      const quickSetups = [
        {
          id: "all-online" as const,
          name: "Fully Digital Simulation",
          description: "Enable all features - optimal for digital courses or centralizing participation online.",
          classes: "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50",
          selectedClasses: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
          tagClasses: "bg-blue-600 text-white",
        },
        {
          id: "blended" as const,
          name: "Hybrid Simulation",
          description: "Disable message boards to facilitate in-person discussion.",
          classes: "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50",
          selectedClasses: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
          tagClasses: "bg-blue-600 text-white",
        },
        {
          id: "core" as const,
          name: "Essentialist Simulation",
          description: "Disable message boards, profiles, and non-essential tools to optimize for time or complexity constraints.",
          classes: "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50",
          selectedClasses: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
          tagClasses: "bg-blue-600 text-white",
        },
      ];
      const currentSettingsCode = encodeSettings();
      const settingsCodePreview = currentSettingsCode ? `${currentSettingsCode.slice(0, 18)}...` : "Unavailable";
      return (
        <div className="space-y-4">
          <SettingsGroup title="Quick setup">
            <div className="grid gap-2 md:grid-cols-3">
              {quickSetups.map((item) => {
                const selected = selectedQuickSetup === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => requestQuickSetup(item.id, item.name)}
                    className={`flex min-h-40 flex-col rounded-lg border-2 p-4 text-left transition ${selected ? item.selectedClasses : item.classes}`}
                  >
                    <span className="block min-h-12 text-base font-semibold leading-6 text-gray-950">{item.name}</span>
                    <span className="mt-1 block text-sm leading-6 text-gray-600">{item.description}</span>
                    {selected && (
                      <span className="mt-auto flex flex-wrap gap-2 pt-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.tagClasses}`}>Selected</span>
                        {quickSetupModified && <span className="inline-flex rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-700">with modifications</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SettingsGroup>

          <SettingsGroup title="Import settings">
            <SettingRow
              title="Copy configuration code"
              description="Copy the current settings as a reusable configuration code."
              wide
              control={
                <button type="button" onClick={copySettingsCode} className="ml-auto flex min-w-0 w-[32rem] max-w-full items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-left hover:bg-gray-100">
                  <code className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700">{settingsCodePreview}</code>
                  <span className="inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
                    <Copy className="h-4 w-4" />
                    Copy
                  </span>
                </button>
              }
            />
            <div className="space-y-2">
              <div className="pl-7 text-xs font-bold uppercase tracking-wide text-gray-500">Import from</div>
              <SettingRow
                title="Configuration code"
                description="Paste a settings configuration code to apply it to this class."
                wide
                control={
                  <div className="ml-auto flex w-[32rem] max-w-full gap-2">
                    <input value={settingsCode} onChange={(event) => setSettingsCode(event.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Paste code" />
                    <button type="button" onClick={applySettingsCode} disabled={!settingsCode.trim()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Apply</button>
                  </div>
                }
              />
              <SettingRow
                title="Existing class"
                description="Duplicate settings from another class where you are a teacher."
                wide
                control={
                  <div className="ml-auto w-[32rem] max-w-full">
                    <SettingSelect
                      value={selectedCopyClassId || "none"}
                      onValueChange={(value) => {
                        const next = value === "none" ? "" : value;
                        setSelectedCopyClassId(next);
                        if (next) copyClassSettings(next);
                      }}
                    >
                      <SelectItem value="none">Select a class</SelectItem>
                      {teacherClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SettingSelect>
                  </div>
                }
              />
            </div>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "parties") {
      return (
        <div className="space-y-4">
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
          <SettingRow title="Party leadership" control={<SettingSelect value={settings.partyLeadershipElectionMode} onValueChange={(value) => setSettings({ partyLeadershipElectionMode: value })}>
            <SelectItem value="elected">Members elect leadership</SelectItem>
            <SelectItem value="teacher-assigned">Teacher assigns leadership</SelectItem>
          </SettingSelect>} />
        </div>
      );
    }
    if (activeTab === "committees") {
      return (
        <div className="space-y-4">
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
          <div className="grid gap-3">
            <SettingRow title="Assignment mode" control={<SettingSelect value={settings.committeeAssignmentMode} onValueChange={(value) => setSettings({ committeeAssignmentMode: value })}>
                <SelectItem value="preference">Preference assigned</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="self-join">Self join</SelectItem>
              </SettingSelect>} />
            <SettingRow title="Chair selection" control={<SettingSelect value={settings.chairElectionMode} onValueChange={(value) => setSettings({ chairElectionMode: value })}>
                <SelectItem value="elected">Committee vote</SelectItem>
                <SelectItem value="teacher-assigned">Teacher assigned</SelectItem>
              </SettingSelect>} />
          </div>
        </div>
      );
    }
    if (activeTab === "bills") {
      return (
        <div className="space-y-4">
          <DisabledBlock disabled={!settings.enableBills}>
            <SettingRow indent title="Bill word limit" description="Maximum words allowed in bill text." control={<WordLimitInput label="" value={settings.billWordLimit} max={5000} onChange={(value) => setSettings({ billWordLimit: value })} />} />
            <SettingsGroup
              title="Cosponsorship"
              actionGrow
              action={
                <div className="w-full">
                  <SettingSelect value={settings.cosponsorshipMode} onValueChange={(value) => setSettings({ cosponsorshipMode: value, cosponsorAfterCommitteeReport: false })}>
                    <SelectItem value="always">Always allowed</SelectItem>
                    <SelectItem value="before_report">Only before bill is reported from all committees</SelectItem>
                    <SelectItem value="never">Never allowed</SelectItem>
                  </SettingSelect>
                </div>
              }
              disabled={!settings.enableBills}
            >
              <DisabledBlock disabled={settings.cosponsorshipMode === "never"}>
                <Toggle indent checked={settings.showCosponsors} onChange={(v) => setSettings({ showCosponsors: v })} disabled={settings.cosponsorshipMode === "never"} title="Show cosponsors" description="Display cosponsors on bill pages and lists." />
              </DisabledBlock>
            </SettingsGroup>
          <SettingsGroup title="Floor" action={<SwitchControl checked={settings.enableFloor} onChange={(v) => setSettings({ enableFloor: v })} disabled={!settings.enableBills} />}>
            <div className="text-sm text-gray-600">Use the floor page for debate queues and final votes.</div>
            <DisabledBlock disabled={!settings.enableFloor}>
              <SettingRow
                title="Floor pass threshold"
                description="Percentage of present members needed to pass."
                indent
                control={
                  <div className="flex flex-wrap items-center gap-2">
                    <PercentInput value={settings.floorVoteThresholdPct} onChange={(value) => setSettings({ floorVoteThresholdPct: value, floorVoteThreshold: value >= 67 ? "two-thirds" : "custom" })} />
                    <button type="button" onClick={() => setSettings({ floorVoteThresholdPct: 50, floorVoteThreshold: "simple-majority" })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">1/2</button>
                    <button type="button" onClick={() => setSettings({ floorVoteThresholdPct: 67, floorVoteThreshold: "two-thirds" })} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">2/3</button>
                  </div>
                }
              />
            </DisabledBlock>
          </SettingsGroup>
          </DisabledBlock>
        </div>
      );
    }
    if (activeTab === "organizations") {
      return (
        <div className="space-y-4">
          <DisabledBlock disabled={!settings.enableOrganizations}>
            <SettingRow
              indent
              title="Organization name and description word limit"
              description="Applies to organization names and about sections."
              control={<WordLimitInput label="" value={settings.organizationDescriptionWordLimit} max={500} onChange={(value) => setSettings({ organizationDescriptionWordLimit: value })} />}
            />
          </DisabledBlock>
          <SettingsGroup title="Announcement boards" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.announcementBoardsEnabled} onChange={(v) => setSettings({ announcementBoardsEnabled: v })} disabled={!settings.enableOrganizations} />}>
            <DisabledBlock disabled={!settings.announcementBoardsEnabled}>
              <SettingRow title="Announcement word limit" description="Maximum words allowed in announcements." control={<WordLimitInput label="" value={settings.announcementWordLimit} max={1000} onChange={(value) => setSettings({ announcementWordLimit: value })} />} />
              <div className="space-y-0.5">
                <Toggle checked={settings.announcementCommentsEnabled} onChange={(v) => setSettings({ announcementCommentsEnabled: v })} title="Enable comments" description="Members can comment on announcement boards." />
                <DisabledBlock disabled={!settings.announcementCommentsEnabled} tight>
                  <SettingRow sub title="Comment word limit" description="Maximum words allowed in announcement comments." control={<WordLimitInput label="" value={settings.commentWordLimit} max={500} onChange={(value) => setSettings({ commentWordLimit: value })} />} />
                </DisabledBlock>
              </div>
              <Toggle checked={settings.announcementEmotesEnabled} onChange={(v) => setSettings({ announcementEmotesEnabled: v })} title="Enable emotes" description="Members can react to announcements and comments." />
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Parties" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableParties} onChange={(v) => setSettings({ enableParties: v })} disabled={!settings.enableOrganizations} />}>
            <div className="text-sm text-gray-600">Students can join parties and use party spaces.</div>
          </SettingsGroup>
          <SettingsGroup title="Committees" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableCommittees} onChange={(v) => setSettings({ enableCommittees: v })} disabled={!settings.enableOrganizations} />}>
            <DisabledBlock disabled={!settings.enableCommittees}>
              <SettingRow
                title="Bill assignment authority"
                description="Choose who can assign or refer bills to committees."
                wide
                control={
                  <div
                    className="min-w-0"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAuthorityOpen(false);
                    }}
                  >
                    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                      {authorityTags.map((tag) => (
                        <button
                          key={`${tag.type}:${tag.id}`}
                          type="button"
                          onClick={() => removeAuthorityTag(tag)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${tag.type === "teacher" ? "cursor-default bg-green-100 text-green-800" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                          {tag.label}{tag.locked ? "" : " x"}
                        </button>
                      ))}
                      <input
                        value={authoritySearch}
                        onChange={(event) => setAuthoritySearch(event.target.value)}
                        onFocus={() => setAuthorityOpen(true)}
                        placeholder="Search people with bill assignment authority..."
                        className="min-w-[20rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                      />
                    </div>
                    {authorityOpen && <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                      {authorityCandidates.length ? authorityCandidates.map((tag) => (
                        <button
                          key={`${tag.type}:${tag.id}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => addAuthorityTag(tag)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          {tag.label}
                        </button>
                      )) : <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
                    </div>}
                  </div>
                }
              />
              <div className="space-y-0.5">
                <Toggle checked={settings.committeesCanReportBills} onChange={(v) => setSettings({ committeesCanReportBills: v })} title="Committee report" description="Committees can submit reports when reviewing bills." />
                <DisabledBlock disabled={!settings.committeesCanReportBills} tight>
                  <SettingRow sub title="Committee report word limit" description="Maximum words allowed in submitted committee reports." control={<WordLimitInput label="" value={settings.committeeReportWordLimit} max={2000} onChange={(value) => setSettings({ committeeReportWordLimit: value })} />} />
                </DisabledBlock>
              </div>
              <div className="space-y-0.5">
                <Toggle checked={settings.billsVotedAfterCommittee} onChange={(v) => setSettings({ billsVotedAfterCommittee: v, committeeVoteRequired: v })} title="Committee voting" description="Bills are voted on after committee review." />
                <DisabledBlock disabled={!settings.billsVotedAfterCommittee} tight>
                  <SettingRow sub title="Committee vote pass threshold" description="Percentage of votes needed to report a bill." control={<PercentInput value={settings.committeeVotePassThresholdPct} onChange={(value) => setSettings({ committeeVotePassThresholdPct: value })} />} />
                </DisabledBlock>
              </div>
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Caucuses" disabled={!settings.enableOrganizations} action={<SwitchControl checked={settings.enableCaucuses} onChange={(v) => setSettings({ enableCaucuses: v })} disabled={!settings.enableOrganizations} />}>
            <div className="text-sm text-gray-600">Students can form caucuses and post announcements.</div>
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "elections") {
      return (
        <div className="space-y-4">
          <DisabledBlock disabled={!settings.enableElections}>
            <SettingsGroup title="House leadership election" action={<SwitchControl checked={settings.enableHouseLeadershipElection} onChange={(v) => setSettings({ enableHouseLeadershipElection: v })} disabled={!settings.enableElections} />}>
              <div className="text-sm text-gray-600">Students can vote for Speaker of the House from the floor page.</div>
            </SettingsGroup>
            <SettingsGroup title="Organization elections" action={<SwitchControl checked={settings.enableOrganizationElections} onChange={(v) => setSettings({ enableOrganizationElections: v })} disabled={!settings.enableElections} />}>
              <div className="text-sm text-gray-600">Parties, committees, and caucuses can run their leadership elections.</div>
            </SettingsGroup>
          </DisabledBlock>
        </div>
      );
    }
    if (activeTab === "profiles") {
      return (
        <div className={`${settings.profilesEnabled ? "" : "pointer-events-none opacity-45"}`}>
          <ProfileLayoutEditor embedded />
        </div>
      );
    }
    if (activeTab === "permissions") {
      return (
        <div className="space-y-4">
          <SettingsGroup title="Students">
            <Toggle checked={settings.studentCanCreateBills} onChange={(v) => setSettings({ studentCanCreateBills: v })} title="Create bills" />
            <Toggle checked={settings.studentCanAnnounce} onChange={(v) => setSettings({ studentCanAnnounce: v })} title="Make announcements in announcement boards" />
            <Toggle checked={settings.studentCanComment} onChange={(v) => setSettings({ studentCanComment: v })} title="Make comments in announcement boards" />
            <Toggle checked={settings.studentCanReact} onChange={(v) => setSettings({ studentCanReact: v })} title="React to announcements and comments in announcement boards" />
          </SettingsGroup>
          <SettingsGroup title="Parties" disabled={!settings.enableParties}>
            <SettingRow
              title="Maximum student join restriction"
              control={
                <SettingSelect value={settings.partyJoinRestriction} onValueChange={(value) => setSettings({ partyJoinRestriction: value })}>
                  <SelectItem value="none">No restriction</SelectItem>
                  <SelectItem value="request">Allow request to join</SelectItem>
                </SettingSelect>
              }
            />
          </SettingsGroup>
          <SettingsGroup title="Committees" disabled={!settings.enableCommittees}>
            <Toggle checked={settings.committeesCanEditBills} onChange={(v) => setSettings({ committeesCanEditBills: v })} title="Revise referred bills" />
            <Toggle checked={settings.committeesCanVoteBills} onChange={(v) => setSettings({ committeesCanVoteBills: v })} title="Vote on referred bills" />
            <Toggle checked={settings.committeesCanReportBills} onChange={(v) => setSettings({ committeesCanReportBills: v })} title="Committee report" />
          </SettingsGroup>
          <SettingsGroup title="Caucuses" disabled={!settings.enableCaucuses}>
            <SettingRow
              title="Maximum student join restriction"
              control={
                <SettingSelect value={settings.caucusJoinRestriction} onValueChange={(value) => setSettings({ caucusJoinRestriction: value })}>
                  <SelectItem value="none">No restriction</SelectItem>
                  <SelectItem value="request">Allow request to join</SelectItem>
                </SettingSelect>
              }
            />
          </SettingsGroup>
          <SettingsGroup title="Speaker of the House">
            <Toggle checked={settings.speakerCanReferBills} onChange={(v) => setSettings({ speakerCanReferBills: v })} title="Refer bills to committees" />
            <Toggle checked={settings.speakerCanCalendarBills} onChange={(v) => setSettings({ speakerCanCalendarBills: v })} title="Calendar bills" />
          </SettingsGroup>
          <SettingsGroup title="Majority Whip" disabled={!settings.enableParties}>
            {roleActionControls("majorityWhipActions")}
          </SettingsGroup>
          <SettingsGroup title="Minority Whip" disabled={!settings.enableParties}>
            {roleActionControls("minorityWhipActions")}
          </SettingsGroup>
          <SettingsGroup title="Created Party Chair" disabled={!settings.enableParties}>
            {roleActionControls("createdPartyChairActions", { createdParty: true })}
          </SettingsGroup>
          <SettingsGroup title="Created Party Co-Chair" disabled={!settings.enableParties}>
            {roleActionControls("createdPartyCoChairActions", { createdParty: true })}
          </SettingsGroup>
          <SettingsGroup title="Committee Chair" disabled={!settings.enableCommittees}>
            {roleActionControls("committeeChairActions")}
          </SettingsGroup>
          <SettingsGroup title="Committee Ranking Member" disabled={!settings.enableCommittees}>
            {roleActionControls("committeeRankingMemberActions")}
          </SettingsGroup>
          <SettingsGroup title="Caucus Chair" disabled={!settings.enableCaucuses}>
            {roleActionControls("caucusChairActions", { caucus: true })}
          </SettingsGroup>
          <SettingsGroup title="Caucus Co-Chair" disabled={!settings.enableCaucuses}>
            {roleActionControls("caucusCoChairActions", { caucus: true })}
          </SettingsGroup>
        </div>
      );
    }
    if (activeTab === "joining") {
      return (
        <div className="space-y-4">
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
  const description = mode === "setup" ? "Choose the default parties and committees for this class." : "";
  const activeTabLabel = visibleTabs.find((tab) => tab.id === activeTab)?.label;
  const tabHeaderAction = () => {
    if (activeTab === "bills") return <SwitchControl checked={settings.enableBills} onChange={(v) => setSettings({ enableBills: v })} />;
    if (activeTab === "organizations") return <SwitchControl checked={settings.enableOrganizations} onChange={(v) => setSettings({ enableOrganizations: v, enableParties: v, enableCommittees: v, enableCaucuses: v })} />;
    if (activeTab === "elections") return <SwitchControl checked={settings.enableElections} onChange={(v) => setSettings({ enableElections: v })} />;
    if (activeTab === "profiles") return <SwitchControl checked={settings.profilesEnabled} onChange={(v) => setSettings({ profilesEnabled: v })} />;
    return null;
  };
  const activeTabAction = tabHeaderAction();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="h-7 w-7 self-center text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>
              {description && <p className="mt-1 text-gray-600">{description}</p>}
            </div>
          </div>
          {mode === "settings" && <TeacherClassTabs classId={activeClassId} active="settings" />}
        </div>
        {loading ? <div className="mb-4 text-sm text-gray-600">Loading settings...</div> : null}

        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div className="min-h-[320px] self-start rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${activeTab === id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="shrink-0 text-xl font-semibold text-gray-900">{activeTabLabel}</h2>
              {activeTabAction && <span className="h-px flex-1 border-t border-dotted border-gray-300" aria-hidden="true" />}
              {activeTabAction && <div className="flex shrink-0 items-center">{activeTabAction}</div>}
            </div>
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
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

export function TeacherSetup() {
  return <TeacherSettingsPage mode="setup" />;
}

export function SimulationSettings() {
  return <TeacherSettingsPage mode="settings" />;
}
