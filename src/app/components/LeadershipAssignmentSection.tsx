import { Settings, Crown, Award } from "lucide-react";

interface Member {
  id: string;
  name: string;
  party: string;
}

interface LeadershipAssignmentSectionProps {
  members: Member[];
  chairId: string | null;
  rankingMemberId: string | null;
  onSetChair: (memberId: string | null) => void;
  onSetRankingMember: (memberId: string | null) => void;
}

export function LeadershipAssignmentSection({
  members,
  chairId,
  rankingMemberId,
  onSetChair,
  onSetRankingMember,
}: LeadershipAssignmentSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Assign Leadership Roles</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assign Chair */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-yellow-600" />
            <h3 className="font-semibold text-gray-900">Assign Chair</h3>
          </div>
          
          <select
            value={chairId || ''}
            onChange={(e) => onSetChair(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select a member...</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.party})
              </option>
            ))}
          </select>

          {chairId && (
            <button
              onClick={() => onSetChair(null)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Remove assignment
            </button>
          )}
        </div>

        {/* Assign Ranking Member */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Assign Ranking Member</h3>
          </div>
          
          <select
            value={rankingMemberId || ''}
            onChange={(e) => onSetRankingMember(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select a member...</option>
            {members
              .filter(m => m.id !== chairId) // Can't be both chair and ranking member
              .map(member => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.party})
                </option>
              ))}
          </select>

          {rankingMemberId && (
            <button
              onClick={() => onSetRankingMember(null)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Remove assignment
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
        <strong>Teacher Mode:</strong> You can directly assign leadership roles to committee members.
      </div>
    </div>
  );
}
