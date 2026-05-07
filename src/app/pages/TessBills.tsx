import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Check, Circle, Clock, ExternalLink, Eye, FileText, Plus, Search } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BillPreviewPanel } from "../components/BillPreviewPanel";
import { InfoTooltip } from "../components/InfoTooltip";
import { CompactPager } from "../components/CompactPager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { fetchBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";
import { useAuth } from "../utils/AuthContext";
import { formatConstituency } from "../utils/constituency";
import { displayPersonName } from "../utils/displayName";

type RowMode = "preview" | "open";
type SortKey = "number" | "newest" | "oldest" | "title" | "sponsor" | "status" | "cosponsors";

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
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(status: string) {
  if (status === "submitted") return "bg-blue-100 text-blue-700";
  if (status === "in_committee") return "bg-slate-100 text-slate-700";
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
  const referred = Boolean(bill.committee) || ["in_committee", "reported", "calendared", "floor", "passed", "failed"].includes(status);
  const reported = ["reported", "calendared", "floor", "passed", "failed"].includes(status);
  const calendared = ["calendared", "floor", "passed", "failed"].includes(status);
  const floor = ["floor", "passed", "failed"].includes(status);
  const final = ["passed", "failed"].includes(status);
  return [
    { label: "Introduced", done: true, current: status === "submitted" },
    { label: bill.committee ? "Referred" : "Committee", done: referred, current: status === "in_committee" },
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
  legislativeText: bill.legislative_text,
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

export function TessBills() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<BillView | null>(null);
  const [allBills, setAllBills] = useState<BillView[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowMode, setRowMode] = useState<RowMode>("preview");
  const [filters, setFilters] = useState({
    status: "all",
    committee: "all",
    sponsorId: "all",
    cosponsorId: "all",
  });
  const [sortBy, setSortBy] = useState<SortKey>("number");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const statusOptions = useMemo(() => Array.from(new Set(allBills.map((bill) => bill.status))).sort(), [allBills]);
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
      if (sortBy === "newest") return new Date(b.introducedAt).getTime() - new Date(a.introducedAt).getTime();
      if (sortBy === "oldest") return new Date(a.introducedAt).getTime() - new Date(b.introducedAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "sponsor") return a.sponsor.localeCompare(b.sponsor);
      if (sortBy === "status") return statusLabel(a.status).localeCompare(statusLabel(b.status));
      if (sortBy === "cosponsors") return b.cosponsorCount - a.cosponsorCount;
      return a.billNumber - b.billNumber;
    });
  }, [allBills, filters, searchQuery, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageBills = filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearchQuery("");
    setFilters({ status: "all", committee: "all", sponsorId: "all", cosponsorId: "all" });
    setSortBy("number");
  };

  const handleBillClick = (bill: BillView) => {
    if (rowMode === "open") {
      navigate(`/bills/${bill.id}`);
      return;
    }
    setSelectedBill(bill);
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
            <p className="text-gray-600">{filteredBills.length} bills found</p>
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
                {statusOptions.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
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
                <SelectItem value="newest">Sort: Newest</SelectItem>
                <SelectItem value="oldest">Sort: Oldest</SelectItem>
                <SelectItem value="title">Sort: Title</SelectItem>
                <SelectItem value="sponsor">Sort: Sponsor</SelectItem>
                <SelectItem value="status">Sort: Status</SelectItem>
                <SelectItem value="cosponsors">Sort: Cosponsors</SelectItem>
              </FilterSelect>
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

        <div className={`grid grid-cols-1 gap-6 ${rowMode === "preview" ? "lg:grid-cols-3" : ""}`}>
          <div className={rowMode === "preview" ? "lg:col-span-2" : ""}>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading bills...</div>
              ) : filteredBills.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No bills found matching your criteria</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pageBills.map((bill) => {
                    const teacherAuthored = bill.sponsorRole === "teacher";
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
                        teacherAuthored ? "bg-green-50/40 hover:bg-green-50/70" : "hover:bg-gray-50"
                      } ${selectedBill?.id === bill.id && rowMode === "preview" ? (teacherAuthored ? "bg-green-50 hover:bg-green-50" : "bg-blue-50 hover:bg-blue-50") : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
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
                              to={`/profile/${bill.sponsorId}`}
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
                          {rowMode === "preview" ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
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

          {rowMode === "preview" && (
            <div className="lg:col-span-1">
              <div className="sticky top-8">
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
    </div>
  );
}
