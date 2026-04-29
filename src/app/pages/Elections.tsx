import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Vote, Users, Trophy, BarChart3 } from "lucide-react";

type ElectionPhase = 'party' | 'speaker' | 'results';
type PartyRole = 'leader' | 'whip';

interface Candidate {
  id: string;
  name: string;
  party: string;
  statement?: string;
}

export function Elections() {
  const [phase, setPhase] = useState<ElectionPhase>('party');
  const [userRole] = useState<'student' | 'teacher'>('student');
  const [userParty] = useState('Democratic');
  
  // Party elections state
  const [runningForLeader, setRunningForLeader] = useState(false);
  const [runningForWhip, setRunningForWhip] = useState(false);
  const [hasVotedLeader, setHasVotedLeader] = useState(false);
  const [hasVotedWhip, setHasVotedWhip] = useState(false);

  // Speaker election state
  const [hasVotedSpeaker, setHasVotedSpeaker] = useState(false);

  // Mock candidates
  const leaderCandidates: Candidate[] = [
    { id: "1", name: "Alice Johnson", party: "Democratic" },
    { id: "2", name: "Emma Davis", party: "Democratic" },
  ];

  const whipCandidates: Candidate[] = [
    { id: "3", name: "Carol Martinez", party: "Democratic" },
  ];

  const speakerCandidates: Candidate[] = [
    { id: "1", name: "Alice Johnson", party: "Democratic" },
    { id: "4", name: "Bob Smith", party: "Republican" },
  ];

  const handleVote = (role: PartyRole | 'speaker', candidateId: string) => {
    console.log(`Voting for ${role}:`, candidateId);
    if (role === 'leader') setHasVotedLeader(true);
    if (role === 'whip') setHasVotedWhip(true);
    if (role === 'speaker') setHasVotedSpeaker(true);
  };

  const democraticTurnout = { voted: 8, total: 12 };
  const republicanTurnout = { voted: 6, total: 10 };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leadership Elections</h1>
          <p className="text-gray-600">
            Vote for party leadership and the Speaker of the House
          </p>
        </div>

        {/* Phase selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setPhase('party')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                phase === 'party'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Phase 1: Party Elections
            </button>
            <button
              onClick={() => setPhase('speaker')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                phase === 'speaker'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Phase 2: Speaker Election
            </button>
            <button
              onClick={() => setPhase('results')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                phase === 'results'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Results
            </button>
          </div>
        </div>

        {/* Party Elections Phase */}
        {phase === 'party' && (
          <div className="space-y-6">
            {/* Turnout widget */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Live Turnout</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Democratic Party</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${(democraticTurnout.voted / democraticTurnout.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {democraticTurnout.voted}/{democraticTurnout.total}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Republican Party</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-red-600 h-3 rounded-full transition-all"
                        style={{ width: `${(republicanTurnout.voted / republicanTurnout.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {republicanTurnout.voted}/{republicanTurnout.total}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Leader Election */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {userParty} Party Leader
              </h2>
              
              {/* Run for Leader toggle */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runningForLeader}
                    onChange={(e) => setRunningForLeader(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-blue-900">
                    I want to run for Party Leader
                  </span>
                </label>
              </div>

              {/* Candidates */}
              <div className="space-y-3 mb-4">
                {leaderCandidates.map(candidate => (
                  <div key={candidate.id} className="p-3 border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      <button
                        onClick={() => handleVote('leader', candidate.id)}
                        disabled={hasVotedLeader}
                        className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {hasVotedLeader ? 'Voted' : 'Vote'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Whip Election */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {userParty} Party Whip
              </h2>
              
              {/* Run for Whip toggle */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runningForWhip}
                    onChange={(e) => setRunningForWhip(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-blue-900">
                    I want to run for Party Whip
                  </span>
                </label>
              </div>

              {/* Candidates */}
              <div className="space-y-3">
                {whipCandidates.map(candidate => (
                  <div key={candidate.id} className="p-3 border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      <button
                        onClick={() => handleVote('whip', candidate.id)}
                        disabled={hasVotedWhip}
                        className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {hasVotedWhip ? 'Voted' : 'Vote'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Speaker Election Phase */}
        {phase === 'speaker' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Vote className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Speaker of the House</h2>
              </div>

              <div className="space-y-3">
                {speakerCandidates.map(candidate => (
                  <div key={candidate.id} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                        <p className="text-sm text-gray-600">{candidate.party}</p>
                      </div>
                      <button
                        onClick={() => handleVote('speaker', candidate.id)}
                        disabled={hasVotedSpeaker}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {hasVotedSpeaker ? 'Voted' : 'Vote'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Phase */}
        {phase === 'results' && (
          <div className="space-y-6">
            {/* Democratic Leader */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Democratic Party Leader</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Alice Johnson</h3>
                    <p className="text-sm text-green-700">7 votes (58%)</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">Emma Davis</span>
                  <span className="text-sm font-medium text-gray-900">5 votes (42%)</span>
                </div>
              </div>
            </div>

            {/* Speaker */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Speaker of the House</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Alice Johnson</h3>
                    <p className="text-sm text-green-700">12 votes (55%)</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">Bob Smith</span>
                  <span className="text-sm font-medium text-gray-900">10 votes (45%)</span>
                </div>
              </div>

              {userRole === 'teacher' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Audit List</h3>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Student 1 → Alice Johnson</p>
                    <p>Student 2 → Bob Smith</p>
                    <p>Student 3 → Alice Johnson</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
