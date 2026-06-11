import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";

type TabId = "dashboard" | "review" | "vote" | "election" | "letters";

type CountedTabId = "dashboard" | "review" | "vote";
type Counts = Record<CountedTabId, number>;
type CountData = {
  counts: Counts;
  ids: Record<CountedTabId, string[]>;
};

const defaultCounts: Counts = { dashboard: 0, review: 0, vote: 0 };
const defaultIds: Record<CountedTabId, string[]> = { dashboard: [], review: [], vote: [] };
const countDataCache = new Map<string, CountData>();
const membershipCache = new Map<string, { isMember: boolean; isTeacher: boolean; dashboardAccess: boolean; reviewAccess: boolean; loaded: boolean }>();

function cloneCountData(data: CountData): CountData {
  return {
    counts: { ...data.counts },
    ids: {
      dashboard: [...data.ids.dashboard],
      review: [...data.ids.review],
      vote: [...data.ids.vote],
    },
  };
}

function countStorageKey(committeeId: string) {
  return `committee:${committeeId}:tabCounts`;
}

function emptyCountData(): CountData {
  return { counts: { ...defaultCounts }, ids: { dashboard: [], review: [], vote: [] } };
}

function readCachedCountData(committeeId: string): CountData {
  const cached = countDataCache.get(committeeId);
  if (cached) return cloneCountData(cached);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(countStorageKey(committeeId)) || "null") as CountData | null;
    if (parsed?.counts && parsed?.ids) {
      const normalized = {
        counts: { ...defaultCounts, ...parsed.counts },
        ids: {
          dashboard: Array.isArray(parsed.ids.dashboard) ? parsed.ids.dashboard : [],
          review: Array.isArray(parsed.ids.review) ? parsed.ids.review : [],
          vote: Array.isArray(parsed.ids.vote) ? parsed.ids.vote : [],
        },
      };
      countDataCache.set(committeeId, normalized);
      return cloneCountData(normalized);
    }
  } catch {
    // ignore
  }
  return emptyCountData();
}

