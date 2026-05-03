import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { BillFilters } from "../components/BillFilters";
import { BillPreviewPanel } from "../components/BillPreviewPanel";
import { Search, ExternalLink, Plus } from "lucide-react";
import { Link } from "react-router";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  sponsorParty: string;
  committee: string;
  status: string;
  lastUpdated: string;
  tags: string[];
  legislativeText: string;
  supportingText: string;
  hasHold: boolean;
}

export function AllBills() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    committee: "all",
    party: "all",
    tags: [] as string[],
  });

  // Mock bills data
  const allBills: Bill[] = [
    {
      id: "1",
      number: "H.R. 101",
      title: "Education Funding Enhancement Act",
      sponsor: "Alice Johnson",
      sponsorParty: "Democratic Party",
      committee: "Education Committee",
      status: "In Committee",
      lastUpdated: "2026-02-08",
      tags: ["education", "budget"],
      legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Education Funding Enhancement Act'.</p>",
      supportingText: "<p>This bill addresses the critical need for increased education funding...</p>",
      hasHold: false,
    },
    {
      id: "2",
      number: "H.R. 102",
      title: "Clean Energy Investment Act",
      sponsor: "Bob Smith",
      sponsorParty: "Republican Party",
      committee: "Environment & Energy Committee",
      status: "Reported",
      lastUpdated: "2026-02-09",
      tags: ["environment", "energy"],
      legislativeText: "<h2>Section 1. Findings</h2><p>Congress finds that renewable energy investment is crucial...</p>",
      supportingText: "<p>This legislation promotes clean energy development through tax incentives...</p>",
      hasHold: false,
    },
    {
      id: "3",
      number: "H.R. 103",
      title: "Healthcare Access Improvement Act",
      sponsor: "Carol Martinez",
      sponsorParty: "Democratic Party",
      committee: "Healthcare Committee",
      status: "Draft",
      lastUpdated: "2026-02-07",
      tags: ["healthcare"],
      legislativeText: "<h2>Section 1. Purpose</h2><p>To expand healthcare access to underserved communities...</p>",
      supportingText: "<p>Millions of Americans lack adequate healthcare access...</p>",
      hasHold: true,
    },
    {
      id: "4",
      number: "H.R. 104",
      title: "Criminal Justice Reform Act",
      sponsor: "David Lee",
      sponsorParty: "Republican Party",
      committee: "Judiciary Committee",
      status: "Calendared",
      lastUpdated: "2026-02-06",
      tags: ["justice", "reform"],
      legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Criminal Justice Reform Act'.</p>",
      supportingText: "<p>Our criminal justice system requires comprehensive reform...</p>",
      hasHold: false,
    },
    {
      id: "5",
      number: "H.R. 105",
      title: "Agricultural Sustainability Act",
      sponsor: "Emma Davis",
      sponsorParty: "Green",
      committee: "Agriculture Committee",
      status: "Voted - Passed",
      lastUpdated: "2026-02-05",
      tags: ["agriculture", "environment"],
      legislativeText: "<h2>Section 1. Findings</h2><p>Sustainable farming practices are essential for long-term food security...</p>",
      supportingText: "<p>This bill incentivizes sustainable agricultural practices...</p>",
      hasHold: false,
    },
  ];

  // Apply filters
  const filteredBills = allBills.filter(bill => {
    const matchesSearch = bill.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bill.sponsor.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filters.status === "all" || bill.status === filters.status;
    const matchesCommittee = filters.committee === "all" || bill.committee === filters.committee;
    const matchesParty = filters.party === "all" || bill.sponsorParty === filters.party;
    const matchesTags = filters.tags.length === 0 || filters.tags.some(tag => bill.tags.includes(tag));

    return matchesSearch && matchesStatus && matchesCommittee && matchesParty && matchesTags;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Draft": "bg-gray-100 text-gray-700",
      "In Committee": "bg-blue-100 text-blue-700",
      "Reported": "bg-purple-100 text-purple-700",
      "Calendared": "bg-yellow-100 text-yellow-700",
      "Voted - Passed": "bg-green-100 text-green-700",
      "Voted - Failed": "bg-red-100 text-red-700",
      "Sent to Senate": "bg-indigo-100 text-indigo-700",
      "Signed": "bg-emerald-100 text-emerald-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">All Bills</h1>
            <p className="text-gray-600">
              {filteredBills.length} bills found
            </p>
          </div>
          <Link to="/bills/create">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
              <Plus className="w-4 h-4" />
              Create Bill
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left section - Filters and list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by bill number, title, or sponsor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Filters */}
            <BillFilters filters={filters} onFilterChange={setFilters} />

            {/* Bills list */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {filteredBills.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No bills found matching your criteria
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredBills.map(bill => (
                    <div
                      key={bill.id}
                      onClick={() => setSelectedBill(bill)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedBill?.id === bill.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {bill.number}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(bill.status)}`}>
                              {bill.status}
                            </span>
                            {bill.hasHold && (
                              <span className="text-xs px-2 py-1 rounded font-medium bg-amber-100 text-amber-700">
                                Hold
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{bill.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Sponsor: {bill.sponsor} ({bill.sponsorParty})</span>
                            <span>•</span>
                            <span>{bill.committee}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Last updated: {new Date(bill.lastUpdated).toLocaleDateString()}
                          </div>
                        </div>
                        <Link to={`/bills/${bill.id}`}>
                          <button className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right section - Preview panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {selectedBill ? (
                <BillPreviewPanel bill={selectedBill} />
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">Select a bill to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
