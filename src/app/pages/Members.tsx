import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Search, User, MapPin, Flag } from "lucide-react";
import { Link } from "react-router";

interface Member {
  id: string;
  name: string;
  party: string;
  constituency: string;
  leadershipRoles: string[];
}

export function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterParty, setFilterParty] = useState("all");

  const members: Member[] = [
    {
      id: "1",
      name: "Alice Johnson",
      party: "Democratic",
      constituency: "District 1",
      leadershipRoles: ["Committee Chair - Education", "Party Whip"],
    },
    {
      id: "2",
      name: "Bob Smith",
      party: "Republican",
      constituency: "District 5",
      leadershipRoles: [],
    },
    {
      id: "3",
      name: "Carol Martinez",
      party: "Democratic",
      constituency: "District 3",
      leadershipRoles: ["Party Leader"],
    },
    {
      id: "4",
      name: "David Lee",
      party: "Republican",
      constituency: "District 7",
      leadershipRoles: [],
    },
    {
      id: "5",
      name: "Emma Davis",
      party: "Green",
      constituency: "District 2",
      leadershipRoles: ["Committee Chair - Environment"],
    },
    {
      id: "6",
      name: "Tess Lin",
      party: "Democratic Party",
      constituency: "California's 22nd District",
      leadershipRoles: [],
    },
  ];

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.constituency.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesParty = filterParty === "all" || member.party === filterParty;
    return matchesSearch && matchesParty;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Members</h1>
          <p className="text-gray-600">
            Directory of all simulation participants
          </p>
        </div>

        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterParty}
              onChange={(e) => setFilterParty(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Parties</option>
              <option value="Democratic">Democratic</option>
              <option value="Republican">Republican</option>
              <option value="Green">Green</option>
            </select>
          </div>
        </div>

        {/* Members grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map(member => (
            <Link
              key={member.id}
              to={`/profile/${member.id}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">{member.name}</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{member.constituency}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Flag className="w-3 h-3" />
                      <span>{member.party}</span>
                    </div>
                  </div>
                </div>
              </div>

              {member.leadershipRoles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-200">
                  {member.leadershipRoles.map(role => (
                    <span key={role} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      {role}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No members found
          </div>
        )}
      </main>
    </div>
  );
}