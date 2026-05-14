import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowDownAZ, ArrowUpAZ, DollarSign, Download, ExternalLink, Eye, FileText, Mail, MoreHorizontal, Newspaper, Pin, Plus, Search, Trash2, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { InfoTooltip } from "../components/InfoTooltip";
import { CompactPager } from "../components/CompactPager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";
import { useAuth } from "../utils/AuthContext";
import { formatConstituency } from "../utils/constituency";
import { profilePath } from "../utils/profileRoute";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { committeeDisplayName } from "../utils/committeeNames";

type VoteChoice = "yea" | "nay" | "present" | "not_voted";
type BaseRecordType = "letter" | "report" | "vote" | "newsletter" | "campaign_contribution";
type RowMode = "preview" | "open";
type SortKey = "date" | "title" | "type";
type SortDirection = "asc" | "desc";
const RECORD_ROW_MODE_KEY = "gavel:records:row-mode";
const RECORD_PREVIEW_SPLIT_KEY = "gavel:records:preview-split";
const PREVIEW_SPLIT_MIN = 25;
const PREVIEW_SPLIT_MAX = 97;
const PREVIEW_SPLIT_CLOSE_AT = 98.5;
type VoteList = Record<VoteChoice, Array<{ userId: string; name: string }>>;
type NewsletterRow = { label: string; detail?: string; href?: string; sponsor?: string; sponsorHref?: string; transition?: string };

type RecordItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string;
  href: string;
  body?: string;
  authorId?: string | null;
  voteUserIds?: string[];
  votes?: VoteList;
  metadata?: any;
  generated?: boolean;
  deletable?: boolean;
};

function FilterSelect({ value, onChange, children, className = "w-40" }: { value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[140]">{children}</SelectContent>
    </Select>
  );
}

const emptyVotes = (): VoteList => ({ yea: [], nay: [], present: [], not_voted: [] });
const builtInTypes: BaseRecordType[] = ["letter", "report", "vote", "newsletter", "campaign_contribution"];

function typeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayPartyName(name: string) {
  const normalized = name.trim();
  if (/democratic( party)?$/i.test(normalized) || /^democrat(ic)?$/i.test(normalized)) return "Democratic Party";
  if (/republican( party)?$/i.test(normalized)) return "Republican Party";
  return /party$/i.test(normalized) ? normalized : `${normalized} Party`;
}

function displayContributionNote(note: string) {
  if (/^dashboard access$/i.test(note.trim())) return "Message board access";
  if (/^review access$/i.test(note.trim())) return "Markup area access";
  return note;
}

function recordIcon(type: string) {
  if (type === "letter") return Mail;
  if (type === "vote") return Vote;
  if (type === "newsletter") return Newspaper;
  if (type === "campaign_contribution") return DollarSign;
  return FileText;
}

function partyAbbr(party: string | null | undefined) {
  const normalized = String(party ?? "").toLowerCase();
  if (normalized.includes("democrat")) return "D";
  if (normalized.includes("republican")) return "R";
  if (normalized.includes("independent")) return "I";
  if (normalized.includes("green")) return "G";
  if (normalized.includes("libertarian")) return "L";
  return party?.trim()?.slice(0, 1).toUpperCase() || "I";
}

function statusRank(status: string) {
  const ranks: Record<string, number> = { draft: 0, submitted: 1, in_committee: 2, committee_vote: 3, reported: 4, calendared: 5, floor: 6, passed: 7, failed: 7 };
  return ranks[status] ?? 0;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    in_committee: "In committee",
    committee_vote: "Committee vote",
    reported: "Reported",
    calendared: "Calendared",
    floor: "Floor",
    passed: "Passed",
    failed: "Failed",
  };
  return labels[status] ?? typeLabel(status);
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLine(value: string, max = 86) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function newsletterRowText(row: NewsletterRow) {
  if (row.sponsor || row.transition) {
    return [row.label, row.sponsor ? `Sponsored by ${row.sponsor}` : "", row.transition ?? row.detail ?? ""].filter(Boolean).join(" | ");
  }
  return `${row.label}${row.detail ? ` ${row.detail}` : ""}`;
}

