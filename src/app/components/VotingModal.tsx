import { useState } from "react";
import { X, Vote } from "lucide-react";

interface Member {
  id: string;
  name: string;
  party: string;
}

interface VotingModalProps {
  position: 'chair' | 'ranking';
  candidates: Member[];
  onClose: () => void;
  onSubmit: (candidateId: string) => void;
}

export function VotingModal({ position, candidates, onClose, onSubmit }: VotingModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedCandidate) {
      onSubmit(selectedCandidate);
    }
  };

  const positionTitle = position === 'chair' ? 'Chair' : 'Ranking Member';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Vote for {positionTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Select your preferred candidate for {positionTitle}:
          </p>

          <div className="space-y-2 mb-6">
            {candidates.map(candidate => (
              <label
                key={candidate.id}
                className={`
                  flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${selectedCandidate === candidate.id 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="candidate"
                  value={candidate.id}
                  checked={selectedCandidate === candidate.id}
                  onChange={() => setSelectedCandidate(candidate.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">{candidate.name}</div>
                  <div className="text-sm text-gray-500">{candidate.party}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <strong>Note:</strong> Your vote is confidential and cannot be changed after submission.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCandidate}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Submit Vote
          </button>
        </div>
      </div>
    </div>
  );
}
