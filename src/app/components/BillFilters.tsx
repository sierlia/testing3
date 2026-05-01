import { Filter } from "lucide-react";

interface BillFiltersProps {
  filters: {
    status: string;
    committee: string;
    party: string;
    tags: string[];
  };
  onFilterChange: (filters: any) => void;
}

export function BillFilters({ filters, onFilterChange }: BillFiltersProps) {
  const statuses = [
    "All Statuses",
    "Draft",
    "In Committee",
    "Reported",
    "Calendared",
    "Voted - Passed",
    "Voted - Failed",
    "Sent to Senate",
    "Signed",
  ];

  const committees = [
    "All Committees",
    "Education Committee",
    "Environment & Energy Committee",
    "Healthcare Committee",
    "Judiciary Committee",
    "Agriculture Committee",
  ];

  const parties = [
    "All Parties",
    "Democratic",
    "Republican",
    "Green",
    "Libertarian",
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Filters</h3>
      </div>

      <div className="space-y-4">
        {/* Status filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          >
            {statuses.map(status => (
              <option key={status} value={status === "All Statuses" ? "all" : status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* Committee filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Committee</label>
          <select
            value={filters.committee}
            onChange={(e) => onFilterChange({ ...filters, committee: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          >
            {committees.map(committee => (
              <option key={committee} value={committee === "All Committees" ? "all" : committee}>
                {committee}
              </option>
            ))}
          </select>
        </div>

        {/* Party filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sponsor Party</label>
          <select
            value={filters.party}
            onChange={(e) => onFilterChange({ ...filters, party: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          >
            {parties.map(party => (
              <option key={party} value={party === "All Parties" ? "all" : party}>
                {party}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
