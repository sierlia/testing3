import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Check, Minus, Search, Trophy, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { fetchCalendaredBillsForCurrentClass, getCurrentProfileClass } from "../services/bills";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";

type VoteChoice = "yea" | "nay" | "present";
type CalendarItem = Awaited<ReturnType<typeof fetchCalendaredBillsForCurrentClass>>[number];
type SessionRow = { id: string; bill_id: string; status: "open" | "closed"; opened_at: string | null; closed_at: string | null };
type VoteRow = { session_id: string; bill_id: string; user_id: string; vote: VoteChoice };
type SpeakerCandidate = { id: string; name: string; party?: string | null; constituency?: string | null };
type SpeakerVoteRow = { class_id: string; voter_user_id: string; candidate_user_id: string };
type SpeakerOptOutRow = { class_id: string; user_id: string };

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

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
  const [speakerVotes, setSpeakerVotes] = useState<SpeakerVoteRow[]>([]);
  const [speakerOptOuts, setSpeakerOptOuts] = useState<SpeakerOptOutRow[]>([]);
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [speakerPartyFilter, setSpeakerPartyFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const current = await getCurrentProfileClass();
      setRole(current.profile.role ?? null);
      setMeId(current.userId);
      setClassId(current.classId);
      const [calendarRows, sessionRows, voteRows, directory, classRow, speakerVoteRows, speakerOptOutRows] = await Promise.all([
        fetchCalendaredBillsForCurrentClass(),
        supabase.from("bill_floor_sessions").select("id,bill_id,status,opened_at,closed_at").eq("class_id", current.classId),
        supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", current.classId),
        supabase.rpc("class_directory", { target_class: current.classId } as any),
        supabase.from("classes").select("settings").eq("id", current.classId).maybeSingle(),
        supabase.from("class_speaker_votes").select("class_id,voter_user_id,candidate_user_id").eq("class_id", current.classId),
        supabase.from("class_speaker_opt_outs").select("class_id,user_id").eq("class_id", current.classId),
      ]);
      if (sessionRows.error) throw sessionRows.error;
      if (voteRows.error) throw voteRows.error;
      if (classRow.error) throw classRow.error;
      if (speakerVoteRows.error) throw speakerVoteRows.error;
      if (speakerOptOutRows.error) throw speakerOptOutRows.error;
      const students = ((directory.data ?? []) as any[]).filter((person) => person.role !== "teacher");
      setItems([...calendarRows].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
      setSessions((sessionRows.data ?? []) as any);
      setVotes((voteRows.data ?? []) as any);
      setStudentCount(students.length);
      setClassSettings((classRow.data as any)?.settings ?? {});
      setSpeakerCandidates(students.map((student) => ({ id: student.user_id, name: student.display_name ?? "Student", party: student.party, constituency: student.constituency_name })));
      const nextSpeakerVotes = (speakerVoteRows.data ?? []) as any[];
      setSpeakerVotes(nextSpeakerVotes);
      setSpeakerVote(nextSpeakerVotes.find((row) => row.voter_user_id === current.userId)?.candidate_user_id ?? null);
      setSpeakerOptOuts((speakerOptOutRows.data ?? []) as any[]);
    } catch (e: any) {
      toast.error(e.message || "Could not load floor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`speaker-votes:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_speaker_votes", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as SpeakerVoteRow | undefined;
          const oldRow = payload.old as SpeakerVoteRow | undefined;
          setSpeakerVotes((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.voter_user_id !== oldRow.voter_user_id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.voter_user_id !== nextRow.voter_user_id), nextRow];
          });
          if (nextRow?.voter_user_id === meId) setSpeakerVote(nextRow.candidate_user_id);
          if (payload.eventType === "DELETE" && oldRow?.voter_user_id === meId) setSpeakerVote(null);
        },
      )
      .subscribe();
    const optOutChannel = supabase
      .channel(`speaker-opt-outs:${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_speaker_opt_outs", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          const nextRow = payload.new as SpeakerOptOutRow | undefined;
          const oldRow = payload.old as SpeakerOptOutRow | undefined;
          setSpeakerOptOuts((prev) => {
            if (payload.eventType === "DELETE" && oldRow) return prev.filter((row) => row.user_id !== oldRow.user_id);
            if (!nextRow) return prev;
            return [...prev.filter((row) => row.user_id !== nextRow.user_id), nextRow];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(optOutChannel);
    };
  }, [classId, meId]);

  const speakerConcluded = Boolean(classSettings?.elections?.speakerConcluded);
  const speakerOpen = classSettings?.elections?.speakerOpen ?? Boolean(classSettings?.elections?.open);
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
  const speakerParties = useMemo(
    () => [...new Set(speakerCandidates.map((candidate) => candidate.party || "No party"))].sort((a, b) => a.localeCompare(b)),
    [speakerCandidates],
  );
  const speakerOptedOut = (candidateId: string) => speakerOptOuts.some((row) => row.user_id === candidateId);
  const speakerVoteCount = (candidateId: string) => speakerOptedOut(candidateId) ? 0 : speakerVotes.filter((row) => row.candidate_user_id === candidateId).length;
  const visibleSpeakerCandidates = useMemo(() => {
    const query = speakerSearch.trim().toLowerCase();
    return speakerCandidates.filter((candidate) => {
      const party = candidate.party || "No party";
      const district = formatConstituency(candidate.constituency);
      return (!query || candidate.name.toLowerCase().includes(query) || party.toLowerCase().includes(query) || district.toLowerCase().includes(query)) && (speakerPartyFilter === "all" || party === speakerPartyFilter);
    }).sort((a, b) => speakerVoteCount(b.id) - speakerVoteCount(a.id) || a.name.localeCompare(b.name));
  }, [speakerCandidates, speakerPartyFilter, speakerSearch, speakerVotes, speakerOptOuts]);
  const speakerWinner = useMemo(() => {
    const [winner] = [...speakerCandidates].sort((a, b) => speakerVoteCount(b.id) - speakerVoteCount(a.id) || a.name.localeCompare(b.name));
    return winner && speakerVoteCount(winner.id) > 0 ? winner : null;
  }, [speakerCandidates, speakerVotes, speakerOptOuts]);

  const postSpeakerResults = async () => {
    if (!classId || role !== "teacher") return;
    setBusy(true);
    try {
      const nextSettings = {
        ...classSettings,
        elections: { ...(classSettings.elections ?? {}), speakerConcluded: true, speakerOpen: false },
      };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success("Speaker election results posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post Speaker results");
    } finally {
      setBusy(false);
    }
  };

  const setSpeakerElectionOpen = async (open: boolean) => {
    if (!classId || role !== "teacher" || speakerConcluded) return;
    setBusy(true);
    try {
      const nextSettings = { ...classSettings, elections: { ...(classSettings.elections ?? {}), speakerOpen: open } };
      const { error } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (error) throw error;
      setClassSettings(nextSettings);
      toast.success(open ? "Speaker election opened" : "Speaker election closed");
    } catch (e: any) {
      toast.error(e.message || "Could not update Speaker election");
    } finally {
      setBusy(false);
    }
  };

  const toggleSpeakerOptOut = async () => {
    if (!classId || !meId || role === "teacher" || speakerConcluded || !speakerOpen) return;
    const optedOut = speakerOptedOut(meId);
    setBusy(true);
    try {
      if (optedOut) {
        const { error } = await supabase.from("class_speaker_opt_outs").delete().eq("class_id", classId).eq("user_id", meId);
        if (error) throw error;
        setSpeakerOptOuts((prev) => prev.filter((row) => row.user_id !== meId));
        toast.success("Opt-out removed");
      } else {
        const [{ error: optError }, { error: voteError }] = await Promise.all([
          supabase.from("class_speaker_opt_outs").upsert({ class_id: classId, user_id: meId } as any, { onConflict: "class_id,user_id" }),
          supabase.from("class_speaker_votes").delete().eq("class_id", classId).eq("candidate_user_id", meId),
        ]);
        if (optError || voteError) throw optError ?? voteError;
        setSpeakerOptOuts((prev) => [...prev.filter((row) => row.user_id !== meId), { class_id: classId, user_id: meId }]);
        setSpeakerVotes((prev) => prev.filter((row) => row.candidate_user_id !== meId));
        setSpeakerVote((prev) => (prev === meId ? null : prev));
        toast.success("Opted out");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not update opt-out");
    } finally {
      setBusy(false);
    }
  };

  const castSpeakerVote = async (candidateId: string) => {
    if (!classId || !meId || role === "teacher" || !speakerOpen || speakerConcluded || speakerOptedOut(candidateId)) return;
    setBusy(true);
    try {
      if (speakerVote === candidateId) {
        const { error } = await supabase.from("class_speaker_votes").delete().eq("class_id", classId).eq("voter_user_id", meId);
        if (error) throw error;
        setSpeakerVote(null);
        setSpeakerVotes((prev) => prev.filter((row) => row.voter_user_id !== meId));
        return;
      }
      const { error } = await supabase.from("class_speaker_votes").upsert(
        { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId, updated_at: new Date().toISOString() } as any,
        { onConflict: "class_id,voter_user_id" },
      );
      if (error) throw error;
      setSpeakerVote(candidateId);
      setSpeakerVotes((prev) => [...prev.filter((row) => row.voter_user_id !== meId), { class_id: classId, voter_user_id: meId, candidate_user_id: candidateId }]);
    } catch (e: any) {
      toast.error(e.message || "Could not record speaker vote");
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
                <p className="text-sm text-gray-600">{speakerOpen ? "Voting is open." : "Voting is closed."} Floor bills will appear after Speaker results are posted.</p>
              </div>
              {role === "teacher" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                    <button type="button" onClick={() => void setSpeakerElectionOpen(true)} disabled={busy} className={`px-4 py-2 text-sm font-medium disabled:opacity-50 ${speakerOpen ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                      Open
                    </button>
                    <button type="button" onClick={() => void setSpeakerElectionOpen(false)} disabled={busy} className={`border-l border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50 ${!speakerOpen ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                      Close
                    </button>
                  </div>
                  <button type="button" onClick={() => void postSpeakerResults()} disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    Post results
                  </button>
                </div>
              )}
            </div>
            {speakerCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No student candidates are available yet.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="text-sm text-gray-700">Leader: <span className="font-semibold text-gray-900">{speakerWinner?.name ?? "No votes yet"}</span></div>
                  {role !== "teacher" && (
                    <button
                      type="button"
                      onClick={() => void toggleSpeakerOptOut()}
                      disabled={busy || !speakerOpen}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${meId && speakerOptedOut(meId) ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"} disabled:opacity-50`}
                    >
                      {meId && speakerOptedOut(meId) ? "Opted out" : "Opt out"}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={speakerSearch}
                      onChange={(event) => setSpeakerSearch(event.target.value)}
                      placeholder="Search candidates..."
                      className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select value={speakerPartyFilter} onChange={(event) => setSpeakerPartyFilter(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="all">All parties</option>
                    {speakerParties.map((party) => <option key={party} value={party}>{party}</option>)}
                  </select>
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                {visibleSpeakerCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => void castSpeakerVote(candidate.id)}
                    disabled={busy || role === "teacher" || !speakerOpen || speakerOptedOut(candidate.id)}
                    className={`flex w-full items-center justify-between gap-4 border-b border-gray-200 p-4 text-left transition-colors last:border-b-0 disabled:cursor-default ${
                      speakerVote === candidate.id ? "bg-blue-50" : speakerOptedOut(candidate.id) ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{candidate.name}</div>
                      <div className="text-sm text-gray-500">
                        {partyAbbr(candidate.party)}-{formatConstituency(candidate.constituency) || "N/A"}
                        {speakerOptedOut(candidate.id) ? " - Opted out" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">{speakerVoteCount(candidate.id)}</div>
                      <div className="text-xs text-gray-500">{speakerVote === candidate.id ? "Selected" : speakerOptedOut(candidate.id) ? "opted out" : "votes"}</div>
                    </div>
                  </button>
                ))}
                {visibleSpeakerCandidates.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No candidates match the filters.</div>}
                </div>
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Speaker results posted</div>
              <div className="mt-1 text-sm text-gray-600">Winner: {speakerWinner?.name ?? "No winner"}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No calendared bills are ready for floor session.</div>
          </div>
        ) : activeItem ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Speaker results posted</div>
                <div className="mt-1 text-sm text-gray-600">Winner: {speakerWinner?.name ?? "No winner"}</div>
              </div>
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
