import { useState } from "react";
import { Navigation } from "../components/Navigation";
import {
  User,
  MapPin,
  Flag,
  Award,
  FileText,
  Users,
  Mail,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useParams } from "react-router";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";

export function StudentProfile() {
  const { id } = useParams();
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterContent, setLetterContent] = useState("");
  const [showFullStatement, setShowFullStatement] = useState(false);
  const [showFullConstituency, setShowFullConstituency] = useState(false);

  const profiles: Record<string, any> = {
    "1": {
      id: "1",
      name: "Alice Johnson",
      constituency: "District 1",
      party: "Democratic",
      leadershipRoles: [
        "Committee Chair - Education",
        "Party Whip",
      ],
      personalStatement:
        "I am committed to improving education access and quality for all students in our district. My background in public policy has prepared me to advocate effectively for needed reforms.",
      constituencyDescription:
        "District 1 comprises suburban communities with a diverse population. Key issues include education funding, environmental protection, and healthcare access. The district has strong school systems but faces challenges with aging infrastructure.",
      keyIssues: [],
      billsWritten: [
        {
          id: "1",
          number: "H.R. 101",
          title: "Education Funding Enhancement Act",
          status: "In Committee",
        },
        {
          id: "2",
          number: "H.R. 115",
          title: "School Infrastructure Modernization Act",
          status: "Draft",
        },
      ],
      billsCosponsored: [
        {
          id: "3",
          number: "H.R. 102",
          title: "Clean Energy Investment Act",
          sponsor: "Bob Smith",
        },
      ],
      groups: [
        {
          type: "committee",
          name: "Education Committee",
          role: "Chair",
        },
        {
          type: "caucus",
          name: "Education Reform Coalition",
          role: "Member",
        },
      ],
      lettersWritten: 3,
    },
    "6": {
      id: "6",
      name: "Tess Lin",
      constituency: "California's 22nd District",
      party: "Democratic Party",
      profileImage: tessLinImage,
      leadershipRoles: [],
      personalStatement:
        "I am honored to represent California's 22nd District in Congress and help the hardworking people of one of our nation's largest agricultural districts achieve the standard of living they afford to the rest of the country.\n\nAs a Democrat, my priorities lie in protecting public health and safety. In light of the illegal biolab discovered in Reedley and the newly reported suspected biolab investigation in Las Vegas, I will push to strengthen federal oversight of select agents and toxins and improve coordination among local, state, and federal agencies so dangerous materials cannot be stored or handled in our communities without oversight. I will also support efforts to protect and strengthen Medicaid or expand access to care in rural areas.\n\nFurthermore, I will fight for water reliability, including solutions for failing wells and land subsidence. Modernizing federal water and infrastructure investments, cutting red tape that slows down repairs, and securing funding and technical support to help local groundwater users comply with California's evolving groundwater pumping requirements without crushing family farms and small communities are high on my agenda.\n\nFinally, I will support all workable legislation that lowers costs for working families, along with cost-of-living policies that help people afford housing, groceries, energy, and child care.\n\nSBA data shows that 1 in 2 of employees in California's 22nd Congressional District work for small businesses. I'm excited to join the Small Business Committee and support the small businesses that are the backbone of CA-22's economy.",
      constituencyDescription:
        "Representative: David Valadao, Republican\n\nDistribution: Largely rural, with half of cities/CDPs having a population under 10,000 and only one city with a population over 70,000.\n\nPopulation: 770,684\n\nMedian household income: $60,072\n\nEthnicity:\n73.2% Hispanic\n15.8% White\n4.5% Black\n3.6% Asian\n1.8% Two or more races\n1.1% other\n\nCook PVI: R+1",
      keyIssues: [
        "Medicaid (CA-22 has the highest Medicaid enrollment rate in the U.S.)",
        "Cost of living (for similar reasons)",
        "Agriculture (CA-22 is largely agricultural)",
        "Wells/subsidence (Central Valley basin)",
      ],
      billsWritten: [
        {
          id: "1",
          number: "H.R. 1",
          title: "Laboratory Accountability, Biosafety, and Security Access and Facility Enforcement (LABSAFE) Act",
          status: "Clerk's Desk",
        },
        {
          id: "2",
          number: "H.R. 2",
          title: "Critical Water Infrastructure Protection and Drought Resilience Act",
          status: "Clerk's Desk",
        },
        {
          id: "3",
          number: "H.R. 3",
          title: "Basin Reporting, Impact mitigation, and Dispute resolution through Governance support and Equipment (BRIDGE) Pilot Act",
          status: "Clerk's Desk",
        },
      ],
      billsCosponsored: [],
      groups: [],
      lettersWritten: 0,
    },
  };

  const profile = profiles[id || "1"] || profiles["1"];

  const handleSendLetter = () => {
    if (letterContent.trim()) {
      console.log("Sending letter:", letterContent);
      alert("Dear Colleague Letter sent!");
      setShowLetterModal(false);
      setLetterContent("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {profile.profileImage ? (
                <img 
                  src={profile.profileImage} 
                  alt={profile.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {profile.name}
                </h1>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.constituency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    <span>{profile.party}</span>
                  </div>
                </div>
                {profile.leadershipRoles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.leadershipRoles.map((role) => (
                      <span
                        key={role}
                        className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowLetterModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <Mail className="w-4 h-4" />
              Send Dear Colleague Letter
            </button>
          </div>
        </div>

        {/* Personal statement */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Personal Statement
            </h2>
            {profile.id === "6" && (
              <span className="text-xs italic text-gray-500">2/23/2026</span>
            )}
          </div>
          <div className="space-y-2">
            {profile.personalStatement.split("\n\n").length > 1 ? (
              <>
                <div className={showFullStatement ? "" : "relative pb-6"}>
                  {showFullStatement ? (
                    <div className="text-gray-700 space-y-4">
                      {profile.personalStatement.split("\n\n").map((para, index) => (
                        <p key={index}>{para}</p>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="text-gray-700 space-y-4">
                        {profile.personalStatement.split("\n\n").slice(0, 2).map((para, index) => (
                          <p key={index}>{para}</p>
                        ))}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowFullStatement(!showFullStatement)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors relative z-10"
                >
                  {showFullStatement ? (
                    <>
                      Show less <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="text-gray-700">{profile.personalStatement}</p>
            )}
          </div>
        </div>

        {/* Constituency description */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Constituency Description
            </h2>
            {profile.id === "6" && (
              <span className="text-xs italic text-gray-500">2/23/2026</span>
            )}
          </div>
          <div className="space-y-2">
            {profile.constituencyDescription.split("\n\n").length > 1 ? (
              <>
                <div className={showFullConstituency ? "" : "relative pb-6"}>
                  {showFullConstituency ? (
                    <div className="text-gray-700 space-y-4 whitespace-pre-line">
                      {profile.constituencyDescription}
                    </div>
                  ) : (
                    <>
                      <div className="text-gray-700 whitespace-pre-line">
                        {profile.constituencyDescription.split("\n\n")[0]}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowFullConstituency(!showFullConstituency)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors relative z-10"
                >
                  {showFullConstituency ? (
                    <>
                      Show less <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="text-gray-700 whitespace-pre-line">{profile.constituencyDescription}</p>
            )}
          </div>
        </div>

        {/* Key Issues */}
        {profile.keyIssues && profile.keyIssues.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Key Issues
              </h2>
              {profile.id === "6" && (
                <span className="text-xs italic text-gray-500">2/23/2026</span>
              )}
            </div>
            <ul className="space-y-2">
              {profile.keyIssues.map((issue, index) => (
                <li key={index} className="text-gray-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Activity panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Legislation written */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Legislation Written
              </h2>
            </div>
            <div className="space-y-3">
              {profile.billsWritten.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {bill.number}
                    </span>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {bill.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {bill.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Legislation cosponsored */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Legislation Cosponsored
              </h2>
            </div>
            {profile.billsCosponsored.length > 0 ? (
              <div className="space-y-3">
                {profile.billsCosponsored.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 bg-gray-50 rounded-md"
                  >
                    <span className="font-mono text-sm font-semibold text-gray-900 block mb-1">
                      {bill.number}
                    </span>
                    <p className="text-sm text-gray-700 mb-1">
                      {bill.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      Sponsor: {bill.sponsor}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No legislation cosponsored yet</p>
            )}
          </div>
        </div>

        {/* Groups */}
        {profile.groups.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Groups
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {profile.groups.map((group, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {group.name}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                      {group.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {group.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dear colleague letters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Dear Colleague Letters
            </h2>
          </div>
          <p className="text-gray-600">
            {profile.lettersWritten} letters sent
          </p>
        </div>
      </main>

      {/* Letter composer modal */}
      {showLetterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Compose Dear Colleague Letter
                </h2>
                <button
                  onClick={() => setShowLetterModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                To: {profile.name}
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={letterContent}
                onChange={(e) =>
                  setLetterContent(e.target.value)
                }
                placeholder="Dear Colleague,

I am writing to..."
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowLetterModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendLetter}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                Send Letter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}