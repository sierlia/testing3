import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Vote, Users, TrendingUp, CheckCircle } from "lucide-react";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";

interface Candidate {
  id: string;
  name: string;
  profileImage?: string;
  votes: number;
}

export function CaucusChairVote() {
  const [hasVoted, setHasVoted] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([
    {
      id: "6",
      name: "Tess Lin",
      profileImage: tessLinImage,
      votes: 1,
    },
    {
      id: "7",
      name: "Less Tin",
      votes: 0,
    },
  ]);

  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  const totalMembers = 2;

  const handleVote = (candidateId: string) => {
    if (hasVoted) return;

    setCandidates(
      candidates.map((c) =>
        c.id === candidateId ? { ...c, votes: c.votes + 1 } : c
      )
    );
    setHasVoted(true);
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Committee Chair Election
          </h1>
          <p className="text-gray-600">
            Vote for the committee chair of{" "}
            <span className="font-semibold text-purple-700">testingcommitteename</span>
          </p>
        </div>

        {/* Vote status */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Voting Progress</h3>
                <p className="text-sm text-gray-600">
                  {totalVotes} of {totalMembers} votes cast
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600">
                {Math.round((totalVotes / totalMembers) * 100)}%
              </div>
              <p className="text-xs text-gray-500">Turnout</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${(totalVotes / totalMembers) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Candidates */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center gap-2">
              <Vote className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Cast Your Vote</h2>
            </div>
            <p className="text-sm text-purple-100 mt-1">
              Select your choice for committee chair
            </p>
          </div>

          <div className="p-6 space-y-4">
            {sortedCandidates.map((candidate, index) => {
              const percentage = getPercentage(candidate.votes);
              const isLeading = index === 0 && candidate.votes > 0;

              return (
                <div
                  key={candidate.id}
                  className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                    isLeading
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Vote percentage background */}
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isLeading
                        ? "bg-purple-200/50"
                        : "bg-blue-100/50"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />

                  <div className="relative flex items-center justify-between p-5">
                    <div className="flex items-center gap-4 flex-1">
                      {candidate.profileImage ? (
                        <img
                          src={candidate.profileImage}
                          alt={candidate.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                          <Users className="w-8 h-8 text-gray-600" />
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">
                            {candidate.name}
                          </h3>
                          {isLeading && (
                            <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                              LEADING
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-2xl font-bold text-purple-600">
                              {percentage}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {candidate.votes} vote{candidate.votes !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!hasVoted ? (
                      <button
                        onClick={() => handleVote(candidate.id)}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
                      >
                        Vote
                      </button>
                    ) : (
                      <div className="px-6 py-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voted confirmation */}
        {hasVoted && (
          <div className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-2xl font-bold mb-2">Vote Recorded!</h2>
              <p className="text-green-100">
                Your vote has been successfully recorded. Results are shown above.
              </p>
            </div>
          </div>
        )}

        {/* Info box */}
        {!hasVoted && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Vote className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  How to Vote
                </h3>
                <p className="text-sm text-gray-600">
                  Click the "Vote" button next to your preferred candidate. You can only
                  vote once, so choose carefully. Results are displayed in real-time as
                  votes are cast.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
