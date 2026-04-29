import { useState } from "react";
import { Vote, UserCheck, Settings } from "lucide-react";
import { VotingModal } from "./VotingModal";

interface Member {
  id: string;
  name: string;
  party: string;
  isRunningForChair?: boolean;
  isRunningForRanking?: boolean;
}

interface LeadershipElectionSectionProps {
  members: Member[];
  chairId: string | null;
  rankingMemberId: string | null;
  currentUserIsMember: boolean;
  isTeacher: boolean;
  onSetChair: (memberId: string | null) => void;
  onSetRankingMember: (memberId: string | null) => void;
  onUpdateMembers: (members: Member[]) => void;
}

export function LeadershipElectionSection({
  members,
  chairId,
  rankingMemberId,
  currentUserIsMember,
  isTeacher,
  onSetChair,
  onSetRankingMember,
  onUpdateMembers,
}: LeadershipElectionSectionProps) {
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [votingFor, setVotingFor] = useState<'chair' | 'ranking' | null>(null);
  const [hasVotedForChair, setHasVotedForChair] = useState(false);
  const [hasVotedForRanking, setHasVotedForRanking] = useState(false);

  // Mock current user
  const currentUserId = "m4";

  const chairCandidates = members.filter(m => m.isRunningForChair);
  const rankingCandidates = members.filter(m => m.isRunningForRanking);

  const handleRunForPosition = (position: 'chair' | 'ranking') => {
    const updatedMembers = members.map(m => {
      if (m.id === currentUserId) {
        if (position === 'chair') {
          return { ...m, isRunningForChair: !m.isRunningForChair };
        } else {
          return { ...m, isRunningForRanking: !m.isRunningForRanking };
        }
      }
      return m;
    });
    onUpdateMembers(updatedMembers);
  };

  const handleVote = (position: 'chair' | 'ranking') => {
    setVotingFor(position);
    setShowVotingModal(true);
  };

  const handleVoteSubmit = (candidateId: string) => {
    if (votingFor === 'chair') {
      setHasVotedForChair(true);
    } else if (votingFor === 'ranking') {
      setHasVotedForRanking(true);
    }
    setShowVotingModal(false);
    setVotingFor(null);
  };

  const handleTeacherOverride = (position: 'chair' | 'ranking', memberId: string) => {
    if (position === 'chair') {
      onSetChair(memberId);
    } else {
      onSetRankingMember(memberId);
    }
  };

  const currentUserIsRunningForChair = members.find(m => m.id === currentUserId)?.isRunningForChair;
  const currentUserIsRunningForRanking = members.find(m => m.id === currentUserId)?.isRunningForRanking;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Leadership Elections</h2>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
              <Settings className="w-4 h-4" />
              <span>Teacher Controls Active</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chair election */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Chair Election</h3>
            
            {chairCandidates.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No candidates yet
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {chairCandidates.map(candidate => (
                  <div key={candidate.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({candidate.party})</span>
                    </div>
                    {isTeacher && (
                      <button
                        onClick={() => handleTeacherOverride('chair', candidate.id)}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        Set as Chair
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentUserIsMember && !isTeacher && (
              <div className="space-y-2">
                <button
                  onClick={() => handleRunForPosition('chair')}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium
                    ${currentUserIsRunningForChair 
                      ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  <UserCheck className="w-4 h-4" />
                  {currentUserIsRunningForChair ? 'Withdraw from Chair Race' : 'Run for Chair'}
                </button>

                {chairCandidates.length > 0 && (
                  <button
                    onClick={() => handleVote('chair')}
                    disabled={hasVotedForChair}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Vote className="w-4 h-4" />
                    {hasVotedForChair ? 'Vote Submitted' : 'Cast Vote'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ranking Member election */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Ranking Member Election</h3>
            
            {rankingCandidates.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No candidates yet
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {rankingCandidates.map(candidate => (
                  <div key={candidate.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({candidate.party})</span>
                    </div>
                    {isTeacher && (
                      <button
                        onClick={() => handleTeacherOverride('ranking', candidate.id)}
                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        Set as Ranking
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentUserIsMember && !isTeacher && (
              <div className="space-y-2">
                <button
                  onClick={() => handleRunForPosition('ranking')}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium
                    ${currentUserIsRunningForRanking 
                      ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  <UserCheck className="w-4 h-4" />
                  {currentUserIsRunningForRanking ? 'Withdraw from Ranking Race' : 'Run for Ranking Member'}
                </button>

                {rankingCandidates.length > 0 && (
                  <button
                    onClick={() => handleVote('ranking')}
                    disabled={hasVotedForRanking}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Vote className="w-4 h-4" />
                    {hasVotedForRanking ? 'Vote Submitted' : 'Cast Vote'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showVotingModal && votingFor && (
        <VotingModal
          position={votingFor}
          candidates={votingFor === 'chair' ? chairCandidates : rankingCandidates}
          onClose={() => {
            setShowVotingModal(false);
            setVotingFor(null);
          }}
          onSubmit={handleVoteSubmit}
        />
      )}
    </>
  );
}
