import { Users, Crown, Award } from "lucide-react";

interface Member {
  id: string;
  name: string;
  party: string;
  isRunningForChair?: boolean;
  isRunningForRanking?: boolean;
}

interface MemberRosterProps {
  members: Member[];
  chairId: string | null;
  rankingMemberId: string | null;
}

export function MemberRoster({ members, chairId, rankingMemberId }: MemberRosterProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Committee Members</h2>
        <span className="text-sm text-gray-500">({members.length})</span>
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const isChair = member.id === chairId;
          const isRanking = member.id === rankingMemberId;
          
          return (
            <div
              key={member.id}
              className={`
                flex items-center justify-between p-3 rounded-md border
                ${isChair ? 'bg-yellow-50 border-yellow-200' : ''}
                ${isRanking && !isChair ? 'bg-blue-50 border-blue-200' : ''}
                ${!isChair && !isRanking ? 'bg-gray-50 border-gray-200' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {isChair && <Crown className="w-4 h-4 text-yellow-600" />}
                  {isRanking && !isChair && <Award className="w-4 h-4 text-blue-600" />}
                  <span className="font-medium text-gray-900">{member.name}</span>
                </div>
                <span className="text-sm text-gray-500">• {member.party}</span>
              </div>

              <div className="flex items-center gap-2">
                {member.isRunningForChair && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    Running for Chair
                  </span>
                )}
                {member.isRunningForRanking && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                    Running for Ranking
                  </span>
                )}
                {isChair && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">
                    Chair
                  </span>
                )}
                {isRanking && !isChair && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                    Ranking Member
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
