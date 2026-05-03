import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";

type TabId = "dashboard" | "review" | "vote";

type Counts = Record<TabId, number>;

const defaultCounts: Counts = { dashboard: 0, review: 0, vote: 0 };

export function CommitteeTabs({ committeeId, active }: { committeeId: string; active: TabId }) {
  const [counts, setCounts] = useState<Counts>(defaultCounts);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ count: announcementCount }, { data: refs }] = await Promise.all([
        supabase
          .from("committee_announcements")
          .select("id", { count: "exact", head: true })
          .eq("committee_id", committeeId),
        supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId),
      ]);
      const billIds = (refs ?? []).map((row: any) => row.bill_id);
      const { count: voteCount } = billIds.length
        ? await supabase
            .from("bill_display")
            .select("id", { count: "exact", head: true })
            .in("id", billIds)
            .eq("status", "committee_vote")
        : ({ count: 0 } as any);
      if (!cancelled) {
        setCounts({
          dashboard: announcementCount ?? 0,
          review: billIds.length,
          vote: voteCount ?? 0,
        });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [committeeId]);

  const storageKeyPrefix = `committee:${committeeId}:seen`;
  const newCounts = useMemo(() => {
    const readSeen = (tab: TabId) => Number(window.localStorage.getItem(`${storageKeyPrefix}:${tab}`) ?? "0");
    return {
      dashboard: Math.max(0, counts.dashboard - readSeen("dashboard")),
      review: Math.max(0, counts.review - readSeen("review")),
      vote: Math.max(0, counts.vote - readSeen("vote")),
    };
  }, [counts, storageKeyPrefix]);

  useEffect(() => {
    window.localStorage.setItem(`${storageKeyPrefix}:${active}`, String(counts[active]));
  }, [active, counts, storageKeyPrefix]);

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
