import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Circle, Clock, ExternalLink, Eye, FileText, Plus, Search } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BillPreviewPanel } from "../components/BillPreviewPanel";
import { fetchBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";
import { useAuth } from "../utils/AuthContext";
import { formatConstituency } from "../utils/constituency";

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
  sponsor: bill.profiles?.display_name ?? "Unknown",
  sponsorParty: bill.profiles?.party ?? "Independent",
  sponsorDistrict: formatConstituency(bill.profiles?.constituency_name),
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
    name: c.display_name ?? "Unknown",
    party: c.party ?? "Independent",
    district: formatConstituency(c.constituency_name),
  })),
});

export function TessBills() {
  const navigate = useNavigate();
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">All Bills</h1>
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
            <div className="flex flex-wrap items-center gap-2">
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
                <option value="all">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <select value={filters.committee} onChange={(e) => setFilters({ ...filters, committee: e.target.value })} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
                <option value="all">All committees</option>
                {committeeOptions.map((committee) => <option key={committee} value={committee}>{committee}</option>)}
              </select>
              <select value={filters.sponsorId} onChange={(e) => setFilters({ ...filters, sponsorId: e.target.value })} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
                <option value="all">All sponsors</option>
                {sponsorOptions.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}
              </select>
              <select value={filters.cosponsorId} onChange={(e) => setFilters({ ...filters, cosponsorId: e.target.value })} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
                <option value="all">All cosponsors</option>
                {cosponsorOptions.map((cosponsor) => <option key={cosponsor.id} value={cosponsor.id}>{cosponsor.name}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs">
                <option value="number">Sort: Bill number</option>
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="title">Sort: Title</option>
                <option value="sponsor">Sort: Sponsor</option>
                <option value="status">Sort: Status</option>
                <option value="cosponsors">Sort: Cosponsors</option>
              </select>
              <button onClick={resetFilters} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700">Reset</button>
            </div>
            <div className="flex justify-end">
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
                  {filteredBills.map((bill) => (
                    <div
                      key={bill.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleBillClick(bill)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") handleBillClick(bill);
                      }}
                      className={`block w-full p-4 text-left transition-colors hover:bg-gray-50 ${selectedBill?.id === bill.id && rowMode === "preview" ? "bg-blue-50" : ""}`}
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
                              className="font-medium text-blue-600 hover:underline"
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
                  ))}
                </div>
              )}
            </div>
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