function writeCachedCountData(committeeId: string, data: CountData) {
  const normalized = cloneCountData(data);
  countDataCache.set(committeeId, normalized);
  try {
    window.localStorage.setItem(countStorageKey(committeeId), JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function updateCommitteeTabCounts(committeeId: string, updater: (current: CountData) => CountData) {
  const next = updater(readCachedCountData(committeeId));
  writeCachedCountData(committeeId, next);
  window.dispatchEvent(new CustomEvent("committee-counts-updated", { detail: { committeeId } }));
}

export function committeeSeenStorageKey(committeeId: string, tab: CountedTabId) {
  return `committee:${committeeId}:seenIds:${tab}`;
}

export function readCommitteeSeenIds(committeeId: string, tab: CountedTabId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(committeeSeenStorageKey(committeeId, tab)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markCommitteeSeenIds(committeeId: string, tab: CountedTabId, ids: string[]) {
  const merged = Array.from(new Set([...readCommitteeSeenIds(committeeId, tab), ...ids.filter(Boolean)]));
  window.localStorage.setItem(committeeSeenStorageKey(committeeId, tab), JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("committee-seen-updated", { detail: { committeeId, tab } }));
}

export function committeeNameStorageKey(committeeId: string) {
  return `committee:${committeeId}:name`;
}

export function CommitteeTabs({ committeeId, active }: { committeeId: string; active: TabId }) {
  const [countData, setCountData] = useState<CountData>(() => readCachedCountData(committeeId));
  const [seenVersion, setSeenVersion] = useState(0);
  const [access, setAccess] = useState(() => membershipCache.get(committeeId) ?? { isMember: false, isTeacher: false, dashboardAccess: false, reviewAccess: false, loaded: false });
  const [electionOpen, setElectionOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCountData(readCachedCountData(committeeId));
    setAccess(membershipCache.get(committeeId) ?? { isMember: false, isTeacher: false, dashboardAccess: false, reviewAccess: false, loaded: false });
    const load = async () => {
      const uid = (await getCurrentUser())?.id;
      const [{ data: announcements }, { data: refs }, { data: membership }, { data: profile }, { data: paidAccess }, { data: committeeRow }] = await Promise.all([
        supabase
          .from("committee_announcements")
          .select("id")
          .eq("committee_id", committeeId),
        supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId),
        uid
          ? supabase.from("committee_members").select("user_id").eq("committee_id", committeeId).eq("user_id", uid).maybeSingle()
          : ({ data: null } as any),
        uid ? supabase.from("profiles").select("role").eq("user_id", uid).maybeSingle() : ({ data: null } as any),
        uid ? supabase.from("committee_paid_access").select("access_type").eq("committee_id", committeeId).eq("user_id", uid) : ({ data: [] } as any),
        supabase.from("committees").select("class_id").eq("id", committeeId).maybeSingle(),
      ]);
      const committeeClassId = (committeeRow as any)?.class_id as string | undefined;
      if (committeeClassId) {
        const { data: classRow } = await supabase.from("classes").select("settings").eq("id", committeeClassId).maybeSingle();
        const settings = (classRow as any)?.settings ?? {};
        const nextElectionOpen = settings?.elections?.committeeOpenById?.[committeeId] ?? Boolean(settings?.elections?.open);
        if (!cancelled) setElectionOpen(Boolean(nextElectionOpen));
      } else if (!cancelled) {
        setElectionOpen(false);
      }
      if (!cancelled) {
        const paid = new Set(((paidAccess ?? []) as any[]).map((row) => row.access_type));
        const nextAccess = { isMember: Boolean(membership), isTeacher: (profile as any)?.role === "teacher", dashboardAccess: paid.has("dashboard"), reviewAccess: paid.has("review"), loaded: true };
        membershipCache.set(committeeId, nextAccess);
        setAccess(nextAccess);
      }
      const billIds = (refs ?? []).map((row: any) => row.bill_id);
      const { data: statusRows } = billIds.length
        ? await supabase
            .from("bills")
            .select("id,status")
            .in("id", billIds)
        : ({ data: [] } as any);
      const dashboardIds = (announcements ?? []).map((row: any) => row.id);
      const reviewIds = (statusRows ?? []).filter((row: any) => row.status === "in_committee").map((row: any) => row.id);
      const voteIds = (statusRows ?? []).filter((row: any) => row.status === "committee_vote").map((row: any) => row.id);
      if (!cancelled) {
        const next = {
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
        };
        writeCachedCountData(committeeId, next);
        setCountData(next);
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
    const onCounts = (event: Event) => {
      const detail = (event as CustomEvent).detail as { committeeId?: string } | undefined;
      if (!detail?.committeeId || detail.committeeId === committeeId) setCountData(readCachedCountData(committeeId));
    };
    window.addEventListener("committee-seen-updated", onSeen);
    window.addEventListener("committee-counts-updated", onCounts);
    window.addEventListener("storage", onSeen);
    window.addEventListener("storage", onCounts);
    return () => {
      window.removeEventListener("committee-seen-updated", onSeen);
      window.removeEventListener("committee-counts-updated", onCounts);
      window.removeEventListener("storage", onSeen);
      window.removeEventListener("storage", onCounts);
    };
  }, [committeeId]);

  const counts = countData.counts;
  const newCounts = useMemo(() => {
    const unseenCount = (tab: CountedTabId) => {
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
    { id: "review" as const, label: "Markup", to: `/committee/${committeeId}/workspace` },
    { id: "election" as const, label: "Election", to: `/committee/${committeeId}/leadership` },
    { id: "letters" as const, label: "Letters", to: `/committees/${committeeId}?tab=letters` },
  ].filter((tab) => {
    if (access.isTeacher || access.isMember) return true;
    if (tab.id === "dashboard") return access.dashboardAccess;
    if (tab.id === "review") return access.reviewAccess;
    return false;
  });

  if (!access.loaded) return null;
  if (!tabs.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      {tabs.map((tab) => {
        const inactiveElection = tab.id === "election" && electionOpen !== true;
        return (
        <Link
          key={tab.id}
          to={tab.to}
          aria-disabled={inactiveElection}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            inactiveElection
              ? active === tab.id ? "bg-gray-100 text-gray-500" : "text-gray-400 hover:bg-gray-50"
              : active === tab.id ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          {inactiveElection ? `${tab.label} (inactive)` : tab.label}
          {(tab.id === "dashboard" || tab.id === "review") && (
            <>
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                {tab.id === "review" ? counts.review + counts.vote : counts[tab.id]}
              </span>
              {(tab.id === "review" ? newCounts.review + newCounts.vote : newCounts[tab.id]) > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${active === tab.id ? "bg-white text-blue-700" : "bg-blue-100 text-blue-700"}`}>
                  {tab.id === "review" ? newCounts.review + newCounts.vote : newCounts[tab.id]} new
                </span>
              )}
            </>
          )}
        </Link>
        );
      })}
    </div>
  );
}
