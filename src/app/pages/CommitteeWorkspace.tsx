import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { FileText, Edit3, Eye, Check, X, Pause, Send, Save, MessageSquare } from "lucide-react";
import { useParams } from "react-router";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  originalText: string;
  amendedText?: string;
  markedUpText?: string;
  status: 'pending' | 'in-deliberation' | 'voted';
  votes?: {
    pass: number;
    table: number;
    fail: number;
  };
}

export function CommitteeWorkspace() {
  const { id } = useParams();
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isAmending, setIsAmending] = useState(false);
  const [amendedText, setAmendedText] = useState("");
  const [showAmendedVersions, setShowAmendedVersions] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedVote, setSelectedVote] = useState<'pass' | 'table' | 'fail' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState("");

  const isLeadership = true; // Mock: would check if user is chair/ranking member

  const committeeName = "Education Committee";

  const [bills, setBills] = useState<Bill[]>([
    {
      id: "1",
      number: "H.R. 4",
      title: "testing",
      sponsor: "Tess Lin",
      originalText: "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p><p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>",
      status: 'pending',
    },
  ]);

  const handleStartAmending = () => {
    if (selectedBill) {
      setAmendedText(selectedBill.originalText);
      setIsAmending(true);
    }
  };

  const handleSaveAmendment = () => {
    if (selectedBill && amendedText) {
      // Simple markup simulation - in reality would use diff algorithm
      const markedUp = amendedText.replace(
        /with a focus on sustainable materials/g,
        '<ins style="background-color: #d4edda; text-decoration: none;"> with a focus on sustainable materials</ins>'
      );

      setBills(bills.map(b =>
        b.id === selectedBill.id
          ? { ...b, amendedText, markedUpText: markedUp }
          : b
      ));
      setIsAmending(false);
      setShowAmendedVersions(true);
    }
  };

  const handleProposeForDeliberation = () => {
    if (selectedBill) {
      setBills(bills.map(b =>
        b.id === selectedBill.id
          ? { ...b, status: 'in-deliberation', votes: { pass: 0, table: 0, fail: 0 } }
          : b
      ));
      setShowAmendedVersions(false);
      alert("Bill proposed for committee deliberation!");
    }
  };

  const handleVote = (vote: 'pass' | 'table' | 'fail') => {
    setSelectedVote(vote);
    setShowVoteModal(true);
  };

  const confirmVote = () => {
    if (selectedBill && selectedVote && selectedBill.votes) {
      const newVotes = { ...selectedBill.votes };
      newVotes[selectedVote]++;

      setBills(bills.map(b =>
        b.id === selectedBill.id
          ? { ...b, votes: newVotes }
          : b
      ));

      setHasVoted(true);
      setShowVoteModal(false);
      setSelectedVote(null);
    }
  };

  const handleToggleComments = () => {
    setShowComments(!showComments);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{committeeName} Workspace</h1>
            <p className="text-gray-600">
              Review and deliberate on assigned bills
            </p>
          </div>
          <button
            onClick={handleToggleComments}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Save className="w-5 h-5" />
            {showComments ? 'Hide Comments' : 'Show Comments'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Bills list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                <h2 className="font-semibold text-lg">Assigned Bills</h2>
                <p className="text-sm text-blue-100 mt-1">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="divide-y divide-gray-200">
                {bills.map(bill => (
                  <button
                    key={bill.id}
                    onClick={() => {
                      setSelectedBill(bill);
                      setIsAmending(false);
                      setShowAmendedVersions(false);
                      setHasVoted(false);
                    }}
                    className={`w-full text-left p-5 transition-all ${
                      selectedBill?.id === bill.id
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {bill.number}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        bill.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                        bill.status === 'in-deliberation' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {bill.status === 'pending' ? 'Pending' :
                         bill.status === 'in-deliberation' ? 'In Deliberation' :
                         'Voted'}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                      {bill.title}
                    </h3>
                    <p className="text-xs text-gray-600">Sponsor: {bill.sponsor}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - Bill viewer and actions */}
          <div className="lg:col-span-2">
            {selectedBill ? (
              <div className="space-y-6">
                {/* Bill viewer */}
                {!isAmending && !showAmendedVersions && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                        <span className="font-mono font-bold text-lg">{selectedBill.number}</span>
                        <h2 className="text-2xl font-bold mt-2">{selectedBill.title}</h2>
                        <p className="text-sm text-blue-100 mt-2">Sponsor: {selectedBill.sponsor}</p>
                      </div>

                      <div className="p-8">
                        <div
                          className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: selectedBill.originalText }}
                        />
                      </div>

                      {isLeadership && selectedBill.status === 'pending' && (
                        <div className="p-5 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                          <button
                            onClick={handleStartAmending}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
                          >
                            <Edit3 className="w-5 h-5" />
                            Amend Bill
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Comments box */}
                    {showComments && (
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          <h3 className="font-semibold text-lg">Your Comments</h3>
                        </div>
                        <div className="p-6">
                          <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Add your thoughts, notes, or questions about this bill..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                            rows={6}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Amendment editor */}
                {isAmending && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
                        <h2 className="text-xl font-semibold">Amendment Editor</h2>
                        <p className="text-sm text-amber-50 mt-1">Edit the bill text below</p>
                      </div>

                      <div className="p-6">
                        <ReactQuill
                          theme="snow"
                          value={amendedText}
                          onChange={setAmendedText}
                          className="min-h-[400px] mb-4 rounded-lg overflow-hidden border border-gray-200"
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'code-block', 'link'],
                              [{ 'header': [1, 2, 3, false] }],
                              ['blockquote'],
                              ['clean']
                            ],
                          }}
                        />
                      </div>

                      <div className="p-5 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-end gap-3">
                        <button
                          onClick={() => setIsAmending(false)}
                          className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAmendment}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium"
                        >
                          Save Amendment
                        </button>
                      </div>
                    </div>

                    {/* Comments box */}
                    {showComments && (
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          <h3 className="font-semibold text-lg">Your Comments</h3>
                        </div>
                        <div className="p-6">
                          <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Add your thoughts, notes, or questions about this bill..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                            rows={6}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Amended versions viewer */}
                {showAmendedVersions && selectedBill.amendedText && (
                  <div className="space-y-6">
                    {/* Marked up version */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5 text-white flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">Marked Up Version</h2>
                          <p className="text-sm text-green-100 mt-1">Tracked changes shown</p>
                        </div>
                        <Eye className="w-6 h-6" />
                      </div>
                      <div className="p-8">
                        <div
                          className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: selectedBill.markedUpText || selectedBill.amendedText }}
                        />
                      </div>
                    </div>

                    {/* Clean version */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">Clean Version</h2>
                          <p className="text-sm text-blue-100 mt-1">Final committee text</p>
                        </div>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="p-8">
                        <div
                          className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: selectedBill.amendedText }}
                        />
                      </div>
                    </div>

                    {/* Propose button */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                      <button
                        onClick={handleProposeForDeliberation}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium w-full justify-center"
                      >
                        <Send className="w-5 h-5" />
                        Propose for Committee Deliberation
                      </button>
                    </div>

                    {/* Comments box */}
                    {showComments && (
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          <h3 className="font-semibold text-lg">Your Comments</h3>
                        </div>
                        <div className="p-6">
                          <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Add your thoughts, notes, or questions about this bill..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                            rows={6}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Voting interface */}
                {selectedBill.status === 'in-deliberation' && !isAmending && !showAmendedVersions && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                        <h2 className="text-xl font-semibold">Committee Vote</h2>
                        <p className="text-sm text-purple-100 mt-1">Cast your vote on this bill</p>
                      </div>

                      <div className="p-8">
                        {/* Bill text */}
                        <div className="mb-8">
                          <div
                            className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: selectedBill.amendedText || selectedBill.originalText }}
                          />
                        </div>

                        {/* Vote tally */}
                        {selectedBill.votes && (
                          <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-green-600">{selectedBill.votes.pass}</div>
                              <div className="text-sm text-gray-600 font-medium mt-1">Pass</div>
                            </div>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-gray-600">{selectedBill.votes.table}</div>
                              <div className="text-sm text-gray-600 font-medium mt-1">Table</div>
                            </div>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-red-600">{selectedBill.votes.fail}</div>
                              <div className="text-sm text-gray-600 font-medium mt-1">Fail</div>
                            </div>
                          </div>
                        )}

                        {/* Vote buttons */}
                        {!hasVoted ? (
                          <div className="grid grid-cols-3 gap-4">
                            <button
                              onClick={() => handleVote('pass')}
                              className="flex flex-col items-center gap-3 p-6 border-2 border-green-300 rounded-xl hover:bg-green-50 transition-all hover:shadow-md"
                            >
                              <Check className="w-8 h-8 text-green-600" />
                              <span className="font-semibold text-green-900 text-lg">Pass</span>
                            </button>
                            <button
                              onClick={() => handleVote('table')}
                              className="flex flex-col items-center gap-3 p-6 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all hover:shadow-md"
                            >
                              <Pause className="w-8 h-8 text-gray-600" />
                              <span className="font-semibold text-gray-900 text-lg">Table</span>
                            </button>
                            <button
                              onClick={() => handleVote('fail')}
                              className="flex flex-col items-center gap-3 p-6 border-2 border-red-300 rounded-xl hover:bg-red-50 transition-all hover:shadow-md"
                            >
                              <X className="w-8 h-8 text-red-600" />
                              <span className="font-semibold text-red-900 text-lg">Fail</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-6 bg-green-50 border-2 border-green-200 rounded-xl">
                            <p className="text-green-800 font-semibold text-lg">You have voted on this bill</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Comments box */}
                    {showComments && (
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          <h3 className="font-semibold text-lg">Your Comments</h3>
                        </div>
                        <div className="p-6">
                          <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Add your thoughts, notes, or questions about this bill..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                            rows={6}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-16 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Select a bill to view</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Vote confirmation modal */}
      {showVoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Confirm Your Vote</h3>
              <p className="text-gray-600 mb-4 text-lg">
                Are you sure you want to vote to <strong className={
                  selectedVote === 'pass' ? 'text-green-600' :
                  selectedVote === 'table' ? 'text-gray-600' :
                  'text-red-600'
                }>{selectedVote}</strong> this bill?
              </p>
              <p className="text-sm text-gray-500">
                Bill: {selectedBill?.number} - {selectedBill?.title}
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowVoteModal(false);
                  setSelectedVote(null);
                }}
                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmVote}
                className={`px-6 py-2.5 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium ${
                  selectedVote === 'pass' ? 'bg-green-600 hover:bg-green-700' :
                  selectedVote === 'table' ? 'bg-gray-600 hover:bg-gray-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm Vote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
