import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Mail, Copy, Check, Calendar, User } from "lucide-react";
import { useParams } from "react-router";

export function LetterView() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);

  const letter = {
    id: id || "1",
    sender: {
      id: "s1",
      name: "Alice Johnson",
      party: "Democratic",
      constituency: "District 1",
    },
    recipient: {
      id: "s2",
      name: "Bob Smith",
      party: "Republican",
      constituency: "District 5",
    },
    subject: "Support for H.R. 101",
    content: `Dear Colleague Bob,

I am writing to request your support for H.R. 101, the Education Funding Enhancement Act. This legislation represents a critical investment in our nation's future by providing substantial increases to K-12 education funding.

Key provisions include:
- $30 billion for teacher salaries and professional development
- $12.5 billion for school infrastructure improvements
- $7.5 billion for educational technology and resources

As representatives from different parties, I believe this bill addresses concerns that transcend partisan divides. Quality education is fundamental to economic prosperity and social mobility in all of our districts.

I would welcome the opportunity to discuss this further with you. Please let me know if you would be willing to cosponsor this important legislation.

Respectfully,
Alice Johnson
Representative, District 1`,
    timestamp: "2026-02-09 10:30 AM",
    permalink: `${window.location.origin}/letters/${id}`,
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(letter.permalink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dear Colleague Letter</h1>
                <p className="text-sm text-gray-600">{letter.subject}</p>
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">From</p>
                <p className="font-medium text-gray-900">{letter.sender.name}</p>
                <p className="text-xs text-gray-600">{letter.sender.party} • {letter.sender.constituency}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">To</p>
                <p className="font-medium text-gray-900">{letter.recipient.name}</p>
                <p className="text-xs text-gray-600">{letter.recipient.party} • {letter.recipient.constituency}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600">Sent</p>
                <p className="font-medium text-gray-900">{letter.timestamp}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Letter content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
              {letter.content}
            </pre>
          </div>
        </div>

        {/* Permalink info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-2">
            <strong>Permalink:</strong> This letter has a unique permanent link
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={letter.permalink}
              readOnly
              className="flex-1 px-3 py-2 text-sm bg-white border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Copy
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
