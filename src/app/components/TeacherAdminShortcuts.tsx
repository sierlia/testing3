import { BookOpen, Tags } from "lucide-react";

export function TeacherAdminShortcuts() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-sm border border-indigo-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
        <h2 className="text-lg font-semibold text-gray-900">Teacher Admin</h2>
      </div>
      
      <div className="space-y-2">
        <a
          href="#"
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-md text-gray-700 hover:bg-indigo-50 hover:text-gray-900 transition-colors border border-indigo-100 hover:border-indigo-200"
        >
          <div className="text-indigo-600">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-medium">Manage Classes</span>
        </a>
        
        <a
          href="#"
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-md text-gray-700 hover:bg-indigo-50 hover:text-gray-900 transition-colors border border-indigo-100 hover:border-indigo-200"
        >
          <div className="text-indigo-600">
            <Tags className="w-5 h-5" />
          </div>
          <span className="font-medium">Manage Tags</span>
        </a>
      </div>
    </div>
  );
}
