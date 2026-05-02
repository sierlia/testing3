import { ExternalLink, User, Building2, Calendar } from "lucide-react";
import { Link } from "react-router";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsorId?: string;
  sponsor: string;
  sponsorParty: string;
  sponsorDistrict?: string;
  committee: string;
  status: string;
  lastUpdated: string;
  introducedAt?: string;
  tags: string[];
  legislativeText: string;
  supportingText: string;
  hasHold: boolean;
  cosponsorCount?: number;
}

interface BillPreviewPanelProps {
  bill: Bill;
}

export function BillPreviewPanel({ bill }: BillPreviewPanelProps) {
  const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const partyAbbr = (party: string) => {
    const normalized = party.toLowerCase();
    if (normalized.includes("democrat")) return "D";
    if (normalized.includes("republican")) return "R";
    if (normalized.includes("independent")) return "I";
    if (normalized.includes("green")) return "G";
    if (normalized.includes("libertarian")) return "L";
    return party.trim().slice(0, 1).toUpperCase() || "I";
  };
  const sponsorDescriptor = `Rep.-${partyAbbr(bill.sponsorParty)}-${bill.sponsorDistrict || "N/A"}`;
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
      submitted: "bg-blue-100 text-blue-700",
      in_committee: "bg-slate-100 text-slate-700",
      reported: "bg-purple-100 text-purple-700",
      calendared: "bg-yellow-100 text-yellow-700",
      floor: "bg-indigo-100 text-indigo-700",
      passed: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-sm font-semibold">{bill.number}</span>
          <Link to={`/bills/${bill.id}`}>
            <button className="p-1 hover:bg-white/20 rounded transition-colors">
              <ExternalLink className="w-4 h-4" />
            </button>
          </Link>
        </div>
        <h3 className="font-semibold">{bill.title}</h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status and Hold */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(bill.status)}`}>
            {statusLabel(bill.status)}
          </span>
          {bill.hasHold && (
            <span className="text-xs px-2 py-1 rounded font-medium bg-amber-100 text-amber-700">
              Hold
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span className="font-medium">Sponsor:</span>
            {bill.sponsorId ? (
              <Link to={`/profile/${bill.sponsorId}`} className="text-blue-600 hover:underline">
                {bill.sponsor}
              </Link>
            ) : (
              <span>{bill.sponsor}</span>
            )}
            <span>({sponsorDescriptor})</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">Committee:</span>
            <span>{bill.committee || "Not referred"}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Introduced:</span>
            <span>{new Date(bill.introducedAt ?? bill.lastUpdated).toLocaleDateString()}</span>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">Cosponsors:</span> {bill.cosponsorCount ?? 0}
          </div>
        </div>

        {/* Tags */}
        {bill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bill.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Legislative Text Preview */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Legislative Text</h4>
          <div 
            className="text-sm text-gray-600 line-clamp-4"
            dangerouslySetInnerHTML={{ __html: bill.legislativeText }}
          />
        </div>

        {/* View Full Bill button */}
        <Link to={`/bills/${bill.id}`}>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm">
            <ExternalLink className="w-4 h-4" />
            View Full Bill
          </button>
        </Link>
      </div>
    </div>
  );
}
