import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Check, FileText, Minus, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { fetchCalendaredBillsForCurrentClass, getCurrentProfileClass } from "../services/bills";
import { supabase } from "../utils/supabase";

type VoteChoice = "yea" | "nay" | "present";
type CalendarItem = Awaited<ReturnType<typeof fetchCalendaredBillsForCurrentClass>>[number];
type SessionRow = { id: string; bill_id: string; status: "open" | "closed"; opened_at: string | null; closed_at: string | null };
type VoteRow = { session_id: string; bill_id: string; user_id: string; vote: VoteChoice };

export function FloorSession() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const current = await getCurrentProfileClass();
      setRole(current.profile.role ?? null);
      setMeId(current.userId);
      setClassId(current.classId);
      const [calendarRows, sessionRows, voteRows, directory] = await Promise.all([
        fetchCalendaredBillsForCurrentClass(),
        supabase.from("bill_floor_sessions").select("id,bill_id,status,opened_at,closed_at").eq("class_id", current.classId),
        supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", current.classId),
        supabase.rpc("class_directory", { target_class: current.classId } as any),
      ]);
      if (sessionRows.error) throw sessionRows.error;
      if (voteRows.error) throw voteRows.error;
      setItems(calendarRows);
      setSessions((sessionRows.data ?? []) as any);
      setVotes((voteRows.data ?? []) as any);
      setStudentCount(((directory.data ?? []) as any[]).filter((p) => p.role !== "teacher").length);
      setSelectedBillId((prev) => prev ?? calendarRows[0]?.bill_id ?? null);
    } catch (e: any) {
      toast.error(e.message || "Could not load floor session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = items.find((item) => item.bill_id === selectedBillId) ?? null;
  const session = selected ? sessions.find((s) => s.bill_id === selected.bill_id) ?? null : null;
  const sessionVotes = session ? votes.filter((v) => v.session_id === session.id) : [];
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

  const openVote = async () => {
    if (!selected || !classId || !meId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_sessions").upsert(
        {
          class_id: classId,
          bill_id: selected.bill_id,
          calendar_id: selected.id,
          status: "open",
          opened_by: meId,
          opened_at: new Date().toISOString(),
          closed_at: null,
        } as any,
        { onConflict: "class_id,bill_id" },
      );
      if (error) throw error;
      await supabase.from("bills").update({ status: "floor" } as any).eq("id", selected.bill_id).eq("class_id", classId);
      toast.success("Vote opened");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not open vote");
    } finally {
      setBusy(false);
    }
  };

  const closeVote = async () => {
    if (!session || !selected || !classId) return;
    setBusy(true);
    try {
      const passed = counts.yea > counts.nay;
      const { error } = await supabase
        .from("bill_floor_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() } as any)
        .eq("id", session.id);
      if (error) throw error;
      await supabase.from("bills").update({ status: passed ? "passed" : "failed" } as any).eq("id", selected.bill_id).eq("class_id", classId);
      toast.success(`Vote closed: bill ${passed ? "passed" : "failed"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not close vote");
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (vote: VoteChoice) => {
    if (!session || !selected || !classId || !meId || session.status !== "open" || myVote) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bill_floor_votes").insert({
        session_id: session.id,
        bill_id: selected.bill_id,
        class_id: classId,
        user_id: meId,
        vote,
      } as any);
      if (error) throw error;
      setVotes((prev) => [...prev, { session_id: session.id, bill_id: selected.bill_id, class_id: classId, user_id: meId, vote } as any]);
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Floor Session</h1>
          <p className="text-gray-600">Debate and vote on calendared bills</p>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Loading floor session...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No calendared bills are ready for floor session.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-900">Calendared Bills</div>
              <div className="divide-y divide-gray-100">
                {items.map((item) => {
                  const itemSession = sessions.find((s) => s.bill_id === item.bill_id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedBillId(item.bill_id)}
                      className={`w-full p-4 text-left hover:bg-gray-50 ${selectedBillId === item.bill_id ? "bg-blue-50" : ""}`}
                    >
                      <div className="font-mono text-sm font-semibold text-gray-900">{item.bill.hr_label}</div>
                      <div className="line-clamp-2 text-sm text-gray-700">{item.bill.title}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        {new Date(item.scheduled_at).toLocaleString()} • {itemSession?.status ?? "not opened"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selected && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <FileText className="mt-1 h-6 w-6 flex-shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="font-mono font-bold text-gray-900">{selected.bill.hr_label}</span>
                        <span className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700">{session?.status === "open" ? "Vote Open" : "Vote Closed"}</span>
                      </div>
                      <Link to={`/bills/${selected.bill_id}`} className="text-xl font-bold text-gray-900 hover:text-blue-600">{selected.bill.title}</Link>
                      <div className="mt-2 text-sm text-gray-600">
                        Sponsor: {selected.bill.profiles?.display_name ?? "Unknown"} • Scheduled {new Date(selected.scheduled_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-sm">
                  <div className="bg-blue-600 p-6 text-white">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Vote className="h-6 w-6" />
                        <h2 className="text-xl font-semibold">Vote</h2>
                      </div>
                      {role === "teacher" && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => void openVote()} disabled={busy || session?.status === "open"} className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Open</button>
                          <button onClick={() => void closeVote()} disabled={busy || session?.status !== "open"} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Close</button>
                        </div>
                      )}
                    </div>

                    {session?.status === "open" && role !== "teacher" ? (
                      <div className="grid grid-cols-3 gap-4">
                        <button onClick={() => void castVote("yea")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "yea" ? "bg-green-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Check className="mx-auto mb-2 h-6 w-6" />Yea</button>
                        <button onClick={() => void castVote("nay")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "nay" ? "bg-red-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><X className="mx-auto mb-2 h-6 w-6" />Nay</button>
                        <button onClick={() => void castVote("present")} disabled={busy || !!myVote} className={`rounded-lg p-4 font-semibold ${myVote === "present" ? "bg-gray-500" : "bg-white/20 hover:bg-white/30 disabled:opacity-50"}`}><Minus className="mx-auto mb-2 h-6 w-6" />Present</button>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-blue-100">{session?.status === "open" ? "Teacher controls are active." : "Waiting for the teacher to open the vote."}</div>
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
