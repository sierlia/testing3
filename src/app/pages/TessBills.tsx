import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { BillFilters } from "../components/BillFilters";
import { BillPreviewPanel } from "../components/BillPreviewPanel";
import { Search, ExternalLink, Plus } from "lucide-react";
import { Link } from "react-router";
import { fetchBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";
import { useAuth } from "../utils/AuthContext";

interface BillView {
  id: string; number: string; title: string; sponsor: string; sponsorParty: string; committee: string;
  status: string; lastUpdated: string; tags: string[]; legislativeText: string; supportingText: string; hasHold: boolean;
}

const toBillView = (bill: BillRecord): BillView => ({
  id: bill.id,
  number: bill.hr_label,
  title: bill.title,
  sponsor: bill.profiles?.display_name ?? 'Unknown',
  sponsorParty: bill.profiles?.party ?? 'Independent',
  committee: '',
  status: bill.status,
  lastUpdated: bill.created_at,
  tags: [],
  legislativeText: bill.legislative_text,
  supportingText: bill.supporting_text ?? '',
  hasHold: false,
});

export function TessBills() {
  const { user } = useAuth();
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<BillView | null>(null);
  const [allBills, setAllBills] = useState<BillView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", committee: "all", party: "all", tags: [] as string[] });

  useEffect(() => {
    const loadBills = async () => {
      try { setAllBills((await fetchBillsForCurrentClass()).map(toBillView)); }
      finally { setLoading(false); }
    };
    loadBills();
  }, []);

  const filteredBills = useMemo(() => allBills.filter((bill) => {
    const matchesSearch = bill.number.toLowerCase().includes(searchQuery.toLowerCase()) || bill.title.toLowerCase().includes(searchQuery.toLowerCase()) || bill.sponsor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filters.status === "all" || bill.status === filters.status;
    const matchesParty = filters.party === "all" || bill.sponsorParty === filters.party;
    return matchesSearch && matchesStatus && matchesParty;
  }), [allBills, searchQuery, filters]);

  return <div className="min-h-screen bg-gray-50"><Navigation />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8"><div><h1 className="text-3xl font-bold text-gray-900 mb-2">Class Bills</h1><p className="text-gray-600">{filteredBills.length} bills found</p></div>
        <div className="flex items-center gap-3">
          {isTeacher && (
            <Link to="/teacher/bill-sorting">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm">
                Sort into Committees
              </button>
            </Link>
          )}
          <Link to="/bills/create"><button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"><Plus className="w-4 h-4" />Create Bill</button></Link>
        </div></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search by bill number, title, or sponsor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" /></div></div>
        <BillFilters filters={filters} onFilterChange={setFilters} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">{loading ? <div className="text-center py-12 text-gray-500">Loading bills...</div> : filteredBills.length === 0 ? <div className="text-center py-12 text-gray-500">No bills found matching your criteria</div> : <div className="divide-y divide-gray-200">{filteredBills.map((bill) => <div key={bill.id} onClick={() => setSelectedBill(bill)} className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedBill?.id === bill.id ? 'bg-blue-50' : ''}`}><div className="flex items-start justify-between gap-4"><div className="flex-1 min-w-0"><div className="flex items-center gap-3 mb-2"><span className="font-mono text-sm font-semibold text-gray-900">{bill.number}</span></div><h3 className="font-semibold text-gray-900 mb-1">{bill.title}</h3><div className="text-sm text-gray-600">Sponsor: {bill.sponsor} ({bill.sponsorParty})</div></div><Link to={`/bills/${bill.id}`}><button className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600"><ExternalLink className="w-4 h-4" /></button></Link></div></div>)}</div>}</div>
      </div><div className="lg:col-span-1"><div className="sticky top-8">{selectedBill ? <BillPreviewPanel bill={selectedBill} /> : <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center"><p className="text-gray-500">Select a bill to preview</p></div>}</div></div></div>
    </main>
  </div>;
}
