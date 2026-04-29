import { useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import {
  User,
  MapPin,
  Flag,
  GripVertical,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Layout,
  Settings,
} from "lucide-react";
import tessLinImage from "figma:asset/966ec4d05f8fbeb48998b857574fc6613b388aae.png";

interface ProfileSection {
  id: string;
  title: string;
  type: string;
  width: "full" | "half";
  content?: any;
  editable: boolean;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

function DraggableSection({
  section,
  index,
  moveSection,
  removeSection,
  updateSection,
}: {
  section: ProfileSection;
  index: number;
  moveSection: (dragIndex: number, hoverIndex: number) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, updates: Partial<ProfileSection>) => void;
}) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: "section",
    item: { index, id: section.id, type: "section" },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop<DragItem, void, {}>({
    accept: "section",
    hover: (item: DragItem) => {
      if (item.index !== index) {
        moveSection(item.index, index);
        item.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => preview(drop(node))}
      className={`bg-white rounded-lg shadow-sm border-2 ${
        isDragging ? "border-blue-400 opacity-50" : "border-gray-200"
      } p-6 ${section.width === "full" ? "col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div ref={drag} className="cursor-move">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={section.title}
            onChange={(e) =>
              updateSection(section.id, { title: e.target.value })
            }
            className="text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              updateSection(section.id, {
                width: section.width === "full" ? "half" : "full",
              })
            }
            className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
            title={section.width === "full" ? "Make half width" : "Make full width"}
          >
            <Layout className="w-4 h-4" />
          </button>
          {section.editable && (
            <button
              onClick={() => removeSection(section.id)}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-600">
        {section.type === "personal-statement" && (
          <p className="text-gray-700">
            I am honored to represent California's 22nd District in Congress...
          </p>
        )}
        {section.type === "constituency" && (
          <div className="text-gray-700 whitespace-pre-line">
            Representative: David Valadao, Republican{"\n"}
            Population: 770,684{"\n"}
            Median household income: $60,072
          </div>
        )}
        {section.type === "key-issues" && (
          <ul className="space-y-2">
            <li className="text-gray-700 flex items-start">
              <span className="mr-2">•</span>
              <span>Medicaid (CA-22 has the highest Medicaid enrollment rate in the U.S.)</span>
            </li>
            <li className="text-gray-700 flex items-start">
              <span className="mr-2">•</span>
              <span>Cost of living (for similar reasons)</span>
            </li>
          </ul>
        )}
        {section.type === "legislation-written" && (
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded-md">
              <span className="font-mono text-sm font-semibold text-gray-900 block mb-1">H.R. 1</span>
              <p className="text-sm text-gray-700">Laboratory Accountability, Biosafety, and Security Access and Facility Enforcement (LABSAFE) Act</p>
            </div>
          </div>
        )}
        {section.type === "legislation-cosponsored" && (
          <p className="text-sm text-gray-500">No legislation cosponsored yet</p>
        )}
        {section.type === "dear-colleague" && (
          <p className="text-gray-600">0 letters sent</p>
        )}
        {section.type === "custom" && (
          <textarea
            placeholder="Enter custom content..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            rows={3}
          />
        )}
      </div>
    </div>
  );
}

export function TeacherProfileLayoutEditor() {
  const [sections, setSections] = useState<ProfileSection[]>([
    {
      id: "personal-statement",
      title: "Personal Statement",
      type: "personal-statement",
      width: "full",
      editable: false,
    },
    {
      id: "constituency",
      title: "Constituency Description",
      type: "constituency",
      width: "full",
      editable: false,
    },
    {
      id: "key-issues",
      title: "Key Issues",
      type: "key-issues",
      width: "full",
      editable: false,
    },
    {
      id: "legislation-written",
      title: "Legislation Written",
      type: "legislation-written",
      width: "half",
      editable: false,
    },
    {
      id: "legislation-cosponsored",
      title: "Legislation Cosponsored",
      type: "legislation-cosponsored",
      width: "half",
      editable: false,
    },
    {
      id: "dear-colleague",
      title: "Dear Colleague Letters",
      type: "dear-colleague",
      width: "full",
      editable: false,
    },
  ]);

  const moveSection = (dragIndex: number, hoverIndex: number) => {
    const draggedSection = sections[dragIndex];
    const newSections = [...sections];
    newSections.splice(dragIndex, 1);
    newSections.splice(hoverIndex, 0, draggedSection);
    setSections(newSections);
  };

  const addSection = () => {
    const newSection: ProfileSection = {
      id: `custom-${Date.now()}`,
      title: "New Section",
      type: "custom",
      width: "full",
      editable: true,
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, updates: Partial<ProfileSection>) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const resetLayout = () => {
    if (confirm("Reset to default layout? This will remove all custom sections.")) {
      setSections([
        {
          id: "personal-statement",
          title: "Personal Statement",
          type: "personal-statement",
          width: "full",
          editable: false,
        },
        {
          id: "constituency",
          title: "Constituency Description",
          type: "constituency",
          width: "full",
          editable: false,
        },
        {
          id: "key-issues",
          title: "Key Issues",
          type: "key-issues",
          width: "full",
          editable: false,
        },
        {
          id: "legislation-written",
          title: "Legislation Written",
          type: "legislation-written",
          width: "half",
          editable: false,
        },
        {
          id: "legislation-cosponsored",
          title: "Legislation Cosponsored",
          type: "legislation-cosponsored",
          width: "half",
          editable: false,
        },
        {
          id: "dear-colleague",
          title: "Dear Colleague Letters",
          type: "dear-colleague",
          width: "full",
          editable: false,
        },
      ]);
    }
  };

  const saveLayout = () => {
    console.log("Saving layout:", sections);
    alert("Profile layout saved successfully!");
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header card (fixed, non-editable) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <img
                  src={tessLinImage}
                  alt="Tess Lin"
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Tess Lin
                  </h1>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>California's 22nd District</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4" />
                      <span>Democratic Party</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs text-gray-500">
                <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  Dear Colleague Letters can be enabled/disabled in{" "}
                  <button className="underline hover:text-blue-800">
                    simulation settings
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="font-medium">Teacher View:</span>
                Drag sections to reorder, click the layout icon to toggle width, or add custom sections below.
              </p>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={addSection}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Custom Section
              </button>
              <button
                onClick={resetLayout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </button>
            </div>
            <button
              onClick={saveLayout}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              Save Layout
            </button>
          </div>

          {/* Editable sections grid */}
          <div className="grid grid-cols-2 gap-6">
            {sections.map((section, index) => (
              <DraggableSection
                key={section.id}
                section={section}
                index={index}
                moveSection={moveSection}
                removeSection={removeSection}
                updateSection={updateSection}
              />
            ))}
          </div>
        </main>
      </div>
    </DndProvider>
  );
}
