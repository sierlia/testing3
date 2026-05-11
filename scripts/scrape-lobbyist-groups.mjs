import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "https://www.opensecrets.org/federal-lobbying/top-spenders";
const OUTPUT = resolve("src/app/data/defaultLobbyistGroups.json");

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

const response = await fetch(SOURCE_URL, {
  headers: {
    "user-agent": "Gavel data refresh script (teacher-controlled simulation defaults)",
  },
});
if (!response.ok) throw new Error(`OpenSecrets request failed: ${response.status} ${response.statusText}`);

const html = await response.text();
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])))
  .filter((cells) => cells.length >= 2);

const groups = rows
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

if (!groups.length) throw new Error("No lobbyist groups were parsed from OpenSecrets.");

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), groups }, null, 2)}\n`);
console.log(`Wrote ${groups.length} lobbyist groups to ${OUTPUT}`);
