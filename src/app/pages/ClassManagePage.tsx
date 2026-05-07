import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Activity, ArrowDown, ArrowUp, Check, Copy, Download, FileUp, GripVertical, MailPlus, MoreHorizontal, Plus, Search, Settings, Trash2, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { displayPersonName } from "../utils/displayName";
import { supabase } from "../utils/supabase";

interface RosterMember {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  status: "approved" | "pending" | "invited";
  position: string;
  role: "student" | "teacher";
  party: string;
  constituency: string;
  billCount: number;
  sponsored: Array<{ id: string; label: string }>;
  passed: Array<{ id: string; label: string }>;
  failed: Array<{ id: string; label: string }>;
  cosponsored: Array<{ id: string; label: string }>;
  letters: number;
  committees: Array<{ id: string; name: string }>;
  caucuses: Array<{ id: string; name: string }>;
}

interface ClassDetails {
  id: string;
  name: string;
  classCode: string;
  teacherId: string;
}

type RosterSortKey = "first" | "last" | "role" | "party" | "joined" | "sponsored" | "passed" | "failed" | "cosponsored" | "letters";
type RosterCustomColumn = { id: string; label: string };
type RosterPreferences = {
  customColumns: RosterCustomColumn[];
  customValues: Record<string, Record<string, string>>;
  defaultSortBy: RosterSortKey;
};
type ExportFormat = "csv" | "xls";
type ExportScope = "filtered" | "all";
type ExportListMode = "details" | "counts";
type ExportHeaderMode = "labels" | "keys";

const defaultRosterPreferences: RosterPreferences = {
  customColumns: [],
  customValues: {},
  defaultSortBy: "first",
};

const baseExportColumns = [
  ["name", "Name"],
  ["email", "Email"],
  ["role", "Role"],
  ["positions", "Positions"],
  ["party", "Party"],
  ["constituency", "Constituency"],
  ["sponsored", "Sponsored"],
  ["passed", "Passed"],
  ["failed", "Failed"],
  ["cosponsored", "Cosponsored"],
  ["letters", "Letters"],
  ["committees", "Committees"],
  ["caucuses", "Caucuses"],
] as const;

