import { useState } from "react";
import { useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import {
  User,
  MapPin,
  Flag,
  FileText,
  Users,
  Mail,
  MessageSquare,
  Settings,
  Eye,
  Trash2,
  AlertTriangle,
  Pin,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function TeacherStudentView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const studentData = {
    id: "6",
    name: "Tess Lin",
    constituency: "California's 22nd District",
    party: "Democratic Party",
    profileImage: tessLinImage,
    personalStatement: {
      content:
        "I am honored to represent California's 22nd District in Congress and help the hardworking people of one of our nation's largest agricultural districts achieve the standard of living they afford to the rest of the country...",
      lastEdited: "2/23/2026",
    },
    constituencyDescription: {
      content:
        "Representative: David Valadao, Republican Party\n\nDistribution: Largely rural, with half of cities/CDPs having a population under 10,000 and only one city with a population over 70,000.\n\nPopulation: 770,684\n\nMedian household income: $60,072",
      lastEdited: "2/23/2026",
    },
    keyIssues: {
      content: [
        "Medicaid (CA-22 has the highest Medicaid enrollment rate in the U.S.)",
        "Cost of living (for similar reasons)",
        "Agriculture (CA-22 is largely agricultural)",
        "Wells/subsidence (Central Valley basin)",
      ],
      lastEdited: "2/23/2026",
    },
    groups: [
      {
        type: "caucus",
        name: "Democratic Caucus",
        role: "Member",
        work: [
          {
            id: 1,
            type: "Announcement",
            title: "Welcome Message",
            date: "3/1/2026",
          },
        ],
      },
      {
        type: "committee",
        name: "Agriculture Committee",
        role: "Member",
        work: [
          {
            id: 1,
            type: "Amendment",
            title: "H.R. 1 - Section 3 Amendment",
            date: "3/5/2026",
          },
        ],
      },
    ],
    billsWritten: [
      {
        id: "1",
        number: "H.R. 1",
        title:
          "Laboratory Accountability, Biosafety, and Security Access and Facility Enforcement (LABSAFE) Act",
        status: "Clerk's Desk",
      },
      {
        id: "2",
        number: "H.R. 2",
        title:
          "Critical Water Infrastructure Protection and Drought Resilience Act",
        status: "Clerk's Desk",
      },
    ],
    billsCosponsored: [],
    dearColleagueLetters: [],
    comments: [
      {
        id: 1,
        location: "testing caucus",
        locationType: "caucus",
        content: "testing pinned message 12345",
        timestamp: "3/15/2026 2:34 PM",
        isPinned: true,
      },
    ],
  };

  const handleDeleteComment = (commentId: number) => {
    setConfirmDialog({
      title: "Delete comment?",
      message: "This comment will be removed.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        console.log("Deleting comment:", commentId);
        alert("Comment deleted");
      },
    });
  };

  const handleWarnStudent = (commentId: number) => {
    setConfirmDialog({
      title: "Send warning?",
      message: "Send a warning to this student about this comment?",
      confirmLabel: "Send warning",
      onConfirm: () => {
        console.log("Warning student about comment:", commentId);
        alert("Warning sent to student");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <img
                src={studentData.profileImage}
                alt={studentData.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {studentData.name}
                </h1>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{studentData.constituency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    <span>{studentData.party}</span>
                  </div>
                </div>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md text-sm font-medium">
              Teacher View
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 w-full justify-start">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="work" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View Student Work
            </TabsTrigger>
            <TabsTrigger value="discussion" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Student Discussion
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="mb-6">
              <button
                onClick={() => navigate("/teacher/profile-layout-editor")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <Settings className="w-4 h-4" />
                Edit Profile Layout
              </button>
            </div>

            {/* Profile sections - showing same layout as StudentProfile */}
            <div className="space-y-6">
              {/* Personal statement */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Personal Statement
                </h2>
                <p className="text-gray-700">{studentData.personalStatement.content}</p>
              </div>

              {/* Constituency description */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Constituency Description
                </h2>
                <div className="text-gray-700 whitespace-pre-line">
                  {studentData.constituencyDescription.content}
                </div>
              </div>

              {/* Key Issues */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Key Issues
                </h2>
                <ul className="space-y-2">
                  {studentData.keyIssues.content.map((issue, index) => (
                    <li key={index} className="text-gray-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Activity panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Legislation written */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      Legislation Written
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {studentData.billsWritten.map((bill) => (
                      <div key={bill.id} className="p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {bill.number}
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {statusLabel(bill.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{bill.title}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legislation cosponsored */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      Legislation Cosponsored
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    No legislation cosponsored yet
                  </p>
                </div>
              </div>

              {/* Dear colleague letters */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Dear Colleague Letters
                  </h2>
                </div>
                <p className="text-gray-600">
                  {studentData.dearColleagueLetters.length} letters sent
                </p>
              </div>
            </div>
          </TabsContent>

          {/* View Student Work Tab */}
          <TabsContent value="work">
            <div className="space-y-6">
              {/* Profile Essays/Work */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Profile Essays & Work
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">
                        Personal Statement
                      </h3>
                      <span className="text-xs text-gray-500">
                        Last edited: {studentData.personalStatement.lastEdited}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {studentData.personalStatement.content}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">
                        Constituency Description
                      </h3>
                      <span className="text-xs text-gray-500">
                        Last edited:{" "}
                        {studentData.constituencyDescription.lastEdited}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {studentData.constituencyDescription.content}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">Key Issues</h3>
                      <span className="text-xs text-gray-500">
                        Last edited: {studentData.keyIssues.lastEdited}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {studentData.keyIssues.content.map((issue, index) => (
                        <li
                          key={index}
                          className="text-sm text-gray-700 flex items-start"
                        >
                          <span className="mr-2">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Groups */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Groups (Caucuses & Committees)
                </h2>
                <div className="space-y-4">
                  {studentData.groups.map((group, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-md">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {group.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {group.type}
                            </span>
                            <span className="text-xs text-gray-600">
                              Role: {group.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Work Contributed:
                        </h4>
                        {group.work.length > 0 ? (
                          <div className="space-y-2">
                            {group.work.map((item) => (
                              <div
                                key={item.id}
                                className="text-sm text-gray-600 flex items-center justify-between"
                              >
                                <span>
                                  {item.type}: {item.title}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {item.date}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            No work contributed yet
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legislation */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Legislation
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Bills Written
                    </h3>
                    <div className="space-y-2">
                      {studentData.billsWritten.map((bill) => (
                        <div key={bill.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {bill.number}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {statusLabel(bill.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{bill.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Bills Cosponsored
                    </h3>
                    <p className="text-sm text-gray-500">
                      No bills cosponsored yet
                    </p>
                  </div>
                </div>
              </div>

              {/* Dear Colleague Letters */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Dear Colleague Letters
                </h2>
                <p className="text-sm text-gray-500">No letters sent yet</p>
              </div>
            </div>
          </TabsContent>

          {/* Student Discussion Tab */}
          <TabsContent value="discussion">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Student Comments & Discussion
              </h2>
              <div className="space-y-4">
                {studentData.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {studentData.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            in{" "}
                            <span className="font-medium text-blue-600">
                              {comment.location}
                            </span>
                          </span>
                          {comment.isPinned && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {comment.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleWarnStudent(comment.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Warn
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
