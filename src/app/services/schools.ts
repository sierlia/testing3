export type SchoolOption = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  url?: string;
  source?: "scorecard" | "fallback";
};

const fallbackSchools: SchoolOption[] = [
  { id: "fallback:harvard-university", name: "Harvard University", city: "Cambridge", state: "MA", source: "fallback" },
  { id: "fallback:stanford-university", name: "Stanford University", city: "Stanford", state: "CA", source: "fallback" },
  { id: "fallback:university-of-california-berkeley", name: "University of California, Berkeley", city: "Berkeley", state: "CA", source: "fallback" },
  { id: "fallback:university-of-michigan-ann-arbor", name: "University of Michigan-Ann Arbor", city: "Ann Arbor", state: "MI", source: "fallback" },
  { id: "fallback:university-of-texas-at-austin", name: "The University of Texas at Austin", city: "Austin", state: "TX", source: "fallback" },
  { id: "fallback:university-of-virginia", name: "University of Virginia-Main Campus", city: "Charlottesville", state: "VA", source: "fallback" },
  { id: "fallback:georgetown-university", name: "Georgetown University", city: "Washington", state: "DC", source: "fallback" },
  { id: "fallback:arizona-state-university", name: "Arizona State University Campus Immersion", city: "Tempe", state: "AZ", source: "fallback" },
  { id: "fallback:ohio-state-university", name: "Ohio State University-Main Campus", city: "Columbus", state: "OH", source: "fallback" },
  { id: "fallback:university-of-florida", name: "University of Florida", city: "Gainesville", state: "FL", source: "fallback" },
];

function normalizeSchool(row: any): SchoolOption | null {
  const name = row?.["school.name"] ?? row?.school?.name;
  if (!name) return null;
  return {
    id: String(row.id ?? `scorecard:${name}`),
    name: String(name),
    city: row?.["school.city"] ?? row?.school?.city ?? undefined,
    state: row?.["school.state"] ?? row?.school?.state ?? undefined,
    url: row?.["school.school_url"] ?? row?.school?.school_url ?? undefined,
    source: "scorecard",
  };
}

function fallbackSearch(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return fallbackSchools
    .filter((school) => `${school.name} ${school.city ?? ""} ${school.state ?? ""}`.toLowerCase().includes(normalized))
    .slice(0, 8);
}

export function formatSchool(school: SchoolOption) {
  const location = [school.city, school.state].filter(Boolean).join(", ");
  return location ? `${school.name} (${location})` : school.name;
}

export async function searchSchools(query: string): Promise<SchoolOption[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const apiKey = import.meta.env.VITE_COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
  const params = new URLSearchParams({
    api_key: apiKey,
    "school.name": normalized,
    "school.operating": "1",
    fields: "id,school.name,school.city,school.state,school.school_url,latest.student.size",
    sort: "latest.student.size:desc",
    per_page: "8",
  });

  try {
    const response = await fetch(`https://api.data.gov/ed/collegescorecard/v1/schools?${params.toString()}`);
    if (!response.ok) throw new Error(`College Scorecard ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body?.results) ? body.results.map(normalizeSchool).filter(Boolean) as SchoolOption[] : [];
    if (rows.length) return rows;
  } catch {
    // Network/API errors fall back to a small starter list so the form remains usable.
  }

  return fallbackSearch(normalized);
}
