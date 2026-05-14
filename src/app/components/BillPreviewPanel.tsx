import { useEffect, useRef, useState } from "react";
import { ExternalLink, User, Building2, Calendar } from "lucide-react";
import { Link } from "react-router";
import { profilePath } from "../utils/profileRoute";
import { sanitizeHtml } from "../utils/sanitizeHtml";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsorId?: string;
  sponsor: string;
  sponsorRole?: string | null;
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(480);
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
  const textTooNarrow = panelWidth < 340;

  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    <div ref={panelRef} className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="bg-blue-600 p-4 text-white">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold">{bill.number}</span>
          <Link
            to={`/bills/${bill.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Full Bill
          </Link>
        </div>
        <h3 className="font-semibold">{bill.title}</h3>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {bill.status !== "submitted" && (
              <span className={`rounded px-2 py-1 font-medium ${getStatusColor(bill.status)}`}>
                {statusLabel(bill.status)}
              </span>
            )}
            {bill.hasHold && (
              <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-700">
                Hold
              </span>
            )}
          </div>

          <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span className="font-medium">Sponsor:</span>
            {bill.sponsorId ? (
              <Link to={profilePath(bill.sponsorId)} className={`${bill.sponsorRole === "teacher" ? "text-green-700" : "text-blue-600"} hover:underline`}>
                {bill.sponsor}
              </Link>
            ) : (
              <span>{bill.sponsor}</span>
            )}
            <span>({sponsorDescriptor})</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-gray-600">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">Committee:</span>
            <span>{bill.committee || "Not referred"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Introduced:</span>
            <span>{new Date(bill.introducedAt ?? bill.lastUpdated).toLocaleDateString()}</span>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">Cosponsors:</span> {bill.cosponsorCount ?? 0}
          </div>
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
          {textTooNarrow ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
              The preview window is too small to display the bill text.
            </div>
          ) : (
            <div
              className="max-h-[520px] overflow-hidden text-sm leading-6 text-gray-700"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(bill.legislativeText) }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
