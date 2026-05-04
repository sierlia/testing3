import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Activity, Check, Copy, Download, MailPlus, MoreHorizontal, Search, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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

export function ClassManagePage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "teacher">("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  const [caucusFilter, setCaucusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"first" | "last" | "sponsored" | "passed" | "failed" | "cosponsored" | "letters">("first");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [rosterTab, setRosterTab] = useState<"members" | "pending">("members");
  const [tableScroll, setTableScroll] = useState({ atStart: true, atEnd: true });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(["name", "email", "role", "positions", "party", "constituency", "sponsored", "passed", "failed", "cosponsored", "letters", "committees", "caucuses"]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

      const { data: cls, error: cErr } = await supabase.from("classes").select("id,name,class_code,teacher_id").eq("id", classId).single();
      if (cErr) throw cErr;
      setClassDetails({ id: cls.id, name: cls.name, classCode: cls.class_code, teacherId: cls.teacher_id });

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
    const close = () => setActionMenuOpen(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
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
      if (roleFilter !== "all" && student.role !== roleFilter) return false;
      if (positionFilter !== "all" && student.position !== positionFilter) return false;
      if (partyFilter !== "all" && student.party !== partyFilter) return false;
      if (committeeFilter !== "all" && !student.committees.some((committee) => committee.name === committeeFilter)) return false;
      if (caucusFilter !== "all" && !student.caucuses.some((caucus) => caucus.name === caucusFilter)) return false;
      if (!query) return true;
      return `${student.name} ${displayPersonName(student.name)} ${student.email} ${student.party} ${student.committees.map((item) => item.name).join(" ")} ${student.caucuses.map((item) => item.name).join(" ")}`.toLowerCase().includes(query);
    }).sort((a, b) => {
      if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
      if (sortBy === "sponsored") return b.sponsored.length - a.sponsored.length || a.name.localeCompare(b.name);
      if (sortBy === "passed") return b.passed.length - a.passed.length || a.name.localeCompare(b.name);
      if (sortBy === "failed") return b.failed.length - a.failed.length || a.name.localeCompare(b.name);
      if (sortBy === "cosponsored") return b.cosponsored.length - a.cosponsored.length || a.name.localeCompare(b.name);
      if (sortBy === "letters") return b.letters - a.letters || a.name.localeCompare(b.name);
      if (sortBy === "last") return namePart(a.name, "last").localeCompare(namePart(b.name, "last")) || namePart(a.name, "first").localeCompare(namePart(b.name, "first"));
      return namePart(a.name, "first").localeCompare(namePart(b.name, "first")) || namePart(a.name, "last").localeCompare(namePart(b.name, "last"));
    });
  }, [caucusFilter, committeeFilter, partyFilter, positionFilter, roleFilter, searchQuery, sortBy, students]);

  const approvedMembers = filteredStudents.filter((student) => student.status === "approved");
  const pendingMembers = filteredStudents.filter((student) => student.status !== "approved");
  const totalApprovedStudents = students.filter((student) => student.status === "approved" && student.role === "student").length;
  const totalApprovedTeachers = students.filter((student) => student.status === "approved" && student.role === "teacher").length;

  useEffect(() => {
    updateTableScroll();
  }, [rosterTab, filteredStudents.length]);

  const positionOptions = useMemo(() => Array.from(new Set(students.map((student) => student.position).filter((value) => value && value !== "N/A"))).sort(), [students]);
  const partyOptions = useMemo(() => Array.from(new Set(students.map((student) => student.party).filter((value) => value && value !== "N/A"))).sort(), [students]);
  const committeeOptions = useMemo(() => Array.from(new Set(students.flatMap((student) => student.committees.map((committee) => committee.name)))).sort(), [students]);
  const caucusOptions = useMemo(() => Array.from(new Set(students.flatMap((student) => student.caucuses.map((caucus) => caucus.name)))).sort(), [students]);
  const stickyShadowLeft = tableScroll.atStart ? "" : "shadow-[8px_0_16px_-12px_rgba(15,23,42,0.55)]";
  const stickyShadowRight = tableScroll.atEnd ? "" : "shadow-[-8px_0_16px_-12px_rgba(15,23,42,0.55)]";

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

  const exportRoster = () => {
    const columns = exportColumns;
    if (!columns.length) {
      toast.error("Select at least one column to export");
      return;
    }
    const valueFor = (member: RosterMember, key: string) => {
      if (key === "name") return displayPersonName(member.name);
      if (key === "positions") return member.position;
      if (key === "sponsored") return `${member.sponsored.length}${member.sponsored.length ? ` (${member.sponsored.map((bill) => bill.label).join("; ")})` : ""}`;
      if (key === "passed") return `${member.passed.length}${member.passed.length ? ` (${member.passed.map((bill) => bill.label).join("; ")})` : ""}`;
      if (key === "failed") return `${member.failed.length}${member.failed.length ? ` (${member.failed.map((bill) => bill.label).join("; ")})` : ""}`;
      if (key === "cosponsored") return member.cosponsored.map((bill) => bill.label).join("; ");
      if (key === "committees") return member.committees.map((item) => item.name).join("; ");
      if (key === "caucuses") return member.caucuses.map((item) => item.name).join("; ");
      return String((member as any)[key] ?? "");
    };
    const csv = [columns.join(","), ...approvedMembers.map((member) => columns.map((column) => `"${valueFor(member, column).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${classDetails?.name ?? "class"}-roster.csv`;
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
      <div ref={scrollRef} onScroll={(event) => updateTableScroll(event.currentTarget)} className="overflow-x-auto" onMouseEnter={() => updateTableScroll()}>
        <table className="min-w-[2050px] w-full caption-bottom text-sm">
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
              <th className="min-w-52 px-5 py-3 text-left font-medium">Cosponsored</th>
              <th className="min-w-28 px-5 py-3 text-left font-medium">Letters</th>
              <th className="min-w-52 px-5 py-3 text-left font-medium">Committees</th>
              <th className="min-w-52 px-5 py-3 text-left font-medium">Caucuses</th>
              <th className={`sticky right-0 z-20 min-w-20 bg-white px-3 py-3 text-right font-medium ${stickyShadowRight}`}>Actions</th>
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
                <td className="px-5 py-3">{linkList(student.cosponsored, "/bills")}</td>
                <td className="px-5 py-3"><Link to={`/dear-colleague/inbox?author=${encodeURIComponent(student.name)}`} className="text-blue-600 hover:underline">{student.letters}</Link></td>
                <td className="px-5 py-3">{linkList(student.committees, "/committees")}</td>
                <td className="px-5 py-3">{linkList(student.caucuses, "/caucuses")}</td>
                <td className={`sticky right-0 z-10 px-3 py-3 text-right ${stickyShadowRight} ${rowClass}`}>
                  <div className="inline-flex">
                    <button
                      type="button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const top = rect.bottom + 150 > window.innerHeight ? Math.max(8, rect.top - 138) : rect.bottom + 6;
                        setActionMenuPosition({ top, left: Math.max(8, rect.right - 176) });
                        setActionMenuOpen((open) => open === student.id ? null : student.id);
                      }}
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Roster</CardTitle>
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
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="relative min-w-[15rem] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search roster..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as any)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="all">All roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>
                <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="all">All positions</option>
                  {positionOptions.map((position) => <option key={position} value={position}>{position}</option>)}
                </select>
                <select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="all">All parties</option>
                  {partyOptions.map((party) => <option key={party} value={party}>{party}</option>)}
                </select>
                <select value={committeeFilter} onChange={(event) => setCommitteeFilter(event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="all">All committees</option>
                  {committeeOptions.map((committee) => <option key={committee} value={committee}>{committee}</option>)}
                </select>
                <select value={caucusFilter} onChange={(event) => setCaucusFilter(event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="all">All caucuses</option>
                  {caucusOptions.map((caucus) => <option key={caucus} value={caucus}>{caucus}</option>)}
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as any)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="first">Sort first name</option>
                  <option value="last">Sort last name</option>
                  <option value="sponsored">Sort sponsored</option>
                  <option value="passed">Sort passed</option>
                  <option value="failed">Sort failed</option>
                  <option value="cosponsored">Sort cosponsored</option>
                  <option value="letters">Sort letters</option>
                </select>
                <button type="button" onClick={() => setExportDialogOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Download className="h-4 w-4" />
                  Export
                </button>
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
                  {rosterTable(pendingMembers, true)}
                </>
            )}
          </CardContent>
        </Card>
      </main>
      {actionMenuOpen && actionMenuPosition && (
        <div
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
      {exportDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Export roster columns</h2>
            </div>
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto p-5 sm:grid-cols-2">
              {[
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
              ].map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={exportColumns.includes(key)}
                    onChange={(event) => setExportColumns((current) => event.target.checked ? [...current, key] : current.filter((column) => column !== key))}
                  />
                  {label}
                </label>
              ))}
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
