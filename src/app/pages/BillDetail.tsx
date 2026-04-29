import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { BillStatusTimeline } from "../components/BillStatusTimeline";
import { BillSponsors } from "../components/BillSponsors";
import { BillActions } from "../components/BillActions";
import { FileText, BookOpen, AlertCircle } from "lucide-react";
import { useParams } from "react-router";

export function BillDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'legislative' | 'supporting'>('legislative');
  
  // Mock user role
  const userRole: 'student' | 'teacher' | 'leadership' = 'student';
  
  // Mock bill data
  const bill = {
    id: id || "1",
    number: "H.R. 101",
    title: "Education Funding Enhancement Act",
    type: "H.R. Bill",
    sponsor: {
      id: "s1",
      name: "Alice Johnson",
      party: "Democratic",
      constituency: "District 1",
    },
    cosponsors: [
      { id: "s2", name: "Bob Smith", party: "Republican" },
      { id: "s3", name: "Carol Martinez", party: "Democratic" },
    ],
    committee: "Education Committee",
    currentStatus: "In Committee",
    hasHold: false,
    submittedDate: "2026-02-01",
    lastUpdated: "2026-02-08",
    legislativeText: `
      <h2>Section 1. Short Title</h2>
      <p>This Act may be cited as the 'Education Funding Enhancement Act'.</p>
      
      <h2>Section 2. Findings</h2>
      <p>Congress finds the following:</p>
      <ol>
        <li>Quality education is fundamental to individual and societal success.</li>
        <li>Current funding levels are inadequate to meet educational needs.</li>
        <li>Investment in education yields significant long-term economic benefits.</li>
      </ol>
      
      <h2>Section 3. Increased Funding Authorization</h2>
      <p>There is authorized to be appropriated $50,000,000,000 for fiscal year 2027 for the purpose of enhancing K-12 education funding, to be distributed as follows:</p>
      <ol>
        <li>60% for teacher salaries and professional development</li>
        <li>25% for school infrastructure improvements</li>
        <li>15% for educational technology and resources</li>
      </ol>
      
      <h2>Section 4. Implementation</h2>
      <p>The Secretary of Education shall implement this Act within 180 days of enactment.</p>
    `,
    supportingText: `
      <h2>Purpose and Need</h2>
      <p>This bill addresses the critical need for increased education funding in our nation's schools. Current funding levels have not kept pace with inflation or the evolving needs of modern education.</p>
      
      <h2>Key Benefits</h2>
      <ul>
        <li><strong>Teacher Quality:</strong> Higher salaries will attract and retain talented educators</li>
        <li><strong>Infrastructure:</strong> Updated facilities create better learning environments</li>
        <li><strong>Technology:</strong> Modern tools prepare students for the digital economy</li>
      </ul>
      
      <h2>Economic Impact</h2>
      <p>Research shows that every dollar invested in education returns $7 to the economy over time through increased productivity, reduced crime, and improved health outcomes.</p>
      
      <h2>Implementation Timeline</h2>
      <p>The 180-day implementation period ensures rapid deployment of funds while allowing for proper oversight and accountability measures.</p>
    `,
    timeline: [
      { stage: "Draft", status: "completed", date: "2026-02-01" },
      { stage: "Submitted", status: "completed", date: "2026-02-01" },
      { stage: "Referred to Committee", status: "completed", date: "2026-02-02" },
      { stage: "In Committee", status: "current", date: "2026-02-03" },
      { stage: "Reported", status: "upcoming", date: null },
      { stage: "Calendared", status: "upcoming", date: null },
      { stage: "Voted", status: "upcoming", date: null },
      { stage: "Sent to Senate", status: "upcoming", date: null },
      { stage: "Sent to President", status: "upcoming", date: null },
      { stage: "Signed/Vetoed", status: "upcoming", date: null },
    ],
  };

  const currentUserId = "s4"; // Mock current user
  const isUserCosponsor = bill.cosponsors.some(cs => cs.id === currentUserId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-lg font-bold text-gray-900">{bill.number}</span>
                <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  {bill.currentStatus}
                </span>
                {bill.hasHold && (
                  <div className="flex items-center gap-1.5 text-sm px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Hold
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{bill.title}</h1>
              <p className="text-sm text-gray-600">{bill.type}</p>
            </div>
          </div>

          {bill.hasHold && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Hold Status:</strong> The sponsor has placed a hold on this bill, signaling to leadership 
              that it should not move forward at this time.
            </div>
          )}
        </div>

        {/* Status Timeline */}
        <BillStatusTimeline timeline={bill.timeline} />

        {/* Sponsor and Cosponsors */}
        <BillSponsors
          sponsor={bill.sponsor}
          cosponsors={bill.cosponsors}
          isUserCosponsor={isUserCosponsor}
          currentUserId={currentUserId}
        />

        {/* Tabs for Legislative Text and Supporting Text */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('legislative')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === 'legislative'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Legislative Text
              </button>
              <button
                onClick={() => setActiveTab('supporting')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === 'supporting'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Supporting Text
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'legislative' && (
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: bill.legislativeText }}
              />
            )}
            {activeTab === 'supporting' && (
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: bill.supportingText }}
              />
            )}
          </div>
        </div>

        {/* Role-based actions */}
        <BillActions
          bill={bill}
          userRole={userRole}
          currentUserId={currentUserId}
        />
      </main>
    </div>
  );
}
