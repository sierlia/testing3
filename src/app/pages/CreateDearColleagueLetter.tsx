import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Send, X, User, Search } from "lucide-react";
import { useNavigate } from "react-router";

interface Recipient {
  type: "individual" | "caucus" | "party" | "committee";
  name: string;
  image?: string | null;
  district?: string;
}

export function CreateDearColleagueLetter() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientType, setRecipientType] = useState<"individual" | "caucus" | "party" | "committee">("individual");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mock data for suggestions
  const individualSuggestions = [
    { name: "Less Tin", district: "CA-21", image: null },
  ];

  const caucusSuggestions = [
    { name: "testing" },
  ];

  const partySuggestions = [
    { name: "Democratic Party" },
    { name: "Republican Party" },
  ];

  const handleAddRecipient = (recipient: Recipient) => {
    if (!recipients.some(r => r.name === recipient.name && r.type === recipient.type)) {
      setRecipients([...recipients, recipient]);
    }
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleSendLetter = () => {
    if (!subject || !message || recipients.length === 0) return;
    
    // Here you would send the letter
    console.log("Sending letter:", { subject, message, recipients });
    
    // Navigate back to dashboard
    navigate("/dashboard");
  };

  const getFilteredSuggestions = () => {
    const query = searchQuery.toLowerCase();
    
    if (recipientType === "individual") {
      return individualSuggestions.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.district.toLowerCase().includes(query)
      );
    } else if (recipientType === "caucus") {
      return caucusSuggestions.filter(s => s.name.toLowerCase().includes(query));
    } else if (recipientType === "party") {
      return partySuggestions.filter(s => s.name.toLowerCase().includes(query));
    }
    
    return [];
  };

  const filteredSuggestions = getFilteredSuggestions();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Compose Dear Colleague Letter</h1>
          <p className="text-gray-600 mt-1">Send a message to your fellow representatives</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Recipient Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To:
            </label>
            
            {/* Selected Recipients */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {recipients.map((recipient, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full">
                    {recipient.type === "individual" && recipient.image && (
                      <img 
                        src={recipient.image} 
                        alt={recipient.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    )}
                    {recipient.type === "individual" && !recipient.image && (
                      <User className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {recipient.name}
                      {recipient.district && ` (${recipient.district})`}
                    </span>
                    <button
                      onClick={() => handleRemoveRecipient(index)}
                      className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Recipient Type Selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRecipientType("individual")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  recipientType === "individual"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => setRecipientType("caucus")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  recipientType === "caucus"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Caucus
              </button>
              <button
                onClick={() => setRecipientType("party")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  recipientType === "party"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Party
              </button>
              <button
                onClick={() => setRecipientType("committee")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  recipientType === "committee"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Committee
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={
                  recipientType === "individual" ? "Search by name or district..." :
                  recipientType === "caucus" ? "Search caucuses..." :
                  recipientType === "party" ? "Search parties..." :
                  "Search committees..."
                }
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && searchQuery && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {recipientType === "individual" && filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddRecipient({
                        type: "individual",
                        name: suggestion.name,
                        district: suggestion.district,
                        image: suggestion.image,
                      })}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {suggestion.image ? (
                        <img 
                          src={suggestion.image} 
                          alt={suggestion.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{suggestion.name}</div>
                        <div className="text-sm text-gray-600">{suggestion.district}</div>
                      </div>
                    </button>
                  ))}
                  
                  {(recipientType === "caucus" || recipientType === "party") && filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddRecipient({
                        type: recipientType,
                        name: suggestion.name,
                      })}
                      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="font-medium text-gray-900">{suggestion.name}</div>
                    </button>
                  ))}
                </div>
              )}

              {recipientType === "committee" && searchQuery && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-sm text-gray-600">
                  No committees available
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Support for H.R. 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Dear Colleague,&#10;&#10;I am writing to..."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSendLetter}
              disabled={!subject || !message || recipients.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Send className="w-4 h-4" />
              Send Letter
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
