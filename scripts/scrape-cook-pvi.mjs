import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "https://www.cookpolitical.com/cook-pvi/2025-partisan-voting-index/district-map-and-list";
const OUTPUT = resolve("src/app/data/cookPviDistricts.json");

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

const response = await fetch(SOURCE_URL, {
  headers: {
    "user-agent": "Gavel data refresh script (teacher-controlled simulation defaults)",
  },
});
if (!response.ok) throw new Error(`Cook PVI request failed: ${response.status} ${response.statusText}`);

const html = await response.text();
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])))
  .filter((cells) => cells.length >= 2);

const districts = rows
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

if (!districts.length) throw new Error("No Cook PVI district rows were parsed.");

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), districts }, null, 2)}\n`);
console.log(`Wrote ${districts.length} Cook PVI rows to ${OUTPUT}`);
