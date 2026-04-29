import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { DraggableCommitteeCard } from "../components/DraggableCommitteeCard";
import { GripVertical, Info } from "lucide-react";

interface Committee {
  id: string;
  name: string;
  description: string;
  meetingTime: string;
  notes?: string;
  tags: string[];
}

export function CommitteePreferences() {
  // Mock student's class tag
  const studentClassTag = "civics-101";
  
  // Mock available committees
  const availableCommittees: Committee[] = [
    {
      id: "education",
      name: "Education Committee",
      description: "Oversees K-12 and higher education policy, student loans, and educational standards.",
      meetingTime: "Tuesdays, 3:00 PM",
      notes: "High activity level during legislative session",
      tags: ["civics-101", "advanced-gov"],
    },
    {
      id: "environment",
      name: "Environment & Energy Committee",
      description: "Addresses climate change, renewable energy, conservation, and environmental protection.",
      meetingTime: "Wednesdays, 2:30 PM",
      tags: ["civics-101"],
    },
    {
      id: "healthcare",
      name: "Healthcare Committee",
      description: "Focuses on healthcare access, insurance reform, public health, and medical policy.",
      meetingTime: "Thursdays, 3:15 PM",
      notes: "Often requires policy research",
      tags: ["civics-101", "advanced-gov"],
    },
    {
      id: "budget",
      name: "Budget & Appropriations Committee",
      description: "Reviews government spending, taxation, and fiscal policy decisions.",
      meetingTime: "Fridays, 2:00 PM",
      tags: ["advanced-gov"],
    },
    {
      id: "judiciary",
      name: "Judiciary Committee",
      description: "Handles legal matters, constitutional issues, criminal justice, and civil rights.",
      meetingTime: "Mondays, 3:30 PM",
      tags: ["civics-101"],
    },
    {
      id: "agriculture",
      name: "Agriculture Committee",
      description: "Covers farm policy, food security, rural development, and agricultural trade.",
      meetingTime: "Tuesdays, 2:00 PM",
      tags: ["civics-101"],
    },
  ];

  // Filter committees based on student's class tag
  const eligibleCommittees = availableCommittees.filter(committee => 
    committee.tags.includes(studentClassTag)
  );

  const [rankedCommittees, setRankedCommittees] = useState<Committee[]>(eligibleCommittees);
  const [submitted, setSubmitted] = useState(false);

  const moveCommittee = (dragIndex: number, hoverIndex: number) => {
    const draggedCommittee = rankedCommittees[dragIndex];
    const newRanking = [...rankedCommittees];
    newRanking.splice(dragIndex, 1);
    newRanking.splice(hoverIndex, 0, draggedCommittee);
    setRankedCommittees(newRanking);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    console.log("Submitted committee preferences:", rankedCommittees);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Committee Preferences</h1>
            <p className="text-gray-600">
              Drag and drop to rank committees in order of preference (1st choice at top)
            </p>
          </div>

          {submitted && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Preferences Submitted!</h3>
                <p className="text-sm text-green-700">
                  Your committee preferences have been recorded. Your teacher will assign committees soon.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <GripVertical className="w-4 h-4" />
              <span>Drag to reorder your preferences</span>
            </div>

            <div className="space-y-3">
              {rankedCommittees.map((committee, index) => (
                <DraggableCommitteeCard
                  key={committee.id}
                  committee={committee}
                  index={index}
                  moveCommittee={moveCommittee}
                  rank={index + 1}
                  disabled={submitted}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {eligibleCommittees.length} eligible committees based on your class
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitted}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitted ? "Submitted" : "Submit Preferences"}
            </button>
          </div>
        </main>
      </div>
    </DndProvider>
  );
}
