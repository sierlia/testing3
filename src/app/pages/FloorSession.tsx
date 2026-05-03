import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Check, Minus, Trophy, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { fetchCalendaredBillsForCurrentClass, getCurrentProfileClass } from "../services/bills";
import { supabase } from "../utils/supabase";

type VoteChoice = "yea" | "nay" | "present";
type CalendarItem = Awaited<ReturnType<typeof fetchCalendaredBillsForCurrentClass>>[number];
type SessionRow = { id: string; bill_id: string; status: "open" | "closed"; opened_at: string | null; closed_at: string | null };
type VoteRow = { session_id: string; bill_id: string; user_id: string; vote: VoteChoice };
type SpeakerCandidate = { id: string; name: string; party?: string | null };

function sessionLabel(session: SessionRow | null) {
  if (!session) return "Vote unopened";
  if (session.status === "open") return "Vote open";
  return "Vote closed";
}

export function FloorSession() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [classSettings, setClassSettings] = useState<any>({});
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [speakerVote, setSpeakerVote] = useState<string | null>(null);
  const [speakerCandidates, setSpeakerCandidates] = useState<SpeakerCandidate[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const current = await getCurrentProfileClass();
      setRole(current.profile.role ?? null);
      setMeId(current.userId);
      setClassId(current.classId);
      const [calendarRows, sessionRows, voteRows, directory, classRow] = await Promise.all([
        fetchCalendaredBillsForCurrentClass(),
        supabase.from("bill_floor_sessions").select("id,bill_id,status,opened_at,closed_at").eq("class_id", current.classId),
        supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", current.classId),
        supabase.rpc("class_directory", { target_class: current.classId } as any),
        supabase.from("classes").select("settings").eq("id", current.classId).maybeSingle(),
      ]);
      if (sessionRows.error) throw sessionRows.error;
      if (voteRows.error) throw voteRows.error;
      if (classRow.error) throw classRow.error;
      const students = ((directory.data ?? []) as any[]).filter((person) => person.role !== "teacher");
      setItems([...calendarRows].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
      setSessions((sessionRows.data ?? []) as any);
      setVotes((voteRows.data ?? []) as any);
      setStudentCount(students.length);
      setClassSettings((classRow.data as any)?.settings ?? {});
      setSpeakerCandidates(students.map((student) => ({ id: student.user_id, name: student.display_name ?? "Student", party: student.party })));
    } catch (e: any) {
      toast.error(e.message || "Could not load floor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const speakerConcluded = Boolean(classSettings?.elections?.speakerConcluded);
  const activeItem = useMemo(() => {
    if (items.length === 0) return null;
    const now = Date.now();
    const openOrDue = items.find((item) => {
      const session = sessions.find((row) => row.bill_id === item.bill_id);
      return session?.status === "open" || (new Date(item.scheduled_at).getTime() <= now && session?.status !== "closed");
    });
    return openOrDue ?? items.find((item) => sessions.find((row) => row.bill_id === item.bill_id)?.status !== "closed") ?? items[0];
  }, [items, sessions]);
  const activeSession = activeItem ? sessions.find((s) => s.bill_id === activeItem.bill_id) ?? null : null;
  const nextItems = activeItem ? items.filter((item) => item.bill_id !== activeItem.bill_id).slice(0, 8) : items.slice(0, 8);
  const sessionVotes = activeSession ? votes.filter((v) => v.session_id === activeSession.id) : [];
  const myVote = meId ? sessionVotes.find((v) => v.user_id === meId)?.vote ?? null : null;
  const counts = useMemo(
    () =>
      sessionVotes.reduce(
        (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
        { yea: 0, nay: 0, present: 0 } as Record<VoteChoice, number>,
      ),
    [sessionVotes],
  );
  const totalVoted = counts.yea + counts.nay + counts.present;

  const concludeSpeakerElection = async () => {
    if (!classId || role !== "teacher") return;
    setBusy(true);
    try {
      const nextSettings = {
        ...classSettings,
        elections: { ...(classSettings.elections ?? {}), speakerConcluded: true },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success("Speaker election concluded");
    } catch (e: any) {
      toast.error(e.message || "Could not conclude Speaker election");
    } finally {
      setBusy(false);
    }
  };

  const openVote = async () => {
    if (!activeItem || !classId || !meId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_sessions").upsert(
        {
          class_id: classId,
          bill_id: activeItem.bill_id,
          calendar_id: activeItem.id,
          status: "open",
          opened_by: meId,
          opened_at: new Date().toISOString(),
          closed_at: null,
        } as any,
        { onConflict: "class_id,bill_id" },
      );
      if (error) throw error;
      await supabase.from("bills").update({ status: "floor" } as any).eq("id", activeItem.bill_id).eq("class_id", classId);
      toast.success("Floor vote opened");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not open vote");
    } finally {
      setBusy(false);
    }
  };

  const closeVote = async () => {
    if (!activeSession || !activeItem || !classId) return;
    setBusy(true);
    try {
      const passed = counts.yea > counts.nay;
      const { error } = await supabase.from("bill_floor_sessions").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", activeSession.id);
      if (error) throw error;
      await supabase.from("bills").update({ status: passed ? "passed" : "failed" } as any).eq("id", activeItem.bill_id).eq("class_id", classId);
      toast.success(`Vote closed: bill ${passed ? "passed" : "failed"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not close vote");
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (vote: VoteChoice) => {
    if (!activeSession || !activeItem || !classId || !meId || activeSession.status !== "open" || myVote) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_votes").insert({
        session_id: activeSession.id,
        bill_id: activeItem.bill_id,
        class_id: classId,
        user_id: meId,
        vote,
      } as any);
      if (error) throw error;
      setVotes((prev) => [...prev, { session_id: activeSession.id, bill_id: activeItem.bill_id, user_id: meId, vote }]);
      toast.success("Vote recorded");
    } catch (e: any) {
      toast.error(e.message || "Could not record vote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Floor</h1>
          <p className="text-gray-600">Speaker election, active floor text, and floor votes.</p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading floor...</div>
        ) : !speakerConcluded ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Speaker of the House Election</h2>
                </div>
                <p className="text-sm text-gray-600">Floor bills will appear after the Speaker election is concluded.</p>
              </div>
              {role === "teacher" && (
                <button type="button" onClick={() => void concludeSpeakerElection()} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  Conclude Speaker election
                </button>
              )}
            </div>
            {speakerCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No student candidates are available yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {speakerCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSpeakerVote((prev) => (prev === candidate.id ? null : candidate.id))}
                    className={`rounded-md border p-4 text-left transition-colors ${speakerVote === candidate.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <div className="font-semibold text-gray-900">{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.party ?? "No party"}</div>
                    <div className="mt-3 text-sm font-medium text-blue-700">{speakerVote === candidate.id ? "Selected" : "Vote for Speaker"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No calendared bills are ready for floor session.</div>
        ) : activeItem ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-gray-900">{activeItem.bill.hr_label}</div>
                    <Link to={`/bills/${activeItem.bill_id}`} className="text-2xl font-bold text-gray-900 hover:text-blue-600">{activeItem.bill.title}</Link>
                    <div className="mt-1 text-sm text-gray-600">Scheduled {new Date(activeItem.scheduled_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded px-3 py-1 text-sm font-medium ${activeSession?.status === "open" ? "bg-green-100 text-green-700" : activeSession?.status === "closed" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-700"}`}>
                    {sessionLabel(activeSession)}
                  </span>
                </div>
                <div className="prose max-w-none rounded-md border border-gray-200 bg-white p-5" dangerouslySetInnerHTML={{ __html: activeItem.bill.legislative_text || "<p><em>No legislative text</em></p>" }} />
              </div>

              <div className="overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-sm">
                <div className="bg-blue-600 p-6 text-white">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Vote className="h-6 w-6" />
                      <h2 className="text-xl font-semibold">Floor Vote</h2>
                    </div>
                    {role === "teacher" && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => void openVote()} disabled={busy || activeSession?.status === "open"} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Open vote</button>
                        <button type="button" onClick={() => void closeVote()} disabled={busy || activeSession?.status !== "open"} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Close vote</button>
                      </div>
                    )}
                  </div>
                  {activeSession?.status === "open" && role !== "teacher" ? (
                    <div className="grid grid-cols-3 gap-4">
                      <button type="button" onClick={() => void castVote("yea")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "yea" ? "bg-green-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Check className="mx-auto mb-2 h-6 w-6" />Yea</button>
                      <button type="button" onClick={() => void castVote("nay")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "nay" ? "bg-red-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><X className="mx-auto mb-2 h-6 w-6" />Nay</button>
                      <button type="button" onClick={() => void castVote("present")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "present" ? "bg-gray-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Minus className="mx-auto mb-2 h-6 w-6" />Present</button>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-blue-100">
                      {activeSession?.status === "closed" ? "This floor vote is closed." : activeSession?.status === "open" ? "Teacher controls are active." : "Vote has not opened yet."}
                    </div>
                  )}
                  {myVote && <div className="mt-4 text-center text-sm">Your vote: <strong>{myVote.toUpperCase()}</strong></div>}
                </div>
                <div className="bg-gray-50 p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Live Results</h3>
                  <div className="mb-6 grid grid-cols-4 gap-4">
                    <div className="text-center"><div className="text-3xl font-bold text-green-600">{counts.yea}</div><div className="text-sm text-gray-600">Yea</div></div>
                    <div className="text-center"><div className="text-3xl font-bold text-red-600">{counts.nay}</div><div className="text-sm text-gray-600">Nay</div></div>
                    <div className="text-center"><div className="text-3xl font-bold text-gray-600">{counts.present}</div><div className="text-sm text-gray-600">Present</div></div>
                    <div className="text-center"><div className="text-3xl font-bold text-gray-400">{Math.max(0, studentCount - totalVoted)}</div><div className="text-sm text-gray-600">Not Voted</div></div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-3 rounded-full bg-blue-600" style={{ width: `${studentCount ? (totalVoted / studentCount) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-2 text-right text-xs text-gray-500">{totalVoted} / {studentCount} votes cast</div>
                </div>
              </div>
            </div>

            <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Next bills</h2>
              <div className="space-y-4 border-l border-gray-200 pl-4">
                {nextItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No additional bills queued.</div>
                ) : (
                  nextItems.map((item) => (
                    <Link key={item.id} to={`/bills/${item.bill_id}`} className="block rounded-md p-2 hover:bg-gray-50">
                      <div className="text-xs text-gray-500">{new Date(item.scheduled_at).toLocaleString()}</div>
                      <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                      <div className="line-clamp-2 text-sm text-gray-700">{item.bill.title}</div>
                    </Link>
                  ))
                )}
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
