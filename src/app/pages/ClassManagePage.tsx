import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Copy, Search, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { supabase } from "../utils/supabase";

interface Student {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  status: "approved" | "pending";
  position: string;
  billCount: number;
}

interface ClassDetails {
  id: string;
  name: string;
  classCode: string;
}

export function ClassManagePage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const loadClassData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          user_id: user.id,
          class_id: classId,
          role: "teacher",
          display_name: user.user_metadata?.name ?? null,
        });
      }

      const { data: cls, error: cErr } = await supabase.from("classes").select("id,name,class_code").eq("id", classId).single();
      if (cErr) throw cErr;
      setClassDetails({ id: cls.id, name: cls.name, classCode: cls.class_code });

      const { data: roster, error: rErr } = await supabase
        .from("class_memberships")
        .select("user_id,created_at,status,email")
        .eq("class_id", classId)
        .eq("role", "student");
      if (rErr) throw rErr;

      const userIds = (roster ?? []).map((row: any) => row.user_id);
      const [{ data: profiles }, { data: bills }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("bills")
          .select("author_user_id")
          .eq("class_id", classId),
      ]);
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile]));
      const billCounts = new Map<string, number>();
      for (const bill of bills ?? []) {
        const authorId = (bill as any).author_user_id;
        billCounts.set(authorId, (billCounts.get(authorId) ?? 0) + 1);
      }

      setStudents(
        (roster ?? []).map((row: any) => ({
          id: row.user_id,
          name: profileMap.get(row.user_id)?.display_name ?? "Student",
          email: row.email ?? "N/A",
          joinedAt: row.created_at,
          status: (row.status ?? "approved") as "approved" | "pending",
          position: "N/A",
          billCount: billCounts.get(row.user_id) ?? 0,
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

  const approveStudent = async (studentId: string) => {
    if (!classId) return;
    const { error } = await supabase
      .from("class_memberships")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("user_id", studentId)
      .eq("class_id", classId);
    if (error) return toast.error("Failed to approve student");
    toast.success("Student approved");
    await loadClassData();
  };

  const removeStudent = (student: Student) => {
    setConfirmDialog({
      title: "Remove student?",
      message: `${student.name} will be removed from this class.`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: async () => {
        if (!classId) return;
        const { error } = await supabase.from("class_memberships").delete().eq("user_id", student.id).eq("class_id", classId);
        if (error) throw error;
        await supabase.from("profiles").update({ class_id: null } as any).eq("user_id", student.id).eq("class_id", classId);
        toast.success("Student removed");
        await loadClassData();
      },
    });
  };

  const copyJoinCode = async () => {
    await navigator.clipboard.writeText(classDetails?.classCode ?? "");
    toast.success("Join code copied");
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      if (!query) return true;
      return student.name.toLowerCase().includes(query) || student.email.toLowerCase().includes(query);
    });
  }, [searchQuery, students]);

  const approvedStudents = filteredStudents.filter((student) => student.status === "approved");
  const pendingStudents = filteredStudents.filter((student) => student.status === "pending");

  const rosterTable = (rows: Student[], pending = false) => (
    rows.length === 0 ? (
      <div className="py-10 text-center text-sm text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        No students found.
      </div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Bills</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((student) => (
            <TableRow key={student.id}>
              <TableCell className="font-medium">{student.name}</TableCell>
              <TableCell>{student.email}</TableCell>
              <TableCell>{student.position}</TableCell>
              <TableCell>{student.billCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {pending && (
                    <Button variant="ghost" size="sm" onClick={() => void approveStudent(student.id)}>
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => removeStudent(student)} className="text-red-600 hover:text-red-700">
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!classDetails) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Button onClick={() => navigate("/teacher/dashboard")}>Back</Button></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{classDetails.name}</h1>
            <p className="mt-1 text-sm text-gray-600">Student roster</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Join code</div>
              <div className="font-mono text-xl font-bold text-blue-700">{classDetails.classCode}</div>
            </div>
            <button type="button" onClick={() => void copyJoinCode()} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Copy join code">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Students</CardTitle>
              </div>
              <div className="relative w-full sm:max-w-sm self-end">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search students..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="students">
              <TabsList>
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
              <TabsContent value="students">{rosterTable(approvedStudents)}</TabsContent>
              <TabsContent value="pending">{rosterTable(pendingStudents, true)}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
