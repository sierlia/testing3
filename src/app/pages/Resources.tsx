import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { BookOpen, FileText, Upload, Search, Download } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  category: string;
  type: 'link' | 'pdf';
  url?: string;
  description: string;
}

export function Resources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const userRole = 'student'; // or 'teacher'

  const resources: Resource[] = [
    {
      id: "1",
      title: "How a Bill Becomes a Law",
      category: "Simulation Rules",
      type: "pdf",
      description: "Step-by-step guide to the legislative process in our simulation",
    },
    {
      id: "2",
      title: "Committee Procedures Guide",
      category: "Committee Guides",
      type: "pdf",
      description: "Best practices for committee meetings, markup, and voting",
    },
    {
      id: "3",
      title: "Floor Debate Norms",
      category: "Debate Norms",
      type: "pdf",
      description: "Parliamentary procedure and etiquette for floor sessions",
    },
    {
      id: "4",
      title: "Bill Writing Rubric",
      category: "Rubrics",
      type: "pdf",
      description: "Grading criteria for legislative proposals",
    },
    {
      id: "5",
      title: "Congressional Research Service",
      category: "External Links",
      type: "link",
      url: "https://www.congress.gov",
      description: "Official government resource for bill tracking and research",
    },
  ];

  const categories = ["all", "Simulation Rules", "Committee Guides", "Debate Norms", "Rubrics", "External Links"];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || resource.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Resources</h1>
            <p className="text-gray-600">
              Classroom materials, guides, and external links
            </p>
          </div>
          {userRole === 'teacher' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
              <Upload className="w-4 h-4" />
              Upload Resource
            </button>
          )}
        </div>

        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resources list */}
        <div className="space-y-4">
          {filteredResources.map(resource => (
            <div key={resource.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {resource.type === 'pdf' ? (
                      <FileText className="w-5 h-5 text-blue-600" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{resource.title}</h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {resource.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{resource.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resource.type === 'pdf' ? (
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  ) : (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Open Link
                    </a>
                  )}
                  {userRole === 'teacher' && (
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      ⋮
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredResources.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No resources found
          </div>
        )}
      </main>
    </div>
  );
}
