import { type ReactNode, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { Check, CheckSquare, Copy, FileText, Mail, Save, Search, Settings, ShieldCheck, UserCog, Users, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../utils/supabase";
import { defaultPartyColor } from "../components/PartyCreateForm";
import { ProfileLayoutEditor } from "./TeacherProfileLayoutEditor";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { houseCommittees, houseCommitteeSubcommittees } from "../constants/houseCommittees";
import { InfoTooltip } from "../components/InfoTooltip";

type TabId = "general" | "parties" | "committees" | "bills" | "organizations" | "elections" | "profiles" | "permissions" | "joining";

const allParties = ["Democratic Party", "Republican Party", "Green Party", "Libertarian Party", "Independent Party"];
const defaultPartyOptions = allParties.filter((party) => party !== "Independent Party");
const allCommittees = houseCommittees;
const subcommitteeOptions = allCommittees.flatMap((committee) => (houseCommitteeSubcommittees[committee] ?? []).map((subcommittee) => `${committee}::${subcommittee}`));
const subcommitteeLabels = Object.fromEntries(subcommitteeOptions.map((key) => {
  const [committee, subcommittee] = key.split("::");
  return [key, `${committee}: ${subcommittee}`];
}));
const partyDetails: Record<string, { text: string; url: string }> = {
  "Democratic Party": { text: "Traces its roots to Jeffersonian Democratic-Republicans and Jacksonian Democrats; today it is one of the two major U.S. parties.", url: "https://democrats.org" },
  "Republican Party": { text: "Founded in 1854 by anti-slavery expansion coalitions and became Lincoln's party before becoming today's GOP.", url: "https://gop.com" },
  "Green Party": { text: "Grew from U.S. Green organizing in the 1980s and 1990s, emphasizing ecology, democracy, social justice, and peace.", url: "https://www.gp.org" },
  "Libertarian Party": { text: "Founded in 1971 in Colorado around individual liberty, limited government, and free-market principles.", url: "https://www.lp.org" },
};

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

function Toggle({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  indent = false,
  variant = "checkbox",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
  indent?: boolean;
  variant?: "switch" | "checkbox";
}) {
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
        {description && <span className="block text-sm font-normal leading-5 text-gray-600">{description}</span>}
      </span>
      {variant === "checkbox" ? (
        <span
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
            checked ? "border-blue-600 bg-blue-600 text-white" : "border-gray-500 bg-white text-transparent ring-1 ring-gray-200"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className={`inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"}`}>
          <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </span>
      )}
    </button>
  );
}

function SettingsGroup({
  title,
  children,
  disabled = false,
  action,
  actionGrow = false,
  actionInline = false,
}: {
  title: string;
  children: ReactNode;
  disabled?: boolean;
  action?: ReactNode;
  actionGrow?: boolean;
  actionInline?: boolean;
}) {
  return (
    <section className="space-y-3 pb-5 last:pb-0">
      <div className="flex min-h-6 items-center gap-3">
        <h3 className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {action && actionInline && <div className="shrink-0 self-center">{action}</div>}
        {(!actionGrow || !action) && <span className="h-px flex-1 border-t border-dotted border-gray-300" aria-hidden="true" />}
        {action && !actionInline && <div className={`${actionGrow ? "flex-1" : "shrink-0"} flex items-center justify-end self-center`}>{action}</div>}
      </div>
      <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>
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
  const leftPad = sub ? "pl-[4.75rem]" : indent ? "pl-[2.5rem]" : "pl-7";
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
        {sub && <span aria-hidden="true" className="absolute -top-1 left-7 h-[calc(50%+0.25rem)] w-10 rounded-bl-lg border-b-2 border-l-2 border-dotted border-gray-300" />}
        <div className="text-base font-semibold text-gray-900">{title}</div>
        {description && <div className="text-sm font-normal leading-5 text-gray-600">{description}</div>}
      </div>
      <div className="md:justify-self-end">{control}</div>
    </div>
  );
}

function DisabledBlock({ disabled, children, tight = false }: { disabled: boolean; children: ReactNode; tight?: boolean }) {
  return <div className={`${tight ? "space-y-0.5" : "space-y-2"} ${disabled ? "pointer-events-none opacity-45" : ""}`}>{children}</div>;
}

function SettingSelect({ value, onValueChange, children, disabled = false }: { value: string; onValueChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function CompactDefaultsDropdown({
  title,
  selected,
  options,
  onToggle,
  onSelectAll,
  onDeselectAll,
  subtexts,
  labels,
  optionDetails,
  capacities,
  onCapacityChange,
}: {
  title: string;
  selected: string[];
  options: string[];
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  subtexts?: Record<string, string[]>;
  labels?: Record<string, string>;
  optionDetails?: Record<string, ReactNode>;
  capacities?: Record<string, number>;
  onCapacityChange?: (name: string, value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-900">{title}</span>
          <span className="block truncate text-xs text-gray-500">{selected.length ? `${selected.length} selected` : "None selected"}</span>
        </span>
        <span className="text-xs text-gray-500">Dropdown</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(44rem,calc(100vw-3rem))] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onSelectAll} className="text-xs font-medium text-blue-600">Select all</button>
              <button type="button" onClick={onDeselectAll} className="text-xs font-medium text-blue-600">Deselect all</button>
            </div>
          </div>
          <div className="max-h-[24rem] overflow-y-auto pr-1">
            {options.map((option) => {
              const checked = selected.includes(option);
              const label = labels?.[option] ?? option;
              const subtext = subtexts?.[option]?.join(", ");
              return (
                <div key={option} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => onToggle(option)}
                    className={`mt-0.5 h-4 w-4 rounded border ${checked ? "border-blue-600 bg-blue-600" : "border-gray-500 bg-white"}`}
                    aria-label={`${checked ? "Disable" : "Enable"} ${label}`}
                  >
                    {checked && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <button type="button" onClick={() => onToggle(option)} className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-semibold leading-5 text-gray-900">{label}</span>
                    {subtext ? <span className="block text-xs leading-4 text-gray-500">{subtext}</span> : null}
                  </button>
                  {optionDetails?.[option] ? <div className="mt-0.5 shrink-0">{optionDetails[option]}</div> : null}
                  {onCapacityChange && checked && (
                    <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                      Cap
                      <input
                        type="number"
                        min={1}
                        value={capacities?.[option] ?? ""}
                        onChange={(event) => onCapacityChange(option, Math.max(1, Number(event.target.value) || 1))}
                        className="h-7 w-14 rounded-md border border-gray-300 px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = Math.min(100, Math.max(1, Number(draft) || 50));
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="relative w-20">
      <input
        type="number"
        min={1}
        max={100}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "" || /^\d{0,3}$/.test(next)) setDraft(next);
        }}
        onBlur={commit}
        className="w-full rounded-md border border-gray-300 py-2 pl-2 pr-5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
    </div>
  );
}

function WordLimitInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="flex max-w-52 flex-col items-end text-right">
      {label && <span className="mb-1 block text-base font-semibold text-gray-900">{label}</span>}
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(1, Number(event.target.value) || 1)))}
        className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="mt-1 block text-sm font-normal leading-5 text-gray-600">Limit: {max}</span>
    </label>
  );
}

