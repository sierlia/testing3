import { useState } from "react";
import { Check, Plus, AlertCircle } from "lucide-react";

interface Party {
  id: string;
  name: string;
  platform: string;
  color: string;
}

interface NewParty {
  name: string;
  platform: string;
}

interface PartySelectionProps {
  selectedParty: string | null;
  newParty?: NewParty;
  onSelectParty: (partyId: string | null) => void;
  onCreateParty: (party: NewParty | undefined) => void;
}

export function PartySelection({ 
  selectedParty, 
  newParty, 
  onSelectParty, 
  onCreateParty 
}: PartySelectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [partyName, setPartyName] = useState(newParty?.name || "");
  const [partyPlatform, setPartyPlatform] = useState(newParty?.platform || "");
  
  // Teacher setting - can be toggled by teachers
  const allowPartyCreation = true;

  // Mock teacher-approved parties
  const approvedParties: Party[] = [
    {
      id: "democratic",
      name: "Democratic Party",
      platform: "Progressive policies focusing on social programs, healthcare reform, and environmental protection",
      color: "blue",
    },
    {
      id: "republican",
      name: "Republican Party",
      platform: "Conservative values emphasizing fiscal responsibility, limited government, and traditional institutions",
      color: "red",
    },
    {
      id: "green",
      name: "Green Party",
      platform: "Environmental sustainability, social justice, and grassroots democracy",
      color: "green",
    },
    {
      id: "libertarian",
      name: "Libertarian Party",
      platform: "Individual liberty, free markets, and minimal government intervention",
      color: "yellow",
    },
  ];

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colorMap: Record<string, { border: string; bg: string; text: string }> = {
      blue: {
        border: isSelected ? "border-blue-600" : "border-blue-300",
        bg: isSelected ? "bg-blue-50" : "bg-white",
        text: "text-blue-600",
      },
      red: {
        border: isSelected ? "border-red-600" : "border-red-300",
        bg: isSelected ? "bg-red-50" : "bg-white",
        text: "text-red-600",
      },
      green: {
        border: isSelected ? "border-green-600" : "border-green-300",
        bg: isSelected ? "bg-green-50" : "bg-white",
        text: "text-green-600",
      },
      yellow: {
        border: isSelected ? "border-yellow-600" : "border-yellow-300",
        bg: isSelected ? "bg-yellow-50" : "bg-white",
        text: "text-yellow-600",
      },
    };
    return colorMap[color] || colorMap.blue;
  };

  const handleSelectParty = (partyId: string) => {
    onSelectParty(partyId);
    setShowCreateForm(false);
    onCreateParty(undefined);
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
    onSelectParty(null);
  };

  const handleSaveNewParty = () => {
    if (partyName.trim() && partyPlatform.trim()) {
      onCreateParty({ name: partyName.trim(), platform: partyPlatform.trim() });
      onSelectParty("custom");
    }
  };

  const platformWordCount = partyPlatform.trim() === "" ? 0 : partyPlatform.trim().split(/\s+/).length;
  const maxPlatformWords = 100;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Choose Your Party</h2>
      <p className="text-gray-600 mb-6">
        Select a political party to join or create your own (if enabled by your teacher)
      </p>

      {/* Teacher-approved parties */}
      <div className="space-y-3 mb-6">
        {approvedParties.map((party) => {
          const isSelected = selectedParty === party.id;
          const colors = getColorClasses(party.color, isSelected);
          
          return (
            <button
              key={party.id}
              onClick={() => handleSelectParty(party.id)}
              className={`
                w-full text-left p-4 rounded-lg border-2 transition-all
                ${colors.border} ${colors.bg}
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg mb-2 ${colors.text}`}>
                    {party.name}
                  </h3>
                  <p className="text-sm text-gray-700">{party.platform}</p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colors.text.replace('text-', 'bg-')}`}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Create party section */}
      {allowPartyCreation && (
        <div>
          <div className="border-t border-gray-200 pt-6">
            {!showCreateForm ? (
              <button
                onClick={handleShowCreateForm}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create Your Own Party</span>
              </button>
            ) : (
              <div className={`
                p-6 rounded-lg border-2 transition-all
                ${selectedParty === "custom" ? 'border-purple-600 bg-purple-50' : 'border-gray-300 bg-white'}
              `}>
                <div className="flex items-start gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-700">
                    <strong>Note:</strong> Your teacher will review your custom party before approval.
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="partyName" className="block text-sm font-medium text-gray-700 mb-1">
                      Party Name *
                    </label>
                    <input
                      id="partyName"
                      type="text"
                      value={partyName}
                      onChange={(e) => {
                        setPartyName(e.target.value);
                        handleSaveNewParty();
                      }}
                      placeholder="e.g., Progressive Reform Party"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label htmlFor="partyPlatform" className="block text-sm font-medium text-gray-700 mb-1">
                      Short Platform *
                    </label>
                    <textarea
                      id="partyPlatform"
                      value={partyPlatform}
                      onChange={(e) => {
                        setPartyPlatform(e.target.value);
                        handleSaveNewParty();
                      }}
                      placeholder="Describe your party's core values and policy priorities..."
                      className="w-full h-32 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-sm ${platformWordCount > maxPlatformWords ? 'text-red-600' : 'text-gray-600'}`}>
                        {platformWordCount} / {maxPlatformWords} words
                      </span>
                    </div>
                  </div>

                  {partyName.trim() && partyPlatform.trim() && platformWordCount <= maxPlatformWords && (
                    <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-4 py-2">
                      <Check className="w-4 h-4 inline mr-1" />
                      Your custom party has been saved
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!allowPartyCreation && (
        <div className="border-t border-gray-200 pt-6">
          <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Party creation is currently disabled. Please select from the approved parties above.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