export function ClassManagePage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [titleFilter, setTitleFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<RosterSortKey>("first");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [rosterTab, setRosterTab] = useState<"members" | "pending">("members");
  const [tableScroll, setTableScroll] = useState({ atStart: true, atEnd: true });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(["name"]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportScope, setExportScope] = useState<ExportScope>("filtered");
  const [exportListMode, setExportListMode] = useState<ExportListMode>("details");
  const [exportHeaderMode, setExportHeaderMode] = useState<ExportHeaderMode>("labels");
  const [exportIncludeSummary, setExportIncludeSummary] = useState(false);
  const [rosterSettingsOpen, setRosterSettingsOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [classSettings, setClassSettings] = useState<Record<string, any>>({});
  const [rosterPreferences, setRosterPreferences] = useState<RosterPreferences>(defaultRosterPreferences);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const rosterImportRef = useRef<HTMLInputElement | null>(null);

  const normalizeRosterPreferences = (raw: any): RosterPreferences => {
    const customColumns = Array.isArray(raw?.customColumns)
      ? raw.customColumns
          .filter((column: any) => typeof column?.id === "string" && typeof column?.label === "string" && column.label.trim())
          .map((column: any) => ({ id: column.id, label: column.label.trim() }))
      : [];
    const defaultSortBy = (["first", "last", "role", "party", "joined", "sponsored", "passed", "failed", "cosponsored", "letters"] as RosterSortKey[]).includes(raw?.defaultSortBy)
      ? raw.defaultSortBy
      : "first";
    return {
      customColumns,
      customValues: raw?.customValues && typeof raw.customValues === "object" ? raw.customValues : {},
      defaultSortBy,
    };
  };

  const saveRosterPreferences = async (nextRoster: RosterPreferences, options: { silent?: boolean } = {}) => {
    if (!classId) return;
    const nextSettings = { ...(classSettings ?? {}), roster: nextRoster };
    setRosterPreferences(nextRoster);
    setClassSettings(nextSettings);
    const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
    if (error) {
      toast.error(error.message || "Could not save roster");
      return;
    }
    if (!options.silent) toast.success("Roster saved");
  };

  const loadClassData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      if (user) {
        await supabase.from("profiles").upsert({
          user_id: user.id,
          class_id: classId,
          role: "teacher",
          display_name: user.user_metadata?.name ?? null,
        });
      }

      const { data: cls, error: cErr } = await supabase.from("classes").select("id,name,class_code,teacher_id,settings").eq("id", classId).single();
      if (cErr) throw cErr;
      setClassDetails({ id: cls.id, name: cls.name, classCode: cls.class_code, teacherId: cls.teacher_id });
      const loadedSettings = ((cls as any).settings ?? {}) as Record<string, any>;
      const loadedRosterPreferences = normalizeRosterPreferences(loadedSettings.roster);
      setClassSettings(loadedSettings);
      setRosterPreferences(loadedRosterPreferences);
      setSortBy(loadedRosterPreferences.defaultSortBy);

      const { data: roster, error: rErr } = await supabase
        .from("class_memberships")
        .select("user_id,created_at,status,email,role")
        .eq("class_id", classId)
        .in("role", ["student", "teacher"]);
      if (rErr) throw rErr;

      const userIds = (roster ?? []).map((row: any) => row.user_id);
      const [{ data: profiles }, { data: bills }, { data: cosponsors }, { data: letters }, { data: committeeRows }, { data: caucusRows }, { data: partyRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,role,party,constituency_name")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("bills")
          .select("id,author_user_id,hr_label,title,bill_number,status")
          .eq("class_id", classId),
        supabase.from("bill_cosponsors").select("user_id,bill_id,bills(id,hr_label,title)").eq("class_id", classId),
        supabase.from("dear_colleague_letters").select("id,author_user_id").eq("class_id", classId),
        supabase.from("committee_members").select("user_id,role,committees(id,name)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("caucus_members").select("user_id,role,caucuses(id,title)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("parties").select("id,name").eq("class_id", classId),
      ]);
      const partyNameToId = new Map((partyRows ?? []).map((party: any) => [String(party.name).toLowerCase(), party.id]));
      const { data: partyRoleRows } = await supabase
        .from("party_member_roles")
        .select("user_id,role,party_id")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"])
        .in("party_id", Array.from(partyNameToId.values()).length ? Array.from(partyNameToId.values()) : ["00000000-0000-0000-0000-000000000000"]);
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile]));
      const sponsoredMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const bill of bills ?? []) {
        const authorId = (bill as any).author_user_id;
        const label = `${(bill as any).hr_label ?? ((bill as any).bill_number ? `H.R. ${(bill as any).bill_number}` : "Bill")} - ${(bill as any).title ?? "Untitled"}`;
        sponsoredMap.set(authorId, [...(sponsoredMap.get(authorId) ?? []), { id: (bill as any).id, label }]);
      }
      const passedMap = new Map<string, Array<{ id: string; label: string }>>();
      const failedMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const bill of bills ?? []) {
        const row = bill as any;
        const label = `${row.hr_label ?? (row.bill_number ? `H.R. ${row.bill_number}` : "Bill")} - ${row.title ?? "Untitled"}`;
        if (row.status === "passed") passedMap.set(row.author_user_id, [...(passedMap.get(row.author_user_id) ?? []), { id: row.id, label }]);
        if (row.status === "failed") failedMap.set(row.author_user_id, [...(failedMap.get(row.author_user_id) ?? []), { id: row.id, label }]);
      }
      const cosponsorMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const row of cosponsors ?? []) {
        const bill = (row as any).bills;
        const label = `${bill?.hr_label ?? "Bill"} - ${bill?.title ?? "Untitled"}`;
        cosponsorMap.set((row as any).user_id, [...(cosponsorMap.get((row as any).user_id) ?? []), { id: bill?.id ?? (row as any).bill_id, label }]);
      }
      const letterCounts = new Map<string, number>();
      for (const letter of letters ?? []) letterCounts.set((letter as any).author_user_id, (letterCounts.get((letter as any).author_user_id) ?? 0) + 1);
      const committeeMap = new Map<string, Array<{ id: string; name: string }>>();
      const positionMap = new Map<string, string[]>();
      const roleLabel = (role: string) => role === "member" ? "" : role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
      for (const row of committeeRows ?? []) {
        const committee = (row as any).committees;
        if (committee) committeeMap.set((row as any).user_id, [...(committeeMap.get((row as any).user_id) ?? []), { id: committee.id, name: committee.name }]);
        const label = roleLabel((row as any).role ?? "member");
        if (label) positionMap.set((row as any).user_id, [...(positionMap.get((row as any).user_id) ?? []), `${label}, ${committee?.name ?? "Committee"}`]);
      }
      const caucusMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const row of caucusRows ?? []) {
        const caucus = (row as any).caucuses;
        if (caucus) caucusMap.set((row as any).user_id, [...(caucusMap.get((row as any).user_id) ?? []), { id: caucus.id, name: caucus.title }]);
        const label = roleLabel((row as any).role ?? "member");
        if (label) positionMap.set((row as any).user_id, [...(positionMap.get((row as any).user_id) ?? []), `${label}, ${caucus?.title ?? "Caucus"}`]);
      }
      for (const row of partyRoleRows ?? []) {
        const partyName = (partyRows ?? []).find((party: any) => party.id === (row as any).party_id)?.name ?? "Party";
        const label = roleLabel((row as any).role ?? "");
        if (label) positionMap.set((row as any).user_id, [...(positionMap.get((row as any).user_id) ?? []), `${label}, ${partyName}`]);
      }

      setStudents(
        (roster ?? []).map((row: any) => ({
          id: row.user_id,
          name: profileMap.get(row.user_id)?.display_name ?? "Student",
          email: row.email ?? "N/A",
          joinedAt: row.created_at,
          status: (row.status ?? "approved") as "approved" | "pending" | "invited",
          role: (profileMap.get(row.user_id)?.role ?? row.role ?? "student") as "student" | "teacher",
          position: positionMap.get(row.user_id)?.join("; ") || "N/A",
          party: profileMap.get(row.user_id)?.party ?? "N/A",
          constituency: profileMap.get(row.user_id)?.constituency_name ?? "N/A",
          sponsored: sponsoredMap.get(row.user_id) ?? [],
          passed: passedMap.get(row.user_id) ?? [],
          failed: failedMap.get(row.user_id) ?? [],
          cosponsored: cosponsorMap.get(row.user_id) ?? [],
          letters: letterCounts.get(row.user_id) ?? 0,
          committees: committeeMap.get(row.user_id) ?? [],
          caucuses: caucusMap.get(row.user_id) ?? [],
          billCount: sponsoredMap.get(row.user_id)?.length ?? 0,
        })),
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to load class data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClassData();
  }, [classId]);

  useEffect(() => {
    if (!actionMenuOpen) return;
    const close = () => {
      setActionMenuOpen(null);
      setActionMenuPosition(null);
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-roster-actions]")) return;
      if (target && actionMenuRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [actionMenuOpen]);

  const approveMember = async (memberId: string) => {
    if (!classId) return;
    const { error } = await supabase
      .from("class_memberships")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("user_id", memberId)
      .eq("class_id", classId);
    if (error) return toast.error("Failed to approve member");
    toast.success("Member approved");
    await loadClassData();
  };

  const removeMember = (student: RosterMember) => {
    setConfirmDialog({
      title: "Remove member?",
      message: `${student.name} will be removed from this class.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: async () => {
        if (!classId) return;
        const { error } = await supabase.from("class_memberships").delete().eq("user_id", student.id).eq("class_id", classId);
        if (error) throw error;
        await supabase.from("profiles").update({ class_id: null } as any).eq("user_id", student.id).eq("class_id", classId);
        toast.success("Member removed");
        await loadClassData();
      },
    });
  };

  const inviteMember = async () => {
    if (!classId || !inviteEmail.trim()) return;
    const email = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("please enter a valid email address");
      return;
    }
    setInviteBusy(true);
    try {
      const [studentInvite, teacherInvite] = await Promise.all([
        supabase.rpc("invite_student_to_class", { target_class: classId, student_email: email }),
        supabase.rpc("invite_teacher_to_class", { target_class: classId, teacher_email: email }),
      ]);
      if (studentInvite.error && teacherInvite.error && studentInvite.error.message === "EMAIL_REQUIRED") throw studentInvite.error;
      toast.success("invitation sent if user exists");
      setInviteEmail("");
      await loadClassData();
    } catch (e: any) {
      toast.error(e.message === "EMAIL_REQUIRED" ? "please enter a valid email address" : "invitation sent if user exists");
    } finally {
      setInviteBusy(false);
    }
  };

  const copyJoinCode = async () => {
    await navigator.clipboard.writeText(classDetails?.classCode ?? "");
    toast.success("Join code copied");
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const namePart = (name: string, part: "first" | "last") => {
      const raw = name.trim();
      if (raw.includes(",")) {
        const [first, ...rest] = raw.split(",");
        return part === "first" ? first.trim() : rest.join(",").trim();
      }
      return part === "first" ? raw : "";
    };
    return students.filter((student) => {
      if (titleFilter !== "all") {
        const [kind, ...valueParts] = titleFilter.split(":");
        const value = valueParts.join(":");
        if (kind === "role" && student.role !== value) return false;
        if (kind === "position" && student.position !== value) return false;
      }
      if (organizationFilter !== "all") {
        const [kind, ...nameParts] = organizationFilter.split(":");
        const name = nameParts.join(":");
        if (kind === "party" && student.party !== name) return false;
        if (kind === "committee" && !student.committees.some((committee) => committee.name === name)) return false;
        if (kind === "caucus" && !student.caucuses.some((caucus) => caucus.name === name)) return false;
      }
      if (!query) return true;
      return `${student.name} ${displayPersonName(student.name)} ${student.email} ${student.party} ${student.committees.map((item) => item.name).join(" ")} ${student.caucuses.map((item) => item.name).join(" ")}`.toLowerCase().includes(query);
    }).sort((a, b) => {
      if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
      if (sortBy === "sponsored") return b.sponsored.length - a.sponsored.length || a.name.localeCompare(b.name);
      if (sortBy === "passed") return b.passed.length - a.passed.length || a.name.localeCompare(b.name);
      if (sortBy === "failed") return b.failed.length - a.failed.length || a.name.localeCompare(b.name);
      if (sortBy === "cosponsored") return b.cosponsored.length - a.cosponsored.length || a.name.localeCompare(b.name);
      if (sortBy === "letters") return b.letters - a.letters || a.name.localeCompare(b.name);
      if (sortBy === "role") return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
      if (sortBy === "party") return a.party.localeCompare(b.party) || a.name.localeCompare(b.name);
      if (sortBy === "joined") return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime() || a.name.localeCompare(b.name);
      if (sortBy === "last") return namePart(a.name, "last").localeCompare(namePart(b.name, "last")) || namePart(a.name, "first").localeCompare(namePart(b.name, "first"));
      return namePart(a.name, "first").localeCompare(namePart(b.name, "first")) || namePart(a.name, "last").localeCompare(namePart(b.name, "last"));
    });
  }, [organizationFilter, searchQuery, sortBy, students, titleFilter]);

  const approvedMembers = filteredStudents.filter((student) => student.status === "approved");
  const pendingMembers = students
    .filter((student) => student.status !== "approved")
    .filter((student) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return `${student.name} ${displayPersonName(student.name)} ${student.email}`.toLowerCase().includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const totalApprovedStudents = students.filter((student) => student.status === "approved" && student.role === "student").length;
  const totalApprovedTeachers = students.filter((student) => student.status === "approved" && student.role === "teacher").length;

  useEffect(() => {
    updateTableScroll();
  }, [rosterTab, filteredStudents.length]);

  const positionOptions = useMemo(() => Array.from(new Set(students.map((student) => student.position).filter((value) => value && value !== "N/A"))).sort(), [students]);
  const partyOptions = useMemo(() => Array.from(new Set(students.map((student) => student.party).filter((value) => value && value !== "N/A"))).sort(), [students]);
  const committeeOptions = useMemo(() => Array.from(new Set(students.flatMap((student) => student.committees.map((committee) => committee.name)))).sort(), [students]);
  const caucusOptions = useMemo(() => Array.from(new Set(students.flatMap((student) => student.caucuses.map((caucus) => caucus.name)))).sort(), [students]);
  const organizationOptions = useMemo(
    () => [
      ...partyOptions.map((name) => ({ value: `party:${name}`, label: name, group: "Parties" })),
      ...committeeOptions.map((name) => ({ value: `committee:${name}`, label: name, group: "Committees" })),
      ...caucusOptions.map((name) => ({ value: `caucus:${name}`, label: name, group: "Caucuses" })),
    ],
    [caucusOptions, committeeOptions, partyOptions],
  );
  const stickyShadowLeft = `relative after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:w-5 after:translate-x-full after:bg-gradient-to-r after:from-slate-400/18 after:via-slate-300/10 after:to-transparent after:transition-opacity after:duration-300 after:content-[''] ${tableScroll.atStart ? "after:opacity-0" : "after:opacity-100"}`;
  const stickyShadowRight = `relative before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:top-0 before:w-5 before:-translate-x-full before:bg-gradient-to-l before:from-slate-400/18 before:via-slate-300/10 before:to-transparent before:transition-opacity before:duration-300 before:content-[''] ${tableScroll.atEnd ? "before:opacity-0" : "before:opacity-100"}`;

  const updateTableScroll = (element = scrollRef.current) => {
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setTableScroll({ atStart: element.scrollLeft <= 1, atEnd: element.scrollLeft >= max - 1 });
  };

  const linkList = (items: Array<{ id: string; label?: string; name?: string }>, base: string) =>
    items.length ? (
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 3).map((item) => (
          <Link key={item.id} to={`${base}/${item.id}`} className="text-blue-600 hover:underline">
            {item.label ?? item.name}
          </Link>
        ))}
        {items.length > 3 && <span className="text-gray-500">+{items.length - 3}</span>}
      </div>
    ) : "N/A";

  const linkedCountList = (items: Array<{ id: string; label: string }>) =>
    items.length ? (
      <div className="max-w-72 whitespace-normal text-sm">
        <span className="font-semibold">{items.length}</span>
        <span> (</span>
        {items.map((item, index) => (
          <span key={item.id}>
            {index > 0 && <span>; </span>}
            <Link to={`/bills/${item.id}`} className="text-blue-600 hover:underline">{item.label}</Link>
          </span>
        ))}
        <span>)</span>
      </div>
    ) : "0";

  const exportColumnOptions = useMemo(
    () => [
      ...baseExportColumns.map(([key, label]) => ({ key, label })),
      ...rosterPreferences.customColumns.map((column) => ({ key: `custom:${column.id}`, label: column.label })),
    ],
    [rosterPreferences.customColumns],
  );

  const customColumnValue = (memberId: string, columnId: string) => rosterPreferences.customValues?.[memberId]?.[columnId] ?? "";

  const setCustomColumnValue = (memberId: string, columnId: string, value: string) => {
    setRosterPreferences((current) => ({
      ...current,
      customValues: {
        ...current.customValues,
        [memberId]: {
          ...(current.customValues?.[memberId] ?? {}),
          [columnId]: value,
        },
      },
    }));
  };

  const saveCustomColumnValue = async (memberId: string, columnId: string, value: string) => {
    await saveRosterPreferences(
      {
        ...rosterPreferences,
        customValues: {
          ...rosterPreferences.customValues,
          [memberId]: {
            ...(rosterPreferences.customValues?.[memberId] ?? {}),
            [columnId]: value,
          },
        },
      },
      { silent: true },
    );
  };

  const addCustomColumn = async (fallbackLabel?: string) => {
    const label = newColumnName.trim() || fallbackLabel?.trim();
    if (!label) return toast.error("Enter a column name");
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `custom-${Date.now()}`;
    await saveRosterPreferences({
      ...rosterPreferences,
      customColumns: [...rosterPreferences.customColumns, { id, label }],
    });
    setNewColumnName("");
  };

  const updateCustomColumnLabel = (columnId: string, label: string) => {
    setRosterPreferences((current) => ({
      ...current,
      customColumns: current.customColumns.map((column) => column.id === columnId ? { ...column, label } : column),
    }));
  };

  const moveCustomColumn = async (columnId: string, direction: -1 | 1) => {
    const index = rosterPreferences.customColumns.findIndex((column) => column.id === columnId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= rosterPreferences.customColumns.length) return;
    const nextColumns = [...rosterPreferences.customColumns];
    const [column] = nextColumns.splice(index, 1);
    nextColumns.splice(nextIndex, 0, column);
    await saveRosterPreferences({ ...rosterPreferences, customColumns: nextColumns });
  };

  const reorderCustomColumn = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const nextColumns = [...rosterPreferences.customColumns];
    const from = nextColumns.findIndex((column) => column.id === sourceId);
    const to = nextColumns.findIndex((column) => column.id === targetId);
    if (from < 0 || to < 0) return;
    const [column] = nextColumns.splice(from, 1);
    nextColumns.splice(to, 0, column);
    await saveRosterPreferences({ ...rosterPreferences, customColumns: nextColumns }, { silent: true });
  };

  const deleteCustomColumn = async (columnId: string) => {
    const nextValues = Object.fromEntries(
      Object.entries(rosterPreferences.customValues).map(([memberId, values]) => {
        const { [columnId]: _removed, ...rest } = values ?? {};
        return [memberId, rest];
      }),
    );
    await saveRosterPreferences({
      ...rosterPreferences,
      customColumns: rosterPreferences.customColumns.filter((column) => column.id !== columnId),
      customValues: nextValues,
    });
    setExportColumns((current) => current.filter((column) => column !== `custom:${columnId}`));
  };

  const saveRosterSettings = async () => {
    const nextRoster = {
      ...rosterPreferences,
      customColumns: rosterPreferences.customColumns.map((column) => ({ ...column, label: column.label.trim() || "Untitled column" })),
      defaultSortBy: sortBy,
    };
    await saveRosterPreferences(nextRoster);
    setRosterSettingsOpen(false);
  };

  const parseSpreadsheetText = (text: string) => {
    const delimiter = text.includes("\t") ? "\t" : ",";
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  };

  const importCustomColumnsFromFile = async (file: File) => {
    const rows = parseSpreadsheetText(await file.text());
    const [headers, ...dataRows] = rows;
    if (!headers?.length) return toast.error("Could not find spreadsheet headers");
    const normalizedHeaders = headers.map((header) => header.trim());
    const standardHeaders = new Set(["name", "email", "role", "positions", "party", "constituency", "sponsored", "passed", "failed", "cosponsored", "letters", "committees", "caucuses"]);
    const customHeaderIndexes = normalizedHeaders
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => header && !standardHeaders.has(header.toLowerCase()));
    if (!customHeaderIndexes.length) return toast.error("No custom columns found to import");

    const nameIndex = normalizedHeaders.findIndex((header) => header.toLowerCase() === "name");
    const emailIndex = normalizedHeaders.findIndex((header) => header.toLowerCase() === "email");
    const existingByLabel = new Map(rosterPreferences.customColumns.map((column) => [column.label.toLowerCase(), column]));
    const importedColumns = customHeaderIndexes.map(({ header }) => existingByLabel.get(header.toLowerCase()) ?? {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `custom-${Date.now()}-${header}`,
      label: header,
    });
    const memberByEmail = new Map(students.map((student) => [student.email.toLowerCase(), student]));
    const memberByName = new Map(students.map((student) => [displayPersonName(student.name).toLowerCase(), student]));
    const nextValues = { ...rosterPreferences.customValues };
    for (const row of dataRows) {
      const matched = emailIndex >= 0 ? memberByEmail.get((row[emailIndex] ?? "").toLowerCase()) : undefined;
      const member = matched ?? (nameIndex >= 0 ? memberByName.get((row[nameIndex] ?? "").toLowerCase()) : undefined);
      if (!member) continue;
      nextValues[member.id] = { ...(nextValues[member.id] ?? {}) };
      customHeaderIndexes.forEach(({ index }, columnIndex) => {
        const value = row[index] ?? "";
        if (value) nextValues[member.id][importedColumns[columnIndex].id] = value;
      });
    }
    await saveRosterPreferences({
      ...rosterPreferences,
      customColumns: [
        ...rosterPreferences.customColumns,
        ...importedColumns.filter((column) => !rosterPreferences.customColumns.some((existing) => existing.id === column.id)),
      ],
      customValues: nextValues,
    });
    toast.success("Spreadsheet imported");
  };

  const headerFor = (key: string) => {
    const option = exportColumnOptions.find((column) => column.key === key);
    if (!option) return key;
    return exportHeaderMode === "keys" ? key : option.label;
  };

  const exportValueFor = (member: RosterMember, key: string) => {
    if (key.startsWith("custom:")) return customColumnValue(member.id, key.slice("custom:".length));
    if (key === "name") return displayPersonName(member.name);
    if (key === "positions") return member.position;
    if (key === "sponsored") return exportListMode === "counts" ? String(member.sponsored.length) : `${member.sponsored.length}${member.sponsored.length ? ` (${member.sponsored.map((bill) => bill.label).join("; ")})` : ""}`;
    if (key === "passed") return exportListMode === "counts" ? String(member.passed.length) : `${member.passed.length}${member.passed.length ? ` (${member.passed.map((bill) => bill.label).join("; ")})` : ""}`;
    if (key === "failed") return exportListMode === "counts" ? String(member.failed.length) : `${member.failed.length}${member.failed.length ? ` (${member.failed.map((bill) => bill.label).join("; ")})` : ""}`;
    if (key === "cosponsored") return exportListMode === "counts" ? String(member.cosponsored.length) : member.cosponsored.map((bill) => bill.label).join("; ");
    if (key === "committees") return exportListMode === "counts" ? String(member.committees.length) : member.committees.map((item) => item.name).join("; ");
    if (key === "caucuses") return exportListMode === "counts" ? String(member.caucuses.length) : member.caucuses.map((item) => item.name).join("; ");
    return String((member as any)[key] ?? "");
  };

  const exportRoster = () => {
    const columns = exportColumns;
    if (!columns.length) {
      toast.error("Select at least one column to export");
      return;
    }
    const rows = exportScope === "all" ? students.filter((student) => student.status === "approved") : approvedMembers;
    const headers = columns.map(headerFor);
    const tableRows = rows.map((member) => columns.map((column) => exportValueFor(member, column)));
    const safeClassName = (classDetails?.name ?? "class").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "class";
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let blob: Blob;
    let extension = "csv";
    if (exportFormat === "xls") {
      const summary = exportIncludeSummary ? `<p><strong>${escapeHtml(classDetails?.name ?? "Class")}</strong> - ${rows.length} member${rows.length === 1 ? "" : "s"}</p>` : "";
      const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${summary}<table border="1"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
      blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      extension = "xls";
    } else {
      const csvRows = [headers, ...tableRows];
      if (exportIncludeSummary) csvRows.unshift([classDetails?.name ?? "Class", `${rows.length} member${rows.length === 1 ? "" : "s"}`]);
      const csv = csvRows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
      blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeClassName}-roster.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  const rosterTable = (rows: RosterMember[], pending = false) => (
    rows.length === 0 ? (
      <div className="py-10 text-center text-sm text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        No members found.
      </div>
    ) : (
      <div ref={scrollRef} onScroll={(event) => updateTableScroll(event.currentTarget)} className="overflow-x-auto rounded-lg border border-gray-200 bg-white" onMouseEnter={() => updateTableScroll()}>
        <table className="w-full caption-bottom text-sm" style={{ minWidth: `${2050 + rosterPreferences.customColumns.length * 240}px` }}>
          <thead>
            <tr className="border-b">
              <th className={`sticky left-0 z-20 min-w-56 bg-white px-5 py-3 text-left font-medium ${stickyShadowLeft}`}>Name</th>
              <th className="min-w-64 px-5 py-3 text-left font-medium">Email</th>
              <th className="min-w-28 px-5 py-3 text-left font-medium">Role</th>
              <th className="min-w-36 px-5 py-3 text-left font-medium">Positions</th>
              <th className="min-w-56 px-5 py-3 text-left font-medium">Party</th>
              <th className="min-w-44 px-5 py-3 text-left font-medium">Constituency</th>
              <th className="min-w-60 px-5 py-3 text-left font-medium">Sponsored</th>
              <th className="min-w-44 px-5 py-3 text-left font-medium">Passed</th>
              <th className="min-w-44 px-5 py-3 text-left font-medium">Failed</th>
              {rosterPreferences.customColumns.map((column) => (
                <th key={column.id} className="min-w-60 px-5 py-3 text-left font-medium">{column.label}</th>
              ))}
              <th className="min-w-52 px-5 py-3 text-left font-medium">Cosponsored</th>
              <th className="min-w-28 px-5 py-3 text-left font-medium">Letters</th>
              <th className="min-w-52 px-5 py-3 text-left font-medium">Committees</th>
              <th className="min-w-52 px-5 py-3 text-left font-medium">Caucuses</th>
              <th className={`sticky right-0 z-20 min-w-14 bg-white px-2 py-3 text-right font-medium ${stickyShadowRight}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => {
              const isTeacher = student.role === "teacher";
              const isOwner = student.id === classDetails?.teacherId;
              const isCurrentUser = student.id === currentUserId;
              const rowClass = isTeacher || isOwner || isCurrentUser ? "bg-emerald-50" : "bg-white";
              const nameClass = isTeacher || isOwner || isCurrentUser ? "text-emerald-700" : "text-blue-600";
              return (
              <tr key={student.id} className={`${rowClass} border-b`}>
                <td className={`sticky left-0 z-10 px-5 py-3 font-medium ${stickyShadowLeft} ${rowClass}`}>
                  <Link to={`/profile/${student.id}`} className={`${nameClass} hover:underline`}>{displayPersonName(student.name)}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {isOwner && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Owner</span>}
                    {isCurrentUser && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">You</span>}
                    {pending && student.status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Join request</span>}
                    {pending && student.status === "invited" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Invitation sent</span>}
                  </div>
                </td>
                <td className="px-5 py-3">{student.email}</td>
                <td className="px-5 py-3 capitalize">{student.role}</td>
                <td className="px-5 py-3">{student.position}</td>
                <td className="px-5 py-3">{student.party !== "N/A" ? <Link to={`/parties?party=${encodeURIComponent(student.party)}`} className="text-blue-600 hover:underline">{student.party}</Link> : "N/A"}</td>
                <td className="px-5 py-3">{student.constituency}</td>
                <td className="px-5 py-3">{linkedCountList(student.sponsored)}</td>
                <td className="px-5 py-3">{linkedCountList(student.passed)}</td>
                <td className="px-5 py-3">{linkedCountList(student.failed)}</td>
                {rosterPreferences.customColumns.map((column) => (
                  <td key={column.id} className="px-5 py-3">
                    <input
                      value={customColumnValue(student.id, column.id)}
                      onChange={(event) => setCustomColumnValue(student.id, column.id, event.target.value)}
                      onBlur={(event) => void saveCustomColumnValue(student.id, column.id, event.target.value)}
                      placeholder="Add text"
                      className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                ))}
                <td className="px-5 py-3">{linkList(student.cosponsored, "/bills")}</td>
                <td className="px-5 py-3"><Link to={`/dear-colleague/inbox?author=${encodeURIComponent(student.name)}`} className="text-blue-600 hover:underline">{student.letters}</Link></td>
                <td className="px-5 py-3">{linkList(student.committees, "/committees")}</td>
                <td className="px-5 py-3">{linkList(student.caucuses, "/caucuses")}</td>
                <td className={`sticky right-0 z-10 px-2 py-3 text-right ${stickyShadowRight} ${rowClass}`}>
                  <div className="inline-flex">
                    <button
                      type="button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const top = rect.bottom + 150 > window.innerHeight ? Math.max(8, rect.top - 138) : rect.bottom + 6;
                        const rightSide = rect.right + 8;
                        const left = rightSide + 176 <= window.innerWidth - 8 ? rightSide : Math.max(8, rect.left - 184);
                        setActionMenuPosition({ top, left });
                        setActionMenuOpen((open) => open === student.id ? null : student.id);
                      }}
                      data-roster-actions
                      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const pendingTable = (rows: RosterMember[]) => (
    rows.length === 0 ? (
      <div className="py-10 text-center text-sm text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        No pending members found.
      </div>
    ) : (
      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-3">
                  <Link to={`/profile/${student.id}`} className="font-medium text-blue-600 hover:underline">{displayPersonName(student.name)}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {student.status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Join request</span>}
                    {student.status === "invited" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Invitation sent</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{student.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  if (!classDetails && loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="h-9 w-64 animate-pulse rounded bg-gray-200" />
              <p className="mt-2 text-sm text-gray-500">Roster</p>
            </div>
            <TeacherClassTabs classId={classId} active="roster" />
          </div>
          <Card>
            <CardContent>
              <div className="py-10 text-center text-sm text-gray-500">Loading students...</div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!classDetails) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Button onClick={() => navigate("/teacher/dashboard")}>Back</Button></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{classDetails.name}</h1>
              <p className="mt-1 text-sm text-gray-600">Roster</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <TeacherClassTabs classId={classId} active="roster" />
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Join code</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-mono text-3xl font-bold leading-none text-blue-700">{classDetails.classCode}</span>
              <button type="button" onClick={() => void copyJoinCode()} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Copy join code">
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Enrollment</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{totalApprovedStudents} student{totalApprovedStudents === 1 ? "" : "s"}</div>
            <div className="text-sm text-gray-600">{totalApprovedTeachers} teacher{totalApprovedTeachers === 1 ? "" : "s"}</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1">
                  {(["members", "pending"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRosterTab(tab)}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${rosterTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:flex-nowrap">
                <div className="relative min-w-[13rem] flex-1 xl:w-56 xl:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search roster..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {rosterTab === "members" && (
                  <>
                    <Select value={titleFilter} onValueChange={setTitleFilter}>
                      <SelectTrigger className="h-10 w-[150px] bg-white"><SelectValue placeholder="All titles" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All titles</SelectItem>
                        <SelectItem value="role:teacher">Teachers</SelectItem>
                        <SelectItem value="role:student">Students</SelectItem>
                        {positionOptions.map((position) => <SelectItem key={position} value={`position:${position}`}>{position}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                      <SelectTrigger className="h-10 w-[180px] bg-white"><SelectValue placeholder="All organizations" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All organizations</SelectItem>
                        {organizationOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.group}: {option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                      <SelectTrigger className="h-10 w-[150px] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">Sort first name</SelectItem>
                        <SelectItem value="last">Sort last name</SelectItem>
                        <SelectItem value="role">Sort role</SelectItem>
                        <SelectItem value="party">Sort party</SelectItem>
                        <SelectItem value="joined">Sort joined date</SelectItem>
                        <SelectItem value="sponsored">Sort sponsored</SelectItem>
                        <SelectItem value="passed">Sort passed</SelectItem>
                        <SelectItem value="failed">Sort failed</SelectItem>
                        <SelectItem value="cosponsored">Sort cosponsored</SelectItem>
                        <SelectItem value="letters">Sort letters</SelectItem>
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={() => setRosterSettingsOpen(true)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" aria-label="Settings">
                      <Settings className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setExportDialogOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading students...</div>
            ) : rosterTab === "members" ? (
              rosterTable(approvedMembers)
            ) : (
              <>
                  <div className="mb-4 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
                    <MailPlus className="hidden h-5 w-5 text-gray-500 sm:block" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="Invite student or teacher by email"
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button type="button" onClick={() => void inviteMember()} disabled={inviteBusy || !inviteEmail.trim()}>
                      Invite
                    </Button>
                  </div>
                  {pendingTable(pendingMembers)}
                </>
            )}
          </CardContent>
        </Card>
      </main>
      {actionMenuOpen && actionMenuPosition && (
        <div
          ref={actionMenuRef}
          className="fixed z-[100] w-44 rounded-md border border-gray-200 bg-white p-1 text-left shadow-xl"
          style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
        >
          {(() => {
            const member = students.find((student) => student.id === actionMenuOpen);
            if (!member) return null;
            const pending = member.status !== "approved";
            return (
              <>
                {pending && member.status === "pending" && <button type="button" onClick={() => { setActionMenuOpen(null); void approveMember(member.id); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Check className="h-4 w-4" />Approve</button>}
                <Link onClick={() => setActionMenuOpen(null)} to={`/teacher/class/${classId}/activity?student=${encodeURIComponent(member.name)}`} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Activity className="h-4 w-4" />View activity</Link>
                <button type="button" onClick={() => { setActionMenuOpen(null); removeMember(member); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"><UserX className="h-4 w-4" />Remove</button>
              </>
            );
          })()}
        </div>
      )}
      {rosterSettingsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-gray-600">Customize columns, row order, and imported roster data.</p>
              </div>
              <button type="button" onClick={() => setRosterSettingsOpen(false)} className="rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Preview</div>
                    <div className="text-sm text-gray-600">Drag custom columns to reorder the roster.</div>
                  </div>
                  <button type="button" onClick={() => rosterImportRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <FileUp className="h-4 w-4" />
                    Import spreadsheet
                  </button>
                  <input
                    ref={rosterImportRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void importCustomColumnsFromFile(file);
                    }}
                  />
                </div>
                <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                  <div
                    className="grid border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500"
                    style={{
                      minWidth: `${640 + rosterPreferences.customColumns.length * 160}px`,
                      gridTemplateColumns: `180px 180px ${rosterPreferences.customColumns.map(() => "160px").join(" ")} 160px 100px 120px 80px`,
                    }}
                  >
                    {["Name", "Email", ...rosterPreferences.customColumns.map((column) => column.label), "Party", "Passed", "Cosponsors"].map((label, index) => (
                      <div
                        key={`${label}-${index}`}
                        draggable={index >= 2 && index < 2 + rosterPreferences.customColumns.length}
                        onDragStart={() => {
                          const column = rosterPreferences.customColumns[index - 2];
                          if (column) setDraggingColumnId(column.id);
                        }}
                        onDragOver={(event) => {
                          if (index >= 2 && index < 2 + rosterPreferences.customColumns.length) event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const column = rosterPreferences.customColumns[index - 2];
                          if (draggingColumnId && column) void reorderCustomColumn(draggingColumnId, column.id);
                          setDraggingColumnId(null);
                        }}
                        onDragEnd={() => setDraggingColumnId(null)}
                        className={`flex min-h-10 items-center gap-2 border-r border-gray-200 px-3 ${index >= 2 && index < 2 + rosterPreferences.customColumns.length ? "cursor-grab bg-white" : ""}`}
                      >
                        {index >= 2 && index < 2 + rosterPreferences.customColumns.length && <GripVertical className="h-4 w-4 text-gray-400" />}
                        <span className="truncate">{label}</span>
                      </div>
                    ))}
                    <button type="button" onClick={() => void addCustomColumn("New column")} className="flex min-h-10 items-center justify-center text-blue-600 hover:bg-blue-50" aria-label="Add column">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {students.filter((student) => student.status === "approved").slice(0, 3).map((student) => (
                    <div
                      key={student.id}
                      className="grid border-b border-gray-100 text-sm last:border-b-0"
                      style={{
                        minWidth: `${640 + rosterPreferences.customColumns.length * 160}px`,
                        gridTemplateColumns: `180px 180px ${rosterPreferences.customColumns.map(() => "160px").join(" ")} 160px 100px 120px 80px`,
                      }}
                    >
                      <div className="truncate border-r border-gray-100 px-3 py-2 font-medium text-gray-900">{displayPersonName(student.name)}</div>
                      <div className="truncate border-r border-gray-100 px-3 py-2 text-gray-600">{student.email}</div>
                      {rosterPreferences.customColumns.map((column) => (
                        <div key={column.id} className="truncate border-r border-gray-100 px-3 py-2 text-gray-600">{customColumnValue(student.id, column.id) || "-"}</div>
                      ))}
                      <div className="truncate border-r border-gray-100 px-3 py-2 text-gray-600">{student.party}</div>
                      <div className="border-r border-gray-100 px-3 py-2 text-gray-600">{student.passed.length}</div>
                      <div className="border-r border-gray-100 px-3 py-2 text-gray-600">{student.cosponsored.length}</div>
                      <div />
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-[190px_1fr] md:items-center">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Default row order</div>
                  <div className="text-sm text-gray-600">Used when this roster opens.</div>
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as RosterSortKey)}>
                  <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First name</SelectItem>
                    <SelectItem value="last">Last name</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                    <SelectItem value="joined">Joined date</SelectItem>
                    <SelectItem value="sponsored">Sponsored bills</SelectItem>
                    <SelectItem value="passed">Passed bills</SelectItem>
                    <SelectItem value="failed">Failed bills</SelectItem>
                    <SelectItem value="cosponsored">Cosponsored bills</SelectItem>
                    <SelectItem value="letters">Dear colleague letters</SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Custom columns</div>
                  <div className="text-sm text-gray-600">Teachers can type custom text into these columns directly in the roster.</div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void addCustomColumn();
                    }}
                    placeholder="Column name"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button type="button" onClick={() => void addCustomColumn()} className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {rosterPreferences.customColumns.length ? rosterPreferences.customColumns.map((column, index) => (
                    <div key={column.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                      <input
                        value={column.label}
                        onChange={(event) => updateCustomColumnLabel(column.id, event.target.value)}
                        onBlur={(event) => void saveRosterPreferences({
                          ...rosterPreferences,
                          customColumns: rosterPreferences.customColumns.map((item) => item.id === column.id ? { ...item, label: event.target.value.trim() || "Untitled column" } : item),
                        }, { silent: true })}
                        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={() => void moveCustomColumn(column.id, -1)} disabled={index === 0} className="rounded-md p-2 text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-40" aria-label="Move column left">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void moveCustomColumn(column.id, 1)} disabled={index === rosterPreferences.customColumns.length - 1} className="rounded-md p-2 text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-40" aria-label="Move column right">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void deleteCustomColumn(column.id)} className="rounded-md p-2 text-red-500 hover:bg-red-50" aria-label="Delete column">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No custom columns yet.</div>
                  )}
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setRosterSettingsOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <Button type="button" onClick={() => void saveRosterSettings()}>Save</Button>
            </div>
          </div>
        </div>
      )}
      {exportDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Export roster</h2>
              </div>
              <button type="button" onClick={() => setExportDialogOpen(false)} className="rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Columns</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExportColumns(exportColumnOptions.map((column) => column.key))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Select all</button>
                    <button type="button" onClick={() => setExportColumns(["name"])} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Name only</button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {exportColumnOptions.map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white p-2 text-sm hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={exportColumns.includes(key)}
                        onChange={(event) => setExportColumns((current) => event.target.checked ? [...current, key] : current.filter((column) => column !== key))}
                        className="h-4 w-4"
                      />
                      <span className="min-w-0 truncate">{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Excel formatting</div>
                  <div className="text-sm text-gray-600">Control what is exported.</div>
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  File type
                  <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                    <SelectTrigger className="mt-1 h-10 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">Excel-compatible CSV</SelectItem>
                      <SelectItem value="xls">Excel worksheet (.xls)</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Rows
                  <Select value={exportScope} onValueChange={(value) => setExportScope(value as ExportScope)}>
                    <SelectTrigger className="mt-1 h-10 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filtered">Current filtered roster</SelectItem>
                      <SelectItem value="all">All approved members</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Multi-item cells
                  <Select value={exportListMode} onValueChange={(value) => setExportListMode(value as ExportListMode)}>
                    <SelectTrigger className="mt-1 h-10 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="details">Counts with names</SelectItem>
                      <SelectItem value="counts">Counts only</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Column headers
                  <Select value={exportHeaderMode} onValueChange={(value) => setExportHeaderMode(value as ExportHeaderMode)}>
                    <SelectTrigger className="mt-1 h-10 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="labels">Readable labels</SelectItem>
                      <SelectItem value="keys">Raw field keys</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md bg-white p-2 text-sm text-gray-700">
                  <input type="checkbox" checked={exportIncludeSummary} onChange={(event) => setExportIncludeSummary(event.target.checked)} className="h-4 w-4" />
                  Include class summary row
                </label>
              </section>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setExportDialogOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <Button type="button" onClick={exportRoster}>Export</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
