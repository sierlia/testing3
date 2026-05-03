import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { AlertCircle, ArrowDown, ArrowUp, BookOpen, FileText, MessageSquare, Search } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "../components/ui/select";
import { fetchClassActivity, ClassActivity } from "../services/classActivity";

type SortDirection = "desc" | "asc";

function activityIcon(type: string) {
  if (type === "bill") return <FileText className="h-4 w-4 text-blue-600" />;
  if (type === "committee") return <BookOpen className="h-4 w-4 text-orange-600" />;
  if (type === "letter" || type === "comment" || type === "caucus") return <MessageSquare className="h-4 w-4 text-gray-700" />;
  return <AlertCircle className="h-4 w-4 text-gray-600" />;
}

export function ClassActivityPage() {
  const { classId } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("student") ?? "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [contextFilter, setContextFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    setSearchQuery(searchParams.get("student") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      if (!classId) return;
      setLoading(true);
      try {
        setActivities(await fetchClassActivity(classId, 250));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [classId]);

  const contextGroups = useMemo(() => {
    const groups = {
      party: new Set<string>(),
      committee: new Set<string>(),
      caucus: new Set<string>(),
    };
    activities.forEach((activity) => {
      if (!activity.contextName || !activity.contextType) return;
      groups[activity.contextType].add(activity.contextName);
    });
    return {
      party: Array.from(groups.party).sort((a, b) => a.localeCompare(b)),
      committee: Array.from(groups.committee).sort((a, b) => a.localeCompare(b)),
      caucus: Array.from(groups.caucus).sort((a, b) => a.localeCompare(b)),
    };
  }, [activities]);

  const visibleActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activities
      .filter((activity) => {
        const haystack = `${activity.studentName} ${activity.action} ${activity.type} ${activity.contextName ?? ""}`.toLowerCase();
        const [selectedContextType, ...selectedContextNameParts] = contextFilter.split(":");
        const selectedContextName = selectedContextNameParts.join(":");
        const contextMatches = contextFilter === "all" || (activity.contextType === selectedContextType && activity.contextName === selectedContextName);
        return (!query || haystack.includes(query)) && (typeFilter === "all" || activity.type === typeFilter) && contextMatches;
      })
      .sort((a, b) => (sortDirection === "asc" ? a.timestamp.getTime() - b.timestamp.getTime() : b.timestamp.getTime() - a.timestamp.getTime()));
  }, [activities, contextFilter, searchQuery, sortDirection, typeFilter]);

  const renderContextGroup = (label: string, type: "party" | "committee" | "caucus", items: string[]) => (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {items.length ? (
        items.map((item) => <SelectItem key={`${type}:${item}`} value={`${type}:${item}`}>{item}</SelectItem>)
      ) : (
        <SelectItem value={`${type}:__none`} disabled>No {label.toLowerCase()}</SelectItem>
      )}
    </SelectGroup>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Student Activity</h1>
          <p className="mt-1 text-sm text-gray-600">Search and sort activity by student, organization, and type.</p>
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_16rem_9rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search activity..."
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="bill">Bills</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
                <SelectItem value="letter">Dear Colleague</SelectItem>
                <SelectItem value="committee">Committees</SelectItem>
                <SelectItem value="caucus">Caucuses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contextFilter} onValueChange={setContextFilter}>
              <SelectTrigger><SelectValue placeholder="All organizations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                <SelectSeparator />
                {renderContextGroup("Parties", "party", contextGroups.party)}
                <SelectSeparator />
                {renderContextGroup("Committees", "committee", contextGroups.committee)}
                <SelectSeparator />
                {renderContextGroup("Caucuses", "caucus", contextGroups.caucus)}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Time
              {sortDirection === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading activity...</div>
          ) : visibleActivities.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No activity found.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visibleActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50">{activityIcon(activity.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <Link to={`/profile/${activity.studentId}`} className="font-semibold hover:text-blue-600">{activity.studentName}</Link>{" "}
                      {activity.action}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{activity.timestamp.toLocaleString()}</span>
                      <span className="capitalize">{activity.type}</span>
                      {activity.contextName && <span>{activity.contextName}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
