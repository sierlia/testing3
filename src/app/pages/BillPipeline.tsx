import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { BillPipelineSidebar } from "../components/BillPipelineSidebar";
import { BillViewer } from "../components/BillViewer";
import { ExternalLink, FileText } from "lucide-react";
import { Link } from "react-router";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  status: string;
  hasHold: boolean;
  legislativeText: string;
  supportingText: string;
  timeline: any[];
}

type Stage = 'clerk' | 'committees' | 'calendar' | 'floor';

export function BillPipeline() {
  const [selectedStage, setSelectedStage] = useState<Stage>('clerk');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Mock bills data organized by stage
  const billsByStage: Record<Stage, Bill[]> = {
    clerk: [
      {
        id: "1",
        number: "H.R. 106",
        title: "Digital Privacy Protection Act",
        sponsor: "Alice Johnson",
        status: "Pending Review",
        hasHold: false,
        legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Digital Privacy Protection Act'.</p>",
        supportingText: "<p>In the digital age, protecting citizen privacy is paramount...</p>",
        timeline: [],
      },
      {
        id: "2",
        number: "H.R. 107",
        title: "Small Business Tax Relief Act",
        sponsor: "Bob Smith",
        status: "Pending Review",
        hasHold: true,
        legislativeText: "<h2>Section 1. Purpose</h2><p>To provide tax relief to small businesses...</p>",
        supportingText: "<p>Small businesses are the backbone of our economy...</p>",
        timeline: [],
      },
    ],
    committees: [
      {
        id: "3",
        number: "H.R. 101",
        title: "Education Funding Enhancement Act",
        sponsor: "Alice Johnson",
        status: "In Committee",
        hasHold: false,
        legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Education Funding Enhancement Act'.</p>",
        supportingText: "<p>This bill addresses critical education funding needs...</p>",
        timeline: [],
      },
      {
        id: "4",
        number: "H.R. 102",
        title: "Clean Energy Investment Act",
        sponsor: "Bob Smith",
        status: "In Committee",
        hasHold: false,
        legislativeText: "<h2>Section 1. Findings</h2><p>Congress finds that renewable energy investment is crucial...</p>",
        supportingText: "<p>This legislation promotes clean energy development...</p>",
        timeline: [],
      },
    ],
    floor: [
      {
        id: "5",
        number: "H.R. 104",
        title: "Criminal Justice Reform Act",
        sponsor: "David Lee",
        status: "Floor Debate",
        hasHold: false,
        legislativeText: "<h2>Section 1. Short Title</h2><p>This Act may be cited as the 'Criminal Justice Reform Act'.</p>",
        supportingText: "<p>Our criminal justice system requires comprehensive reform...</p>",
        timeline: [],
      },
    ],
    calendar: [
      {
        id: "6",
        number: "H.R. 105",
        title: "Agricultural Sustainability Act",
        sponsor: "Emma Davis",
        status: "Scheduled for Vote",
        hasHold: false,
        legislativeText: "<h2>Section 1. Findings</h2><p>Sustainable farming practices are essential...</p>",
        supportingText: "<p>This bill incentivizes sustainable agricultural practices...</p>",
        timeline: [],
      },
    ],
  };

  const currentBills = billsByStage[selectedStage];

  // Select first bill when stage changes
  const handleStageChange = (stage: Stage) => {
    setSelectedStage(stage);
    const bills = billsByStage[stage];
    setSelectedBill(bills.length > 0 ? bills[0] : null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bill Pipeline</h1>
          <p className="text-gray-600">
            Track bills through the legislative process
          </p>
        </div>

        {/* Stage selector tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleStageChange('clerk')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                selectedStage === 'clerk'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Clerk
              <span className="ml-2 text-sm">({billsByStage.clerk.length})</span>
            </button>
            <button
              onClick={() => handleStageChange('committees')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                selectedStage === 'committees'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Committees
              <span className="ml-2 text-sm">({billsByStage.committees.length})</span>
            </button>
            <button
              onClick={() => handleStageChange('floor')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                selectedStage === 'floor'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Calendar
              <span className="ml-2 text-sm">({billsByStage.floor.length})</span>
            </button>
            <button
              onClick={() => handleStageChange('calendar')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                selectedStage === 'calendar'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Floor
              <span className="ml-2 text-sm">({billsByStage.calendar.length})</span>
            </button>
          </div>
        </div>

        {/* Main workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar - Bill list */}
          <div className="lg:col-span-1">
            <BillPipelineSidebar
              bills={currentBills}
              selectedBill={selectedBill}
              onSelectBill={setSelectedBill}
              stage={selectedStage}
            />
          </div>

          {/* Right pane - Bill viewer */}
          <div className="lg:col-span-2">
            {selectedBill ? (
              <div className="space-y-4">
                {/* Header with "Open full page" button */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Bill Viewer</h2>
                    </div>
                    <Link to={`/bills/${selectedBill.id}`}>
                      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm">
                        <ExternalLink className="w-4 h-4" />
                        Open Full Page
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Bill viewer component */}
                <BillViewer bill={selectedBill} />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {currentBills.length === 0
                    ? 'No bills in this stage'
                    : 'Select a bill from the list to view'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
