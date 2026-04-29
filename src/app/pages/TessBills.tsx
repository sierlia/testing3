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

export function TessBills() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    committee: "all",
    party: "all",
    tags: [] as string[],
  });

  // Tess's bills data
  const allBills: Bill[] = [
    {
      id: "1",
      number: "H.R. 1",
      title: "Laboratory Accountability, Biosafety, and Security Access and Facility Enforcement (LABSAFE) Act",
      sponsor: "Tess Lin",
      sponsorParty: "Democratic",
      committee: "",
      status: "Clerk's Desk",
      lastUpdated: "[placeholder]",
      tags: ["public health", "biosafety", "oversight"],
      legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Laboratory Accountability, Biosafety, and Security Access and Facility Enforcement Act' or the 'LABSAFE Act'.</p><h2>Section 2. Findings</h2><p>Congress finds that:</p><ol><li>The illegal biolab discovered in Reedley, California, and other suspected biolab investigations demonstrate gaps in federal oversight of select agents and toxins.</li><li>Dangerous biological materials require strict regulation to protect public health and safety.</li><li>Enhanced coordination among local, state, and federal agencies is necessary to prevent unauthorized storage and handling of biological hazards.</li></ol>",
      supportingText: "<p>This legislation addresses critical gaps in federal oversight of biological laboratories and hazardous materials storage. In light of recent discoveries of illegal biolabs in California and Nevada, the LABSAFE Act will strengthen coordination among agencies and ensure dangerous materials cannot be stored or handled without proper oversight and safety protocols.</p>",
      hasHold: false,
    },
    {
      id: "2",
      number: "H.R. 2",
      title: "Critical Water Infrastructure Protection and Drought Resilience Act",
      sponsor: "Tess Lin",
      sponsorParty: "Democratic",
      committee: "",
      status: "Clerk's Desk",
      lastUpdated: "[placeholder]",
      tags: ["water", "infrastructure", "agriculture"],
      legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Critical Water Infrastructure Protection and Drought Resilience Act'.</p><h2>Section 2. Purpose</h2><p>To modernize federal water and infrastructure investments, streamline repair and maintenance processes, and address critical issues including failing wells and land subsidence in agricultural regions.</p><h2>Section 3. Federal Water Infrastructure Modernization</h2><p>The Act authorizes increased funding for water infrastructure projects and establishes expedited review processes for critical repair work.</p>",
      supportingText: "<p>California's 22nd District faces critical water infrastructure challenges including failing wells and land subsidence. This bill modernizes federal water investments, cuts bureaucratic red tape that delays essential repairs, and provides resources to help communities maintain reliable water access while supporting agricultural operations that feed the nation.</p>",
      hasHold: false,
    },
    {
      id: "3",
      number: "H.R. 3",
      title: "Basin Reporting, Impact mitigation, and Dispute resolution through Governance support and Equipment (BRIDGE) Pilot Act",
      sponsor: "Tess Lin",
      sponsorParty: "Democratic",
      committee: "",
      status: "Clerk's Desk",
      lastUpdated: "[placeholder]",
      tags: ["water", "agriculture", "groundwater"],
      legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Basin Reporting, Impact mitigation, and Dispute resolution through Governance support and Equipment Pilot Act' or the 'BRIDGE Pilot Act'.</p><h2>Section 2. Pilot Program Establishment</h2><p>The Secretary shall establish a pilot program to provide funding and technical assistance to local groundwater sustainability agencies in regions subject to state groundwater management requirements.</p><h2>Section 3. Eligible Activities</h2><p>Funds may be used for monitoring equipment, data collection systems, stakeholder engagement processes, and compliance infrastructure to meet evolving groundwater regulations without imposing undue burdens on family farms and small communities.</p>",
      supportingText: "<p>This pilot program provides critical support to help local groundwater users comply with California's Sustainable Groundwater Management Act (SGMA) requirements without crushing family farms and small communities. The BRIDGE Pilot Act delivers funding and technical support for monitoring, reporting, and sustainable management practices that protect water resources while preserving agricultural livelihoods.</p>",
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
      "Clerk's Desk": "bg-slate-100 text-slate-700",
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tess Lin's Bills</h1>
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
                            {bill.committee && (
                              <>
                                <span>•</span>
                                <span>{bill.committee}</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Last updated: {bill.lastUpdated}
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
