import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { TagManager } from "../components/TagManager";
import { StudentTable } from "../components/StudentTable";
import { Tags, Users } from "lucide-react";

export function TeacherAdmin() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Student & Tag Management</h1>
          <p className="text-gray-600">
            Manage class periods, tags, and student assignments
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel - Tag Management */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <Tags className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Tags & Periods</h2>
              </div>
              <TagManager onTagsChange={setSelectedTags} />
            </div>
          </div>

          {/* Main panel - Student Table */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              </div>
              <StudentTable filterTags={selectedTags} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
