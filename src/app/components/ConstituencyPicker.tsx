import { useMemo, useState } from "react";
import { Search, MapPin, Check, ExternalLink } from "lucide-react";
import { normalizeConstituencyId } from "../utils/constituency";

export interface Constituency {
  id: string;
  name: string;
  code: string;
  pvi: string;
  wikipediaUrl: string;
}

interface ConstituencyPickerProps {
  selected: string | null;
  onSelect: (constituency: string) => void;
  unavailableIds?: string[];
}

function hashStringToUnitInterval(input: string): number {
  // Simple deterministic hash -> [0,1)
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 2 ** 32;
}

// Helper function to generate dummy districts
function generateDummyDistricts(): Constituency[] {
  const states = [
    { name: "Alaska", abbr: "AK", count: 1 },
    { name: "Arizona", abbr: "AZ", count: 9 },
    { name: "Arkansas", abbr: "AR", count: 4 },
    { name: "California", abbr: "CA", count: 52 },
    { name: "Colorado", abbr: "CO", count: 8 },
    { name: "Connecticut", abbr: "CT", count: 5 },
    { name: "Delaware", abbr: "DE", count: 1 },
    { name: "Florida", abbr: "FL", count: 28 },
    { name: "Georgia", abbr: "GA", count: 14 },
    { name: "Hawaii", abbr: "HI", count: 2 },
    { name: "Idaho", abbr: "ID", count: 2 },
    { name: "Illinois", abbr: "IL", count: 17 },
    { name: "Indiana", abbr: "IN", count: 9 },
    { name: "Iowa", abbr: "IA", count: 4 },
    { name: "Kansas", abbr: "KS", count: 4 },
    { name: "Kentucky", abbr: "KY", count: 6 },
    { name: "Louisiana", abbr: "LA", count: 6 },
    { name: "Maine", abbr: "ME", count: 2 },
    { name: "Maryland", abbr: "MD", count: 8 },
    { name: "Massachusetts", abbr: "MA", count: 9 },
    { name: "Michigan", abbr: "MI", count: 13 },
    { name: "Minnesota", abbr: "MN", count: 8 },
    { name: "Mississippi", abbr: "MS", count: 4 },
    { name: "Missouri", abbr: "MO", count: 8 },
    { name: "Montana", abbr: "MT", count: 2 },
    { name: "Nebraska", abbr: "NE", count: 3 },
    { name: "Nevada", abbr: "NV", count: 4 },
    { name: "New Hampshire", abbr: "NH", count: 2 },
    { name: "New Jersey", abbr: "NJ", count: 12 },
    { name: "New Mexico", abbr: "NM", count: 3 },
    { name: "New York", abbr: "NY", count: 26 },
    { name: "North Carolina", abbr: "NC", count: 14 },
    { name: "North Dakota", abbr: "ND", count: 1 },
    { name: "Ohio", abbr: "OH", count: 15 },
    { name: "Oklahoma", abbr: "OK", count: 5 },
    { name: "Oregon", abbr: "OR", count: 6 },
    { name: "Pennsylvania", abbr: "PA", count: 17 },
    { name: "Rhode Island", abbr: "RI", count: 2 },
    { name: "South Carolina", abbr: "SC", count: 7 },
    { name: "South Dakota", abbr: "SD", count: 1 },
    { name: "Tennessee", abbr: "TN", count: 9 },
    { name: "Texas", abbr: "TX", count: 38 },
    { name: "Utah", abbr: "UT", count: 4 },
    { name: "Vermont", abbr: "VT", count: 1 },
    { name: "Virginia", abbr: "VA", count: 11 },
    { name: "Washington", abbr: "WA", count: 10 },
    { name: "West Virginia", abbr: "WV", count: 2 },
    { name: "Wisconsin", abbr: "WI", count: 8 },
    { name: "Wyoming", abbr: "WY", count: 1 },
  ];

  const pviOptions = [
    "R+35",
    "R+30",
    "R+25",
    "R+20",
    "R+15",
    "R+10",
    "R+5",
    "EVEN",
    "D+5",
    "D+10",
    "D+15",
    "D+20",
    "D+25",
    "D+30",
  ];
  
  const districts: Constituency[] = [];
  
  for (const state of states) {
    for (let i = 1; i <= state.count; i++) {
      const districtNum = i.toString().padStart(2, "0");
      const id = `${state.abbr.toLowerCase()}-${districtNum}`;
      const r = hashStringToUnitInterval(id);
      const randomPVI = pviOptions[Math.floor(r * pviOptions.length)];
      
      districts.push({
        id,
        name: `${state.name}'s ${i}${getOrdinalSuffix(i)} Congressional District`,
        code: `(${state.abbr}-${districtNum})`,
        pvi: randomPVI,
        wikipediaUrl: `https://en.wikipedia.org/wiki/${state.name}%27s_${i}${getOrdinalSuffix(i)}_congressional_district`,
      });
    }
  }
  
  return districts;
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function ConstituencyPicker({
  selected,
  onSelect,
  unavailableIds = [],
}: ConstituencyPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const unavailableSet = useMemo(
    () => new Set(unavailableIds.map((id) => normalizeConstituencyId(id)).filter(Boolean) as string[]),
    [unavailableIds],
  );

  // Alabama districts with real data
  const alabamaDistricts: Constituency[] = [
    {
      id: "al-01",
      name: "Alabama's 1st Congressional District",
      code: "(AL-01)",
      pvi: "R+27",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_1st_congressional_district",
    },
    {
      id: "al-02",
      name: "Alabama's 2nd Congressional District",
      code: "(AL-02)",
      pvi: "D+5",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_2nd_congressional_district",
    },
    {
      id: "al-03",
      name: "Alabama's 3rd Congressional District",
      code: "(AL-03)",
      pvi: "R+23",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_3rd_congressional_district",
    },
    {
      id: "al-04",
      name: "Alabama's 4th Congressional District",
      code: "(AL-04)",
      pvi: "R+33",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_4th_congressional_district",
    },
    {
      id: "al-05",
      name: "Alabama's 5th Congressional District",
      code: "(AL-05)",
      pvi: "R+15",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_5th_congressional_district",
    },
    {
      id: "al-06",
      name: "Alabama's 6th Congressional District",
      code: "(AL-06)",
      pvi: "R+20",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_6th_congressional_district",
    },
    {
      id: "al-07",
      name: "Alabama's 7th Congressional District",
      code: "(AL-07)",
      pvi: "D+13",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_7th_congressional_district",
    },
  ];

  const constituencies = useMemo<Constituency[]>(
    () => [...alabamaDistricts, ...generateDummyDistricts()],
    [],
  );

  const filteredConstituencies = constituencies.filter(
    (constituency) => {
      const query = searchQuery.toLowerCase();
      return (
        constituency.name.toLowerCase().includes(query) ||
        constituency.code.toLowerCase().includes(query) ||
        constituency.pvi.toLowerCase().includes(query)
      );
    },
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Choose Your Constituency
      </h2>
      <p className="text-gray-600 mb-6">
        Select the district you will represent in the simulation
      </p>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search constituencies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Constituency list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {filteredConstituencies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No constituencies found matching "{searchQuery}"
          </div>
        ) : (
          filteredConstituencies.map((constituency) => {
            const isSelected = selected === constituency.id;
            const isUnavailable = !isSelected && unavailableSet.has(normalizeConstituencyId(constituency.id) ?? constituency.id);

            return (
              <button
                key={constituency.id}
                onClick={() => onSelect(constituency.id)}
                disabled={isUnavailable}
                className={`
                  w-full text-left p-4 rounded-lg border-2 transition-all relative
                  ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : isUnavailable
                        ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <MapPin
                        className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-400"}`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {constituency.name} {constituency.code}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        PVI: {constituency.pvi}
                      </p>

                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <a
                      href={constituency.wikipediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Wikipedia
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {isSelected && (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {isUnavailable && (
                      <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function getConstituencyById(id: string | null | undefined) {
  if (!id) return null;

  // Alabama districts with real data
  const alabamaDistricts: Constituency[] = [
    {
      id: "al-01",
      name: "Alabama's 1st Congressional District",
      code: "(AL-01)",
      pvi: "R+14",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_1st_congressional_district",
    },
    {
      id: "al-02",
      name: "Alabama's 2nd Congressional District",
      code: "(AL-02)",
      pvi: "R+12",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_2nd_congressional_district",
    },
    {
      id: "al-03",
      name: "Alabama's 3rd Congressional District",
      code: "(AL-03)",
      pvi: "R+16",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_3rd_congressional_district",
    },
    {
      id: "al-04",
      name: "Alabama's 4th Congressional District",
      code: "(AL-04)",
      pvi: "R+30",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_4th_congressional_district",
    },
    {
      id: "al-05",
      name: "Alabama's 5th Congressional District",
      code: "(AL-05)",
      pvi: "R+18",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_5th_congressional_district",
    },
    {
      id: "al-06",
      name: "Alabama's 6th Congressional District",
      code: "(AL-06)",
      pvi: "R+20",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_6th_congressional_district",
    },
    {
      id: "al-07",
      name: "Alabama's 7th Congressional District",
      code: "(AL-07)",
      pvi: "D+13",
      wikipediaUrl: "https://en.wikipedia.org/wiki/Alabama%27s_7th_congressional_district",
    },
  ];

  const all = [...alabamaDistricts, ...generateDummyDistricts()];
  return all.find((c) => c.id === id) ?? null;
}