function TeacherSettingsPage({ mode }: { mode: "setup" | "settings" }) {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [activeClassId, setActiveClassId] = useState<string | null>(params.classId ?? null);
  const [hasChanges, setHasChanges] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [authoritySearch, setAuthoritySearch] = useState("");
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const [billSubmissionSearch, setBillSubmissionSearch] = useState("");
  const [billSubmissionOpen, setBillSubmissionOpen] = useState(false);
  const [profileEditingSearch, setProfileEditingSearch] = useState("");
  const [profileEditingOpen, setProfileEditingOpen] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassOption[]>([]);
  const [settingsCode, setSettingsCode] = useState("");
  const [selectedCopyClassId, setSelectedCopyClassId] = useState("");
  const [speakerName, setSpeakerName] = useState("No speaker selected");
  const [selectedQuickSetup, setSelectedQuickSetup] = useState<"all-online" | "blended" | "core" | null>(null);
  const [quickSetupModified, setQuickSetupModified] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const authoritySearchRef = useRef<HTMLDivElement | null>(null);
  const billSubmissionSearchRef = useRef<HTMLDivElement | null>(null);
  const profileEditingSearchRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettingsState] = useState({
    allowedParties: ["Democratic Party", "Republican Party"],
    allowStudentCreatedParties: false,
    requirePartyApproval: true,
    autoApproveParties: [] as string[],
    enabledCommittees: allCommittees.slice(0, 5),
    committeeSubcommitteesEnabled: true,
    enabledSubcommittees: subcommitteeOptions,
    committeeCapacitiesByName: {} as Record<string, number>,
    allowSelfJoinCommittees: false,
    committeeAssignmentMode: "preference",
    chairElectionMode: "elected",
    chairVoteThresholdPct: 50,
    partyLeadershipElectionMode: "elected",
    enableBills: true,
    billSubmissionMode: "all",
    billSubmissionStudentIds: [] as string[],
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
    organizationCreationAllowed: true,
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
    profileEditingAllowed: true,
    profileEditingMode: "all",
    profileEditingStudentIds: [] as string[],
    selfSufficiencyMode: "teacher-initiated",
    autoOpenVotes: false,
    autoCloseVotes: false,
    autoCloseVoteParticipationPct: 75,
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
    organizationNameWordLimit: 100,
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
        const [{ data: cls }, { data: memberships }, { data: membershipRows }, { data: ownedClasses }, { data: coTeacherMemberships }] = await Promise.all([
          supabase.from("classes").select("settings").eq("id", classId).maybeSingle(),
          supabase.rpc("class_directory", { target_class: classId }),
          supabase
            .from("class_memberships")
            .select("user_id,email,role,status")
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
        const emailByMemberId = new Map((membershipRows ?? []).map((row: any) => [row.user_id, row.email ?? ""]));
        const roleByMemberId = new Map((membershipRows ?? []).map((row: any) => [row.user_id, row.role ?? "student"]));
        const directoryIds = new Set((memberships ?? []).map((row: any) => row.user_id));
        const members = [
          ...(memberships ?? []).map((row: any) => ({
          id: row.user_id,
          email: emailByMemberId.get(row.user_id) ?? "",
          role: row.role ?? roleByMemberId.get(row.user_id) ?? "student",
          name: row.display_name ?? emailByMemberId.get(row.user_id) ?? "Member",
          })),
          ...(membershipRows ?? [])
            .filter((row: any) => !directoryIds.has(row.user_id))
            .map((row: any) => ({
              id: row.user_id,
              email: row.email ?? "",
              role: row.role ?? "student",
              name: row.email ?? "Member",
            })),
        ] as MemberOption[];
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
        const s = (cls as any)?.settings ?? {};
        const savedAuthorityTags = (s?.bills?.assignmentAuthorityTags ?? []) as AuthorityTag[];
        const mergedAuthorityTags = savedAuthorityTags.filter((tag) => tag.type !== "teacher");
        setSettingsState((prev) => ({
          ...prev,
          allowedParties: s?.parties?.allowed ?? prev.allowedParties,
          allowStudentCreatedParties: s?.parties?.allowStudentCreated ?? prev.allowStudentCreatedParties,
          requirePartyApproval: s?.parties?.requireApproval ?? prev.requirePartyApproval,
          autoApproveParties: s?.parties?.autoApprove ?? prev.autoApproveParties,
          enabledCommittees: s?.committees?.enabled ?? prev.enabledCommittees,
          committeeSubcommitteesEnabled: s?.committees?.subcommitteesEnabled ?? prev.committeeSubcommitteesEnabled,
          enabledSubcommittees: s?.committees?.enabledSubcommittees ?? prev.enabledSubcommittees,
          committeeCapacitiesByName: s?.committees?.capacitiesByName ?? prev.committeeCapacitiesByName,
          allowSelfJoinCommittees: !!s?.committees?.allowSelfJoin,
          committeeAssignmentMode: s?.committees?.assignmentMode ?? prev.committeeAssignmentMode,
          chairElectionMode: s?.committees?.chairElectionMode ?? prev.chairElectionMode,
          chairVoteThresholdPct: s?.committees?.chairVoteThresholdPct ?? prev.chairVoteThresholdPct,
          enableParties: s?.organizations?.enableParties ?? prev.enableParties,
          enableCommittees: s?.organizations?.enableCommittees ?? prev.enableCommittees,
          enableCaucuses: s?.organizations?.enableCaucuses ?? prev.enableCaucuses,
          enableOrganizations: s?.organizations?.enabled ?? prev.enableOrganizations,
          organizationCreationAllowed: s?.organizations?.creationAllowed ?? prev.organizationCreationAllowed,
          partyLeadershipElectionMode: s?.parties?.leadershipElectionMode ?? prev.partyLeadershipElectionMode,
          enableBills: s?.bills?.enabled ?? s?.bills?.allowDrafts ?? prev.enableBills,
          billSubmissionMode: s?.bills?.submissionMode ?? ((s?.bills?.enabled ?? s?.bills?.allowDrafts ?? prev.enableBills) ? prev.billSubmissionMode : "none"),
          billSubmissionStudentIds: s?.bills?.submissionStudentIds ?? prev.billSubmissionStudentIds,
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
          profileEditingAllowed: s?.profiles?.editingAllowed ?? prev.profileEditingAllowed,
          profileEditingMode: s?.profiles?.editingMode ?? (s?.profiles?.editingAllowed === false ? "none" : prev.profileEditingMode),
          profileEditingStudentIds: s?.profiles?.editingStudentIds ?? prev.profileEditingStudentIds,
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
          organizationNameWordLimit: s?.wordLimits?.organizationName ?? prev.organizationNameWordLimit,
          organizationDescriptionWordLimit: s?.wordLimits?.organizationDescription ?? prev.organizationDescriptionWordLimit,
          announcementWordLimit: s?.wordLimits?.announcement ?? prev.announcementWordLimit,
          commentWordLimit: s?.wordLimits?.comment ?? prev.commentWordLimit,
          selfSufficiencyMode: s?.automation?.selfSufficiencyMode ?? prev.selfSufficiencyMode,
          autoOpenVotes: s?.automation?.autoOpenVotes ?? prev.autoOpenVotes,
          autoCloseVotes: s?.automation?.autoCloseVotes ?? prev.autoCloseVotes,
          autoCloseVoteParticipationPct: s?.automation?.autoCloseVoteParticipationPct ?? prev.autoCloseVoteParticipationPct,
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

  useEffect(() => {
    const closeSearches = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (authorityOpen && target && !authoritySearchRef.current?.contains(target)) setAuthorityOpen(false);
      if (billSubmissionOpen && target && !billSubmissionSearchRef.current?.contains(target)) setBillSubmissionOpen(false);
      if (profileEditingOpen && target && !profileEditingSearchRef.current?.contains(target)) setProfileEditingOpen(false);
    };
    document.addEventListener("pointerdown", closeSearches);
    return () => document.removeEventListener("pointerdown", closeSearches);
  }, [authorityOpen, billSubmissionOpen, profileEditingOpen]);

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
    const { data: committeeRows } = await supabase.from("committees").select("id,name").eq("class_id", classId).in("name", settings.enabledCommittees.length ? settings.enabledCommittees : [""]);
    const subcommitteeRows = (committeeRows ?? []).flatMap((committee: any) =>
      (settings.committeeSubcommitteesEnabled ? (houseCommitteeSubcommittees[committee.name] ?? []) : [])
        .filter((name) => settings.enabledSubcommittees.includes(`${committee.name}::${name}`))
        .map((name) => ({
        committee_id: committee.id,
        class_id: classId,
        name,
        description: "",
      })),
    );
    if (subcommitteeRows.length) {
      await supabase.from("subcommittees").upsert(subcommitteeRows as any, { onConflict: "committee_id,name" });
    }
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
                subcommitteesEnabled: settings.committeeSubcommitteesEnabled,
                enabledSubcommittees: settings.enabledSubcommittees,
                capacitiesByName: settings.committeeCapacitiesByName,
                assignmentMode: settings.allowSelfJoinCommittees ? "self-join" : settings.committeeAssignmentMode,
                chairElectionMode: settings.chairElectionMode,
                chairVoteThresholdPct: settings.chairVoteThresholdPct,
                allowSelfJoin: settings.allowSelfJoinCommittees,
              },
              organizations: {
                ...(existing?.organizations ?? {}),
                enabled: settings.enableOrganizations,
                creationAllowed: settings.organizationCreationAllowed,
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
                allowed: settings.allowedParties,
                allowStudentCreated: settings.allowStudentCreatedParties,
                requireApproval: settings.requirePartyApproval,
                autoApprove: settings.autoApproveParties,
                leadershipElectionMode: settings.partyLeadershipElectionMode,
              },
              committees: {
                ...(existing?.committees ?? {}),
                enabled: settings.enabledCommittees,
                subcommitteesEnabled: settings.committeeSubcommitteesEnabled,
                enabledSubcommittees: settings.enabledSubcommittees,
                capacitiesByName: settings.committeeCapacitiesByName,
                assignmentMode: settings.allowSelfJoinCommittees ? "self-join" : settings.committeeAssignmentMode,
                allowSelfJoin: settings.allowSelfJoinCommittees,
                chairElectionMode: settings.chairElectionMode,
                chairVoteThresholdPct: settings.chairVoteThresholdPct,
                votePassThresholdPct: Math.min(100, Math.max(1, Number(settings.committeeVotePassThresholdPct) || 50)),
              },
              bills: {
                ...(existing?.bills ?? {}),
                enabled: settings.enableBills,
                submissionMode: settings.billSubmissionMode,
                submissionStudentIds: settings.billSubmissionStudentIds,
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
                editingAllowed: settings.profileEditingAllowed,
                editingMode: settings.profileEditingMode,
                editingStudentIds: settings.profileEditingStudentIds,
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
              automation: {
                ...(existing?.automation ?? {}),
                selfSufficiencyMode: settings.selfSufficiencyMode,
                autoOpenVotes: settings.autoOpenVotes,
                autoCloseVotes: settings.autoCloseVotes,
                autoCloseVoteParticipationPct: Math.min(100, Math.max(1, Number(settings.autoCloseVoteParticipationPct) || 75)),
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
                organizationName: Math.min(200, Math.max(1, Number(settings.organizationNameWordLimit) || 100)),
                organizationDescription: Math.min(500, Math.max(1, Number(settings.organizationDescriptionWordLimit) || 500)),
                announcement: Math.min(1000, Math.max(1, Number(settings.announcementWordLimit) || 1000)),
                comment: Math.min(500, Math.max(1, Number(settings.commentWordLimit) || 500)),
              },
            }),
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings }).eq("id", activeClassId);
      if (error) throw error;
      await syncPartiesAndCommittees(activeClassId);
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

  const speakerAuthorityCandidate: AuthorityTag = {
    id: "speaker-of-the-house",
    label: `Speaker of the House: ${speakerName === "No speaker selected" ? "None" : speakerName}`,
    type: "role",
  };
  const authorityMatches = (tag: AuthorityTag) => {
    const query = authoritySearch.trim().toLowerCase();
    const matches = !query || tag.label.toLowerCase().includes(query);
    const unused = !settings.billAssignmentAuthorityTags.some((item) => item.id === tag.id && item.type === tag.type);
    return matches && unused;
  };
  const showSpeakerAuthorityCandidate = authorityMatches(speakerAuthorityCandidate);
  const studentAuthorityCandidates = memberOptions
    .filter((member) => member.role === "student")
    .map((member) => ({ id: member.id, label: member.name, type: "member" as const }))
    .filter(authorityMatches);
  const hasAuthorityCandidates = showSpeakerAuthorityCandidate || studentAuthorityCandidates.length > 0;

  const authorityTags = settings.billAssignmentAuthorityTags
    .filter((tag) => tag.type !== "teacher")
    .map((tag) => tag.id === "speaker-of-the-house" && tag.type === "role" ? { ...tag, label: speakerAuthorityCandidate.label } : tag);

  const studentOptions = memberOptions.filter((member) => member.role === "student");
  const selectedBillSubmissionStudents = studentOptions.filter((member) => settings.billSubmissionStudentIds.includes(member.id));
  const billSubmissionCandidates = studentOptions.filter((member) => {
    const query = billSubmissionSearch.trim().toLowerCase();
    return !settings.billSubmissionStudentIds.includes(member.id) && (!query || member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query));
  });

  const addBillSubmissionStudent = (studentId: string) => {
    if (settings.billSubmissionStudentIds.includes(studentId)) return;
    setSettings({ billSubmissionStudentIds: [...settings.billSubmissionStudentIds, studentId] });
    setBillSubmissionSearch("");
  };

  const removeBillSubmissionStudent = (studentId: string) => {
    setSettings({ billSubmissionStudentIds: settings.billSubmissionStudentIds.filter((id) => id !== studentId) });
  };

  const selectedProfileEditingStudents = studentOptions.filter((member) => settings.profileEditingStudentIds.includes(member.id));
  const profileEditingCandidates = studentOptions.filter((member) => {
    const query = profileEditingSearch.trim().toLowerCase();
    return !settings.profileEditingStudentIds.includes(member.id) && (!query || member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query));
  });

  const addProfileEditingStudent = (studentId: string) => {
    if (settings.profileEditingStudentIds.includes(studentId)) return;
    setSettings({ profileEditingStudentIds: [...settings.profileEditingStudentIds, studentId] });
    setProfileEditingSearch("");
  };

  const removeProfileEditingStudent = (studentId: string) => {
    setSettings({ profileEditingStudentIds: settings.profileEditingStudentIds.filter((id) => id !== studentId) });
  };

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
          committeeSubcommitteesEnabled: raw?.committees?.subcommitteesEnabled ?? settings.committeeSubcommitteesEnabled,
          enabledSubcommittees: raw?.committees?.enabledSubcommittees ?? settings.enabledSubcommittees,
          committeeCapacitiesByName: raw?.committees?.capacitiesByName ?? settings.committeeCapacitiesByName,
          committeeAssignmentMode: raw?.committees?.assignmentMode ?? settings.committeeAssignmentMode,
          chairElectionMode: raw?.committees?.chairElectionMode ?? settings.chairElectionMode,
          chairVoteThresholdPct: raw?.committees?.chairVoteThresholdPct ?? settings.chairVoteThresholdPct,
          committeeVotePassThresholdPct: raw?.committees?.votePassThresholdPct ?? settings.committeeVotePassThresholdPct,
          enableOrganizations: raw?.organizations?.enabled ?? settings.enableOrganizations,
          organizationCreationAllowed: raw?.organizations?.creationAllowed ?? settings.organizationCreationAllowed,
          enableParties: raw?.organizations?.enableParties ?? settings.enableParties,
          enableCommittees: raw?.organizations?.enableCommittees ?? settings.enableCommittees,
          enableCaucuses: raw?.organizations?.enableCaucuses ?? settings.enableCaucuses,
          enableBills: raw?.bills?.enabled ?? raw?.bills?.allowDrafts ?? settings.enableBills,
          billSubmissionMode: raw?.bills?.submissionMode ?? settings.billSubmissionMode,
          billSubmissionStudentIds: raw?.bills?.submissionStudentIds ?? settings.billSubmissionStudentIds,
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
          profileEditingAllowed: raw?.profiles?.editingAllowed ?? settings.profileEditingAllowed,
          profileEditingMode: raw?.profiles?.editingMode ?? settings.profileEditingMode,
          profileEditingStudentIds: raw?.profiles?.editingStudentIds ?? settings.profileEditingStudentIds,
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
          organizationNameWordLimit: raw?.wordLimits?.organizationName ?? settings.organizationNameWordLimit,
          organizationDescriptionWordLimit: raw?.wordLimits?.organizationDescription ?? settings.organizationDescriptionWordLimit,
          announcementWordLimit: raw?.wordLimits?.announcement ?? settings.announcementWordLimit,
          commentWordLimit: raw?.wordLimits?.comment ?? settings.commentWordLimit,
          selfSufficiencyMode: raw?.automation?.selfSufficiencyMode ?? settings.selfSufficiencyMode,
          autoOpenVotes: raw?.automation?.autoOpenVotes ?? settings.autoOpenVotes,
          autoCloseVotes: raw?.automation?.autoCloseVotes ?? settings.autoCloseVotes,
          autoCloseVoteParticipationPct: raw?.automation?.autoCloseVoteParticipationPct ?? settings.autoCloseVoteParticipationPct,
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
      billSubmissionMode: "all",
      organizationCreationAllowed: true,
      profileEditingAllowed: true,
      profileEditingMode: "all",
      studentCanCreateBills: true,
      selfSufficiencyMode: "teacher-initiated",
      autoOpenVotes: false,
      autoCloseVotes: false,
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
      applyPresetState({ ...common, announcementBoardsEnabled: false, announcementCommentsEnabled: false, announcementEmotesEnabled: false, profilesEnabled: false, profileEditingAllowed: false, profileEditingMode: "none", enableCaucuses: false, enableOrganizationElections: false }, "Essentialist Simulation applied");
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
          <Toggle key={row.key} variant="checkbox" checked={!!current[row.key]} onChange={(value) => setRoleAction(roleKey, row.key, value)} title={row.label} />
        ))}
      </div>
    );
  };

  const enabledDisabledSelect = (checked: boolean, onChange: (next: boolean) => void, disabled = false) => (
    <div className="w-44">
      <SettingSelect disabled={disabled} value={checked ? "enabled" : "disabled"} onValueChange={(value) => onChange(value === "enabled")}>
        <SelectItem value="enabled">Enabled</SelectItem>
        <SelectItem value="disabled">Disabled</SelectItem>
      </SettingSelect>
    </div>
  );

  const billSubmissionSelect = (
    <div className="w-80">
      <SettingSelect
        value={settings.enableBills ? settings.billSubmissionMode : "none"}
        onValueChange={(value) => {
          if (value === "none") setSettings({ enableBills: true, billSubmissionMode: "none", allowDrafts: false, studentCanCreateBills: false });
          else setSettings({ enableBills: true, billSubmissionMode: value, allowDrafts: true, studentCanCreateBills: true });
        }}
      >
        <SelectItem value="all">Submission allowed</SelectItem>
        <SelectItem value="select">Submission allowed for select students</SelectItem>
        <SelectItem value="none">Submission not allowed</SelectItem>
      </SettingSelect>
    </div>
  );

  const organizationsSelect = (
    <div className="w-80">
      <SettingSelect
        value={!settings.enableOrganizations ? "disabled" : settings.organizationCreationAllowed ? "creation-allowed" : "creation-not-allowed"}
        onValueChange={(value) => {
          if (value === "disabled") setSettings({ enableOrganizations: false, enableParties: false, enableCommittees: false, enableCaucuses: false, organizationCreationAllowed: false });
          else setSettings({ enableOrganizations: true, enableParties: true, enableCommittees: true, enableCaucuses: true, organizationCreationAllowed: value === "creation-allowed" });
        }}
      >
        <SelectItem value="creation-allowed">Enabled, creation allowed</SelectItem>
        <SelectItem value="creation-not-allowed">Enabled, creation not allowed</SelectItem>
        <SelectItem value="disabled">Disabled</SelectItem>
      </SettingSelect>
    </div>
  );

  const committeesSelect = (
    <div className="w-80">
      <SettingSelect
        value={!settings.enableCommittees ? "disabled" : settings.committeeSubcommitteesEnabled ? "with-subcommittees" : "without-subcommittees"}
        onValueChange={(value) => {
          if (value === "disabled") setSettings({ enableCommittees: false, committeeSubcommitteesEnabled: false });
          else setSettings({ enableCommittees: true, committeeSubcommitteesEnabled: value === "with-subcommittees" });
        }}
      >
        <SelectItem value="with-subcommittees">Enabled, with subcommittees</SelectItem>
        <SelectItem value="without-subcommittees">Enabled, without subcommittees</SelectItem>
        <SelectItem value="disabled">Disabled</SelectItem>
      </SettingSelect>
    </div>
  );

  const profilesSelect = (
    <div className="w-80">
      <SettingSelect
        value={!settings.profilesEnabled ? "disabled" : settings.profileEditingMode === "select" ? "editing-select" : settings.profileEditingAllowed ? "editing-allowed" : "editing-not-allowed"}
        onValueChange={(value) => {
          if (value === "disabled") setSettings({ profilesEnabled: false, profileEditingAllowed: false });
          else setSettings({ profilesEnabled: true, profileEditingAllowed: value !== "editing-not-allowed", profileEditingMode: value === "editing-select" ? "select" : value === "editing-allowed" ? "all" : "none" });
        }}
      >
        <SelectItem value="editing-allowed">Enabled, editing allowed</SelectItem>
        <SelectItem value="editing-select">Enabled, editing allowed for select students</SelectItem>
        <SelectItem value="editing-not-allowed">Enabled, editing not allowed</SelectItem>
        <SelectItem value="disabled">Disabled</SelectItem>
      </SettingSelect>
    </div>
  );

  const section = () => {
    if (activeTab === "general") {
      const quickSetups = [
        {
          id: "all-online" as const,
          name: "Enable all features",
          description: "Enable all features - optimal for digital courses and centralizing participation online.",
          classes: "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50",
          selectedClasses: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
          tagClasses: "bg-blue-600 text-white",
        },
        {
          id: "blended" as const,
          name: "Disable message boards",
          description: "Disable message boards to facilitate in-person discussion.",
          classes: "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50",
          selectedClasses: "border-blue-500 bg-blue-50 ring-1 ring-blue-100",
          tagClasses: "bg-blue-600 text-white",
        },
        {
          id: "core" as const,
          name: "Disable non-essential tools",
          description: "Disable message boards, profiles, and non-essential tools to refine for time or complexity constraints.",
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
            <div className="mb-2 text-sm font-semibold text-gray-900">Level of Virtual Features</div>
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
            <div className="mt-4 text-sm font-semibold text-gray-900">Self-sufficiency</div>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                { id: "teacher-initiated", name: "Actions are teacher-initiated", description: "Teachers open and close major simulation actions manually." },
                { id: "self-sufficient", name: "Simulation is fully self-sufficient", description: "Votes can open automatically and close after the configured participation threshold." },
              ].map((item) => {
                const selected = settings.selfSufficiencyMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSettings({
                      selfSufficiencyMode: item.id,
                      autoOpenVotes: item.id === "self-sufficient",
                      autoCloseVotes: item.id === "self-sufficient",
                    })}
                    className={`rounded-lg border-2 bg-white p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-100" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"}`}
                  >
                    <span className="block text-base font-semibold text-gray-950">{item.name}</span>
                    <span className="mt-1 block text-sm leading-5 text-gray-600">{item.description}</span>
                  </button>
                );
              })}
            </div>
            {settings.selfSufficiencyMode === "self-sufficient" && (
              <div className="mt-2">
                <SettingRow
                  title="Auto-close vote threshold"
                  description="Automatically close votes once this percentage of present members have voted."
                  control={<PercentInput value={settings.autoCloseVoteParticipationPct} onChange={(value) => setSettings({ autoCloseVoteParticipationPct: value })} />}
                />
              </div>
            )}
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
            {settings.billSubmissionMode === "select" && (
              <SettingRow
                indent
                title="Students allowed to submit bills"
                description="Only selected students can submit bill drafts."
                wide
                control={
                  <div
                    ref={billSubmissionSearchRef}
                    className="relative ml-auto w-[32rem] max-w-full"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBillSubmissionOpen(false);
                    }}
                  >
                    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500" onClick={() => setBillSubmissionOpen(true)}>
                      <Search className="h-4 w-4 shrink-0 text-gray-400" />
                      {selectedBillSubmissionStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => removeBillSubmissionStudent(student.id)}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          {student.name} x
                        </button>
                      ))}
                      <input
                        value={billSubmissionSearch}
                        onChange={(event) => setBillSubmissionSearch(event.target.value)}
                        onFocus={() => setBillSubmissionOpen(true)}
                        placeholder="Search students"
                        className="min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                      />
                    </div>
                    {billSubmissionOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                        {billSubmissionCandidates.length ? (
                          billSubmissionCandidates.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => addBillSubmissionStudent(student.id)}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                            >
                              {student.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            )}
            <SettingRow indent title="Bill word limit" description="Maximum words allowed in bill text." control={<WordLimitInput label="" value={settings.billWordLimit} max={5000} onChange={(value) => setSettings({ billWordLimit: value })} />} />
            <SettingsGroup
              title="Cosponsorship"
              action={
                <div className="w-[22rem]">
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
          <SettingsGroup title="Floor" action={enabledDisabledSelect(settings.enableFloor, (v) => setSettings({ enableFloor: v }), !settings.enableBills)}>
            <div className="text-sm text-gray-600">Use the floor page for debate queues and final votes.</div>
            <DisabledBlock disabled={!settings.enableFloor}>
              <SettingRow
                title="Floor pass threshold"
                description="Percentage of present members needed to pass."
                indent
                control={
                  <div className="flex flex-wrap items-center gap-2">
                    <PercentInput value={settings.floorVoteThresholdPct} onChange={(value) => setSettings({ floorVoteThresholdPct: value, floorVoteThreshold: value >= 67 ? "two-thirds" : "custom" })} />
                    <button type="button" onClick={() => setSettings({ floorVoteThresholdPct: 50, floorVoteThreshold: "simple-majority" })} className={`rounded-md border px-2 py-1.5 text-sm font-medium ${settings.floorVoteThresholdPct === 50 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>1/2</button>
                    <button type="button" onClick={() => setSettings({ floorVoteThresholdPct: 67, floorVoteThreshold: "two-thirds" })} className={`rounded-md border px-2 py-1.5 text-sm font-medium ${settings.floorVoteThresholdPct === 67 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>2/3</button>
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
              title="Organization name word limit"
              description="Maximum words allowed in organization names."
              control={<WordLimitInput label="" value={settings.organizationNameWordLimit} max={200} onChange={(value) => setSettings({ organizationNameWordLimit: value })} />}
            />
            <SettingRow
              indent
              title="Organization description word limit"
              description="Maximum words allowed in organization about sections."
              control={<WordLimitInput label="" value={settings.organizationDescriptionWordLimit} max={500} onChange={(value) => setSettings({ organizationDescriptionWordLimit: value })} />}
            />
          </DisabledBlock>
          <SettingsGroup title="Parties" disabled={!settings.enableOrganizations} action={enabledDisabledSelect(settings.enableParties, (v) => setSettings({ enableParties: v }), !settings.enableOrganizations)}>
            <DisabledBlock disabled={!settings.enableParties}>
              <SettingRow
                title="Default parties"
                description="Choose which parties are created and approved for this class."
                wide
                control={
                  <div className="ml-auto w-[32rem] max-w-full">
                    <CompactDefaultsDropdown
                      title="Default parties"
                      selected={settings.allowedParties.filter((party) => defaultPartyOptions.includes(party))}
                      options={defaultPartyOptions}
                      optionDetails={Object.fromEntries(defaultPartyOptions.map((party) => [party, partyDetails[party] ? (
                        <InfoTooltip label={`${party} history`}>
                          <p>{partyDetails[party].text}</p>
                          <a href={partyDetails[party].url} target="_blank" rel="noreferrer" className="mt-2 block text-blue-600 underline">Official website</a>
                        </InfoTooltip>
                      ) : null]))}
                      onToggle={(party) => setSettings({ allowedParties: settings.allowedParties.includes(party) ? settings.allowedParties.filter((p) => p !== party) : [...settings.allowedParties, party] })}
                      onSelectAll={() => setSettings({ allowedParties: [...defaultPartyOptions] })}
                      onDeselectAll={() => setSettings({ allowedParties: [] })}
                    />
                  </div>
                }
              />
              <Toggle checked={settings.allowStudentCreatedParties} onChange={(v) => setSettings({ allowStudentCreatedParties: v })} title="Allow student-created parties" description="Students can propose custom parties from the organizations area." />
              <Toggle checked={settings.requirePartyApproval} onChange={(v) => setSettings({ requirePartyApproval: v })} title="Require approval for new parties" description="Student-created parties stay pending until approved." />
              <SettingRow title="Party leadership" description="Choose how party leaders are selected." control={<SettingSelect value={settings.partyLeadershipElectionMode} onValueChange={(value) => setSettings({ partyLeadershipElectionMode: value })}>
                <SelectItem value="elected">Members elect leadership</SelectItem>
                <SelectItem value="teacher-assigned">Teacher assigns leadership</SelectItem>
              </SettingSelect>} />
            </DisabledBlock>
          </SettingsGroup>
          <SettingsGroup title="Committees" disabled={!settings.enableOrganizations} action={committeesSelect}>
            <DisabledBlock disabled={!settings.enableCommittees}>
              <SettingRow
                title="Default committees"
                description="Choose committees, seed their subcommittees, and set optional join capacities."
                wide
                control={
                  <div className="ml-auto w-[32rem] max-w-full">
                    <CompactDefaultsDropdown
                      title="Default committees"
                      selected={settings.enabledCommittees}
                      options={allCommittees}
                      subtexts={houseCommitteeSubcommittees}
                      capacities={settings.committeeCapacitiesByName}
                      onCapacityChange={(name, value) => setSettings({ committeeCapacitiesByName: { ...settings.committeeCapacitiesByName, [name]: value } })}
                      onToggle={(committee) => setSettings({ enabledCommittees: settings.enabledCommittees.includes(committee) ? settings.enabledCommittees.filter((c) => c !== committee) : [...settings.enabledCommittees, committee] })}
                      onSelectAll={() => setSettings({ enabledCommittees: [...allCommittees] })}
                      onDeselectAll={() => setSettings({ enabledCommittees: [] })}
                    />
                  </div>
                }
              />
              {settings.committeeSubcommitteesEnabled && (
                <SettingRow
                  title="Default subcommittees"
                  description="Choose which subcommittees are created under the selected default committees."
                  wide
                  control={
                    <div className="ml-auto w-[32rem] max-w-full">
                      <CompactDefaultsDropdown
                        title="Default subcommittees"
                        selected={settings.enabledSubcommittees}
                        options={subcommitteeOptions.filter((key) => settings.enabledCommittees.includes(key.split("::")[0]))}
                        labels={subcommitteeLabels}
                        onToggle={(subcommittee) => setSettings({ enabledSubcommittees: settings.enabledSubcommittees.includes(subcommittee) ? settings.enabledSubcommittees.filter((item) => item !== subcommittee) : [...settings.enabledSubcommittees, subcommittee] })}
                        onSelectAll={() => setSettings({ enabledSubcommittees: subcommitteeOptions.filter((key) => settings.enabledCommittees.includes(key.split("::")[0])) })}
                        onDeselectAll={() => setSettings({ enabledSubcommittees: [] })}
                      />
                    </div>
                  }
                />
              )}
              <Toggle checked={settings.allowSelfJoinCommittees} onChange={(v) => setSettings({ allowSelfJoinCommittees: v })} title="Allow students to join committees on their own" description="When off, students submit preference rankings." />
              <div className="grid gap-3">
                <SettingRow title="Assignment mode" description="Choose how students are assigned to committees." control={<SettingSelect value={settings.committeeAssignmentMode} onValueChange={(value) => setSettings({ committeeAssignmentMode: value })}>
                    <SelectItem value="preference">Preference assigned</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="self-join">Self join</SelectItem>
                  </SettingSelect>} />
                <SettingRow title="Chair selection" description="Choose how committee chairs are selected." control={<SettingSelect value={settings.chairElectionMode} onValueChange={(value) => setSettings({ chairElectionMode: value })}>
                    <SelectItem value="elected">Committee vote</SelectItem>
                    <SelectItem value="teacher-assigned">Teacher assigned</SelectItem>
                  </SettingSelect>} />
              </div>
              <SettingRow
                title="Bill assignment authority"
                description="Choose who can assign or refer bills to committees."
                wide
                control={
                  <div
                    ref={authoritySearchRef}
                    className="relative min-w-0"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAuthorityOpen(false);
                    }}
                  >
                    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500" onClick={() => setAuthorityOpen(true)}>
                      <Search className="h-4 w-4 shrink-0 text-gray-400" />
                      {authorityTags.map((tag) => (
                        <button
                          key={`${tag.type}:${tag.id}`}
                          type="button"
                          onClick={() => removeAuthorityTag(tag)}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          {tag.label}{tag.locked ? "" : " x"}
                        </button>
                      ))}
                      <input
                        value={authoritySearch}
                        onChange={(event) => setAuthoritySearch(event.target.value)}
                        onFocus={() => setAuthorityOpen(true)}
                        placeholder="Search students"
                        className="min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                      />
                    </div>
                    {authorityOpen && <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                      {hasAuthorityCandidates ? (
                        <>
                          {showSpeakerAuthorityCandidate && (
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => addAuthorityTag(speakerAuthorityCandidate)}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                            >
                              {speakerAuthorityCandidate.label}
                            </button>
                          )}
                          {studentAuthorityCandidates.map((tag) => (
                        <button
                          key={`${tag.type}:${tag.id}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => addAuthorityTag(tag)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          {tag.label}
                        </button>
                          ))}
                        </>
                      ) : <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
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
          <SettingsGroup title="Caucuses" disabled={!settings.enableOrganizations} action={enabledDisabledSelect(settings.enableCaucuses, (v) => setSettings({ enableCaucuses: v }), !settings.enableOrganizations)}>
            <div className="text-sm text-gray-600">Students can form caucuses and post announcements.</div>
          </SettingsGroup>
          <SettingsGroup title="Announcement boards" disabled={!settings.enableOrganizations} action={enabledDisabledSelect(settings.announcementBoardsEnabled, (v) => setSettings({ announcementBoardsEnabled: v }), !settings.enableOrganizations)}>
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
        </div>
      );
    }
    if (activeTab === "elections") {
      return (
        <div className="space-y-4">
          <DisabledBlock disabled={!settings.enableElections}>
            <SettingsGroup title="House leadership election" action={enabledDisabledSelect(settings.enableHouseLeadershipElection, (v) => setSettings({ enableHouseLeadershipElection: v }), !settings.enableElections)}>
              <div className="text-sm text-gray-600">Students can vote for Speaker of the House from the floor page.</div>
            </SettingsGroup>
            <SettingsGroup title="Organization elections" action={enabledDisabledSelect(settings.enableOrganizationElections, (v) => setSettings({ enableOrganizationElections: v }), !settings.enableElections)}>
              <div className="text-sm text-gray-600">Parties, committees, and caucuses can run their leadership elections.</div>
            </SettingsGroup>
          </DisabledBlock>
        </div>
      );
    }
    if (activeTab === "profiles") {
      return (
        <div className={`space-y-4 ${settings.profilesEnabled ? "" : "pointer-events-none opacity-45"}`}>
          {settings.profileEditingMode === "select" && (
            <SettingRow
              title="Students allowed to edit profiles"
              description="Only selected students can edit their profile fields."
              wide
              control={
                <div
                  ref={profileEditingSearchRef}
                  className="relative ml-auto w-[32rem] max-w-full"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileEditingOpen(false);
                  }}
                >
                  <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-gray-300 px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500" onClick={() => setProfileEditingOpen(true)}>
                    <Search className="h-4 w-4 shrink-0 text-gray-400" />
                    {selectedProfileEditingStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => removeProfileEditingStudent(student.id)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        {student.name} x
                      </button>
                    ))}
                    <input
                      value={profileEditingSearch}
                      onChange={(event) => setProfileEditingSearch(event.target.value)}
                      onFocus={() => setProfileEditingOpen(true)}
                      placeholder="Search students"
                      className="min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                    />
                  </div>
                  {profileEditingOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                      {profileEditingCandidates.length ? (
                        profileEditingCandidates.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => addProfileEditingStudent(student.id)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                          >
                            {student.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                      )}
                    </div>
                  )}
                </div>
              }
            />
          )}
          <ProfileLayoutEditor embedded />
        </div>
      );
    }
    if (activeTab === "permissions") {
      return (
        <div className="space-y-4">
          <SettingsGroup title="Students">
            <Toggle variant="checkbox" checked={settings.studentCanCreateBills} onChange={(v) => setSettings({ studentCanCreateBills: v })} title="Create bills" />
            <Toggle variant="checkbox" checked={settings.studentCanAnnounce} onChange={(v) => setSettings({ studentCanAnnounce: v })} title="Make announcements in announcement boards" />
            <Toggle variant="checkbox" checked={settings.studentCanComment} onChange={(v) => setSettings({ studentCanComment: v })} title="Make comments in announcement boards" />
            <Toggle variant="checkbox" checked={settings.studentCanReact} onChange={(v) => setSettings({ studentCanReact: v })} title="React to announcements and comments in announcement boards" />
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
            <Toggle variant="checkbox" checked={settings.committeesCanEditBills} onChange={(v) => setSettings({ committeesCanEditBills: v })} title="Revise referred bills" />
            <Toggle variant="checkbox" checked={settings.committeesCanVoteBills} onChange={(v) => setSettings({ committeesCanVoteBills: v })} title="Vote on referred bills" />
            <Toggle variant="checkbox" checked={settings.committeesCanReportBills} onChange={(v) => setSettings({ committeesCanReportBills: v })} title="Committee report" />
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
            <Toggle variant="checkbox" checked={settings.speakerCanReferBills} onChange={(v) => setSettings({ speakerCanReferBills: v })} title="Refer bills to committees" />
            <Toggle variant="checkbox" checked={settings.speakerCanCalendarBills} onChange={(v) => setSettings({ speakerCanCalendarBills: v })} title="Calendar bills" />
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

  const visibleTabs = tabs.filter((tab) => settingsTabIds.includes(tab.id));
  const heading = "Simulation Settings";
  const description = "";
  const activeTabLabel = visibleTabs.find((tab) => tab.id === activeTab)?.label;
  const tabHeaderAction = () => {
    if (activeTab === "bills") return billSubmissionSelect;
    if (activeTab === "organizations") return organizationsSelect;
    if (activeTab === "elections") return enabledDisabledSelect(settings.enableElections, (v) => setSettings({ enableElections: v }));
    if (activeTab === "profiles") return profilesSelect;
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
              <span className="h-px flex-1 border-t border-dotted border-gray-300" aria-hidden="true" />
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
  return <TeacherSettingsPage mode="settings" />;
}

export function SimulationSettings() {
  return <TeacherSettingsPage mode="settings" />;
}
