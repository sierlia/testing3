import { useEffect, useMemo, useState } from "react";
import { fetchCalendaredBillsForCurrentClass, getCurrentProfileClass } from "../services/bills";
import { supabase } from "../utils/supabase";

type PresentationState = {
  mode: "agenda" | "debate" | "speaker_for" | "speaker_against" | "vote" | "results" | "recess";
  note: string;
  billId?: string | null;
};

const defaultState: PresentationState = { mode: "agenda", note: "Floor is coming to order." };

function readPresentationState(): PresentationState {
  try {
    return { ...defaultState, ...JSON.parse(window.localStorage.getItem("gavel:floorPresentation") || "null") };
  } catch {
    return defaultState;
  }
}

function modeTitle(mode: PresentationState["mode"]) {
  if (mode === "speaker_for") return "Speaker in Favor";
  if (mode === "speaker_against") return "Speaker in Opposition";
  if (mode === "vote") return "Vote Open";
  if (mode === "results") return "Vote Results";
  if (mode === "recess") return "Recess";
  if (mode === "debate") return "Floor Debate";
  return "Floor Agenda";
}

export function FloorPresentationScreen() {
  const [state, setState] = useState<PresentationState>(() => readPresentationState());
  const [activeBill, setActiveBill] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);

  const load = async () => {
    try {
      const { classId } = await getCurrentProfileClass();
      const [items, sessions] = await Promise.all([
        fetchCalendaredBillsForCurrentClass(),
        supabase.from("bill_floor_sessions").select("bill_id,status,manual_counts,posted_result").eq("class_id", classId),
      ]);
      const nextState = readPresentationState();
      setState(nextState);
      const item = items.find((candidate) => candidate.bill_id === nextState.billId) ?? items[0] ?? null;
      setActiveBill(item?.bill ?? null);
      setSession((sessions.data ?? []).find((row: any) => row.bill_id === item?.bill_id) ?? null);
    } catch {
      setActiveBill(null);
      setSession(null);
    }
  };

  useEffect(() => {
    void load();
    const onStorage = () => {
      setState(readPresentationState());
      void load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("gavel:floor-presentation", onStorage);
    const timer = window.setInterval(load, 15_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("gavel:floor-presentation", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  const counts = session?.manual_counts;
  const result = session?.posted_result;
  const palette = useMemo(() => {
    if (state.mode === "vote") return "bg-blue-700 text-white";
    if (state.mode === "results") return result === "failed" ? "bg-red-700 text-white" : "bg-green-700 text-white";
    if (state.mode === "speaker_against") return "bg-red-700 text-white";
    if (state.mode === "speaker_for") return "bg-green-700 text-white";
    if (state.mode === "recess") return "bg-gray-700 text-white";
    return "bg-slate-700 text-white";
  }, [result, state.mode]);

  return (
    <div className={`flex min-h-screen items-center justify-center ${palette}`}>
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-10 text-center">
        <div className="mb-8 text-2xl font-semibold uppercase tracking-[0.24em] opacity-80">{modeTitle(state.mode)}</div>
        <h1 className="text-balance text-6xl font-bold leading-tight">{state.note || modeTitle(state.mode)}</h1>
        {activeBill && state.mode !== "recess" ? (
          <div className="mt-10 max-w-5xl">
            <div className="font-mono text-3xl font-bold opacity-90">{activeBill.hr_label}</div>
            <div className="mt-3 text-balance text-4xl font-semibold">{activeBill.title}</div>
          </div>
        ) : null}
        {state.mode === "vote" && <div className="mt-12 text-5xl font-bold">Voting is open</div>}
        {state.mode === "results" && (
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div><div className="text-6xl font-bold">{counts?.yea ?? 0}</div><div className="mt-2 text-xl opacity-80">Yea</div></div>
            <div><div className="text-6xl font-bold">{counts?.nay ?? 0}</div><div className="mt-2 text-xl opacity-80">Nay</div></div>
            <div><div className="text-6xl font-bold">{counts?.present ?? 0}</div><div className="mt-2 text-xl opacity-80">Present</div></div>
          </div>
        )}
      </main>
    </div>
  );
}
