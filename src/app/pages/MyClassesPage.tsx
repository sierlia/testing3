import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { CheckCircle2, Layers, Plus, X } from "lucide-react";

import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { supabase } from "../utils/supabase";
import { readActiveClassPreference, saveActiveClassPreference } from "../utils/activeClass";

type ClassCard = {
  id: string;
  name: string;
  class_code: string;
  status: string;
};

function normalizeJoinCode(code: string) {
  return code.trim().toUpperCase();
}

export function MyClassesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const approvedClasses = useMemo(() => classes.filter((classItem) => classItem.status === "approved"), [classes]);

  const persistActiveClass = async (uid: string, classItem: ClassCard) => {
    const desiredRole = "student";
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: uid, class_id: classItem.id, role: desiredRole } as any);
    if (error) throw error;
    saveActiveClassPreference(uid, classItem.id, classItem.name);
    setActiveClassId(classItem.id);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const [{ data: memberships, error: mErr }, { data: profile }] = await Promise.all([
        supabase
          .from("class_memberships")
          .select("class_id,status")
          .eq("user_id", uid)
          .eq("role", "student"),
        supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle(),
      ]);
      if (mErr) throw mErr;

      const byClass = new Map((memberships ?? []).map((membership: any) => [membership.class_id, membership.status ?? "approved"]));
      const profileClassId = (profile as any)?.class_id as string | undefined;
      if (profileClassId && !byClass.has(profileClassId)) byClass.set(profileClassId, "approved");

      const classIds = Array.from(byClass.keys());
      if (classIds.length === 0) {
        setClasses([]);
        setActiveClassId(null);
        return;
      }

      const { data: classRows, error: cErr } = await supabase.from("classes").select("id,name,class_code").in("id", classIds);
      if (cErr) throw cErr;

      const nextClasses = ((classRows ?? []) as any[])
        .map((classRow) => ({ ...classRow, status: byClass.get(classRow.id) ?? "approved" }))
        .sort((a, b) => {
          if (a.status === "approved" && b.status !== "approved") return -1;
          if (a.status !== "approved" && b.status === "approved") return 1;
          return a.name.localeCompare(b.name);
        });
      setClasses(nextClasses);

      const cookieClassId = readActiveClassPreference(uid);
      const preferredClassId =
        nextClasses.find((classItem) => classItem.id === cookieClassId && classItem.status === "approved")?.id ??
        nextClasses.find((classItem) => classItem.id === profileClassId && classItem.status === "approved")?.id ??
        nextClasses.find((classItem) => classItem.status === "approved")?.id ??
        null;
      setActiveClassId(preferredClassId);

      const preferredClass = nextClasses.find((classItem) => classItem.id === preferredClassId);
      if (preferredClass && profileClassId !== preferredClass.id) {
        await persistActiveClass(uid, preferredClass);
      } else if (preferredClass) {
        saveActiveClassPreference(uid, preferredClass.id, preferredClass.name);
      }
    } catch (error: any) {
      toast.error(error.message || "Could not load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [navigate]);

  const openClassDashboard = async (classItem: ClassCard) => {
    if (classItem.status !== "approved") {
      toast.info(classItem.status === "pending" ? "This class is waiting for teacher approval." : "Accept the invitation before opening this class.");
      return;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");
      await persistActiveClass(uid, classItem);
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Could not open class");
    }
  };

  const mergeJoinedClass = (joinedRow: any) => {
    if (!joinedRow?.joined_class_id) return;
    setClasses((current) => {
      const nextCard = {
        id: joinedRow.joined_class_id,
        name: joinedRow.joined_class_name,
        class_code: joinedRow.joined_class_code,
        status: joinedRow.joined_status ?? "approved",
      };
      const exists = current.some((classItem) => classItem.id === nextCard.id);
      return exists
        ? current.map((classItem) => (classItem.id === nextCard.id ? { ...classItem, ...nextCard } : classItem))
        : [...current, nextCard].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const joinClass = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode = normalizeJoinCode(joinCode);
    if (!normalizedCode) return;
    setJoining(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const { data: joined, error } = await supabase.rpc("join_class_by_code", { join_code_input: normalizedCode });
      if (error) throw error;
      const joinedRow = Array.isArray(joined) ? joined[0] : joined;
      if (!joinedRow) throw new Error("Invalid class code");
      mergeJoinedClass(joinedRow);
      setJoinCode("");
      setShowJoinModal(false);

      if (joinedRow.joined_status === "pending") {
        toast.info(`Requested to join ${joinedRow.joined_class_name}`);
      } else {
        toast.success(`Joined ${joinedRow.joined_class_name}`);
        if (!activeClassId) {
          const nextCard = {
            id: joinedRow.joined_class_id,
            name: joinedRow.joined_class_name,
            class_code: joinedRow.joined_class_code,
            status: joinedRow.joined_status ?? "approved",
          };
          await persistActiveClass(uid, nextCard);
        }
      }
      await load();
    } catch (error: any) {
      if (error.message === "INVALID_CLASS_CODE") toast.error("Invalid class code");
      else if (error.message === "CLASS_NOT_OPEN") toast.error("This class is not open for students to join yet.");
      else toast.error(error.message || "Could not join class");
    } finally {
      setJoining(false);
    }
  };

  const updateInvitation = async (classId: string, accepted: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = accepted
      ? await supabase
          .from("class_memberships")
          .update({ status: "approved", approved_at: new Date().toISOString() } as any)
          .eq("class_id", classId)
          .eq("user_id", uid)
      : await supabase.from("class_memberships").delete().eq("class_id", classId).eq("user_id", uid);
    if (error) return toast.error(error.message || "Could not update invitation");
    toast.success(accepted ? "Invitation accepted" : "Invitation declined");
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
            <p className="mt-1 text-gray-600">Join classes and choose which workspace opens by default.</p>
          </div>
          <Button onClick={() => setShowJoinModal(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Join Class
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading...</div>
        ) : classes.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Join a Class to Continue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-gray-600">Enter the class code from your teacher to start working.</p>
              <Button onClick={() => setShowJoinModal(true)}>Join Class</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((classItem) => {
              const active = activeClassId === classItem.id && classItem.status === "approved";
              const disabled = classItem.status !== "approved";
              return (
                <Card
                  key={classItem.id}
                  role={disabled ? undefined : "button"}
                  tabIndex={disabled ? undefined : 0}
                  onClick={() => !disabled && void openClassDashboard(classItem)}
                  onKeyDown={(event) => {
                    if (!disabled && (event.key === "Enter" || event.key === " ")) void openClassDashboard(classItem);
                  }}
                  className={`transition ${active ? "border-blue-300 bg-blue-50 shadow-sm" : "bg-white hover:border-gray-300 hover:shadow-md"} ${disabled ? "opacity-80" : "cursor-pointer"}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <p className="mt-1 text-sm text-gray-600">
                          Join code: <span className="font-mono font-semibold">{classItem.class_code}</span>
                        </p>
                      </div>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {classItem.status === "invited" ? (
                      <div className="flex gap-2">
                        <Button onClick={(event) => { event.stopPropagation(); void updateInvitation(classItem.id, true); }}>Accept</Button>
                        <Button variant="outline" onClick={(event) => { event.stopPropagation(); void updateInvitation(classItem.id, false); }}>Decline</Button>
                      </div>
                    ) : classItem.status === "pending" ? (
                      <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Pending approval</div>
                    ) : active ? (
                      <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">Opens by default</div>
                    ) : (
                      <Button variant="outline" onClick={(event) => { event.stopPropagation(); void openClassDashboard(classItem); }}>
                        <Layers className="mr-2 h-4 w-4" />
                        Switch
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && approvedClasses.length === 0 && classes.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You have class requests, but no approved class yet.
          </div>
        ) : null}
      </main>

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="relative w-full max-w-md">
            <button type="button" onClick={() => setShowJoinModal(false)} className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <CardHeader>
              <CardTitle>Join a Class</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={joinClass} className="space-y-4">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
                  maxLength={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-lg uppercase outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC123"
                  required
                />
                <Button className="w-full" disabled={joining}>{joining ? "Joining..." : "Join Class"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default MyClassesPage;
