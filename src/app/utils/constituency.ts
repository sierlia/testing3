const STATE_TO_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};
const ABBR_TO_STATE = Object.fromEntries(Object.entries(STATE_TO_ABBR).map(([name, abbr]) => [abbr, name])) as Record<string, string>;

function ordinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function formatConstituency(value: string | null | undefined) {
  if (!value) return "N/A";
  const trimmed = value.trim();
  const short = trimmed.match(/^([A-Za-z]{2})-0?(\d{1,2})$/);
  if (short) return `${short[1].toUpperCase()}-${Number(short[2])}`;

  const long = trimmed.match(/^(.+?)'s\s+(\d+)(?:st|nd|rd|th)\s+Congressional District$/i);
  if (long) {
    const stateName = long[1].replace(/\b\w/g, (char) => char.toUpperCase());
    const abbr = STATE_TO_ABBR[stateName];
    if (abbr) return `${abbr}-${Number(long[2])}`;
  }

  const parenthetical = trimmed.match(/\(([A-Za-z]{2})-0?(\d{1,2})\)/);
  if (parenthetical) return `${parenthetical[1].toUpperCase()}-${Number(parenthetical[2])}`;
  return trimmed;
}

export function normalizeConstituencyId(value: string | null | undefined) {
  if (!value) return null;
  const short = formatConstituency(value).match(/^([A-Za-z]{2})-(\d{1,2})$/);
  if (!short) return value.trim().toLowerCase();
  return `${short[1].toLowerCase()}-${short[2].padStart(2, "0")}`;
}

export function formatConstituencyFull(value: string | null | undefined) {
  const shortValue = formatConstituency(value);
  const match = shortValue.match(/^([A-Z]{2})-(\d{1,2})$/);
  if (!match) return shortValue;
  const stateName = ABBR_TO_STATE[match[1]];
  if (!stateName) return shortValue;
  const district = Number(match[2]);
  return `${stateName}'s ${district}${ordinalSuffix(district)} District (${shortValue})`;
}
