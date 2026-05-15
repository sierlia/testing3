import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowDownAZ, ArrowUpAZ, Check, Circle, Clock, ExternalLink, Eye, FileText, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { BillPreviewPanel } from "../components/BillPreviewPanel";
import { InfoTooltip } from "../components/InfoTooltip";
import { CompactPager } from "../components/CompactPager";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { bulkUpdateBillStatusForCurrentClass, deleteBillForCurrentClass, fetchBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";
import { useAuth } from "../utils/AuthContext";
import { formatConstituency } from "../utils/constituency";
import { displayPersonName } from "../utils/displayName";
import { profilePath } from "../utils/profileRoute";

type RowMode = "preview" | "open";
type SortKey = "number" | "date" | "title" | "sponsor" | "status" | "cosponsors";
type SortDirection = "asc" | "desc";
const BILL_ROW_MODE_KEY = "gavel:bills:row-mode";
const BILL_PREVIEW_SPLIT_KEY = "gavel:bills:preview-split";
const PREVIEW_SPLIT_MIN = 32;
const PREVIEW_SPLIT_MAX = 97;
const PREVIEW_SPLIT_CLOSE_AT = 98.5;

interface BillView {
  id: string;
  number: string;
  billNumber: number;
  title: string;
  sponsorId: string;
  sponsor: string;
  sponsorParty: string;
  sponsorDistrict: string;
  sponsorRole: string | null;
  committee: string;
  status: string;
  lastUpdated: string;
  introducedAt: string;
  tags: string[];
  legislativeText: string;
  supportingText: string;
  hasHold: boolean;
  cosponsorCount: number;
  cosponsors: Array<{ id: string; name: string; party: string; district: string }>;
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

function statusLabel(status: string) {
  if (status === "submitted") return "Introduced";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(status: string) {
  if (status === "submitted") return "bg-blue-100 text-blue-700";
  if (status === "in_committee") return "bg-slate-100 text-slate-700";
  if (status === "committee_vote") return "bg-cyan-100 text-cyan-700";
  if (status === "reported") return "bg-purple-100 text-purple-700";
  if (status === "calendared") return "bg-yellow-100 text-yellow-700";
  if (status === "floor") return "bg-indigo-100 text-indigo-700";
  if (status === "passed") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function FilterSelect({ value, onChange, children, className = "w-36" }: { value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[140]">{children}</SelectContent>
    </Select>
  );
}

function sponsorDescriptor(bill: BillView) {
  return `Rep.-${partyAbbr(bill.sponsorParty)}-${bill.sponsorDistrict || "N/A"}`;
}

function billTrackerSteps(bill: BillView) {
  const status = bill.status;
  const referred = Boolean(bill.committee) || ["in_committee", "committee_vote", "reported", "calendared", "floor", "passed", "failed"].includes(status);
  const reported = ["reported", "calendared", "floor", "passed", "failed"].includes(status);
  const calendared = ["calendared", "floor", "passed", "failed"].includes(status);
  const floor = ["floor", "passed", "failed"].includes(status);
  const final = ["passed", "failed"].includes(status);
  return [
    { label: "Introduced", done: true, current: status === "submitted" },
    { label: bill.committee ? "Referred" : "Committee", done: referred, current: status === "in_committee" || status === "committee_vote" },
    { label: "Reported", done: reported, current: status === "reported" },
    { label: "Calendared", done: calendared, current: status === "calendared" },
    { label: "Floor", done: floor, current: status === "floor" },
    { label: final && status === "failed" ? "Failed" : "Passed", done: final, current: final },
  ];
}

function BillTracker({ bill }: { bill: BillView }) {
  const steps = billTrackerSteps(bill);
  return (
    <div className="mt-3 grid grid-cols-6 gap-1.5">
      {steps.map((step) => (
        <div key={step.label} className="min-w-0">
          <div className={`h-1.5 rounded-full ${step.done ? "bg-blue-600" : step.current ? "bg-blue-300" : "bg-gray-200"}`} />
          <div className={`mt-1 flex items-center gap-1 truncate text-[11px] ${step.done || step.current ? "text-gray-700" : "text-gray-400"}`}>
            {step.done ? <Check className="h-3 w-3 flex-shrink-0" /> : step.current ? <Clock className="h-3 w-3 flex-shrink-0" /> : <Circle className="h-3 w-3 flex-shrink-0" />}
            <span className="truncate">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const toBillView = (bill: BillRecord): BillView => ({
  id: bill.id,
  number: bill.hr_label,
  billNumber: bill.bill_number ?? 0,
  title: bill.title,
  sponsorId: bill.author_user_id,
  sponsor: displayPersonName(bill.profiles?.display_name ?? "Unknown"),
  sponsorParty: bill.profiles?.party ?? "Independent",
  sponsorDistrict: formatConstituency(bill.profiles?.constituency_name),
  sponsorRole: bill.profiles?.role ?? null,
  committee: bill.committee_name ?? "",
  status: bill.status,
  lastUpdated: bill.created_at,
  introducedAt: bill.created_at,
  tags: [],
  legislativeText: bill.legislative_text ?? "",
  supportingText: bill.supporting_text ?? "",
  hasHold: bill.status === "draft",
  cosponsorCount: bill.cosponsor_count ?? 0,
  cosponsors: (bill.cosponsors ?? []).map((c) => ({
    id: c.user_id,
    name: displayPersonName(c.display_name ?? "Unknown"),
    party: c.party ?? "Independent",
    district: formatConstituency(c.constituency_name),
  })),
});

const statusFilterOptions = [
  { value: "submitted", label: "Introduced" },
  { value: "in_committee", label: "In Committee" },
  { value: "reported", label: "Reported" },
  { value: "calendared", label: "Calendared" },
  { value: "floor", label: "Floor" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

const bulkStatusOptions = [
  { value: "submitted", label: "Introduced" },
  { value: "in_committee", label: "In Committee" },
  { value: "committee_vote", label: "Marked Up" },
  { value: "reported", label: "Reported" },
  { value: "calendared", label: "Calendared" },
  { value: "floor", label: "Floor" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

export function TessBills() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<BillView | null>(null);
  const [allBills, setAllBills] = useState<BillView[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowMode, setRowMode] = useState<RowMode>(() => {
    const saved = window.localStorage.getItem(BILL_ROW_MODE_KEY);
    return saved === "open" || saved === "preview" ? saved : "preview";
  });
  const [previewSplitPct, setPreviewSplitPct] = useState(() => {
    const saved = Number(window.localStorage.getItem(BILL_PREVIEW_SPLIT_KEY));
    return Number.isFinite(saved) && saved >= PREVIEW_SPLIT_MIN && saved <= PREVIEW_SPLIT_MAX ? saved : 66;
  });
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    committee: "all",
    sponsorId: "all",
    cosponsorId: "all",
  });
  const [sortBy, setSortBy] = useState<SortKey>("number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openBillMenuId, setOpenBillMenuId] = useState<string | null>(null);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [bulkOverrideOpen, setBulkOverrideOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkOverrideRef = useRef<HTMLDivElement | null>(null);
  const searchKey = searchParams.toString();

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const bills = (await fetchBillsForCurrentClass()).map(toBillView);
        setAllBills(bills);
        setSelectedBill((prev) => prev ?? bills[0] ?? null);
      } finally {
        setLoading(false);
      }
    };
    void loadBills();
  }, []);

  useEffect(() => {
    const cosponsorId = searchParams.get("cosponsorId") || searchParams.get("cosponsor");
    const sponsorId = searchParams.get("sponsorId") || searchParams.get("sponsor");
    if (!cosponsorId && !sponsorId) return;
    setFilters((prev) => ({
      ...prev,
      cosponsorId: cosponsorId || prev.cosponsorId,
      sponsorId: sponsorId || prev.sponsorId,
    }));
  }, [searchKey]);

  const committeeOptions = useMemo(() => Array.from(new Set(allBills.map((bill) => bill.committee).filter(Boolean))).sort(), [allBills]);
  const sponsorOptions = useMemo(
    () => Array.from(new Map(allBills.map((bill) => [bill.sponsorId, { id: bill.sponsorId, name: bill.sponsor }])).values()).sort((a, b) => a.name.localeCompare(b.name)),
    [allBills],
  );
  const cosponsorOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const bill of allBills) {
      for (const cosponsor of bill.cosponsors) map.set(cosponsor.id, { id: cosponsor.id, name: cosponsor.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBills]);

  const filteredBills = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const rows = allBills.filter((bill) => {
      const matchesSearch =
        !query ||
        bill.number.toLowerCase().includes(query) ||
        bill.title.toLowerCase().includes(query) ||
        bill.sponsor.toLowerCase().includes(query) ||
        bill.committee.toLowerCase().includes(query) ||
        statusLabel(bill.status).toLowerCase().includes(query) ||
        bill.cosponsors.some((c) => c.name.toLowerCase().includes(query));
      const matchesStatus = filters.status === "all" || bill.status === filters.status;
      const matchesCommittee = filters.committee === "all" || bill.committee === filters.committee;
      const matchesSponsor = filters.sponsorId === "all" || bill.sponsorId === filters.sponsorId;
      const matchesCosponsor = filters.cosponsorId === "all" || bill.cosponsors.some((c) => c.id === filters.cosponsorId);
      return matchesSearch && matchesStatus && matchesCommittee && matchesSponsor && matchesCosponsor;
    });

    return rows.sort((a, b) => {
      let result = a.billNumber - b.billNumber;
      if (sortBy === "date") result = new Date(a.introducedAt).getTime() - new Date(b.introducedAt).getTime();
      if (sortBy === "title") result = a.title.localeCompare(b.title);
      if (sortBy === "sponsor") result = a.sponsor.localeCompare(b.sponsor);
      if (sortBy === "status") result = statusLabel(a.status).localeCompare(statusLabel(b.status));
      if (sortBy === "cosponsors") result = a.cosponsorCount - b.cosponsorCount;
      return result * (sortDirection === "asc" ? 1 : -1);
    });
  }, [allBills, filters, searchQuery, sortBy, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, searchQuery, sortBy, sortDirection]);

  useEffect(() => {
    if (!filteredBills.length) {
      setSelectedBill(null);
      setSelectedBillIds([]);
      return;
    }
    setSelectedBill((current) => (current && filteredBills.some((bill) => bill.id === current.id) ? current : filteredBills[0]));
    const filteredIds = new Set(filteredBills.map((bill) => bill.id));
    setSelectedBillIds((current) => current.filter((id) => filteredIds.has(id)));
  }, [filteredBills]);

  useEffect(() => {
    const existing = new Set(allBills.map((bill) => bill.id));
    setSelectedBillIds((current) => current.filter((id) => existing.has(id)));
  }, [allBills]);

  useEffect(() => {
    if (!openBillMenuId) return;
    const close = () => setOpenBillMenuId(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openBillMenuId]);

  useEffect(() => {
    if (!bulkOverrideOpen) return;
    const close = (event: PointerEvent) => {
      if (!bulkOverrideRef.current?.contains(event.target as Node)) setBulkOverrideOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [bulkOverrideOpen]);

  useEffect(() => {
    window.localStorage.setItem(BILL_ROW_MODE_KEY, rowMode);
  }, [rowMode]);

  useEffect(() => {
    window.localStorage.setItem(BILL_PREVIEW_SPLIT_KEY, String(Math.round(previewSplitPct)));
  }, [previewSplitPct]);

  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (event: MouseEvent) => {
      const container = document.getElementById("bills-preview-split");
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

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageBills = filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resultLabel = loading ? "Loading bills..." : `${filteredBills.length} bills found`;
  const selectedBillIdSet = useMemo(() => new Set(selectedBillIds), [selectedBillIds]);
  const filteredBillIds = useMemo(() => filteredBills.map((bill) => bill.id), [filteredBills]);
  const selectedCount = selectedBillIds.length;
  const allFilteredSelected = filteredBillIds.length > 0 && filteredBillIds.every((id) => selectedBillIdSet.has(id));

  const resetFilters = () => {
    setSearchQuery("");
    setFilters({ status: "all", committee: "all", sponsorId: "all", cosponsorId: "all" });
    setSortBy("number");
    setSortDirection("desc");
  };

  const handleBillClick = (bill: BillView) => {
    if (rowMode === "open") {
      navigate(`/bills/${bill.id}`);
      return;
    }
    setSelectedBill(bill);
  };

  const toggleBillSelection = (billId: string) => {
    setSelectedBillIds((current) => (current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedBillIds((current) => current.filter((id) => !filteredBillIds.includes(id)));
      return;
    }
    setSelectedBillIds((current) => Array.from(new Set([...current, ...filteredBillIds])));
  };

  const requestDeleteBill = (bill: BillView) => {
    setOpenBillMenuId(null);
    setConfirmDialog({
      title: "Delete bill?",
      message: `${bill.number}: ${bill.title} will be removed from the legislation list.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        setDeletingBillId(bill.id);
        try {
          await deleteBillForCurrentClass(bill.id);
          setAllBills((current) => current.filter((item) => item.id !== bill.id));
          setSelectedBill((current) => current?.id === bill.id ? allBills.find((item) => item.id !== bill.id) ?? null : current);
          toast.success("Bill deleted");
        } catch (error: any) {
          toast.error(error.message || "Could not delete bill");
        } finally {
          setDeletingBillId(null);
        }
      },
    });
  };

  const requestBulkDelete = () => {
    if (!selectedCount) return;
    const ids = [...selectedBillIds];
    const selectedBills = allBills.filter((bill) => ids.includes(bill.id));
    setConfirmDialog({
      title: `Delete ${ids.length} bill${ids.length === 1 ? "" : "s"}?`,
      message: (
        <div className="space-y-3">
          <p>This action will irreversibly apply to all these bills.</p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
            {selectedBills.map((bill) => (
              <div key={bill.id} className="border-b border-gray-100 px-3 py-2 last:border-b-0">
                <div className="font-mono text-xs font-semibold text-gray-900">{bill.number}</div>
                <div className="text-xs text-gray-600">{bill.title}</div>
              </div>
            ))}
          </div>
        </div>
      ),
      confirmLabel: "Delete selected",
      danger: true,
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          for (const id of ids) await deleteBillForCurrentClass(id);
          setAllBills((current) => current.filter((bill) => !ids.includes(bill.id)));
          setSelectedBillIds([]);
          setSelectedBill((current) => (current && ids.includes(current.id) ? null : current));
          toast.success(`Deleted ${ids.length} bill${ids.length === 1 ? "" : "s"}`);
        } catch (error: any) {
          toast.error(error.message || "Could not delete selected bills");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  const requestBulkStatusOverride = (status: string) => {
    if (!selectedCount || !status) return;
    const ids = [...selectedBillIds];
    const bulkStatusLabel = bulkStatusOptions.find((option) => option.value === status)?.label ?? statusLabel(status);
    const selectedBills = allBills.filter((bill) => ids.includes(bill.id));
    setBulkOverrideOpen(false);
    setConfirmDialog({
      title: `Set ${ids.length} bill${ids.length === 1 ? "" : "s"} to ${bulkStatusLabel}?`,
      message: (
        <div className="space-y-3">
          <p>This action will irreversibly apply to all these bills.</p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
            {selectedBills.map((bill) => (
              <div key={bill.id} className="border-b border-gray-100 px-3 py-2 last:border-b-0">
                <div className="font-mono text-xs font-semibold text-gray-900">{bill.number}</div>
                <div className="text-xs text-gray-600">{bill.title}</div>
              </div>
            ))}
          </div>
        </div>
      ),
      confirmLabel: "Override status",
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const updatedIds = await bulkUpdateBillStatusForCurrentClass(ids, status);
          const updatedSet = new Set(updatedIds);
          setAllBills((current) => current.map((bill) => (updatedSet.has(bill.id) ? { ...bill, status } : bill)));
          setSelectedBill((current) => (current && updatedSet.has(current.id) ? { ...current, status } : current));
          setSelectedBillIds([]);
          toast.success(`Updated ${updatedIds.length} bill${updatedIds.length === 1 ? "" : "s"}`);
        } catch (error: any) {
          toast.error(error.message || "Could not override selected bills");
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">All Bills</h1>
              <InfoTooltip label="What are bills?">
                <p>A bill is a proposed law. In the simulation, bills are written by members, referred to committees, revised or reported, calendared, and considered on the floor.</p>
                <p className="mt-2">All Bills shows bills from the user's cohort.</p>
              </InfoTooltip>
            </div>
            <p className="text-gray-600">{resultLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {isTeacher && (
              <Link to="/teacher/bill-sorting" className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                Sort into Committees
              </Link>
            )}
            <Link to="/bills/create" className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Bill
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search number, title, sponsor, cosponsor, committee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectItem value="all">All statuses</SelectItem>
                {statusFilterOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </FilterSelect>
              <FilterSelect value={filters.committee} onChange={(value) => setFilters({ ...filters, committee: value })} className="w-44">
                <SelectItem value="all">All committees</SelectItem>
                {committeeOptions.map((committee) => <SelectItem key={committee} value={committee}>{committee}</SelectItem>)}
              </FilterSelect>
              <FilterSelect value={filters.sponsorId} onChange={(value) => setFilters({ ...filters, sponsorId: value })} className="w-40">
                <SelectItem value="all">All sponsors</SelectItem>
                {sponsorOptions.map((sponsor) => <SelectItem key={sponsor.id} value={sponsor.id}>{sponsor.name}</SelectItem>)}
              </FilterSelect>
              <FilterSelect value={filters.cosponsorId} onChange={(value) => setFilters({ ...filters, cosponsorId: value })} className="w-40">
                <SelectItem value="all">All cosponsors</SelectItem>
                {cosponsorOptions.map((cosponsor) => <SelectItem key={cosponsor.id} value={cosponsor.id}>{cosponsor.name}</SelectItem>)}
              </FilterSelect>
              <FilterSelect value={sortBy} onChange={(value) => setSortBy(value as SortKey)} className="w-40">
                <SelectItem value="number">Sort: Bill number</SelectItem>
                <SelectItem value="date">Sort: Introduced</SelectItem>
                <SelectItem value="title">Sort: Title</SelectItem>
                <SelectItem value="sponsor">Sort: Sponsor</SelectItem>
                <SelectItem value="status">Sort: Status</SelectItem>
                <SelectItem value="cosponsors">Sort: Cosponsors</SelectItem>
              </FilterSelect>
              <button
                type="button"
                onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
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
            {isTeacher && filteredBills.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Select all
                </label>
                {selectedCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-blue-50 px-2 py-1">
                    <span className="text-xs font-medium text-blue-700">{selectedCount} selected</span>
                    <div className="relative" ref={bulkOverrideRef}>
                      <button
                        type="button"
                        onClick={() => setBulkOverrideOpen((open) => !open)}
                        disabled={bulkBusy}
                        className="rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Override
                      </button>
                      {bulkOverrideOpen && (
                        <div className="absolute left-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                          {bulkStatusOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => requestBulkStatusOverride(option.value)}
                              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={requestBulkDelete}
                      disabled={bulkBusy}
                      className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          id="bills-preview-split"
          className={`grid grid-cols-1 gap-6 overflow-hidden ${rowMode === "preview" ? "lg:grid-cols-[var(--bill-list-width)_0.375rem_minmax(0,1fr)] lg:gap-3" : "lg:grid-cols-[minmax(0,1fr)_0.375rem] lg:gap-3"}`}
          style={{ "--bill-list-width": `${previewSplitPct}%` } as CSSProperties}
        >
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading bills...</div>
              ) : filteredBills.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No bills found matching your criteria</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pageBills.map((bill) => {
                    const teacherAuthored = bill.sponsorRole === "teacher";
                    const bulkSelected = selectedBillIdSet.has(bill.id);
                    return (
                    <div
                      key={bill.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleBillClick(bill)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") handleBillClick(bill);
                      }}
                      className={`block w-full p-4 text-left transition-colors ${
                        bulkSelected ? "bg-blue-50 hover:bg-blue-50" : teacherAuthored ? "bg-green-50/40 hover:bg-green-50/70" : "hover:bg-gray-50"
                      } ${!bulkSelected && selectedBill?.id === bill.id && rowMode === "preview" ? (teacherAuthored ? "bg-green-50 hover:bg-green-50" : "bg-blue-50 hover:bg-blue-50") : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {isTeacher && (
                          <div className="pt-0.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedBillIdSet.has(bill.id)}
                              onChange={() => toggleBillSelection(bill.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`Select ${bill.number}`}
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">{bill.number}</span>
                            {bill.status !== "submitted" && <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass(bill.status)}`}>{statusLabel(bill.status)}</span>}
                            {bill.committee && <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{bill.committee}</span>}
                          </div>
                          <h2 className="mb-2 text-base font-semibold text-gray-900">{bill.title}</h2>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                            <span>Sponsor:</span>
                            <Link
                              to={profilePath(bill.sponsorId)}
                              onClick={(event) => event.stopPropagation()}
                              className={`font-medium hover:underline ${bill.sponsorRole === "teacher" ? "text-green-700" : "text-blue-600"}`}
                            >
                              {bill.sponsor}
                            </Link>
                            <span>({sponsorDescriptor(bill)})</span>
                            <span className="text-gray-300">|</span>
                            <span>Introduced {new Date(bill.introducedAt).toLocaleDateString()}</span>
                            <span className="text-gray-300">|</span>
                            <span>{bill.cosponsorCount} cosponsor{bill.cosponsorCount === 1 ? "" : "s"}</span>
                          </div>
                          <BillTracker bill={bill} />
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2 text-gray-400">
                          {rowMode === "preview" ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/bills/${bill.id}#bill-text`);
                              }}
                              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              aria-label={`Open full text for ${bill.number}`}
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          {isTeacher ? (
                            <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenBillMenuId((current) => current === bill.id ? null : bill.id);
                                }}
                                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                aria-label={`Actions for ${bill.number}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {openBillMenuId === bill.id && (
                                <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      requestDeleteBill(bill);
                                    }}
                                    disabled={deletingBillId === bill.id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
            {!loading && filteredBills.length > 0 && <CompactPager currentPage={currentPage} totalPages={totalPages} totalItems={filteredBills.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
          </div>

          <button
            type="button"
            onMouseDown={() => setDraggingSplit(true)}
            className="my-3 hidden min-h-[22rem] cursor-col-resize bg-gray-200 transition-colors hover:bg-gray-300 active:bg-blue-400 lg:block"
            aria-label={rowMode === "preview" ? "Resize bill preview" : "Drag left to show bill preview"}
          />

          {rowMode === "preview" && (
            <div className="min-w-0 lg:w-full">
              <div className="lg:sticky lg:top-4">
                {selectedBill ? (
                  <BillPreviewPanel bill={selectedBill} />
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <p className="text-gray-500">Select a bill to preview</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
