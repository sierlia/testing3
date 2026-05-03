import { useState } from "react";
import {
  Search,
  User,
  MoreVertical,
  Tag,
  Users as UsersIcon,
  Flag,
  Eye,
} from "lucide-react";
import { Link } from "react-router";

interface Student {
  id: string;
  name: string;
  tags: string[];
  party: string;
  committee: string;
  leadershipRoles: string[];
}

interface StudentTableProps {
  filterTags: string[];
}

export function StudentTable({
  filterTags,
}: StudentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    party: "all",
    committee: "all",
    role: "all",
  });

  // Mock students
  const allStudents: Student[] = [
    {
      id: "1",
      name: "Alice Johnson",
      tags: ["Mr. Litzenberger Period 6"],
      party: "Democratic Party",
      committee: "Education Committee",
      leadershipRoles: ["Committee Chair"],
    },
    {
      id: "2",
      name: "Bob Smith",
      tags: ["Mr. Litzenberger Period 6", "Advanced Civics"],
      party: "Republican Party",
      committee: "Environment & Energy Committee",
      leadershipRoles: [],
    },
    {
      id: "3",
      name: "Carol Martinez",
      tags: ["Ms. Beito Period 2"],
      party: "Democratic Party",
      committee: "Healthcare Committee",
      leadershipRoles: ["Party Whip"],
    },
    {
      id: "6",
      name: "Tess Lin",
      tags: ["Mr. Litzenberger Period 6"],
      party: "Democratic Party",
      committee: "Agriculture Committee",
      leadershipRoles: [],
    },
  ];

  const filteredStudents = allStudents.filter((student) => {
    const matchesSearch = student.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesTags =
      filterTags.length === 0 ||
      filterTags.some((tag) => student.tags.includes(tag));
    const matchesParty =
      filters.party === "all" ||
      student.party === filters.party;
    const matchesCommittee =
      filters.committee === "all" ||
      student.committee === filters.committee;
    const matchesRole =
      filters.role === "all" ||
      student.leadershipRoles.includes(filters.role);

    return (
      matchesSearch &&
      matchesTags &&
      matchesParty &&
      matchesCommittee &&
      matchesRole
    );
  });

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <select
          value={filters.party}
          onChange={(e) =>
            setFilters({ ...filters, party: e.target.value })
          }
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        >
          <option value="all">All Parties</option>
          <option value="Democratic Party">Democratic Party</option>
          <option value="Republican Party">Republican Party</option>
        </select>

        <select
          value={filters.committee}
          onChange={(e) =>
            setFilters({
              ...filters,
              committee: e.target.value,
            })
          }
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        >
          <option value="all">All Committees</option>
          <option value="Education Committee">
            Education Committee
          </option>
          <option value="Healthcare Committee">
            Healthcare Committee
          </option>
        </select>

        <select
          value={filters.role}
          onChange={(e) =>
            setFilters({ ...filters, role: e.target.value })
          }
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        >
          <option value="all">All Roles</option>
          <option value="Committee Chair">
            Committee Chair
          </option>
          <option value="Party Whip">Party Whip</option>
        </select>
      </div>

      {/* Student table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Party
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Committee
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Roles
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <Link
                      to={`/profile/${student.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {student.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {student.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {student.party}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {student.committee}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {student.leadershipRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {student.leadershipRoles.map((role) => (
                        <span
                          key={role}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">
                      None
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/teacher/student/${student.id}/view`}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No students found
          </div>
        )}
      </div>
    </div>
  );
}