function absolutePdfUrl(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${href.startsWith("/") ? href : `/${href}`}`;
}

function pdfUriEscape(value: string) {
  return pdfEscape(value).replace(/\r?\n/g, "");
}

function downloadNewsletterPdf(record: RecordItem) {
  const newsletter = record.metadata?.newsletter;
  const sections: Array<[string, NewsletterRow[]]> = [
    ["Daily Digest", [{ label: record.subtitle }, { label: new Date(record.date).toLocaleString() }]],
    ["Referrals", newsletter?.referrals ?? []],
    ["Committee Meetings", newsletter?.meetings ?? []],
    ["Committee Reports and Votes", newsletter?.reportedBills ?? []],
    ["Top Cosponsor Gains", newsletter?.cosponsorLeaders ?? []],
    ["Fastest-Moving Bills", newsletter?.fastestMoving ?? []],
  ];
  type PdfLine = { text: string; size?: number; bold?: boolean; links?: Array<{ href: string; start: number; length: number }> };
  const textLines: PdfLine[] = [{ text: record.title, size: 18, bold: true }, { text: "" }];
  for (const [title, rows] of sections) {
    textLines.push({ text: title, size: 13, bold: true });
    if (rows.length) {
      rows.forEach((row, index) => {
        const prefix = title === "Daily Digest" ? "" : `${index + 1}. `;
        const text = `${prefix}${newsletterRowText(row)}`;
        const links: PdfLine["links"] = [];
        if (row.href) links.push({ href: row.href, start: prefix.length, length: row.label.length });
        if (row.sponsor && row.sponsorHref) {
          const sponsorText = `Sponsored by ${row.sponsor}`;
          const start = text.indexOf(sponsorText);
          if (start >= 0) links.push({ href: row.sponsorHref, start: start + "Sponsored by ".length, length: row.sponsor.length });
        }
        textLines.push({ text, links });
      });
    } else {
      textLines.push({ text: "None" });
    }
    textLines.push({ text: "" });
  }

  const pages: PdfLine[][] = [[]];
  for (const rawLine of textLines) {
    const wrapped = wrapPdfLine(rawLine.text, rawLine.size && rawLine.size > 13 ? 58 : 86);
    wrapped.forEach((line, partIndex) => {
      if (pages[pages.length - 1].length >= 42) pages.push([]);
      pages[pages.length - 1].push({
        ...rawLine,
        text: line,
        links: partIndex === 0 ? rawLine.links : [],
      });
    });
  }

  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };
  const pageObjectIds: number[] = [];
  const pagesId = 2;
  const fontId = 3;
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (const pageLines of pages) {
    const annotations: string[] = [];
    pageLines.forEach((line, index) => {
      const y = 760 - index * 16;
      const size = line.size ?? 11;
      for (const link of line.links ?? []) {
        const x1 = 50 + link.start * (size * 0.48);
        const x2 = Math.min(562, x1 + link.length * (size * 0.48));
        annotations.push(
          `<< /Type /Annot /Subtype /Link /Rect [${x1.toFixed(1)} ${(y - 2).toFixed(1)} ${x2.toFixed(1)} ${(y + 10).toFixed(1)}] /Border [0 0 0] /A << /S /URI /URI (${pdfUriEscape(absolutePdfUrl(link.href))}) >> >>`,
        );
      }
    });
    const annotationIds = annotations.map((annotation) => addObject(annotation));
    const stream = [
      "BT",
      "/F1 11 Tf",
      "50 760 Td",
      ...pageLines.map((line, index) => {
        const size = line.size ?? 11;
        const prefix = `${index === 0 ? "" : "0 -16 Td"}${size !== 11 ? `/F1 ${size} Tf ` : ""}`;
        return `${prefix}(${pdfEscape(line.text)}) Tj${size !== 11 ? " /F1 11 Tf" : ""}`;
      }),
      "ET",
    ].join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R${annotationIds.length ? ` /Annots [${annotationIds.map((id) => `${id} 0 R`).join(" ")}]` : ""} >>`);
    pageObjectIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${record.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "newsletter"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function RecordPreviewPanel({ record }: { record: RecordItem }) {
  const Icon = recordIcon(record.type);
  const voteLists = record.votes;
  const newsletter = record.metadata?.newsletter;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(480);
  const textTooNarrow = panelWidth < 260;

  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (textTooNarrow) {
    return (
      <div ref={panelRef} className="flex min-h-[18rem] items-center justify-center rounded-lg border border-dotted border-gray-300 bg-gray-50 p-5 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">The preview window is too small to display the record text.</p>
          <Link
            to={record.href}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Full Record
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="flex max-h-[calc(100vh-5rem)] min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex-shrink-0 bg-blue-600 p-4 text-white">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4" />
            {typeLabel(record.type)}
          </span>
          <Link to={record.href}>
            <button className="rounded p-1 transition-colors hover:bg-blue-700">
              <ExternalLink className="h-4 w-4" />
            </button>
          </Link>
        </div>
        <h3 className="font-semibold">{record.title}</h3>
      </div>
      <div className="space-y-4 overflow-y-auto p-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <div className="font-medium text-gray-900">{record.subtitle}</div>
          <div className="mt-1 text-xs text-gray-500">{new Date(record.date).toLocaleString()}</div>
        </div>
        {voteLists ? (
          <div className="grid grid-cols-2 gap-3">
            {(["yea", "nay", "present", "not_voted"] as VoteChoice[]).map((choice) => (
              <div key={choice} className="rounded-md border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-600">{choice.replace("_", " ")} ({voteLists[choice].length})</div>
                <div className="max-h-40 overflow-y-auto p-2">
                  {voteLists[choice].length ? voteLists[choice].map((person) => <div key={person.userId} className="truncate rounded px-2 py-1 text-sm text-gray-700">{person.name}</div>) : <div className="px-2 py-1 text-sm text-gray-400">None</div>}
                </div>
              </div>
            ))}
          </div>
        ) : newsletter ? (
          <div className="space-y-4 text-sm">
            <NewsletterSection title="Referrals" rows={newsletter.referrals} />
            <NewsletterSection title="Committee Meetings" rows={newsletter.meetings} />
            <NewsletterSection title="Committee Reports and Votes" rows={newsletter.reportedBills} />
            <NewsletterSection title="Top Cosponsor Gains" rows={newsletter.cosponsorLeaders} />
            <NewsletterSection title="Fastest-Moving Bills" rows={newsletter.fastestMoving} />
            <NewsletterSection title="Advertisement Bids" rows={newsletter.adBids} />
          </div>
        ) : (
          <div className="relative">
            <div className="max-h-[520px] overflow-hidden whitespace-pre-line text-sm leading-6 text-gray-700">{record.body || "Select Open to view the full record."}</div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent" />
          </div>
        )}
        <div className="grid gap-2">
          {newsletter && (
            <button type="button" onClick={() => downloadNewsletterPdf(record)} className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
          <Link to={record.href} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <ExternalLink className="h-4 w-4" />
            View Full Record
          </Link>
        </div>
      </div>
    </div>
  );
}

function NewsletterSection({ title, rows }: { title: string; rows?: NewsletterRow[] }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
      {rows?.length ? (
        <ol className="space-y-1">
          {rows.map((row, index) => (
            <li key={`${title}-${index}`} className="rounded bg-gray-50 px-3 py-2 text-gray-700">
              {index + 1}. {row.href ? <Link to={row.href} className="font-medium text-blue-600 hover:underline">{row.label}</Link> : row.label}
              {row.sponsor ? (
                <>
                  <span className="text-gray-400"> | </span>
                  <span className="text-gray-500">Sponsored by </span>
                  {row.sponsorHref ? <Link to={row.sponsorHref} className="font-medium text-blue-600 hover:underline">{row.sponsor}</Link> : <span className="text-gray-600">{row.sponsor}</span>}
                </>
              ) : null}
              {row.transition ? (
                <>
                  <span className="text-gray-400"> | </span>
                  <span className="text-gray-500">{row.transition}</span>
                </>
              ) : row.detail ? <span className="text-gray-500"> {row.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded bg-gray-50 px-3 py-2 text-gray-500">None</div>
      )}
    </div>
  );
}

export function RecordsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSortParam = searchParams.get("sort");
  const { user } = useAuth();
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordTypes, setRecordTypes] = useState<string[]>(["record"]);
  const [classId, setClassId] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>(initialSortParam === "title" || initialSortParam === "type" ? initialSortParam : "date");
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortParam === "oldest" || searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [rowMode, setRowMode] = useState<RowMode>(() => {
    const saved = window.localStorage.getItem(RECORD_ROW_MODE_KEY);
    return saved === "open" || saved === "preview" ? saved : "preview";
  });
  const [previewSplitPct, setPreviewSplitPct] = useState(() => {
    const saved = Number(window.localStorage.getItem(RECORD_PREVIEW_SPLIT_KEY));
    return Number.isFinite(saved) && saved >= PREVIEW_SPLIT_MIN && saved <= PREVIEW_SPLIT_MAX ? saved : 66;
  });
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editorOpen, setEditorOpen] = useState(false);
  const [adBidOpen, setAdBidOpen] = useState(false);
  const [recordDraft, setRecordDraft] = useState({ title: "", type: "record", body: "" });
  const [adBidDraft, setAdBidDraft] = useState({ message: "", amount: "0", lobbyistGroupId: "" });
  const [myLobbyistGroups, setMyLobbyistGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [peopleOptions, setPeopleOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [moneyEnabled, setMoneyEnabled] = useState(false);
  const [openRecordMenuId, setOpenRecordMenuId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const userFilter = searchParams.get("user") ?? searchParams.get("author") ?? "";

  const loadRecords = async () => {
    setLoading(true);
    const currentUser = await getCurrentUser();
    const uid = currentUser?.id;
    if (!uid) return navigate("/signin");
    const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
    const activeClassId = (profile as any)?.class_id;
    setClassId(activeClassId ?? null);
    if (!activeClassId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const { data: cls } = await supabase.from("classes").select("settings").eq("id", activeClassId).maybeSingle();
    const customTypes = (((cls as any)?.settings?.records?.types ?? ["record"]) as string[]).filter(Boolean);
    setRecordTypes(customTypes.length ? customTypes : ["record"]);
    setMoneyEnabled(Boolean((cls as any)?.settings?.money?.enabled));

    const [{ data: customRecords }, { data: letters }, { data: orgLetterRecipients }, { data: reports }, { data: committeeDocs }, { data: committeeVotes }, { data: committeeMembers }, { data: floorSessions }, { data: floorVotes }, { data: lobbyistMemberships }, { data: contributions }, { data: contributionCommittees }, { data: contributionParties }, { data: contributionCaucuses }, directory] = await Promise.all([
      supabase.from("custom_records").select("id,type,title,body,created_by,generated,metadata,created_at,updated_at").eq("class_id", activeClassId).order("created_at", { ascending: false }),
      supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,body,created_at").eq("class_id", activeClassId).order("created_at", { ascending: false }),
      supabase.from("dear_colleague_org_recipients").select("letter_id,organization_type,organization_id").eq("class_id", activeClassId),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_report_submitted_at,bills!inner(id,hr_label,title,status),committees(id,name)")
        .eq("class_id", activeClassId)
        .neq("bills.status", "deleted")
        .not("committee_report_submitted_at", "is", null)
        .order("committee_report_submitted_at", { ascending: false }),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_vote_finalized_at,bills!inner(id,hr_label,title,status),committees(id,name)")
        .eq("class_id", activeClassId)
        .neq("bills.status", "deleted")
        .not("committee_vote_finalized_at", "is", null)
        .order("committee_vote_finalized_at", { ascending: false }),
      supabase.from("bill_committee_votes").select("bill_id,committee_id,user_id,vote").eq("class_id", activeClassId),
      supabase.from("committee_members").select("committee_id,user_id"),
      supabase.from("bill_floor_sessions").select("id,bill_id,results_posted_at,closed_at,posted_result,bills!inner(id,hr_label,title,status)").eq("class_id", activeClassId).neq("bills.status", "deleted").not("results_posted_at", "is", null),
      supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", activeClassId),
      supabase.from("lobbyist_group_members").select("group_id,lobbyist_groups(id,name)").eq("user_id", uid),
      supabase.from("lobbyist_contributions").select("id,group_id,from_user_id,recipient_type,recipient_id,amount,note,created_at,lobbyist_groups(name)").eq("class_id", activeClassId).order("created_at", { ascending: false }),
      supabase.from("committees").select("id,name").eq("class_id", activeClassId),
      supabase.from("parties").select("id,name").eq("class_id", activeClassId),
      supabase.from("caucuses").select("id,title").eq("class_id", activeClassId),
      supabase.rpc("class_directory", { target_class: activeClassId } as any),
    ]);
    setMyLobbyistGroups(((lobbyistMemberships ?? []) as any[]).map((row) => row.lobbyist_groups).filter(Boolean));

    const directoryRows = (directory.data ?? []) as any[];
    const people = directoryRows.filter((person) => person.role !== "teacher");
    setPeopleOptions(
      directoryRows
        .map((person) => ({ id: person.user_id, name: person.display_name ?? "Member" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const peopleById = new Map(people.map((person) => [person.user_id, person.display_name ?? "Member"]));
    const senderIds = Array.from(new Set((letters ?? []).map((letter: any) => letter.sender_user_id).filter(Boolean)));
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("user_id,display_name").in("user_id", senderIds)
      : ({ data: [] } as any);
    const profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row.display_name ?? "Member"]));
    const committeeNames = new Map(((contributionCommittees ?? []) as any[]).map((committee) => [committee.id, committeeDisplayName(committee.name)]));
    const partyNames = new Map(((contributionParties ?? []) as any[]).map((party) => [party.id, displayPartyName(party.name)]));
    const caucusNames = new Map(((contributionCaucuses ?? []) as any[]).map((caucus) => [caucus.id, caucus.title ?? "Caucus"]));
    const orgNameFor = (type: string, id: string) => {
      if (type === "committee") return committeeNames.get(id) ?? "Committee";
      if (type === "party") return partyNames.get(id) ?? "Party";
      if (type === "caucus") return caucusNames.get(id) ?? "Caucus";
      return typeLabel(type);
    };
    const orgRecipientsByLetter = new Map<string, string[]>();
    for (const row of (orgLetterRecipients ?? []) as any[]) {
      const name = orgNameFor(row.organization_type, row.organization_id);
      orgRecipientsByLetter.set(row.letter_id, [...(orgRecipientsByLetter.get(row.letter_id) ?? []), name]);
    }
    const recipientNameFor = (contribution: any) => {
      if (contribution.recipient_type === "member") return peopleById.get(contribution.recipient_id) ?? "Member";
      if (contribution.recipient_type === "committee") return committeeNames.get(contribution.recipient_id) ?? "Committee";
      if (contribution.recipient_type === "party") return partyNames.get(contribution.recipient_id) ?? "Party";
      if (contribution.recipient_type === "caucus") return caucusNames.get(contribution.recipient_id) ?? "Caucus";
      return typeLabel(contribution.recipient_type);
    };

    const voteListsFor = (rows: any[], memberIds: string[]) => {
      const lists = emptyVotes();
      const voted = new Set<string>();
      for (const row of rows) {
        const choice = row.vote as VoteChoice;
        voted.add(row.user_id);
        lists[choice].push({ userId: row.user_id, name: peopleById.get(row.user_id) ?? "Member" });
      }
      for (const memberId of memberIds) {
        if (!voted.has(memberId)) lists.not_voted.push({ userId: memberId, name: peopleById.get(memberId) ?? "Member" });
      }
      for (const choice of Object.keys(lists) as VoteChoice[]) lists[choice].sort((a, b) => a.name.localeCompare(b.name));
      return lists;
    };

    const committeeMemberMap = new Map<string, string[]>();
    for (const row of (committeeMembers ?? []) as any[]) committeeMemberMap.set(row.committee_id, [...(committeeMemberMap.get(row.committee_id) ?? []), row.user_id]);

    const nextRecords: RecordItem[] = [
      ...((customRecords ?? []) as any[]).map((record) => ({
        id: `custom:${record.id}`,
        type: record.type,
        title: record.title,
        subtitle: record.generated ? "Generated record" : "Teacher-created record",
        date: record.created_at,
        href: record.type === "newsletter" ? `/newsletters/${record.id}` : `/records?record=${record.id}`,
        body: record.body,
        authorId: record.created_by,
        metadata: record.metadata,
        generated: record.generated,
        deletable: true,
      })),
      ...((contributions ?? []) as any[]).map((contribution) => {
        const recipientName = recipientNameFor(contribution);
        const sourceName = contribution.lobbyist_groups?.name ?? peopleById.get(contribution.from_user_id) ?? "Lobbyist";
        return {
          id: `contribution:${contribution.id}`,
          type: "campaign_contribution",
          title: `${sourceName} contributed $${Number(contribution.amount ?? 0).toLocaleString()} to ${recipientName}`,
          subtitle: `By ${peopleById.get(contribution.from_user_id) ?? sourceName}`,
          date: contribution.created_at,
          href: `/records?type=campaign_contribution&record=${contribution.id}`,
          body: displayContributionNote(contribution.note || "Campaign contribution recorded."),
          authorId: contribution.from_user_id,
          voteUserIds: [contribution.from_user_id, contribution.recipient_type === "member" ? contribution.recipient_id : ""].filter(Boolean),
          metadata: { contribution },
        };
      }),
      ...(letters ?? []).map((letter: any) => {
        const orgRecipients = orgRecipientsByLetter.get(letter.id) ?? [];
        return {
          id: `letter:${letter.id}`,
          type: "letter",
          title: letter.subject || "Dear Colleague Letter",
          subtitle: orgRecipients.length
            ? `To ${orgRecipients.join(", ")} | From ${profileMap.get(letter.sender_user_id) ?? "Member"}`
            : `From ${profileMap.get(letter.sender_user_id) ?? "Member"}`,
          date: letter.created_at,
          href: `/letters/${letter.id}`,
          body: letter.body,
          authorId: letter.sender_user_id,
        };
      }),
      ...(reports ?? []).map((report: any) => ({
        id: `report:${report.committee_id}:${report.bill_id}`,
        type: "report",
        title: `${report.committees?.name ?? "Committee"} Report`,
        subtitle: `${report.bills?.hr_label ?? "Bill"} - ${report.bills?.title ?? ""}`,
        date: report.committee_report_submitted_at,
        href: `/committee/${report.committee_id}/reports/${report.bill_id}`,
        authorId: null,
      })),
      ...(committeeDocs ?? []).map((doc: any) => {
        const rows = (committeeVotes ?? []).filter((voteRow: any) => voteRow.bill_id === doc.bill_id && voteRow.committee_id === doc.committee_id);
        const memberIds = committeeMemberMap.get(doc.committee_id) ?? [...new Set(rows.map((row: any) => row.user_id))];
        return {
          id: `committee-vote:${doc.committee_id}:${doc.bill_id}`,
          type: "vote",
          title: `${doc.committees?.name ?? "Committee"} Vote`,
          subtitle: `${doc.bills?.hr_label ?? "Bill"} - ${doc.bills?.title ?? ""}`,
          date: doc.committee_vote_finalized_at,
          href: `/bills/${doc.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes: voteListsFor(rows, memberIds),
        };
      }),
      ...(floorSessions ?? []).map((session: any) => {
        const rows = (floorVotes ?? []).filter((voteRow: any) => voteRow.session_id === session.id);
        return {
          id: `floor-vote:${session.id}`,
          type: "vote",
          title: "Floor Vote",
          subtitle: `${session.bills?.hr_label ?? "Bill"} - ${session.bills?.title ?? ""}`,
          date: session.results_posted_at ?? session.closed_at,
          href: `/bills/${session.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes: voteListsFor(rows, people.map((person) => person.user_id)),
        };
      }),
    ];
    setRecords(nextRecords);
    const requestedRecordId = searchParams.get("record");
    setSelectedRecord((prev) => nextRecords.find((record) => record.id === `custom:${requestedRecordId}` || record.id === `contribution:${requestedRecordId}`) ?? prev ?? nextRecords[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, sortDirection, typeFilter, pageSize, userFilter]);

  useEffect(() => {
    if (!openRecordMenuId) return;
    const close = () => setOpenRecordMenuId(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openRecordMenuId]);

  useEffect(() => {
    window.localStorage.setItem(RECORD_ROW_MODE_KEY, rowMode);
  }, [rowMode]);

  useEffect(() => {
    window.localStorage.setItem(RECORD_PREVIEW_SPLIT_KEY, String(Math.round(previewSplitPct)));
  }, [previewSplitPct]);

  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (event: MouseEvent) => {
      const container = document.getElementById("records-preview-split");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      if (next >= PREVIEW_SPLIT_CLOSE_AT) {
        setPreviewSplitPct(PREVIEW_SPLIT_MAX);
        setRowMode("open");
        return;
      }
      setRowMode("preview");
      setPreviewSplitPct(Math.min(PREVIEW_SPLIT_MAX, Math.max(PREVIEW_SPLIT_MIN, next)));
    };
    const onUp = () => setDraggingSplit(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingSplit]);

  const availableTypes = useMemo(() => Array.from(new Set([...builtInTypes, ...recordTypes, ...records.map((record) => record.type)])), [recordTypes, records]);
  const defaultRecordsView = !query.trim() && typeFilter === "all" && sortBy === "date" && sortDirection === "desc" && !userFilter;
  const latestNewsletterId = useMemo(
    () => [...records].filter((record) => record.type === "newsletter").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.id ?? "",
    [records],
  );
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records
      .filter((record) => typeFilter === "all" || record.type === typeFilter)
      .filter((record) => !userFilter || record.authorId === userFilter || record.voteUserIds?.includes(userFilter))
      .filter((record) => !q || `${record.title} ${record.subtitle} ${record.body ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        let result = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === "title") result = a.title.localeCompare(b.title);
        if (sortBy === "type") result = typeLabel(a.type).localeCompare(typeLabel(b.type)) || new Date(a.date).getTime() - new Date(b.date).getTime();
        return result * (sortDirection === "asc" ? 1 : -1);
      });
    if (defaultRecordsView && latestNewsletterId) {
      const index = list.findIndex((record) => record.id === latestNewsletterId);
      if (index > 0) list.unshift(...list.splice(index, 1));
    }
    return list;
  }, [defaultRecordsView, latestNewsletterId, query, records, sortBy, sortDirection, typeFilter, userFilter]);

  useEffect(() => {
    if (!filteredRecords.length) {
      setSelectedRecord(null);
      return;
    }
    setSelectedRecord((current) => (current && filteredRecords.some((record) => record.id === current.id) ? current : filteredRecords[0]));
  }, [filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resultLabel = loading ? "Loading records..." : `${filteredRecords.length} records found`;

  const updateParam = (key: string, value: string, defaultValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const setType = (value: string) => {
    setTypeFilter(value);
    updateParam("type", value, "all");
  };

  const setPerson = (value: string) => {
    updateParam("user", value, "all");
  };

  const resetFilters = () => {
    setQuery("");
    setType("all");
    setSortBy("date");
    setSortDirection("desc");
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("type");
    next.delete("sort");
    next.delete("dir");
    next.delete("user");
    next.delete("author");
    setSearchParams(next);
  };

  const handleRecordClick = (record: RecordItem) => {
    if (rowMode === "open") {
      navigate(record.href);
      if (record.href.startsWith("/records")) setSelectedRecord(record);
      return;
    }
    setSelectedRecord(record);
  };

  const createRecord = async () => {
    if (!classId || !recordDraft.title.trim()) return;
    const currentUser = await getCurrentUser();
    const { error } = await supabase.from("custom_records").insert({
      class_id: classId,
      title: recordDraft.title.trim(),
      type: recordDraft.type,
      body: recordDraft.body.trim(),
      created_by: currentUser?.id ?? null,
    } as any);
    if (error) throw error;
    setEditorOpen(false);
    setRecordDraft({ title: "", type: recordTypes[0] ?? "record", body: "" });
    await loadRecords();
  };

  const createAdBid = async () => {
    if (!classId || !adBidDraft.message.trim()) return;
    const currentUser = await getCurrentUser();
    const { error } = await supabase.from("newsletter_ad_bids").insert({
      class_id: classId,
      bidder_user_id: currentUser?.id,
      lobbyist_group_id: myLobbyistGroups[0]?.id ?? null,
      message: adBidDraft.message.trim(),
      amount: Math.max(0, Number(adBidDraft.amount) || 0),
    } as any);
    if (error) throw error;
    setAdBidOpen(false);
    setAdBidDraft({ message: "", amount: "0", lobbyistGroupId: "" });
    await loadRecords();
  };

  const requestDeleteRecord = (record: RecordItem) => {
    if (!isTeacher || !record.deletable || !record.id.startsWith("custom:")) return;
    setConfirmDialog({
      title: "Delete record?",
      message: `${record.title} will be removed from Records.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const recordId = record.id.replace(/^custom:/, "");
        const { error } = await supabase.from("custom_records").delete().eq("id", recordId);
        if (error) throw error;
        toast.success("Record deleted");
        setSelectedRecord((current) => current?.id === record.id ? null : current);
        await loadRecords();
      },
    });
  };

  const generateNewsletter = async () => {
    if (!classId) return;
    const currentUser = await getCurrentUser();
    const { data: last } = await supabase
      .from("custom_records")
      .select("created_at")
      .eq("class_id", classId)
      .eq("type", "newsletter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = (last as any)?.created_at ?? "1970-01-01T00:00:00.000Z";
    const [{ data: cosponsors }, { data: bills }, { data: reports }, { data: votes }, { data: meetings }, { data: referrals }, { data: adBids }] = await Promise.all([
      supabase.from("bill_cosponsors").select("bill_id,created_at,bills!inner(id,hr_label,title,status)").eq("class_id", classId).neq("bills.status", "deleted").gt("created_at", since),
      supabase.from("bill_display").select("id,hr_label,title,status,created_at,author_user_id").eq("class_id", classId).neq("status", "deleted").gte("created_at", since),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_report_submitted_at,bills!inner(id,hr_label,title,status),committees(id,name)")
        .eq("class_id", classId)
        .neq("bills.status", "deleted")
        .gt("committee_report_submitted_at", since),
      supabase.from("bill_committee_votes").select("bill_id,committee_id,vote").eq("class_id", classId),
      supabase.from("committee_meetings").select("committee_id,started_at,ended_at,committees(name)").eq("class_id", classId).gt("started_at", since).order("started_at", { ascending: true }),
      supabase.from("bill_referrals").select("bill_id,committee_id,referred_at,bills!inner(id,hr_label,title,status),committees(id,name)").eq("class_id", classId).neq("bills.status", "deleted").gt("referred_at", since).order("referred_at", { ascending: true }),
      supabase.from("newsletter_ad_bids").select("id,bidder_user_id,message,amount,created_at,status,lobbyist_groups(name)").eq("class_id", classId).gt("created_at", since).order("amount", { ascending: false }),
    ]);
    const cosponsorCounts = new Map<string, any>();
    for (const row of (cosponsors ?? []) as any[]) {
      const current = cosponsorCounts.get(row.bill_id) ?? { bill: row.bills, count: 0 };
      current.count += 1;
      cosponsorCounts.set(row.bill_id, current);
    }
    const cosponsorLeaders = [...cosponsorCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((row) => ({ label: `${row.bill?.hr_label ?? "Bill"} - ${row.bill?.title ?? ""}`, href: `/bills/${row.bill?.id}`, detail: `+${row.count} cosponsor${row.count === 1 ? "" : "s"}` }));
    const authorIds = [...new Set(((bills ?? []) as any[]).map((bill) => bill.author_user_id).filter(Boolean))];
    const { data: authorProfiles } = authorIds.length
      ? await supabase.from("profiles").select("user_id,display_name,party,constituency_name").in("user_id", authorIds)
      : ({ data: [] } as any);
    const authorById = new Map((authorProfiles ?? []).map((profile: any) => [profile.user_id, profile]));
    const fastestMoving = ((bills ?? []) as any[])
      .sort((a, b) => statusRank(b.status) - statusRank(a.status))
      .slice(0, 10)
      .map((bill) => {
        const sponsor = authorById.get(bill.author_user_id) as any;
        const sponsorName = sponsor?.display_name ?? "Member";
        const district = formatConstituency(sponsor?.constituency_name);
        return {
          label: `${bill.hr_label ?? "Bill"} - ${bill.title ?? ""}`,
          href: `/bills/${bill.id}`,
          sponsor: `${sponsorName} (Rep.-${partyAbbr(sponsor?.party)}-${district || "N/A"})`,
          sponsorHref: profilePath(bill.author_user_id),
          transition: `Introduced -> ${statusLabel(bill.status)}`,
        };
      });
    const reportedBills = ((reports ?? []) as any[]).map((report) => {
      const rows = ((votes ?? []) as any[]).filter((vote) => vote.bill_id === report.bill_id && vote.committee_id === report.committee_id);
      const counts = { yea: rows.filter((row) => row.vote === "yea").length, nay: rows.filter((row) => row.vote === "nay").length, present: rows.filter((row) => row.vote === "present").length };
      return {
        label: `${report.bills?.hr_label ?? "Bill"} - ${report.bills?.title ?? ""}`,
        href: `/bills/${report.bill_id}`,
        detail: `${report.committees?.name ?? "Committee"}; ${counts.yea} yea, ${counts.nay} nay, ${counts.present} present`,
      };
    });
    const meetingRows = ((meetings ?? []) as any[]).map((meeting) => ({
      label: meeting.committees?.name ?? "Committee meeting",
      detail: `${new Date(meeting.started_at).toLocaleString()}${meeting.ended_at ? ` to ${new Date(meeting.ended_at).toLocaleString()}` : " (open)"}`,
    }));
    const referralRows = ((referrals ?? []) as any[]).map((referral) => ({
      label: `${referral.bills?.hr_label ?? "Bill"} - ${referral.bills?.title ?? ""}`,
      href: `/bills/${referral.bill_id}`,
      detail: `referred to ${referral.committees?.name ?? "committee"}`,
    }));
    const bidUserIds = [...new Set(((adBids ?? []) as any[]).map((bid) => bid.bidder_user_id).filter(Boolean))];
    const { data: bidProfiles } = bidUserIds.length
      ? await supabase.from("profiles").select("user_id,display_name").in("user_id", bidUserIds)
      : ({ data: [] } as any);
    const bidProfileMap = new Map((bidProfiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
    const rankedAdBids = ((adBids ?? []) as any[]).filter((bid) => bid.status === "pending").slice(0, 3);
    const adBidRows = rankedAdBids.map((bid) => ({
      label: bid.lobbyist_groups?.name ?? bidProfileMap.get(bid.bidder_user_id) ?? "Member",
      detail: `$${Number(bid.amount ?? 0).toLocaleString()}: ${bid.message}`,
    }));
    const metadata = { newsletter: { since, referrals: referralRows, meetings: meetingRows, reportedBills, cosponsorLeaders, fastestMoving, adBids: adBidRows } };
    const body = [
      "Daily Digest",
      "",
      "Referrals",
      ...referralRows.map((row) => `${row.label} ${row.detail}`),
      "",
      "Committee meetings",
      ...meetingRows.map((row) => `${row.label} ${row.detail}`),
      "",
      "Committee reports and votes",
      ...reportedBills.map((row) => `${row.label} ${row.detail}`),
      "",
      "Top cosponsor gains",
      ...cosponsorLeaders.map((row, index) => `${index + 1}. ${row.label} ${row.detail}`),
      "",
      "Fastest-moving bills",
      ...fastestMoving.map((row, index) => `${index + 1}. ${newsletterRowText(row)}`),
      "",
      "Advertisement bids",
      ...adBidRows.map((row, index) => `${index + 1}. ${row.label} ${row.detail}`),
    ].join("\n");
    const { error } = await supabase.from("custom_records").insert({
      class_id: classId,
      type: "newsletter",
      title: `Newsletter - ${new Date().toLocaleDateString()}`,
      body,
      metadata,
      generated: true,
      created_by: currentUser?.id ?? null,
    } as any);
    if (error) throw error;
    const acceptedIds = rankedAdBids.map((bid: any) => bid.id);
    const rejectedIds = ((adBids ?? []) as any[]).filter((bid: any) => bid.status === "pending" && !acceptedIds.includes(bid.id)).map((bid: any) => bid.id);
    if (acceptedIds.length) await supabase.from("newsletter_ad_bids").update({ status: "accepted" }).in("id", acceptedIds);
    if (rejectedIds.length) await supabase.from("newsletter_ad_bids").update({ status: "rejected" }).in("id", rejectedIds);
    await loadRecords();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">Records</h1>
              <InfoTooltip label="What are records?">
                <p>The real Congressional Record is the official published account of congressional proceedings, debate, statements, and related materials. It gives the public a searchable history of what happened in Congress.</p>
                <p className="mt-2">In this simulation, Records collects letters, reports, finalized vote records, newsletters, and teacher-created records.</p>
              </InfoTooltip>
            </div>
            <p className="text-gray-600">{resultLabel}</p>
          </div>
          {isTeacher && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void generateNewsletter()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                <Newspaper className="h-4 w-4" />
                Generate newsletter
              </button>
              <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700" aria-label="Add record">
                <Plus className="h-4 w-4" />
                Add record
              </button>
            </div>
          )}
          {!isTeacher && moneyEnabled && (
            <button type="button" onClick={() => setAdBidOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
              <DollarSign className="h-4 w-4" />
              Bid for newsletter ad
            </button>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search title, type, author, or text..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect value={typeFilter} onChange={setType}>
                  <SelectItem value="all">All types</SelectItem>
                  {availableTypes.map((type) => <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>)}
                </FilterSelect>
                <FilterSelect value={userFilter || "all"} onChange={setPerson}>
                  <SelectItem value="all">All people</SelectItem>
                  {peopleOptions.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
                </FilterSelect>
                <FilterSelect value={sortBy} onChange={(value) => { setSortBy(value as SortKey); updateParam("sort", value, "date"); }}>
                  <SelectItem value="date">Sort: Date</SelectItem>
                  <SelectItem value="title">Sort: Title</SelectItem>
                  <SelectItem value="type">Sort: Type</SelectItem>
                </FilterSelect>
                <button
                  type="button"
                  onClick={() => {
                    const next = sortDirection === "asc" ? "desc" : "asc";
                    setSortDirection(next);
                    updateParam("dir", next, "desc");
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                  title={sortDirection === "asc" ? "Ascending" : "Descending"}
                >
                  {sortDirection === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                </button>
                <button onClick={resetFilters} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700">Reset</button>
              </div>
              <div className="flex rounded-md border border-gray-300 bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setRowMode("preview")} className={`flex items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${rowMode === "preview" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button type="button" onClick={() => setRowMode("open")} className={`flex items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${rowMode === "open" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                  <ExternalLink className="h-4 w-4" />
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          id="records-preview-split"
          className={`grid grid-cols-1 gap-6 overflow-hidden ${rowMode === "preview" ? "lg:grid-cols-[var(--record-list-width)_0.375rem_minmax(0,1fr)] lg:gap-3" : "lg:grid-cols-[minmax(0,1fr)_0.375rem] lg:gap-3"}`}
          style={{ "--record-list-width": `${previewSplitPct}%` } as CSSProperties}
        >
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading records...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No records found matching your criteria</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pageRecords.map((record) => {
                    const Icon = recordIcon(record.type);
                    return (
                      <div
                        key={record.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRecordClick(record)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") handleRecordClick(record);
                        }}
                        className={`block w-full p-4 text-left transition-colors hover:bg-gray-50 ${selectedRecord?.id === record.id && rowMode === "preview" ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                <Icon className="h-3.5 w-3.5" />
                                {typeLabel(record.type)}
                              </span>
                              {defaultRecordsView && record.id === latestNewsletterId && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                  <Pin className="h-3.5 w-3.5" />
                                  Pinned
                                </span>
                              )}
                              {record.generated && <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Generated</span>}
                            </div>
                            <h2 className="mb-2 text-base font-semibold text-gray-900">{record.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                              <span>{record.subtitle}</span>
                              <span className="text-gray-300">|</span>
                              <span>{new Date(record.date).toLocaleDateString()}</span>
                            </div>
                            {record.body && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{record.body}</p>}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2 text-gray-400">
                            {isTeacher && record.deletable && (
                              <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenRecordMenuId((current) => current === record.id ? null : record.id);
                                  }}
                                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                  aria-label="Record options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {openRecordMenuId === record.id && (
                                  <div className="absolute right-0 top-full z-[120] mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenRecordMenuId(null);
                                        requestDeleteRecord(record);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {rowMode === "preview" ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {!loading && filteredRecords.length > 0 && <CompactPager currentPage={currentPage} totalPages={totalPages} totalItems={filteredRecords.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
          </div>

          <button
            type="button"
            onMouseDown={() => setDraggingSplit(true)}
            className="my-3 hidden min-h-[22rem] cursor-col-resize bg-gray-300 transition-colors hover:bg-blue-400 active:bg-blue-500 lg:block"
            aria-label={rowMode === "preview" ? "Resize records preview" : "Drag left to show records preview"}
          />

          {rowMode === "preview" && (
            <div className="min-w-0 lg:w-full">
              {selectedRecord ? <RecordPreviewPanel record={selectedRecord} /> : <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm"><p className="text-gray-500">Select a record to preview</p></div>}
            </div>
          )}
        </div>
      </main>

      {editorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add record</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            <div className="space-y-4 p-5">
              <input value={recordDraft.title} onChange={(event) => setRecordDraft({ ...recordDraft, title: event.target.value })} placeholder="Record title" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <Select value={recordDraft.type} onValueChange={(type) => setRecordDraft({ ...recordDraft, type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[140]">
                  {recordTypes.map((type) => <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>)}
                </SelectContent>
              </Select>
              <textarea value={recordDraft.body} onChange={(event) => setRecordDraft({ ...recordDraft, body: event.target.value })} rows={10} placeholder="Record text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void createRecord()} disabled={!recordDraft.title.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save record</button>
            </div>
          </div>
        </div>
      )}
      {adBidOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Bid for newsletter ad</h2>
              <button type="button" onClick={() => setAdBidOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <input value={adBidDraft.amount} onChange={(event) => setAdBidDraft({ ...adBidDraft, amount: event.target.value.replace(/[^\d]/g, "") })} placeholder="Bid amount" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={adBidDraft.message} onChange={(event) => setAdBidDraft({ ...adBidDraft, message: event.target.value })} rows={5} placeholder="Advertisement message for the next newsletter" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setAdBidOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void createAdBid()} disabled={!adBidDraft.message.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Submit bid</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}

export function NewsletterDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<RecordItem | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("custom_records")
          .select("id,type,title,body,created_by,generated,metadata,created_at")
          .eq("id", id)
          .eq("type", "newsletter")
          .maybeSingle();
        if (error) throw error;
        setRecord(data ? {
          id: `custom:${(data as any).id}`,
          type: (data as any).type,
          title: (data as any).title,
          subtitle: "Generated newsletter",
          date: (data as any).created_at,
          href: `/newsletters/${(data as any).id}`,
          body: (data as any).body,
          authorId: (data as any).created_by,
          metadata: (data as any).metadata,
          generated: (data as any).generated,
        } : null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const newsletter = record?.metadata?.newsletter;
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading newsletter...</div>
        ) : !record || !newsletter ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm">Newsletter not found.</div>
        ) : (
          <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="bg-blue-600 px-6 py-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold"><Newspaper className="h-4 w-4" />Newsletter</div>
                  <h1 className="mt-2 text-2xl font-bold">{record.title}</h1>
                  <div className="mt-1 text-sm text-blue-100">{new Date(record.date).toLocaleString()}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => downloadNewsletterPdf(record)} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-6 p-6 text-sm">
              <NewsletterSection title="Referrals" rows={newsletter.referrals} />
              <NewsletterSection title="Committee Meetings" rows={newsletter.meetings} />
              <NewsletterSection title="Committee Reports and Votes" rows={newsletter.reportedBills} />
              <NewsletterSection title="Top Cosponsor Gains" rows={newsletter.cosponsorLeaders} />
              <NewsletterSection title="Fastest-Moving Bills" rows={newsletter.fastestMoving} />
              <NewsletterSection title="Advertisement Bids" rows={newsletter.adBids} />
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
