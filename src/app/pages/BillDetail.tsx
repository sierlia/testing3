import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AlertCircle, BookOpen, Check, Circle, Clock, FileText, Search, UserPlus, Users } from "lucide-react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { BillActions } from "../components/BillActions";
import { DeleteHighlight, EditHighlight, LinkMark, TextAlignment, UnderlineMark } from "../components/CollaborativeBillEditor";
import { fetchBillDetail, toggleCosponsor } from "../services/bills";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";

type TextTab = "revised" | "original" | "supporting";
type TrackerStatus = "completed" | "current" | "upcoming";
type TrackerStep = { label: string; status: TrackerStatus; date?: string | null; note?: string };
type TrackerItem = TrackerStep | { kind: "split"; steps: [TrackerStep, TrackerStep] };
type BillAction = { label: string; detail?: string; date: string };

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function voteCounts(votes: Array<{ vote: string }>) {
  return votes.reduce(
    (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
    { yea: 0, nay: 0, present: 0 } as Record<string, number>,
  );
}

function latestDate(rows: Array<{ created_at?: string | null; updated_at?: string | null }>) {
  return rows
    .map((row) => row.updated_at || row.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] as string | undefined;
}

function fromBase64(b64: string) {
  if (!b64) return new Uint8Array();
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = window.atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return u8;
}

function cleanRevisedHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("[data-delete-highlight]").forEach((node) => node.remove());
  doc.querySelectorAll("[data-edit-highlight]").forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  });
  return doc.body.innerHTML;
}

function revisedHtmlFromSnapshot(snapshot?: string | null) {
  if (!snapshot) return null;
  try {
    const ydoc = new Y.Doc();
    const update = fromBase64(snapshot);
    if (!update.length) return null;
    Y.applyUpdate(ydoc, update);
    const json = yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment("default"));
    const html = generateHTML(json, [StarterKit.configure({ history: false }), EditHighlight, DeleteHighlight, UnderlineMark, LinkMark, TextAlignment]);
    ydoc.destroy();
    return cleanRevisedHtml(html);
  } catch {
    return null;
  }
}

function trackerBarClass(status: TrackerStatus) {
  if (status === "completed") return "bg-blue-600";
  if (status === "current") return "bg-blue-300";
  return "bg-gray-200";
}

function trackerIcon(step: TrackerStep) {
  return step.status === "completed" ? Check : step.status === "current" ? Clock : Circle;
}

