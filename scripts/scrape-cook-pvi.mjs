import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "https://www.cookpolitical.com/cook-pvi/2025-partisan-voting-index/district-map-and-list";
const OUTPUT = resolve("src/app/data/cookPviDistricts.json");
const STRICT = process.env.SCRAPER_STRICT === "1";

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

function normalizeDistrict(value) {
  const text = value.replace(/\s+/g, " ").trim();
  const match = text.match(/\b([A-Z]{2})[-\s]?(\d{1,2}|AL)\b/i);
  if (!match) return null;
  const district = match[2].toUpperCase() === "AL" ? "AL" : match[2].padStart(2, "0");
  return `${match[1].toUpperCase()}-${district}`;
}

async function fetchCookPvi() {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 GavelDataRefresh/1.0",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    referer: "https://www.cookpolitical.com/",
  };
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, { headers });
      if (response.ok) return response.text();
      lastError = new Error(`Cook PVI request failed: ${response.status} ${response.statusText}`);
      if (response.status === 403 || response.status === 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
  }
  throw lastError ?? new Error("Cook PVI request failed");
}

async function writeDistricts(districts, metadata = {}) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `${JSON.stringify({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), districts, ...metadata }, null, 2)}\n`,
  );
  console.log(`Wrote ${districts.length} Cook PVI rows to ${OUTPUT}`);
}

let districts = [];
let metadata = { scrapeStatus: "live" };
let html = "";
try {
  html = await fetchCookPvi();
} catch (error) {
  if (STRICT) throw error;
  console.warn(`${error.message}. Writing an empty Cook PVI defaults file so the workflow can continue.`);
  metadata = {
    scrapeStatus: "blocked",
    scrapeError: error.message,
    fallbackNote: "Live Cook Political Report scraping was blocked; no Cook PVI defaults were refreshed.",
  };
}

const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])))
  .filter((cells) => cells.length >= 2);

if (html) {
  districts = rows
    .map((cells) => {
      const districtCell = cells.find((cell) => normalizeDistrict(cell));
      const district = districtCell ? normalizeDistrict(districtCell) : null;
      const pvi = cells.find((cell) => /\b(?:EVEN|[DR]\+\d+)\b/i.test(cell))?.toUpperCase() ?? null;
      if (!district || !pvi) return null;
      return {
        district,
        cookPvi: pvi,
        description: cells.filter((cell) => cell !== districtCell && cell !== pvi).join(" | "),
        source: SOURCE_URL,
      };
    })
    .filter(Boolean);
}

if (html && !districts.length) {
  const error = new Error("No Cook PVI district rows were parsed.");
  if (STRICT) throw error;
  console.warn(`${error.message} Writing an empty Cook PVI defaults file so the workflow can continue.`);
  metadata = {
    scrapeStatus: "fallback",
    scrapeError: error.message,
    fallbackNote: "Live Cook Political Report parsing produced no rows; no Cook PVI defaults were refreshed.",
  };
}

await writeDistricts(districts, metadata);
