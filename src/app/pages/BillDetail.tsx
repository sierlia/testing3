import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { AlertCircle, ArrowLeft, BookOpen, Check, Circle, Clock, ExternalLink, FileText, Search, Trash2, UserPlus, Users } from "lucide-react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { DeleteHighlight, EditHighlight, LinkMark, TextAlignment, UnderlineMark } from "../components/CollaborativeBillEditor";
import { deleteBillForCurrentClass, fetchBillDetail, toggleCosponsor } from "../services/bills";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";
import { displayPersonName } from "../utils/displayName";
import { profilePath } from "../utils/profileRoute";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { committeeDisplayName } from "../utils/committeeNames";
import { signedStorageUrl, storageFileHashUrl, storagePathFromUrl } from "../utils/privateStorage";

type TextTab = string;
type TrackerStatus = "completed" | "current" | "upcoming";
type TrackerStep = { label: string; status: TrackerStatus; date?: string | null; note?: string; overrideFilled?: boolean };
type TrackerItem = TrackerStep | { kind: "split"; steps: [TrackerStep, TrackerStep] };
type BillAction = { label: string; detail?: string; date: string; tone?: "teacher" };
type CommitteeOption = { id: string; name: string };
type TeacherOverrideAction = { id: string; step: string; note: string | null; created_at: string };
type RevisionTab = {
  id: string;
  label: string;
  ydoc_base64?: string | null;
  revised_pdf_path?: string | null;
  date?: string | null;
};
type TrackerOverrideDraft = {
  step: TrackerStep;
  committeeId: string;
  scheduledAt: string;
  finalStatus: "passed" | "failed";
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function statusLabel(status: string) {
  if (status === "senate") return "In Senate";
  if (status === "senate_passed") return "Passed Senate";
  if (status === "signed") return "Signed";
  if (status === "vetoed") return "Vetoed";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function voteCounts(votes: Array<{ vote: string }>) {
  return votes.reduce(
    (acc, row) => ({ ...acc, [row.vote]: (acc[row.vote] ?? 0) + 1 }),
    { yea: 0, nay: 0, present: 0 } as Record<string, number>,
  );
}

function overrideMessage(step: string) {
  if (step === "Introduced") return "This will return the bill to the introduced stage so it can be referred again.";
  if (step === "Referred") return "This will refer the bill to the committee selected above.";
  if (step === "Marked up") return "This will move the bill into committee vote for the committee selected above.";
  if (step === "Reported") return "This will mark the current committee's work as reported and move the bill to await calendaring.";
  if (step === "Calendared") return "This will place the bill on the floor calendar for the selected date and time.";
  if (step === "Floor") return "This will move the bill into the floor queue.";
  if (step === "Senate") return "Use the Senate action buttons to record the Senate result.";
  if (step === "President") return "Use the president action buttons to sign or veto the bill.";
  if (step === "Final") return "This will close floor action and record the final bill outcome.";
  return "This will update the bill's status.";
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
  return sanitizeHtml(doc.body.innerHTML);
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

function simulationPdfPathFromHtml(html?: string | null) {
  if (!html || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#/storage-file")) {
      const params = new URLSearchParams(href.split("?")[1] ?? "");
      if (params.get("bucket") === "simulation-pdfs" && params.get("path")) return params.get("path");
    }
    const path = storagePathFromUrl(href, "simulation-pdfs");
    if (path) return path;
  }
  return null;
}

function trackerRank(label: string) {
  const ranks: Record<string, number> = {
    Introduced: 0,
    Referred: 1,
    "Marked up": 2,
    Reported: 3,
    Calendared: 4,
    Floor: 5,
    Senate: 6,
    President: 7,
    Final: 8,
  };
  return ranks[label] ?? -1;
}

function trackerBarClass(step: TrackerStep) {
  if (step.overrideFilled) return "bg-green-600";
  const status = step.status;
  if (status === "completed") return "bg-blue-600";
  if (status === "current") return "bg-blue-300";
  return "bg-blue-100";
}

function trackerIcon(step: TrackerStep) {
  return step.status === "completed" ? Check : step.status === "current" ? Clock : Circle;
}

function TrackerPoint({ step, compact = false }: { step: TrackerStep; compact?: boolean }) {
  const Icon = trackerIcon(step);
  const content = (
    <>
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
          step.overrideFilled ? "bg-green-600 text-white" : step.status === "completed" ? "bg-blue-600 text-white" : step.status === "current" ? "bg-blue-100 text-blue-700" : "bg-blue-50 text-blue-300"
        }`}
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <div className={`${compact ? "text-[11px]" : "text-xs"} whitespace-normal leading-tight font-semibold ${step.status === "upcoming" ? "text-gray-500" : "text-gray-900"}`}>{step.label}</div>
        <div className="truncate text-[11px] text-gray-500">{step.note || formatDate(step.date) || "Pending"}</div>
      </div>
    </>
  );
  return (
    <div className="flex min-w-0 items-start gap-2">
      {content}
    </div>
  );
}

function HorizontalTracker({ steps, onSelectStep }: { steps: TrackerItem[]; onSelectStep?: (step: TrackerStep) => void }) {
  return (
    <div className="pt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step) => {
          if ("kind" in step) {
            return (
              <div key={step.steps.map((item) => item.label).join("-")} className="grid grid-cols-2 gap-2">
                {step.steps.map((item) => (
                  <div
                    key={item.label}
                    className={`min-w-0 rounded-md ${onSelectStep ? "cursor-pointer border border-dashed border-gray-300 p-1 hover:border-blue-300 hover:bg-blue-50" : ""}`}
                    onClick={onSelectStep ? () => onSelectStep(item) : undefined}
                  >
                    <div className={`mb-2 h-1.5 rounded-full ${trackerBarClass(item)}`} />
                    <TrackerPoint step={item} compact />
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div
              key={step.label}
              className={`min-w-0 rounded-md ${onSelectStep ? "cursor-pointer border border-dashed border-gray-300 p-1 hover:border-blue-300 hover:bg-blue-50" : ""}`}
              onClick={onSelectStep ? () => onSelectStep(step) : undefined}
            >
              <div className={`mb-2 h-1.5 rounded-full ${trackerBarClass(step)}`} />
              <TrackerPoint step={step} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PdfDocumentPanel({ path, title }: { path: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError("");
    signedStorageUrl("simulation-pdfs", path, 3600).then((nextUrl) => {
      if (cancelled) return;
      if (!nextUrl) {
        setError("Could not open the uploaded PDF.");
        return;
      }
      setUrl(nextUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="space-y-4">
      <a href={storageFileHashUrl("simulation-pdfs", path)} target="_blank" rel="noopener noreferrer" className="flex max-w-md items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-left text-sm text-blue-800 hover:border-blue-300 hover:bg-blue-100">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-blue-700">
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-xs text-blue-700">Open attached document: {path.split("/").pop() ?? "Uploaded PDF"}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">PDF editor</div>
        {url ? (
          <iframe title={title} src={`${url}#toolbar=1&navpanes=0`} className="h-[70vh] w-full bg-white" />
        ) : (
          <div className="flex h-96 items-center justify-center text-sm text-gray-500">{error || "Opening PDF..."}</div>
        )}
      </div>
    </div>
  );
}

