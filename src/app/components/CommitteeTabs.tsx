import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";

type TabId = "dashboard" | "review" | "vote";

type Counts = Record<TabId, number>;
type CountData = {
  counts: Counts;
  ids: Record<TabId, string[]>;
};

const defaultCounts: Counts = { dashboard: 0, review: 0, vote: 0 };
const defaultIds: Record<TabId, string[]> = { dashboard: [], review: [], vote: [] };

export function committeeSeenStorageKey(committeeId: string, tab: TabId) {
  return `committee:${committeeId}:seenIds:${tab}`;
}

export function readCommitteeSeenIds(committeeId: string, tab: TabId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(committeeSeenStorageKey(committeeId, tab)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markCommitteeSeenIds(committeeId: string, tab: TabId, ids: string[]) {
  const merged = Array.from(new Set([...readCommitteeSeenIds(committeeId, tab), ...ids.filter(Boolean)]));
  window.localStorage.setItem(committeeSeenStorageKey(committeeId, tab), JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("committee-seen-updated", { detail: { committeeId, tab } }));
}

export function CommitteeTabs({ committeeId, active }: { committeeId: string; active: TabId }) {
  const [countData, setCountData] = useState<CountData>({ counts: defaultCounts, ids: defaultIds });
  const [seenVersion, setSeenVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: announcements }, { data: refs }] = await Promise.all([
        supabase
          .from("committee_announcements")
          .select("id")
          .eq("committee_id", committeeId),
        supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId),
      ]);
      const billIds = (refs ?? []).map((row: any) => row.bill_id);
      const { data: statusRows } = billIds.length
        ? await supabase
            .from("bill_display")
            .select("id,status")
            .in("id", billIds)
        : ({ data: [] } as any);
      const dashboardIds = (announcements ?? []).map((row: any) => row.id);
      const reviewIds = (statusRows ?? []).filter((row: any) => row.status === "in_committee").map((row: any) => row.id);
      const voteIds = (statusRows ?? []).filter((row: any) => row.status === "committee_vote").map((row: any) => row.id);
      if (!cancelled) {
        setCountData({
          counts: {
            dashboard: dashboardIds.length,
            review: reviewIds.length,
            vote: voteIds.length,
          },
          ids: {
            dashboard: dashboardIds,
            review: reviewIds,
            vote: voteIds,
          },
        });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [committeeId]);

  useEffect(() => {
    const onSeen = (event: Event) => {
      const detail = (event as CustomEvent).detail as { committeeId?: string } | undefined;
      if (!detail?.committeeId || detail.committeeId === committeeId) setSeenVersion((value) => value + 1);
    };
    window.addEventListener("committee-seen-updated", onSeen);
    window.addEventListener("storage", onSeen);
    return () => {
      window.removeEventListener("committee-seen-updated", onSeen);
      window.removeEventListener("storage", onSeen);
    };
  }, [committeeId]);

  const counts = countData.counts;
  const newCounts = useMemo(() => {
    const unseenCount = (tab: TabId) => {
      const seen = new Set(readCommitteeSeenIds(committeeId, tab));
      return countData.ids[tab].filter((id) => !seen.has(id)).length;
    };
    return {
      dashboard: unseenCount("dashboard"),
      review: unseenCount("review"),
      vote: unseenCount("vote"),
    };
  }, [committeeId, countData, seenVersion]);

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", to: `/committees/${committeeId}` },
    { id: "review" as const, label: "Review", to: `/committee/${committeeId}/workspace` },
    { id: "vote" as const, label: "Vote", to: `/committee/${committeeId}/vote` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active === tab.id ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          {tab.label}
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            {counts[tab.id]}
          </span>
          {newCounts[tab.id] > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${active === tab.id ? "bg-white text-blue-700" : "bg-blue-100 text-blue-700"}`}>
              {newCounts[tab.id]} new
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
