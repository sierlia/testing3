import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Users, Crown, Vote, UserCheck, X, Check } from "lucide-react";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";

interface Member {
  id: string;
  name: string;
  profileImage?: string;
  currentRole?: string;
}

export function TeacherCaucusManagement() {
  const [selectionMode, setSelectionMode] = useState<"appoint" | "vote" | null>(null);
  const [selectedChair, setSelectedChair] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [voteActive, setVoteActive] = useState(false);

  const caucusName = "testingcommitteename";

  const members: Member[] = [
    {
      id: "6",
      name: "Tess Lin",
      profileImage: tessLinImage,
    },
    {
      id: "7",
      name: "Less Tin",
    },
  ];

  const handleAppoint = (memberId: string) => {
    setSelectedChair(memberId);
    setShowConfirmModal(true);
  };

  const confirmAppointment = () => {
    console.log("Appointing chair:", selectedChair);
    alert(`${members.find(m => m.id === selectedChair)?.name} has been appointed as committee chair!`);
    setShowConfirmModal(false);
    setSelectedChair(null);
    setSelectionMode(null);
  };

  const initiateVote = () => {
    setVoteActive(true);
    alert("Vote has been initiated! Students can now vote for committee chair.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Caucus Leadership Management
          </h1>
          <p className="text-gray-600">
            Manage leadership for <span className="font-semibold text-purple-700">{caucusName}</span>
          </p>
        </div>

        {/* Selection mode buttons */}
        {!selectionMode && !voteActive && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Choose Leadership Selection Method
            </h2>
            <p className="text-gray-600 mb-6">
              How would you like to select the committee chair for this caucus?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setSelectionMode("appoint")}
                className="flex flex-col items-center gap-4 p-6 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-all hover:shadow-md"
              >
                <UserCheck className="w-12 h-12 text-blue-600" />
                <div className="text-center">
                  <h3 className="font-semibold text-blue-900 text-lg mb-1">
                    Appoint Chair
                  </h3>
                  <p className="text-sm text-gray-600">
                    Directly select a member to be committee chair
                  </p>
                </div>
              </button>
              <button
                onClick={() => setSelectionMode("vote")}
                className="flex flex-col items-center gap-4 p-6 border-2 border-purple-300 rounded-xl hover:bg-purple-50 transition-all hover:shadow-md"
              >
                <Vote className="w-12 h-12 text-purple-600" />
                <div className="text-center">
                  <h3 className="font-semibold text-purple-900 text-lg mb-1">
                    Member Vote
                  </h3>
                  <p className="text-sm text-gray-600">
                    Let caucus members vote for their chair
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Appoint mode */}
        {selectionMode === "appoint" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Appoint Committee Chair</h2>
                  <p className="text-sm text-blue-100 mt-1">
                    Select a member to appoint as chair
                  </p>
                </div>
                <button
                  onClick={() => setSelectionMode(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {member.profileImage ? (
                        <img
                          src={member.profileImage}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {member.name}
                        </h3>
                        {member.currentRole && (
                          <p className="text-xs text-gray-500">
                            Current: {member.currentRole}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAppoint(member.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
                    >
                      <Crown className="w-4 h-4" />
                      Appoint as Chair
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vote mode */}
        {selectionMode === "vote" && !voteActive && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Initiate Leadership Vote</h2>
                <p className="text-sm text-purple-100 mt-1">
                  Start a vote for caucus members to select their chair
                </p>
              </div>
              <button
                onClick={() => setSelectionMode(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Eligible Candidates
                </h3>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      {member.profileImage ? (
                        <img
                          src={member.profileImage}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                      <span className="font-medium text-gray-900">
                        {member.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg mb-6">
                <p className="text-sm text-purple-800">
                  <strong>Note:</strong> Once initiated, all caucus members will be able
                  to cast their vote. The vote will remain open until you close it.
                </p>
              </div>

              <button
                onClick={initiateVote}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                <Vote className="w-5 h-5" />
                Initiate Vote
              </button>
            </div>
          </div>
        )}

        {/* Active vote status */}
        {voteActive && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5 text-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <h2 className="text-xl font-semibold">Vote Active</h2>
              </div>
              <p className="text-sm text-green-100">
                Members are currently voting for committee chair
              </p>
            </div>

            <div className="p-8">
              <p className="text-gray-600 mb-4">
                Students can now vote at the{" "}
                <a
                  href="/caucus-chair-vote"
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  caucus chair voting page
                </a>
              </p>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  The vote is now live. You can monitor results in real-time on the
                  voting page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Caucus members list */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-5 text-white">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Caucus Members</h2>
            </div>
            <p className="text-sm text-gray-300 mt-1">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="p-6 space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                {member.profileImage ? (
                  <img
                    src={member.profileImage}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  {member.currentRole ? (
                    <p className="text-sm text-gray-600">{member.currentRole}</p>
                  ) : (
                    <p className="text-sm text-gray-500">No leadership role</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <Crown className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                Confirm Appointment
              </h3>
              <p className="text-gray-600 mb-2 text-center">
                Are you sure you want to appoint
              </p>
              <p className="text-xl font-semibold text-blue-600 mb-4 text-center">
                {members.find(m => m.id === selectedChair)?.name}
              </p>
              <p className="text-gray-600 text-center">
                as the committee chair for {caucusName}?
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedChair(null);
                }}
                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAppointment}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                <Check className="w-5 h-5" />
                Confirm Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
