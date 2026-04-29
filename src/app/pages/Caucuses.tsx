import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search, Plus, Users, Tag } from "lucide-react";
import { Link } from "react-router";

interface Caucus {
  id: string;
  name: string;
  description: string;
  issueAreas: string[];
  memberCount: number;
  chair: string;
  isMember: boolean;
}

export function Caucuses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'newest' | 'largest' | 'issue'>('newest');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [caucuses, setCaucuses] = useState<Caucus[]>([
    {
      id: "1",
      name: "Environmental Action Caucus",
      description: "Focused on climate change, conservation, and renewable energy policies",
      issueAreas: ["environment", "energy"],
      memberCount: 12,
      chair: "Emma Davis",
      isMember: false,
    },
    {
      id: "2",
      name: "Education Reform Coalition",
      description: "Advocating for improved education funding and curriculum standards",
      issueAreas: ["education", "budget"],
      memberCount: 18,
      chair: "Alice Johnson",
      isMember: true,
    },
    {
      id: "3",
      name: "Healthcare Access Group",
      description: "Working towards universal healthcare access and affordability",
      issueAreas: ["healthcare", "reform"],
      memberCount: 15,
      chair: "Carol Martinez",
      isMember: false,
    },
  ]);

  const filteredCaucuses = caucuses.filter(caucus =>
    caucus.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caucus.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caucus.issueAreas.some(area => area.includes(searchQuery.toLowerCase()))
  );

  const sortedCaucuses = [...filteredCaucuses].sort((a, b) => {
    if (sortBy === 'largest') return b.memberCount - a.memberCount;
    if (sortBy === 'newest') return parseInt(b.id) - parseInt(a.id);
    return 0;
  });

  const handleJoinLeave = (caucusId: string) => {
    setCaucuses(caucuses.map(c =>
      c.id === caucusId ? { ...c, isMember: !c.isMember, memberCount: c.isMember ? c.memberCount - 1 : c.memberCount + 1 } : c
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Caucuses</h1>
            <p className="text-gray-600">
              Join or create groups focused on specific issues
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Caucus
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Caucus</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caucus Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Climate Action Caucus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  placeholder="Describe the caucus purpose and goals..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Areas *
                </label>
                <div className="flex flex-wrap gap-2">
                  {['environment', 'education', 'healthcare', 'justice', 'economy'].map(tag => (
                    <button
                      key={tag}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                  Create Caucus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and sort */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search caucuses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="newest">Newest</option>
              <option value="largest">Most Members</option>
              <option value="issue">By Issue</option>
            </select>
          </div>
        </div>

        {/* Caucus cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedCaucuses.map(caucus => (
            <div key={caucus.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="mb-4">
                <Link to={`/caucuses/${caucus.id}`}>
                  <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2">
                    {caucus.name}
                  </h3>
                </Link>
                <p className="text-sm text-gray-600 line-clamp-2">{caucus.description}</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {caucus.issueAreas.map(area => (
                  <span key={area} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {area}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{caucus.memberCount} members</span>
                  </div>
                  <span>•</span>
                  <span>Chair: {caucus.chair}</span>
                </div>
                <button
                  onClick={() => handleJoinLeave(caucus.id)}
                  className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${
                    caucus.isMember
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {caucus.isMember ? 'Leave' : 'Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
