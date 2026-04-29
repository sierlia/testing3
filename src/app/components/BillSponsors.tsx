import { useState } from "react";
import { Users, UserPlus, Star } from "lucide-react";
import { Link } from "react-router";

interface Sponsor {
  id: string;
  name: string;
  party: string;
  constituency?: string;
}

interface BillSponsorsProps {
  sponsor: Sponsor;
  cosponsors: Sponsor[];
  isUserCosponsor: boolean;
  currentUserId: string;
  onToggleCosponsor?: (next: boolean) => void;
}

export function BillSponsors({ sponsor, cosponsors, isUserCosponsor, currentUserId, onToggleCosponsor }: BillSponsorsProps) {
  const [hasCosponsored, setHasCosponsored] = useState(isUserCosponsor);

  const handleCosponsor = () => {
    setHasCosponsored(true);
    onToggleCosponsor?.(true);
  };

  const handleUncosponsor = () => {
    setHasCosponsored(false);
    onToggleCosponsor?.(false);
  };

  const isUserSponsor = sponsor.id === currentUserId;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Sponsor & Cosponsors</h2>
        </div>
        {!isUserSponsor && !hasCosponsored && (
          <button
            onClick={handleCosponsor}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Cosponsor This Bill
          </button>
        )}
        {hasCosponsored && !isUserSponsor && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-md border border-green-200 text-sm font-medium">
              <UserPlus className="w-4 h-4" />
              You are a cosponsor
            </div>
            <button
              onClick={handleUncosponsor}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Undo
            </button>
          </div>
        )}
      </div>

      {/* Primary Sponsor */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Primary Sponsor</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              <Link to={`/profile/${sponsor.id}`} className="text-blue-600 hover:underline">
                {sponsor.name}
              </Link>
            </h3>
            <p className="text-sm text-gray-600">
              {sponsor.party}
              {sponsor.constituency && ` • ${sponsor.constituency}`}
            </p>
          </div>
        </div>
      </div>

      {/* Cosponsors */}
      {cosponsors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Cosponsors ({cosponsors.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cosponsors.map(cosponsor => (
              <div key={cosponsor.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <h4 className="font-medium text-gray-900">
                  <Link to={`/profile/${cosponsor.id}`} className="text-blue-600 hover:underline">
                    {cosponsor.name}
                  </Link>
                </h4>
                <p className="text-sm text-gray-600">{cosponsor.party}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {cosponsors.length === 0 && (
        <p className="text-sm text-gray-500 italic">No cosponsors yet</p>
      )}
    </div>
  );
}