export function BillDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TextTab>("original");

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [cosponsors, setCosponsors] = useState<any[]>([]);
  const [cosponsorIds, setCosponsorIds] = useState<string[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [committeeDoc, setCommitteeDoc] = useState<any>(null);
  const [committeeDocs, setCommitteeDocs] = useState<any[]>([]);
  const [committeeVotes, setCommitteeVotes] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any>(null);
  const [floorSession, setFloorSession] = useState<any>(null);
  const [floorVotes, setFloorVotes] = useState<any[]>([]);
  const [teacherOverrideActions, setTeacherOverrideActions] = useState<TeacherOverrideAction[]>([]);
  const [classSettings, setClassSettings] = useState<any>({});
  const [committeeOptions, setCommitteeOptions] = useState<CommitteeOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<"student" | "teacher" | "leadership">("student");
  const [cosponsorPending, setCosponsorPending] = useState(false);
  const [cosponsorSearch, setCosponsorSearch] = useState("");
  const [cosponsorPartyFilter, setCosponsorPartyFilter] = useState("all");
  const [cosponsorSort, setCosponsorSort] = useState<"newest" | "oldest" | "name">("newest");
  const [trackerOverrideDraft, setTrackerOverrideDraft] = useState<TrackerOverrideDraft | null>(null);
  const [trackerOverrideSaving, setTrackerOverrideSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

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
        setCommitteeDocs(res.committeeDocs ?? []);
        setCommitteeVotes(res.committeeVotes);
        setCalendar(res.calendar);
        setFloorSession(res.floorSession);
        setFloorVotes(res.floorVotes);
        setClassSettings(res.classSettings ?? {});
        const { data: overrideRows } = await supabase
          .from("bill_teacher_overrides")
          .select("id,step,note,created_at")
          .eq("bill_id", res.bill.id)
          .order("created_at", { ascending: false });
        setTeacherOverrideActions((overrideRows ?? []) as any);

        if (me) {
          const { data: p } = await supabase.from("profiles").select("role,display_name,party,constituency_name").eq("user_id", me).maybeSingle();
          setCurrentProfile(p ?? null);
          if ((p as any)?.role === "teacher") {
            setUserRole("teacher");
            const { data: committeeRows } = await supabase
              .from("committees")
              .select("id,name")
              .eq("class_id", res.bill.class_id)
              .order("name", { ascending: true });
            setCommitteeOptions((committeeRows ?? []) as any);
          }
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
  const postFloorStatuses = ["passed", "senate", "senate_passed", "signed", "vetoed"];
  const finalStatuses = ["passed", "failed", "signed", "vetoed"];
  const committeePassed = bill ? ["reported", "calendared", "floor", ...postFloorStatuses].includes(bill.status) || (bill.status === "failed" && committeeCounts.yea > committeeCounts.nay) : false;
  const cosponsorshipMode = classSettings?.bills?.cosponsorshipMode ?? (classSettings?.bills?.cosponsorAfterCommitteeReport ? "after_report" : "always");
  const reportSubmitted = Boolean(committeeDoc?.committee_report_submitted_at);
  const subcommitteeReports = Array.isArray(committeeDoc?.subcommittee_reports) ? committeeDoc.subcommittee_reports : [];
  const cosponsorAllowed = cosponsorshipMode === "always" || (cosponsorshipMode === "before_report" && !reportSubmitted) || (cosponsorshipMode === "after_report" && reportSubmitted);
  const showCosponsors = classSettings?.bills?.showCosponsors !== false;
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
  const revisionTabs = useMemo<RevisionTab[]>(() => {
    const tabs: RevisionTab[] = [];
    for (const doc of committeeDocs ?? []) {
      const committeeName = committeeDisplayName(doc.committee_name) || "Committee";
      const reports = Array.isArray(doc.subcommittee_reports) ? doc.subcommittee_reports : [];
      for (const report of reports) {
        const snapshot = report.ydoc_base64 ?? report.revisionYdocBase64 ?? doc.ydoc_base64 ?? null;
        const pdfPath = report.revised_pdf_path ?? report.revisedPdfPath ?? doc.revised_pdf_path ?? null;
        if (!snapshot && !pdfPath) continue;
        tabs.push({
          id: `subcommittee:${doc.committee_id}:${report.subcommitteeId ?? report.subcommitteeName ?? tabs.length}`,
          label: `${report.subcommitteeName ?? "Subcommittee"} version`,
          ydoc_base64: snapshot,
          revised_pdf_path: pdfPath,
          date: report.submittedAt ?? report.voteClosedAt ?? doc.updated_at ?? doc.committee_markup_posted_at ?? doc.referred_at,
        });
      }
      if (doc?.ydoc_base64 || doc?.revised_pdf_path || doc?.committee_markup_posted_at) {
        tabs.push({
          id: `committee:${doc.committee_id}`,
          label: `${committeeName} version`,
          ydoc_base64: doc.ydoc_base64,
          revised_pdf_path: doc.revised_pdf_path,
          date: doc.updated_at || doc.committee_markup_posted_at || doc.referred_at,
        });
      }
    }
    return tabs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [committeeDocs]);
  const activeRevision = activeTab.startsWith("revision:") ? revisionTabs.find((doc) => `revision:${doc.id}` === activeTab) : null;
  const revisedHtml = useMemo(() => revisedHtmlFromSnapshot(activeRevision?.ydoc_base64 ?? committeeDoc?.ydoc_base64) ?? bill?.legislative_text ?? "", [activeRevision?.ydoc_base64, bill?.legislative_text, committeeDoc?.ydoc_base64]);
  const originalPdfPath = useMemo(() => simulationPdfPathFromHtml(bill?.legislative_text), [bill?.legislative_text]);

  useEffect(() => {
    if (!bill) return;
    setActiveTab((prev) => {
      if (revisionTabs.length) return prev.startsWith("revision:") || prev === "supporting" ? prev : `revision:${revisionTabs[0].id}`;
      return prev.startsWith("revision:") ? "original" : prev;
    });
  }, [bill, revisionTabs]);

  useEffect(() => {
    if (!bill || location.hash !== "#bill-text") return;
    setActiveTab("original");
    window.setTimeout(() => {
      document.getElementById("bill-text")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [bill, location.hash]);

  const actions = useMemo<BillAction[]>(() => {
    if (!bill) return [];
    const committeeName = committeeDisplayName(referral?.committee_name);
    const rows: BillAction[] = [{ label: "Introduced", date: bill.created_at }];
    if (referral?.referred_at) rows.push({ label: `Referred to ${committeeName}`, date: referral.referred_at });
    if (committeeDoc?.committee_markup_posted_at) rows.push({ label: `Marked up in ${committeeName}`, date: committeeDoc.committee_markup_posted_at });
    const committeeVoteDate = latestDate(committeeVotes);
    if (committeeVoteDate) {
      const passed = committeeCounts.yea > committeeCounts.nay;
      const decided = ["reported", "calendared", "floor", "passed", "failed", "senate", "senate_passed", "signed", "vetoed"].includes(bill.status);
      rows.push({
        label: decided ? (passed ? `Reported by ${committeeName}` : `Rejected by ${committeeName}`) : "Committee vote recorded",
        detail: `${committeeCounts.yea} yeas to ${committeeCounts.nay} nays${committeeCounts.present ? `, ${committeeCounts.present} present` : ""}`,
        date: committeeDoc?.committee_vote_finalized_at || committeeDoc?.committee_vote_closed_at || committeeVoteDate,
      });
    }
    if (committeeDoc?.committee_vote_closed_at && !["reported", "calendared", "floor", "passed", "failed", "senate", "senate_passed", "signed", "vetoed"].includes(bill.status)) {
      rows.push({ label: "Committee vote closed", detail: `${committeeCounts.yea} yeas to ${committeeCounts.nay} nays`, date: committeeDoc.committee_vote_closed_at });
    }
    if (committeeDoc?.committee_report_submitted_at) rows.push({ label: `${committeeName} report submitted`, date: committeeDoc.committee_report_submitted_at });
    if (calendar?.created_at || calendar?.scheduled_at) rows.push({ label: "Calendared", detail: calendar?.scheduled_at ? `Scheduled for ${new Date(calendar.scheduled_at).toLocaleString()}` : undefined, date: calendar.created_at || calendar.scheduled_at });
    if (floorSession?.opened_at) rows.push({ label: "Floor debate opened", date: floorSession.opened_at });
    const floorVoteDate = latestDate(floorVotes);
    if (floorVoteDate) rows.push({ label: "Floor vote recorded", detail: `${floorCounts.yea} yeas to ${floorCounts.nay} nays${floorCounts.present ? `, ${floorCounts.present} present` : ""}`, date: floorVoteDate });
    if (floorSession?.closed_at) rows.push({ label: "Floor debate closed", date: floorSession.closed_at });
    if (bill.status === "senate") rows.push({ label: "Sent to Senate", date: floorSession?.results_posted_at || floorSession?.closed_at || bill.created_at });
    if (bill.status === "senate_passed") rows.push({ label: "Passed by Senate", date: floorSession?.results_posted_at || floorSession?.closed_at || bill.created_at });
    if (bill.status === "signed") rows.push({ label: "Signed by President", date: floorSession?.results_posted_at || floorSession?.closed_at || bill.created_at });
    if (bill.status === "vetoed") rows.push({ label: "Vetoed by President", date: floorSession?.results_posted_at || floorSession?.closed_at || bill.created_at });
    for (const override of teacherOverrideActions) {
      const label = override.step === "Referred" && override.note ? `Teacher Override: ${override.note}` : `Teacher Override: ${override.step}`;
      rows.push({
        label,
        detail: undefined,
        date: override.created_at,
        tone: "teacher",
      });
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bill, calendar, committeeCounts, committeeDoc, committeeVotes, floorCounts, floorSession, floorVotes, referral, teacherOverrideActions]);

  const latestAction = actions[0];

  const tracker = useMemo<TrackerItem[]>(() => {
    if (!bill) return [];
    const status = bill.status;
    const overrideRank = Math.max(-1, ...teacherOverrideActions.map((override) => trackerRank(override.step)));
    const markOverrideFilled = (step: TrackerStep): TrackerStep => {
      const rank = trackerRank(step.label);
      if (overrideRank > rank && rank > 0 && step.status !== "completed") {
        return { ...step, status: "completed", overrideFilled: true, note: step.note ?? "Skipped by override" };
      }
      return step;
    };
    const markedUp = Boolean(committeeDoc?.committee_markup_posted_at || ["committee_vote", "reported", "calendared", "floor", "passed", "failed", "senate", "senate_passed", "signed", "vetoed"].includes(status));
    const reported = ["reported", "calendared", "floor", "passed", "failed", "senate", "senate_passed", "signed", "vetoed"].includes(status);
    const calendared = Boolean(calendar);
    const floor = Boolean(floorSession?.opened_at || ["passed", "failed", "senate", "senate_passed", "signed", "vetoed"].includes(status));
    const senateEnabled = Boolean(classSettings?.senate?.enabled);
    const executiveEnabled = Boolean(classSettings?.executive?.enabled);
    const senateDone = ["senate_passed", "signed", "vetoed"].includes(status);
    const executiveReady = executiveEnabled && (senateEnabled ? status === "senate_passed" : status === "passed");
    const executiveDone = ["signed", "vetoed"].includes(status);
    const final = finalStatuses.includes(status) && (!executiveEnabled || executiveDone || status === "failed");
    const markupDate = committeeDoc?.committee_markup_posted_at || committeeDoc?.committee_vote_finalized_at || committeeDoc?.committee_vote_closed_at || latestDate(committeeVotes);
    const steps: TrackerItem[] = [
      markOverrideFilled({ label: "Introduced", status: "completed", date: bill.created_at }),
      {
        kind: "split",
        steps: [
          markOverrideFilled({ label: "Referred", status: referral ? "completed" : status === "submitted" ? "current" : "upcoming", date: referral?.referred_at }),
          markOverrideFilled({ label: "Marked up", status: markedUp ? "completed" : referral ? "current" : "upcoming", date: markupDate }),
        ],
      },
      markOverrideFilled({ label: "Reported", status: reported ? (calendared || floor || final ? "completed" : "current") : referral ? "upcoming" : "upcoming", date: committeeDoc?.committee_vote_finalized_at }),
      markOverrideFilled({ label: "Calendared", status: calendared ? (floor || final ? "completed" : "current") : "upcoming", date: calendar?.created_at || calendar?.scheduled_at }),
      markOverrideFilled({ label: "Floor", status: floor ? (status === "floor" ? "current" : "completed") : "upcoming", date: floorSession?.opened_at }),
    ];
    if (senateEnabled) {
      steps.push(markOverrideFilled({ label: "Senate", status: status === "senate" ? "current" : senateDone ? "completed" : floor ? "upcoming" : "upcoming", date: floorSession?.results_posted_at || floorSession?.closed_at, note: status === "senate" ? "Awaiting Senate" : senateDone ? "Passed Senate" : undefined }));
    }
    if (executiveEnabled) {
      steps.push(markOverrideFilled({ label: "President", status: executiveDone ? "completed" : executiveReady ? "current" : "upcoming", date: floorSession?.results_posted_at || floorSession?.closed_at, note: executiveDone ? statusLabel(status) : executiveReady ? "Awaiting action" : undefined }));
    }
    steps.push(markOverrideFilled({ label: "Final", status: final ? "completed" : ["passed", "senate_passed"].includes(status) && !executiveEnabled ? "completed" : "upcoming", date: floorSession?.closed_at, note: final || (["passed", "senate_passed"].includes(status) && !executiveEnabled) ? statusLabel(status) : undefined }));
    return steps;
  }, [bill, calendar, classSettings, committeeDoc, committeeVotes, finalStatuses, floorSession, referral, teacherOverrideActions]);

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
                  role: currentProfile?.role ?? null,
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

  const refreshBillState = async () => {
    if (!id) return;
    const res = await fetchBillDetail(id);
    setBill(res.bill);
    setSponsor(res.sponsor);
    setCosponsors(res.cosponsors);
    setCosponsorIds(res.cosponsorIds);
    setReferral(res.referral);
    setCommitteeDoc(res.committeeDoc);
    setCommitteeDocs(res.committeeDocs ?? []);
    setCommitteeVotes(res.committeeVotes);
    setCalendar(res.calendar);
    setFloorSession(res.floorSession);
    setFloorVotes(res.floorVotes);
    setClassSettings(res.classSettings ?? {});
    const { data: overrideRows } = await supabase
      .from("bill_teacher_overrides")
      .select("id,step,note,created_at")
      .eq("bill_id", res.bill.id)
      .order("created_at", { ascending: false });
    setTeacherOverrideActions((overrideRows ?? []) as any);
  };

  const upsertTeacherReferral = async (committeeId: string) => {
    if (!bill) return null;
    const { data: rpcData, error: rpcError } = await supabase.rpc("teacher_set_bill_referral", { target_bill: bill.id, target_committee: committeeId } as any);
    if (!rpcError) return (rpcData as string) ?? committeeId;
    if ((rpcError as any).code !== "PGRST202" && !String(rpcError.message ?? "").includes("teacher_set_bill_referral")) throw rpcError;
    const { error: deleteError } = await supabase.from("bill_referrals").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
    if (deleteError) throw deleteError;
    const { error: referralError } = await supabase.from("bill_referrals").insert(
      {
        bill_id: bill.id,
        class_id: bill.class_id,
        committee_id: committeeId,
        referred_by: currentUserId,
        referred_at: new Date().toISOString(),
      } as any,
    );
    if (referralError) throw referralError;
    const { error: billError } = await supabase.from("bills").update({ status: "in_committee" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
    if (billError) throw billError;
    return committeeId;
  };

  const openTeacherTrackerOverride = (step: TrackerStep) => {
    if (userRole !== "teacher" || !bill) return;
    if (["Senate", "President"].includes(step.label)) {
      toast.info(overrideMessage(step.label));
      return;
    }
    if (committeeOptions.length === 0 && ["Referred", "Marked up"].includes(step.label)) {
      toast.error("No committees are configured for this class");
      return;
    }
    const defaultCommitteeId = referral?.committee_id ?? committeeOptions[0]?.id ?? "";
    setTrackerOverrideDraft({
      step,
      committeeId: defaultCommitteeId,
      scheduledAt: new Date().toISOString().slice(0, 16),
      finalStatus: "passed",
    });
  };

  const handleTeacherTrackerOverride = async () => {
    if (userRole !== "teacher" || !bill || !trackerOverrideDraft) return;
    const { step, committeeId, scheduledAt, finalStatus } = trackerOverrideDraft;
    if (["Referred", "Marked up"].includes(step.label) && !committeeId) {
      toast.error("Choose a committee");
      return;
    }
    const targetCommitteeId = step.label === "Reported" ? referral?.committee_id : committeeId;
    setTrackerOverrideSaving(true);
    try {
      if (step.label === "Introduced") {
        await supabase.from("bill_referrals").delete().eq("bill_id", bill.id);
        await supabase.from("committee_bill_docs").delete().eq("bill_id", bill.id);
        await supabase.from("bill_calendar").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await supabase.from("bill_floor_sessions").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        const { error } = await supabase.from("bills").update({ status: "submitted" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (error) throw error;
      } else if (step.label === "Referred") {
        await supabase.from("committee_bill_docs").delete().eq("bill_id", bill.id);
        await supabase.from("bill_calendar").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await supabase.from("bill_floor_sessions").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await upsertTeacherReferral(committeeId);
      } else if (step.label === "Marked up") {
        await supabase.from("bill_calendar").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await supabase.from("bill_floor_sessions").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await upsertTeacherReferral(committeeId);
        const now = new Date().toISOString();
        const { error: docError } = await supabase.from("committee_bill_docs").upsert(
          { bill_id: bill.id, committee_id: committeeId, class_id: bill.class_id, committee_markup_posted_at: now } as any,
          { onConflict: "bill_id,committee_id" },
        );
        if (docError) throw docError;
        const { error: billError } = await supabase.from("bills").update({ status: "committee_vote" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (billError) throw billError;
      } else if (step.label === "Reported") {
        await supabase.from("bill_calendar").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        await supabase.from("bill_floor_sessions").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        if (targetCommitteeId) {
          await upsertTeacherReferral(targetCommitteeId);
          const { error: docError } = await supabase.from("committee_bill_docs").upsert(
            { bill_id: bill.id, committee_id: targetCommitteeId, class_id: bill.class_id, committee_vote_finalized_at: new Date().toISOString() } as any,
            { onConflict: "bill_id,committee_id" },
          );
          if (docError) throw docError;
        }
        const { error } = await supabase.from("bills").update({ status: "reported" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (error) throw error;
      } else if (step.label === "Calendared") {
        await supabase.from("bill_floor_sessions").delete().eq("bill_id", bill.id).eq("class_id", bill.class_id);
        if (!scheduledAt) return;
        const { error: calendarError } = await supabase.from("bill_calendar").upsert(
          { bill_id: bill.id, class_id: bill.class_id, scheduled_at: new Date(scheduledAt).toISOString(), duration_minutes: 30, published: true, created_by: currentUserId } as any,
          { onConflict: "class_id,bill_id" },
        );
        if (calendarError) throw calendarError;
        const { error } = await supabase.from("bills").update({ status: "calendared" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (error) throw error;
      } else if (step.label === "Floor") {
        const now = new Date().toISOString();
        const { error: sessionError } = await supabase.from("bill_floor_sessions").upsert(
          { bill_id: bill.id, class_id: bill.class_id, status: "open", opened_at: now, opened_by: currentUserId } as any,
          { onConflict: "class_id,bill_id" },
        );
        if (sessionError) throw sessionError;
        const { error } = await supabase.from("bills").update({ status: "floor" } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (error) throw error;
      } else if (step.label === "Final") {
        const { error: sessionError } = await supabase.from("bill_floor_sessions").upsert(
          { bill_id: bill.id, class_id: bill.class_id, status: "closed", closed_at: new Date().toISOString() } as any,
          { onConflict: "class_id,bill_id" },
        );
        if (sessionError) throw sessionError;
        const { error } = await supabase.from("bills").update({ status: finalStatus } as any).eq("id", bill.id).eq("class_id", bill.class_id);
        if (error) throw error;
      }
      await supabase.from("bill_teacher_overrides").insert({
        bill_id: bill.id,
        class_id: bill.class_id,
        actor_user_id: currentUserId,
        step: step.label,
        note: step.label === "Referred" ? `Referred to ${committeeDisplayName(committeeOptions.find((committee) => committee.id === committeeId)?.name ?? "selected committee")}` : null,
      } as any);
      await refreshBillState();
      setTrackerOverrideDraft(null);
      toast.success("Bill tracker updated");
    } catch (e: any) {
      toast.error(e.message || "Could not update bill tracker");
    } finally {
      setTrackerOverrideSaving(false);
    }
  };

  const recordBillStatusDecision = async (status: string, note: string) => {
    if (!bill) return;
    try {
      const { error } = await supabase.from("bills").update({ status } as any).eq("id", bill.id).eq("class_id", bill.class_id);
      if (error) throw error;
      if (currentUserId) {
        await supabase.from("bill_teacher_overrides").insert({
          bill_id: bill.id,
          class_id: bill.class_id,
          actor_user_id: currentUserId,
          step: ["signed", "vetoed"].includes(status) ? "President" : "Senate",
          note,
        } as any);
      }
      await refreshBillState();
      toast.success(note);
    } catch (e: any) {
      toast.error(e.message || "Could not update bill status");
    }
  };

  const handleSenateDecision = async (passed: boolean) => {
    if (userRole !== "teacher" || !bill || bill.status !== "senate") return;
    await recordBillStatusDecision(passed ? "senate_passed" : "failed", passed ? "Passed by Senate" : "Rejected by Senate");
  };

  const handleExecutiveDecision = async (status: "signed" | "vetoed") => {
    if (!bill) return;
    const executiveEnabled = Boolean(classSettings?.executive?.enabled);
    const senateEnabled = Boolean(classSettings?.senate?.enabled);
    const presidentUserId = classSettings?.executive?.presidentUserId as string | null | undefined;
    const ready = senateEnabled ? bill.status === "senate_passed" : bill.status === "passed";
    const canAct = ready && executiveEnabled && (userRole === "teacher" || (currentUserId && presidentUserId === currentUserId));
    if (!canAct) return;
    await recordBillStatusDecision(status, status === "signed" ? "Signed by President" : "Vetoed by President");
  };

  const handleDeleteBill = async () => {
    if (userRole !== "teacher" || !bill || deletePending) return;
    setDeletePending(true);
    try {
      await deleteBillForCurrentClass(bill.id);
      toast.success("Bill deleted");
      navigate("/bills");
    } catch (e: any) {
      toast.error(e.message || "Could not delete bill");
    } finally {
      setDeletePending(false);
      setDeleteDialogOpen(false);
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

  const sponsorName = displayPersonName(sponsor?.display_name ?? "Unknown");
  const sponsorDistrict = formatConstituency(sponsor?.constituency_name);
  const isUserSponsor = sponsor?.user_id === currentUserId || bill.author_user_id === currentUserId;
  const senateEnabled = Boolean(classSettings?.senate?.enabled);
  const executiveEnabled = Boolean(classSettings?.executive?.enabled);
  const presidentUserId = classSettings?.executive?.presidentUserId as string | null | undefined;
  const isPresident = Boolean(executiveEnabled && currentUserId && presidentUserId === currentUserId);
  const canRecordSenate = userRole === "teacher" && senateEnabled && bill.status === "senate";
  const executiveReady = executiveEnabled && (senateEnabled ? bill.status === "senate_passed" : bill.status === "passed");
  const canRecordExecutive = executiveReady && (userRole === "teacher" || isPresident);
  const overrideCommitteeOptions =
    trackerOverrideDraft?.step.label === "Marked up" && referral?.committee_id
      ? [
          ...committeeOptions.filter((committee) => committee.id === referral.committee_id),
          ...committeeOptions.filter((committee) => committee.id !== referral.committee_id),
        ]
      : committeeOptions;
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/bills");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {userRole === "teacher" && (
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete bill
            </button>
          )}
        </div>
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
              <Link to={profilePath(sponsor?.user_id ?? bill.author_user_id)} className={`font-medium hover:underline ${sponsor?.role === "teacher" ? "text-green-700" : "text-blue-600"}`}>
                {sponsorName}
              </Link>
              {sponsor?.role !== "teacher" && <span className="text-gray-500"> ({sponsor?.party ?? "Independent"}{sponsorDistrict ? `-${sponsorDistrict}` : ""})</span>}
            </div>
            <div><span className="font-semibold text-gray-900">Committees:</span> {referral?.committee_name ?? "Not referred"}</div>
            <div>
              <span className="font-semibold text-gray-900">Committee reports:</span>{" "}
              {referral?.committee_id && (committeeDoc?.committee_report_submitted_at || subcommitteeReports.length) ? (
                <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
                  {subcommitteeReports.map((report: any) => (
                    <span key={report.subcommitteeId ?? report.subcommitteeName} className="text-gray-700">
                      {report.subcommitteeName ?? "Subcommittee"} Report
                      {report.votes ? <span className="text-gray-500"> ({report.votes.yea ?? 0}-{report.votes.nay ?? 0})</span> : null}
                    </span>
                  ))}
                  {committeeDoc?.committee_report_submitted_at ? (
                    committeeDoc?.committee_report_pdf_path ? (
                      <a href={storageFileHashUrl("simulation-pdfs", committeeDoc.committee_report_pdf_path)} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                        {committeeDisplayName(referral.committee_name)} Report
                      </a>
                    ) : (
                      <Link to={`/committee/${referral.committee_id}/reports/${bill.id}`} className="font-medium text-blue-600 hover:underline">
                        {committeeDisplayName(referral.committee_name)} Report
                      </Link>
                    )
                  ) : null}
                </span>
              ) : (
                "Not submitted"
              )}
            </div>
            <div><span className="font-semibold text-gray-900">Latest action:</span> {latestAction ? `${latestAction.label} - ${formatDate(latestAction.date)}` : "No action yet"}</div>
          </div>
          {userRole === "teacher" && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
              <span>Teacher override is enabled. Click a tracker stage to review and confirm a manual status change.</span>
            </div>
          )}
          {(canRecordSenate || canRecordExecutive) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {canRecordSenate && (
                <>
                  <span className="mr-1 text-sm font-semibold text-gray-900">Senate action</span>
                  <button type="button" onClick={() => void handleSenateDecision(true)} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                    Pass Senate
                  </button>
                  <button type="button" onClick={() => void handleSenateDecision(false)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                    Reject
                  </button>
                </>
              )}
              {canRecordExecutive && (
                <>
                  <span className="mr-1 text-sm font-semibold text-gray-900">President action</span>
                  <button type="button" onClick={() => void handleExecutiveDecision("signed")} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                    Sign
                  </button>
                  <button type="button" onClick={() => void handleExecutiveDecision("vetoed")} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                    Veto
                  </button>
                </>
              )}
            </div>
          )}
          <HorizontalTracker steps={tracker} onSelectStep={userRole === "teacher" ? openTeacherTrackerOverride : undefined} />
        </div>

        {bill.status === "draft" && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Hold Status:</strong> The sponsor has placed a hold on this bill, signaling to leadership that it should not move forward at this time.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div id="bill-text" className="scroll-mt-24 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200">
                <div className="flex overflow-x-auto whitespace-nowrap">
                  {revisionTabs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setActiveTab(`revision:${doc.id}`)}
                      className={`flex shrink-0 items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === `revision:${doc.id}` ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      <FileText className="h-4 w-4" />
                      {doc.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTab("original")}
                    className={`flex shrink-0 items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === "original" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    <FileText className="h-4 w-4" />
                    Original Text
                  </button>
                  <button
                    onClick={() => setActiveTab("supporting")}
                    className={`flex shrink-0 items-center gap-2 border-l border-gray-200 px-6 py-3 font-medium transition-colors ${activeTab === "supporting" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Supporting Text
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeRevision && (
                  activeRevision?.revised_pdf_path ? (
                    <PdfDocumentPanel path={activeRevision.revised_pdf_path} title="Committee revised text PDF" />
                  ) : (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(revisedHtml) }} />
                  )
                )}
                {activeTab === "original" && (
                  originalPdfPath ? (
                    <PdfDocumentPanel path={originalPdfPath} title="Legislative text PDF" />
                  ) : (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(bill.legislative_text) }} />
                  )
                )}
                {activeTab === "supporting" && <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(bill.supporting_text || "<p><em>No supporting text</em></p>") }} />}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            {showCosponsors && <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <h2 className="font-semibold text-gray-900">Cosponsors</h2>
                </div>
                {!isUserSponsor && currentUserId && (
                  <button
                    onClick={() => void toggleCurrentUserCosponsor()}
                    disabled={!cosponsorAllowed || cosponsorPending}
                    title={cosponsorAllowed ? undefined : "Cosponsorship is not available at this stage."}
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
                      <Link to={profilePath(cosponsor.user_id)} className={`font-medium hover:underline ${cosponsor.role === "teacher" ? "text-green-700" : "text-blue-600"}`}>
                        {displayPersonName(cosponsor.display_name ?? "Unknown")}
                      </Link>
                      {cosponsor.role !== "teacher" && <div className="text-xs text-gray-600">{cosponsor.party ?? "Independent"}{cosponsor.constituency_name ? ` - ${formatConstituency(cosponsor.constituency_name)}` : ""}</div>}
                      <div className="mt-1 text-xs text-gray-500">Cosponsored {formatDate(cosponsor.cosponsored_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>}

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-900">Actions</h2>
              <div className="space-y-4">
                {actions.map((action, index) => (
                  <div key={`${action.label}-${action.date}-${index}`} className={`border-l-2 pl-3 ${action.tone === "teacher" ? "border-green-600" : "border-blue-200"}`}>
                    <div className={`text-sm font-medium ${action.tone === "teacher" ? "text-green-800" : "text-gray-900"}`}>{action.label}</div>
                    {action.detail && <div className="text-xs text-gray-600">{action.detail}</div>}
                    <div className="mt-1 text-xs text-gray-500">{new Date(action.date).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      {trackerOverrideDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-5 pt-4">
              <h2 className="text-lg font-semibold text-gray-900">Confirm teacher override</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {["Referred", "Marked up"].includes(trackerOverrideDraft.step.label) && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Committee</span>
                  <select
                    value={trackerOverrideDraft.committeeId}
                    onChange={(event) => setTrackerOverrideDraft((draft) => draft ? { ...draft, committeeId: event.target.value } : draft)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {overrideCommitteeOptions.map((committee) => (
                      <option key={committee.id} value={committee.id}>
                        {committee.name}{trackerOverrideDraft.step.label === "Marked up" && committee.id === referral?.committee_id ? " (current committee)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-sm text-gray-600">{overrideMessage(trackerOverrideDraft.step.label)}</span>
                </label>
              )}
              {!["Referred", "Marked up"].includes(trackerOverrideDraft.step.label) && (
                <p className="text-sm text-gray-600">{overrideMessage(trackerOverrideDraft.step.label)}</p>
              )}
              {trackerOverrideDraft.step.label === "Calendared" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Schedule for</span>
                  <input
                    type="datetime-local"
                    value={trackerOverrideDraft.scheduledAt}
                    onChange={(event) => setTrackerOverrideDraft((draft) => draft ? { ...draft, scheduledAt: event.target.value } : draft)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
              {trackerOverrideDraft.step.label === "Final" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Final result</span>
                  <select
                    value={trackerOverrideDraft.finalStatus}
                    onChange={(event) => setTrackerOverrideDraft((draft) => draft ? { ...draft, finalStatus: event.target.value as "passed" | "failed" } : draft)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
              )}
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This action will create or update related committee, calendar, or floor records.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setTrackerOverrideDraft(null)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTeacherTrackerOverride()}
                disabled={trackerOverrideSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {trackerOverrideSaving ? "Updating" : "Confirm update"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="px-5 pt-4">
              <h2 className="text-lg font-semibold text-gray-900">Delete bill?</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-600">
                This will remove {bill.hr_label} - {bill.title} from the simulation.
              </p>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                This cannot be undone from the site. When hard deletion is available on the database, related bill
                records are removed with it.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deletePending}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBill()}
                disabled={deletePending}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletePending ? "Deleting" : "Delete bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
