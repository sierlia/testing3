import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "https://www.opensecrets.org/federal-lobbying/top-spenders";
const FALLBACK_SOURCE_URL = "https://www.statistico.com/s/us-leading-lobbying-clients-by-expenditure";
const OUTPUT = resolve("src/app/data/defaultLobbyistGroups.json");
const STRICT = process.env.SCRAPER_STRICT === "1";

// OpenSecrets blocks some automated hosts, including GitHub Actions runners,
// with 403 responses. Keep the workflow useful by falling back to a compact
// OpenSecrets-sourced seed list when live scraping is denied.
const FALLBACK_GROUPS = [
  ["US Chamber of Commerce", 69.58],
  ["National Assn of Realtors", 52.4],
  ["American Hospital Assn", 30.24],
  ["Blue Cross/Blue Shield", 28.59],
  ["Pharmaceutical Research & Manufacturers of America", 27.63],
  ["American Medical Assn", 21.22],
  ["Amazon.com", 19.84],
  ["Business Roundtable", 19.74],
  ["Meta", 19.3],
  ["CTIA", 17.18],
  ["AARP", 16.52],
  ["American Chemistry Council", 15.8],
  ["Pharmaceutical Care Management Assn", 15.43],
  ["NCTA The Internet & Television Assn", 14.56],
  ["Boeing Co", 14.49],
  ["General Motors", 14.42],
  ["Pfizer Inc", 14.36],
  ["Alphabet Inc", 14.36],
  ["Amgen Inc", 14.29],
  ["Lockheed Martin", 14.07],
].map(([name, millions]) => ({
  name,
  defaultStartingMoney: Math.round(Number(millions) * 1_000_000),
  source: SOURCE_URL,
}));

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function amountFromText(value) {
  const match = value.replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

async function fetchOpenSecrets() {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 GavelDataRefresh/1.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    referer: "https://www.opensecrets.org/",
  };
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, { headers });
      if (response.ok) return response.text();
      lastError = new Error(`OpenSecrets request failed: ${response.status} ${response.statusText}`);
      if (response.status === 403 || response.status === 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
  }
  throw lastError ?? new Error("OpenSecrets request failed");
}

async function writeGroups(groups, metadata = {}) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `${JSON.stringify({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), groups, ...metadata }, null, 2)}\n`,
  );
  console.log(`Wrote ${groups.length} lobbyist groups to ${OUTPUT}`);
}

let groups = [];
let metadata = { scrapeStatus: "live" };
let html = "";
try {
  html = await fetchOpenSecrets();
} catch (error) {
  if (STRICT) throw error;
  console.warn(`${error.message}. Writing fallback lobbyist group defaults instead.`);
  groups = FALLBACK_GROUPS;
  metadata = {
    scrapeStatus: "fallback",
    scrapeError: error.message,
    fallbackSource: FALLBACK_SOURCE_URL,
    fallbackNote: "Live OpenSecrets scraping was blocked; fallback values are OpenSecrets-sourced 2023 leading lobbying clients in USD.",
  };
}

if (!groups.length) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])))
    .filter((cells) => cells.length >= 2);

  groups = rows
    .map((cells) => {
      const name = cells.find((cell) => cell && !/^(rank|total|amount|client|organization)$/i.test(cell) && !/^\d+$/.test(cell));
      const spending = amountFromText(cells.find((cell) => /\$/.test(cell)) ?? "");
      if (!name || !spending) return null;
      return {
        name,
        defaultStartingMoney: spending,
        source: SOURCE_URL,
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

if (!groups.length) {
  const error = new Error("No lobbyist groups were parsed from OpenSecrets.");
  if (STRICT) throw error;
  console.warn(`${error.message} Writing fallback lobbyist group defaults instead.`);
  groups = FALLBACK_GROUPS;
  metadata = {
    scrapeStatus: "fallback",
    scrapeError: error.message,
    fallbackSource: FALLBACK_SOURCE_URL,
    fallbackNote: "Live OpenSecrets parsing produced no rows; fallback values are OpenSecrets-sourced 2023 leading lobbying clients in USD.",
  };
}

await writeGroups(groups, metadata);
