import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { FileText, Vote, Users, Check, X, Minus } from "lucide-react";

type VoteChoice = 'yea' | 'nay' | 'present' | null;

interface VoteRecord {
  studentId: string;
  studentName: string;
  vote: VoteChoice;
}

export function FloorSession() {
  const [voteOpen, setVoteOpen] = useState(false);
  const [userVote, setUserVote] = useState<VoteChoice>(null);
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([
    { studentId: "1", studentName: "Alice Johnson", vote: 'yea' },
    { studentId: "2", studentName: "Bob Smith", vote: 'nay' },
    { studentId: "3", studentName: "Carol Martinez", vote: 'yea' },
    { studentId: "4", studentName: "David Lee", vote: null },
    { studentId: "5", studentName: "Emma Davis", vote: 'yea' },
    { studentId: "6", studentName: "Frank Wilson", vote: 'present' },
  ]);

  const userRole = 'student'; // or 'teacher'/'leadership'

  const bill = {
    number: "H.R. 101",
    title: "Education Funding Enhancement Act",
    sponsor: "Alice Johnson",
    committee: "Education Committee",
    summary: "Increases federal education funding by $50 billion over the next fiscal year, with allocations for teacher salaries, infrastructure, and technology.",
  };

  const handleVote = (choice: VoteChoice) => {
    setUserVote(choice);
    // Update vote records
    setVoteRecords(records => 
      records.map(r => r.studentId === "4" ? { ...r, vote: choice } : r)
    );
  };

  const handleOpenVote = () => {
    setVoteOpen(true);
  };

  const handleCloseVote = () => {
    setVoteOpen(false);
  };

  const yeaCount = voteRecords.filter(r => r.vote === 'yea').length;
  const nayCount = voteRecords.filter(r => r.vote === 'nay').length;
  const presentCount = voteRecords.filter(r => r.vote === 'present').length;
  const notVotedCount = voteRecords.filter(r => r.vote === null).length;
  const totalVoted = yeaCount + nayCount + presentCount;

  const voteResult = yeaCount > nayCount ? 'passed' : 'failed';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Floor Session</h1>
          <p className="text-gray-600">
            Current bill on the floor for debate and voting
          </p>
        </div>

        {/* Bill info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-bold text-gray-900">{bill.number}</span>
                <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  On Floor
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{bill.title}</h2>
              <div className="text-sm text-gray-600 mb-3">
                Sponsor: {bill.sponsor} • {bill.committee}
              </div>
              <p className="text-gray-700">{bill.summary}</p>
            </div>
          </div>
        </div>

        {/* Voting module */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-blue-300 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Vote className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Vote</h2>
              </div>
              <div className="flex items-center gap-2">
                {voteOpen ? (
                  <span className="text-sm px-3 py-1 bg-green-500 rounded-full font-medium">
                    Vote Open
                  </span>
                ) : (
                  <span className="text-sm px-3 py-1 bg-gray-500 rounded-full font-medium">
                    Vote Closed
                  </span>
                )}
              </div>
            </div>

            {voteOpen ? (
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => handleVote('yea')}
                  disabled={userVote !== null}
                  className={`p-4 rounded-lg font-semibold text-lg transition-all ${
                    userVote === 'yea'
                      ? 'bg-green-500 text-white scale-105'
                      : 'bg-white/20 hover:bg-white/30 backdrop-blur disabled:opacity-50'
                  }`}
                >
                  <Check className="w-6 h-6 mx-auto mb-2" />
                  Yea
                </button>
                <button
                  onClick={() => handleVote('nay')}
                  disabled={userVote !== null}
                  className={`p-4 rounded-lg font-semibold text-lg transition-all ${
                    userVote === 'nay'
                      ? 'bg-red-500 text-white scale-105'
                      : 'bg-white/20 hover:bg-white/30 backdrop-blur disabled:opacity-50'
                  }`}
                >
                  <X className="w-6 h-6 mx-auto mb-2" />
                  Nay
                </button>
                <button
                  onClick={() => handleVote('present')}
                  disabled={userVote !== null}
                  className={`p-4 rounded-lg font-semibold text-lg transition-all ${
                    userVote === 'present'
                      ? 'bg-gray-500 text-white scale-105'
                      : 'bg-white/20 hover:bg-white/30 backdrop-blur disabled:opacity-50'
                  }`}
                >
                  <Minus className="w-6 h-6 mx-auto mb-2" />
                  Present
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-blue-100">
                <p>Waiting for vote to open...</p>
              </div>
            )}

            {userVote && (
              <div className="mt-4 text-center text-sm">
                Your vote: <strong className="text-white">{userVote.toUpperCase()}</strong>
              </div>
            )}
          </div>

          {/* Live results */}
          <div className="p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">Live Results</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{yeaCount}</div>
                <div className="text-sm text-gray-600">Yea</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{nayCount}</div>
                <div className="text-sm text-gray-600">Nay</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{presentCount}</div>
                <div className="text-sm text-gray-600">Present</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-400">{notVotedCount}</div>
                <div className="text-sm text-gray-600">Not Voted</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Turnout</span>
                <span>{totalVoted} / {voteRecords.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${(totalVoted / voteRecords.length) * 100}%` }}
                />
              </div>
            </div>

            {!voteOpen && totalVoted === voteRecords.length && (
              <div className={`p-4 rounded-lg text-center ${
                voteResult === 'passed' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className={`text-lg font-bold ${
                  voteResult === 'passed' ? 'text-green-900' : 'text-red-900'
                }`}>
                  Bill {voteResult === 'passed' ? 'PASSED' : 'FAILED'}
                </h3>
                <p className={`text-sm ${
                  voteResult === 'passed' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {voteResult === 'passed' 
                    ? 'Bill will be sent to the Senate' 
                    : 'Bill will not advance'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Vote roster */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Vote Roster</h3>
          </div>
          <div className="space-y-2">
            {voteRecords.map(record => (
              <div key={record.studentId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-900">{record.studentName}</span>
                {record.vote === 'yea' && (
                  <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded font-medium">
                    Yea
                  </span>
                )}
                {record.vote === 'nay' && (
                  <span className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded font-medium">
                    Nay
                  </span>
                )}
                {record.vote === 'present' && (
                  <span className="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded font-medium">
                    Present
                  </span>
                )}
                {record.vote === null && (
                  <span className="text-sm px-3 py-1 bg-gray-100 text-gray-500 rounded">
                    Not Voted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Teacher controls */}
        {userRole === 'teacher' && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-3">Teacher Controls</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenVote}
                disabled={voteOpen}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Open Vote
              </button>
              <button
                onClick={handleCloseVote}
                disabled={!voteOpen}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Close Vote
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
