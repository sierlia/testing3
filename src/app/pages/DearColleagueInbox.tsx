import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Mail, User, Calendar } from "lucide-react";
import { Link } from "react-router";

interface DearColleagueLetter {
  id: string;
  from: string;
  fromDistrict: string;
  fromImage: string | null;
  subject: string;
  message: string;
  date: Date;
  isRead: boolean;
}

export function DearColleagueInbox() {
  const [letters, setLetters] = useState<DearColleagueLetter[]>([
    {
      id: "1",
      from: "Less Tin",
      fromDistrict: "CA-21",
      fromImage: null,
      subject: "testing title",
      message: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      date: new Date("2026-03-09T21:32:00"),
      isRead: false,
    },
  ]);

  const [selectedLetter, setSelectedLetter] = useState<DearColleagueLetter | null>(null);

  const handleSelectLetter = (letter: DearColleagueLetter) => {
    setSelectedLetter(letter);
    if (!letter.isRead) {
      setLetters(letters.map(l => l.id === letter.id ? { ...l, isRead: true } : l));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dear Colleague Letters</h1>
          <p className="text-gray-600 mt-1">Read letters from your fellow representatives</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Letters List */}
          <div className="lg:col-span-1 space-y-2">
            {letters.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No letters yet</h3>
                <p className="text-sm text-gray-600">Your inbox is empty</p>
              </div>
            ) : (
              letters.map(letter => (
                <button
                  key={letter.id}
                  onClick={() => handleSelectLetter(letter)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedLetter?.id === letter.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  } ${!letter.isRead ? 'font-semibold' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {letter.fromImage ? (
                      <img 
                        src={letter.fromImage} 
                        alt={letter.from}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-900 truncate">{letter.from}</span>
                        {!letter.isRead && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate mb-1">{letter.subject}</p>
                      <p className="text-xs text-gray-500">{formatDate(letter.date)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Letter Content */}
          <div className="lg:col-span-2">
            {selectedLetter ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-200">
                  <Link to={`/members/${selectedLetter.fromDistrict.toLowerCase()}`}>
                    {selectedLetter.fromImage ? (
                      <img 
                        src={selectedLetter.fromImage} 
                        alt={selectedLetter.from}
                        className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1">
                    <Link 
                      to={`/members/${selectedLetter.fromDistrict.toLowerCase()}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {selectedLetter.from}
                    </Link>
                    <p className="text-sm text-gray-600">{selectedLetter.fromDistrict}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(selectedLetter.date)}</span>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedLetter.subject}</h2>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700">{selectedLetter.message}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a letter to read</h3>
                <p className="text-gray-600">Choose a letter from the list to view its contents</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}