import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "static-teacher-defaults";
const OUTPUT = resolve("src/app/data/defaultLobbyistGroups.json");

const DEFAULT_GROUPS = [
  "US Chamber of Commerce",
  "National Assn of Realtors",
  "Pharmaceutical Research & Manufacturers of America",
  "General Motors",
  "American Medical Assn",
  "Blue Cross/Blue Shield",
  "Business Roundtable",
  "American Hospital Assn",
  "CTIA",
  "Meta",
  "America's Health Insurance Plans",
  "Amazon.com",
  "Pfizer Inc",
  "RTX Corp",
  "Merck & Co",
  "Lockheed Martin",
  "Alphabet Inc",
  "Novartis AG",
  "Roche Holdings",
  "AARP",
].map((name) => ({
  name,
  defaultStartingMoney: 0,
  source: SOURCE_URL,
}));

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  `${JSON.stringify({ source: SOURCE_URL, groups: DEFAULT_GROUPS }, null, 2)}\n`,
);
console.log(`Wrote ${DEFAULT_GROUPS.length} static lobbyist groups to ${OUTPUT}`);
