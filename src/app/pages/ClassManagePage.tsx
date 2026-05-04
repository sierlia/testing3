import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Activity, Check, Copy, Download, MailPlus, MoreHorizontal, Search, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { TeacherClassTabs } from "../components/TeacherClassTabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
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
  const [sortBy, setSortBy] = useState<"name" | "role" | "party" | "sponsored">("name");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"student" | "teacher">("student");
  const [inviteBusy, setInviteBusy] = useState(false);

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
      const [{ data: profiles }, { data: bills }, { data: cosponsors }, { data: letters }, { data: committeeRows }, { data: caucusRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,role,party,constituency_name")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("bills")
          .select("id,author_user_id,hr_label,title")
          .eq("class_id", classId),
        supabase.from("bill_cosponsors").select("user_id,bill_id,bills(id,hr_label,title)").eq("class_id", classId),
        supabase.from("dear_colleague_letters").select("id,author_user_id").eq("class_id", classId),
        supabase.from("committee_members").select("user_id,committees(id,name)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("caucus_members").select("user_id,caucuses(id,title)").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile]));
      const sponsoredMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const bill of bills ?? []) {
        const authorId = (bill as any).author_user_id;
        sponsoredMap.set(authorId, [...(sponsoredMap.get(authorId) ?? []), { id: (bill as any).id, label: (bill as any).hr_label ?? (bill as any).title ?? "Bill" }]);
      }
      const cosponsorMap = new Map<string, Array<{ id: string; label: string }>>();
      for (const row of cosponsors ?? []) {
        const bill = (row as any).bills;
        cosponsorMap.set((row as any).user_id, [...(cosponsorMap.get((row as any).user_id) ?? []), { id: bill?.id ?? (row as any).bill_id, label: bill?.hr_label ?? bill?.title ?? "Bill" }]);
      }
      const letterCounts = new Map<string, number>();
      for (const letter of letters ?? []) letterCounts.set((letter as any).author_user_id, (letterCounts.get((letter as any).author_user_id) ?? 0) + 1);
      const committeeMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const row of committeeRows ?? []) {
        const committee = (row as any).committees;
        if (committee) committeeMap.set((row as any).user_id, [...(committeeMap.get((row as any).user_id) ?? []), { id: committee.id, name: committee.name }]);
      }
      const caucusMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const row of caucusRows ?? []) {
        const caucus = (row as any).caucuses;
        if (caucus) caucusMap.set((row as any).user_id, [...(caucusMap.get((row as any).user_id) ?? []), { id: caucus.id, name: caucus.title }]);
      }

      setStudents(
        (roster ?? []).map((row: any) => ({
          id: row.user_id,
          name: profileMap.get(row.user_id)?.display_name ?? "Student",
          email: row.email ?? "N/A",
          joinedAt: row.created_at,
          status: (row.status ?? "approved") as "approved" | "pending" | "invited",
          role: (profileMap.get(row.user_id)?.role ?? row.role ?? "student") as "student" | "teacher",
          position: "N/A",
          party: profileMap.get(row.user_id)?.party ?? "N/A",
          constituency: profileMap.get(row.user_id)?.constituency_name ?? "N/A",
          sponsored: sponsoredMap.get(row.user_id) ?? [],
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
      const rpcName = inviteRole === "teacher" ? "invite_teacher_to_class" : "invite_student_to_class";
      const args = inviteRole === "teacher" ? { target_class: classId, teacher_email: email } : { target_class: classId, student_email: email };
      const { error } = await supabase.rpc(rpcName, args as any);
      if (error) throw error;
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
    return students.filter((student) => {
      if (roleFilter !== "all" && student.role !== roleFilter) return false;
      if (!query) return true;
      return student.name.toLowerCase().includes(query) || student.email.toLowerCase().includes(query) || student.party.toLowerCase().includes(query);
    }).sort((a, b) => {
      if (sortBy === "role") return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
      if (sortBy === "party") return a.party.localeCompare(b.party) || a.name.localeCompare(b.name);
      if (sortBy === "sponsored") return b.sponsored.length - a.sponsored.length || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [roleFilter, searchQuery, sortBy, students]);

  const approvedMembers = filteredStudents.filter((student) => student.status === "approved");
  const pendingMembers = filteredStudents.filter((student) => student.status !== "approved");
  const totalApprovedStudents = students.filter((student) => student.status === "approved" && student.role === "student").length;
  const totalApprovedTeachers = students.filter((student) => student.status === "approved" && student.role === "teacher").length;

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

  const exportRoster = () => {
    const columns = ["name", "email", "role", "position", "party", "constituency", "sponsored", "cosponsored", "letters", "committees", "caucuses"];
    const valueFor = (member: RosterMember, key: string) => {
      if (key === "sponsored") return member.sponsored.map((bill) => bill.label).join("; ");
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
  };

  const rosterTable = (rows: RosterMember[], pending = false) => (
    rows.length === 0 ? (
      <div className="py-10 text-center text-sm text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        No members found.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-white">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Constituency</TableHead>
              <TableHead>Sponsored</TableHead>
              <TableHead>Cosponsored</TableHead>
              <TableHead>Letters</TableHead>
              <TableHead>Committees</TableHead>
              <TableHead>Caucuses</TableHead>
              <TableHead className="sticky right-0 z-10 bg-white text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((student) => {
              const isTeacher = student.role === "teacher";
              const isOwner = student.id === classDetails?.teacherId;
              const isCurrentUser = student.id === currentUserId;
              const rowClass = isTeacher || isOwner || isCurrentUser ? "bg-emerald-50" : "bg-white";
              const nameClass = isTeacher || isOwner || isCurrentUser ? "text-emerald-700" : "text-blue-600";
              return (
              <TableRow key={student.id} className={`${rowClass} hover:bg-transparent`}>
                <TableCell className={`sticky left-0 z-10 font-medium ${rowClass}`}>
                  <Link to={`/profile/${student.id}`} className={`${nameClass} hover:underline`}>{student.name}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {isOwner && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Owner</span>}
                    {isCurrentUser && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">You</span>}
                    {pending && student.status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Join request</span>}
                    {pending && student.status === "invited" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Invitation sent</span>}
                  </div>
                </TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell className="capitalize">{student.role}</TableCell>
                <TableCell>{student.position}</TableCell>
                <TableCell>{student.party !== "N/A" ? <Link to={`/parties?party=${encodeURIComponent(student.party)}`} className="text-blue-600 hover:underline">{student.party}</Link> : "N/A"}</TableCell>
                <TableCell>{student.constituency}</TableCell>
                <TableCell>{linkList(student.sponsored, "/bills")}</TableCell>
                <TableCell>{linkList(student.cosponsored, "/bills")}</TableCell>
                <TableCell><Link to={`/dear-colleague/inbox?author=${encodeURIComponent(student.name)}`} className="text-blue-600 hover:underline">{student.letters}</Link></TableCell>
                <TableCell>{linkList(student.committees, "/committees")}</TableCell>
                <TableCell>{linkList(student.caucuses, "/caucuses")}</TableCell>
                <TableCell className={`sticky right-0 z-10 text-right ${rowClass}`}>
                  <div className="relative inline-flex">
                    <button type="button" onClick={() => setActionMenuOpen((open) => open === student.id ? null : student.id)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {actionMenuOpen === student.id && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white p-1 text-left shadow-lg">
                        {pending && student.status === "pending" && <button type="button" onClick={() => void approveMember(student.id)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Check className="h-4 w-4" />Approve</button>}
                        <Link to={`/teacher/class/${classId}/activity?student=${encodeURIComponent(student.name)}`} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Activity className="h-4 w-4" />View activity</Link>
                        <button type="button" onClick={() => removeMember(student)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"><UserX className="h-4 w-4" />Remove</button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
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
              <div>
                <CardTitle>Roster</CardTitle>
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
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as any)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                  <option value="name">Sort name</option>
                  <option value="role">Sort role</option>
                  <option value="party">Sort party</option>
                  <option value="sponsored">Sort sponsored</option>
                </select>
                <button type="button" onClick={exportRoster} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
              <MailPlus className="hidden h-5 w-5 text-gray-500 sm:block" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Invite by email"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "student" | "teacher")} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              <Button type="button" onClick={() => void inviteMember()} disabled={inviteBusy || !inviteEmail.trim()}>
                Invite
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading students...</div>
            ) : (
              <Tabs defaultValue="members">
                <TabsList>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                </TabsList>
                <TabsContent value="members">{rosterTable(approvedMembers)}</TabsContent>
                <TabsContent value="pending">{rosterTable(pendingMembers, true)}</TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