function TrackerPoint({ step, compact = false }: { step: TrackerStep; compact?: boolean }) {
  const Icon = trackerIcon(step);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
          step.status === "completed" ? "bg-blue-600 text-white" : step.status === "current" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
        }`}
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <div className={`${compact ? "text-[11px]" : "text-xs"} truncate font-semibold ${step.status === "upcoming" ? "text-gray-500" : "text-gray-900"}`}>{step.label}</div>
        <div className="truncate text-[11px] text-gray-500">{step.note || formatDate(step.date) || "Pending"}</div>
      </div>
    </div>
  );
}

function HorizontalTracker({ steps }: { steps: TrackerItem[] }) {
  return (
    <div className="pt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step) => {
          if ("kind" in step) {
            return (
              <div key={step.steps.map((item) => item.label).join("-")} className="min-w-0">
                <div className="mb-2 flex h-1.5 overflow-hidden rounded-full">
                  <div className={`flex-1 ${trackerBarClass(step.steps[0].status)}`} />
                  <div className={`flex-1 ${trackerBarClass(step.steps[1].status)}`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TrackerPoint step={step.steps[0]} compact />
                  <TrackerPoint step={step.steps[1]} compact />
                </div>
              </div>
            );
          }
          return (
            <div key={step.label} className="min-w-0">
              <div className={`mb-2 h-1.5 rounded-full ${trackerBarClass(step.status)}`} />
              <TrackerPoint step={step} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BillDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<TextTab>("original");

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [cosponsors, setCosponsors] = useState<any[]>([]);
  const [cosponsorIds, setCosponsorIds] = useState<string[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [committeeDoc, setCommitteeDoc] = useState<any>(null);
  const [committeeVotes, setCommitteeVotes] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any>(null);
  const [floorSession, setFloorSession] = useState<any>(null);
  const [floorVotes, setFloorVotes] = useState<any[]>([]);
  const [classSettings, setClassSettings] = useState<any>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<"student" | "teacher" | "leadership">("student");
  const [cosponsorPending, setCosponsorPending] = useState(false);
  const [cosponsorSearch, setCosponsorSearch] = useState("");
  const [cosponsorPartyFilter, setCosponsorPartyFilter] = useState("all");
  const [cosponsorSort, setCosponsorSort] = useState<"newest" | "oldest" | "name">("newest");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id ?? null;
        setCurrentUserId(me);

        if (!id) return;
        const res = await fetchBillDetail(id);
        setBill(res.bill);
        setSponsor(res.sponsor);
        setCosponsors(res.cosponsors);
        setCosponsorIds(res.cosponsorIds);
        setReferral(res.referral);
        setCommitteeDoc(res.committeeDoc);
        setCommitteeVotes(res.committeeVotes);
        setCalendar(res.calendar);
        setFloorSession(res.floorSession);
        setFloorVotes(res.floorVotes);
        setClassSettings(res.classSettings ?? {});

        if (me) {
          const { data: p } = await supabase.from("profiles").select("role,display_name,party,constituency_name").eq("user_id", me).maybeSingle();
          setCurrentProfile(p ?? null);
          if ((p as any)?.role === "teacher") setUserRole("teacher");
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load bill");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const isUserCosponsor = useMemo(() => (currentUserId ? cosponsorIds.includes(currentUserId) : false), [cosponsorIds, currentUserId]);
  const committeeCounts = useMemo(() => voteCounts(committeeVotes), [committeeVotes]);
  const floorCounts = useMemo(() => voteCounts(floorVotes), [floorVotes]);
  const committeePassed = bill ? ["reported", "calendared", "floor", "passed"].includes(bill.status) || (bill.status === "failed" && committeeCounts.yea > committeeCounts.nay) : false;
  const showRevisedText = Boolean(committeePassed && referral?.committee_id && (committeeDoc?.ydoc_base64 || committeeDoc?.committee_markup_posted_at));
  const limitCosponsorsAfterReport = !!classSettings?.bills?.cosponsorAfterCommitteeReport;
  const cosponsorAllowed = !limitCosponsorsAfterReport || Boolean(committeeDoc?.committee_report_submitted_at);
  const cosponsorPartyOptions = useMemo(
    () => [...new Set(cosponsors.map((row) => row.party || "Independent"))].sort((a, b) => a.localeCompare(b)),
    [cosponsors],
  );
  const visibleCosponsors = useMemo(() => {
    const query = cosponsorSearch.trim().toLowerCase();
    return cosponsors
      .filter((row) => {
        const party = row.party || "Independent";
        const district = row.constituency_name ? formatConstituency(row.constituency_name) : "";
        const haystack = `${row.display_name ?? ""} ${party} ${district}`.toLowerCase();
        return (!query || haystack.includes(query)) && (cosponsorPartyFilter === "all" || party === cosponsorPartyFilter);
      })
      .sort((a, b) => {
        if (cosponsorSort === "name") return String(a.display_name ?? "").localeCompare(String(b.display_name ?? ""));
        const aTime = new Date(a.cosponsored_at ?? 0).getTime();
        const bTime = new Date(b.cosponsored_at ?? 0).getTime();
        return cosponsorSort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [cosponsorPartyFilter, cosponsorSearch, cosponsorSort, cosponsors]);
  const revisedHtml = useMemo(() => revisedHtmlFromSnapshot(committeeDoc?.ydoc_base64) ?? bill?.legislative_text ?? "", [bill?.legislative_text, committeeDoc?.ydoc_base64]);

  useEffect(() => {
    if (!bill) return;
    setActiveTab((prev) => {
      if (showRevisedText) return prev === "original" || prev === "supporting" || prev === "revised" ? prev : "revised";
      return prev === "revised" ? "original" : prev;
    });
  }, [bill, showRevisedText]);

  const actions = useMemo<BillAction[]>(() => {
    if (!bill) return [];
    const committeeName = referral?.committee_name ?? "Committee";
    const rows: BillAction[] = [{ label: "Introduced", date: bill.created_at }];
    if (referral?.referred_at) rows.push({ label: `Referred to ${committeeName}`, date: referral.referred_at });
    if (committeeDoc?.committee_markup_posted_at) rows.push({ label: `Marked up in ${committeeName}`, date: committeeDoc.committee_markup_posted_at });
    const committeeVoteDate = latestDate(committeeVotes);
    if (committeeVoteDate) {
      const passed = committeeCounts.yea > committeeCounts.nay;
      const decided = ["reported", "calendared", "floor", "passed", "failed"].includes(bill.status);
      rows.push({
        label: decided ? (passed ? `Reported by ${committeeName}` : `Rejected by ${committeeName}`) : "Committee vote recorded",
        detail: `${committeeCounts.yea} yeas to ${committeeCounts.nay} nays${committeeCounts.present ? `, ${committeeCounts.present} present` : ""}`,
        date: committeeDoc?.committee_vote_finalized_at || committeeDoc?.committee_vote_closed_at || committeeVoteDate,
      });
    }
    if (committeeDoc?.committee_vote_closed_at && !["reported", "calendared", "floor", "passed", "failed"].includes(bill.status)) {
      rows.push({ label: "Committee vote closed", detail: `${committeeCounts.yea} yeas to ${committeeCounts.nay} nays`, date: committeeDoc.committee_vote_closed_at });
    }
    if (committeeDoc?.committee_report_submitted_at) rows.push({ label: `${committeeName} report submitted`, date: committeeDoc.committee_report_submitted_at });
    if (calendar?.created_at || calendar?.scheduled_at) rows.push({ label: "Calendared", detail: calendar?.scheduled_at ? `Scheduled for ${new Date(calendar.scheduled_at).toLocaleString()}` : undefined, date: calendar.created_at || calendar.scheduled_at });
    if (floorSession?.opened_at) rows.push({ label: "Floor debate opened", date: floorSession.opened_at });
    const floorVoteDate = latestDate(floorVotes);
    if (floorVoteDate) rows.push({ label: "Floor vote recorded", detail: `${floorCounts.yea} yeas to ${floorCounts.nay} nays${floorCounts.present ? `, ${floorCounts.present} present` : ""}`, date: floorVoteDate });
    if (floorSession?.closed_at) rows.push({ label: "Floor debate closed", date: floorSession.closed_at });
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bill, calendar, committeeCounts, committeeDoc, committeeVotes, floorCounts, floorSession, floorVotes, referral]);

  const latestAction = actions[0];

  const tracker = useMemo<TrackerItem[]>(() => {
    if (!bill) return [];
    const status = bill.status;
    const markedUp = Boolean(committeeDoc?.committee_markup_posted_at || ["committee_vote", "reported", "calendared", "floor", "passed", "failed"].includes(status));
    const reported = ["reported", "calendared", "floor", "passed", "failed"].includes(status);
    const calendared = Boolean(calendar);
    const floor = Boolean(floorSession?.opened_at);
    const final = ["passed", "failed"].includes(status);
    const markupDate = committeeDoc?.committee_markup_posted_at || committeeDoc?.committee_vote_finalized_at || committeeDoc?.committee_vote_closed_at || latestDate(committeeVotes);
    return [
      { label: "Introduced", status: "completed", date: bill.created_at },
      {
        kind: "split",
        steps: [
          { label: "Referred", status: referral ? "completed" : status === "submitted" ? "current" : "upcoming", date: referral?.referred_at },
          { label: "Marked up", status: markedUp ? "completed" : referral ? "current" : "upcoming", date: markupDate },
        ],
      },
      { label: "Reported", status: reported ? (calendared || floor || final ? "completed" : "current") : referral ? "upcoming" : "upcoming", date: committeeDoc?.committee_vote_finalized_at },
      { label: "Calendared", status: calendared ? (floor || final ? "completed" : "current") : "upcoming", date: calendar?.created_at || calendar?.scheduled_at },
      { label: "Floor", status: floor ? (final ? "completed" : "current") : "upcoming", date: floorSession?.opened_at },
      { label: "Final", status: final ? "completed" : "upcoming", date: floorSession?.closed_at, note: final ? statusLabel(status) : undefined },
    ];
  }, [bill, calendar, committeeDoc, committeeVotes, floorSession, referral]);

  const toggleCurrentUserCosponsor = async () => {
    if (!id || !cosponsorAllowed || cosponsorPending) return;
    const next = currentUserId ? !cosponsorIds.includes(currentUserId) : false;
    setCosponsorPending(true);
    try {
      await toggleCosponsor(id, next);
      setCosponsorIds((prev) => {
        if (!currentUserId) return prev;
        return next ? [...new Set([...prev, currentUserId])] : prev.filter((x) => x !== currentUserId);
      });
      if (next && currentUserId) {
        setCosponsors((prev) =>
          prev.some((row) => row.user_id === currentUserId)
            ? prev
            : [
                ...prev,
                {
                  user_id: currentUserId,
                  display_name: currentProfile?.display_name ?? "You",
                  party: currentProfile?.party ?? "Independent",
                  constituency_name: currentProfile?.constituency_name ?? null,
                  cosponsored_at: new Date().toISOString(),
                },
              ],
        );
      }
      if (!next && currentUserId) setCosponsors((prev) => prev.filter((row) => row.user_id !== currentUserId));
      toast.success(next ? "Cosponsored" : "Cosponsorship withdrawn");
    } catch (e: any) {
      toast.error(e.message || "Could not update cosponsorship");
    } finally {
      setCosponsorPending(false);
    }
  };

  if (loading || !bill) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="mx-auto max-w-5xl px-4 py-8 text-gray-600">Loading...</main>
      </div>
    );
  }

  const sponsorName = sponsor?.display_name ?? "Unknown";
  const sponsorDistrict = formatConstituency(sponsor?.constituency_name);
  const isUserSponsor = sponsor?.user_id === currentUserId || bill.author_user_id === currentUserId;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="font-mono text-lg font-bold text-gray-900">{bill.hr_label}</span>
            <span className="rounded bg-blue-100 px-2 py-1 text-sm font-medium text-blue-700">{statusLabel(bill.status)}</span>
            {bill.status === "draft" && (
              <span className="flex items-center gap-1.5 rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-700">
                <AlertCircle className="h-4 w-4" />
                Hold
              </span>
            )}
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">{bill.title}</h1>
          <div className="grid gap-2 text-sm text-gray-700">
            <div>
              <span className="font-semibold text-gray-900">Sponsor:</span>{" "}
              <Link to={`/profile/${sponsor?.user_id ?? bill.author_user_id}`} className="font-medium text-blue-600 hover:underline">
                {sponsorName}
              </Link>
              <span className="text-gray-500"> ({sponsor?.party ?? "Independent"}{sponsorDistrict ? `-${sponsorDistrict}` : ""})</span>
            </div>
            <div><span className="font-semibold text-gray-900">Committees:</span> {referral?.committee_name ?? "Not referred"}</div>
            <div>
              <span className="font-semibold text-gray-900">Committee reports:</span>{" "}
              {referral?.committee_id && committeeDoc?.committee_report_submitted_at ? (
                <Link to={`/committee/${referral.committee_id}/reports/${bill.id}`} className="font-medium text-blue-600 hover:underline">
                  {referral.committee_name ?? "Committee"} Report
                </Link>
              ) : (
                "Not submitted"
              )}
            </div>
            <div><span className="font-semibold text-gray-900">Latest action:</span> {latestAction ? `${latestAction.label} - ${formatDate(latestAction.date)}` : "No action yet"}</div>
          </div>
          <HorizontalTracker steps={tracker} />
        </div>

        {bill.status === "draft" && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Hold Status:</strong> The sponsor has placed a hold on this bill, signaling to leadership that it should not move forward at this time.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200">
                <div className="flex">
                  {showRevisedText && (
                    <button
                      onClick={() => setActiveTab("revised")}
                      className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === "revised" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      <FileText className="h-4 w-4" />
                      Revised Text
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab("original")}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === "original" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    <FileText className="h-4 w-4" />
                    Original Text
                  </button>
                  <button
                    onClick={() => setActiveTab("supporting")}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === "supporting" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Supporting Text
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === "revised" && showRevisedText && (
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: revisedHtml }} />
                )}
                {activeTab === "original" && <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: bill.legislative_text }} />}
                {activeTab === "supporting" && <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: bill.supporting_text || "<p><em>No supporting text</em></p>" }} />}
              </div>
            </div>

            <BillActions
              bill={{
                id: bill.id,
                number: bill.hr_label,
                committee: referral?.committee_name ?? "",
                currentStatus: bill.status,
                hasHold: bill.status === "draft",
              }}
              userRole={userRole}
              currentUserId={currentUserId ?? ""}
            />
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <h2 className="font-semibold text-gray-900">Cosponsors</h2>
                </div>
                {!isUserSponsor && currentUserId && (
                  <button
                    onClick={() => void toggleCurrentUserCosponsor()}
                    disabled={!cosponsorAllowed || cosponsorPending}
                    title={cosponsorAllowed ? undefined : "Cosponsorship is available after the committee report is submitted."}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${isUserCosponsor ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {cosponsorPending ? "Saving" : isUserCosponsor ? "Withdraw" : "Cosponsor"}
                  </button>
                )}
              </div>
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={cosponsorSearch}
                    onChange={(event) => setCosponsorSearch(event.target.value)}
                    placeholder="Search cosponsors..."
                    className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={cosponsorPartyFilter}
                    onChange={(event) => setCosponsorPartyFilter(event.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All parties</option>
                    {cosponsorPartyOptions.map((party) => (
                      <option key={party} value={party}>{party}</option>
                    ))}
                  </select>
                  <select
                    value={cosponsorSort}
                    onChange={(event) => setCosponsorSort(event.target.value as any)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                {visibleCosponsors.length === 0 ? (
                  <div className="text-sm italic text-gray-500">No cosponsors yet.</div>
                ) : (
                  visibleCosponsors.map((cosponsor) => (
                    <div key={cosponsor.user_id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <Link to={`/profile/${cosponsor.user_id}`} className="font-medium text-blue-600 hover:underline">
                        {cosponsor.display_name ?? "Unknown"}
                      </Link>
                      <div className="text-xs text-gray-600">{cosponsor.party ?? "Independent"}{cosponsor.constituency_name ? ` - ${formatConstituency(cosponsor.constituency_name)}` : ""}</div>
                      <div className="mt-1 text-xs text-gray-500">Cosponsored {formatDate(cosponsor.cosponsored_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-900">Actions</h2>
              <div className="space-y-4">
                {actions.map((action, index) => (
                  <div key={`${action.label}-${action.date}-${index}`} className="border-l-2 border-blue-200 pl-3">
                    <div className="text-sm font-medium text-gray-900">{action.label}</div>
                    {action.detail && <div className="text-xs text-gray-600">{action.detail}</div>}
                    <div className="mt-1 text-xs text-gray-500">{new Date(action.date).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
