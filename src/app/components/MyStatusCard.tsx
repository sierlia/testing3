import { Flag, MapPin, Users, Star } from "lucide-react";

interface StatusInfo {
  party: string;
  constituency: string;
  committees: string[];
  leadershipRoles: string[];
}

interface MyStatusCardProps {
  status: StatusInfo;
}

export function MyStatusCard({ status }: MyStatusCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Status</h2>
      
      <div className="space-y-4">
        {/* Party */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Flag className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Party</div>
            <div className="font-medium text-gray-900">{status.party}</div>
          </div>
        </div>
        
        {/* Constituency */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <MapPin className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Constituency</div>
            <div className="font-medium text-gray-900">{status.constituency}</div>
          </div>
        </div>
        
        {/* Committees */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-500">Committee Assignments</div>
            <div className="space-y-1 mt-1">
              {status.committees.length === 0 ? (
                <div className="text-gray-400 text-sm">No assignments</div>
              ) : (
                status.committees.map((committee, index) => (
                  <div key={index} className="font-medium text-gray-900">
                    {committee}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Leadership Roles */}
        {status.leadershipRoles.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Star className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-500">Leadership Roles</div>
              <div className="space-y-1 mt-1">
                {status.leadershipRoles.map((role, index) => (
                  <div key={index} className="font-medium text-gray-900">
                    {role}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
