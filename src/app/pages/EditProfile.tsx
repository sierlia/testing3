import { useState } from "react";
import { Navigation } from "../components/Navigation";
import {
  User,
  MapPin,
  Flag,
  Pencil,
  Save,
  X,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
} from "lucide-react";
import { useParams } from "react-router";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";
import { toast } from "sonner";

export function EditProfile() {
  const { id } = useParams();
  
  const [profileData, setProfileData] = useState({
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
  });

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const handleEditClick = (section: string, content: string | string[]) => {
    setEditingSection(section);
    if (Array.isArray(content)) {
      setEditingContent(content.join("\n"));
    } else {
      setEditingContent(content);
    }
  };

  const handleSave = (section: string) => {
    if (section === "keyIssues") {
      const issues = editingContent.trim() === "" ? [] : editingContent.split("\n").filter(line => line.trim());
      setProfileData({ ...profileData, keyIssues: issues });
    } else {
      setProfileData({ ...profileData, [section]: editingContent });
    }
    setEditingSection(null);
    setEditingContent("");
    toast.success("Profile updated successfully!");
  };

  const handleCancel = () => {
    setEditingSection(null);
    setEditingContent("");
  };

  const insertMarkdown = (prefix: string, suffix: string = "", placeholder: string = "text") => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selectedText = editingContent.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText = 
      editingContent.substring(0, start) + 
      prefix + textToInsert + suffix + 
      editingContent.substring(end);
    
    setEditingContent(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      if (textareaRef) {
        const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : 0);
        textareaRef.focus();
        textareaRef.setSelectionRange(newCursorPos, newCursorPos + (selectedText ? 0 : placeholder.length));
      }
    }, 0);
  };

  const MarkdownToolbar = () => (
    <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-md border-b-0">
      <button
        type="button"
        onClick={() => insertMarkdown("**", "**", "bold text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Bold"
      >
        <Bold className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("*", "*", "italic text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Italic"
      >
        <Italic className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("[", "](url)", "link text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Link"
      >
        <LinkIcon className="w-4 h-4 text-gray-700" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => insertMarkdown("- ", "", "list item")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Bullet List"
      >
        <List className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("1. ", "", "list item")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              {editingSection === "profileImage" ? (
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  Image upload coming soon
                </div>
              ) : (
                <>
                  <img 
                    src={profileData.profileImage} 
                    alt={profileData.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <button
                    onClick={() => handleEditClick("profileImage", "")}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {profileData.name}
              </h1>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{profileData.constituency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  <span>{profileData.party}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal statement */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Personal Statement
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs italic text-gray-500">2/23/2026</span>
              {editingSection !== "personalStatement" && (
                <button
                  onClick={() => handleEditClick("personalStatement", profileData.personalStatement)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {editingSection === "personalStatement" ? (
            <div className="space-y-3">
              <MarkdownToolbar />
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter your personal statement..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500 mb-2">
                Supports markdown formatting
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave("personalStatement")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {profileData.personalStatement.trim() === "" ? (
                <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
              ) : (
                <div className="text-gray-700 space-y-4">
                  {profileData.personalStatement.split("\n\n").map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Constituency description */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Constituency Description
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs italic text-gray-500">2/23/2026</span>
              {editingSection !== "constituencyDescription" && (
                <button
                  onClick={() => handleEditClick("constituencyDescription", profileData.constituencyDescription)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {editingSection === "constituencyDescription" ? (
            <div className="space-y-3">
              <MarkdownToolbar />
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter constituency description..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500 mb-2">
                Supports markdown formatting
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave("constituencyDescription")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {profileData.constituencyDescription.trim() === "" ? (
                <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
              ) : (
                <div className="text-gray-700 whitespace-pre-line">
                  {profileData.constituencyDescription}
                </div>
              )}
            </>
          )}
        </div>

        {/* Key Issues */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Key Issues
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs italic text-gray-500">2/23/2026</span>
              {editingSection !== "keyIssues" && (
                <button
                  onClick={() => handleEditClick("keyIssues", profileData.keyIssues)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {editingSection === "keyIssues" ? (
            <div className="space-y-3">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter key issues (one per line)..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500 mb-2">
                Enter one issue per line. Supports markdown formatting.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave("keyIssues")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {profileData.keyIssues.length === 0 ? (
                <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
              ) : (
                <ul className="space-y-2">
                  {profileData.keyIssues.map((issue, index) => (
                    <li key={index} className="text-gray-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}