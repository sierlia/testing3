import fs from 'node:fs/promises';

const districts = ["California's 22nd congressional district", "New York's 12th congressional district"];
const out = [];
for (const title of districts) {
  const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const r = await fetch(api);
    const j = await r.json();
    out.push({
    name: title,
    wikipedia_url: j.content_urls?.desktop?.page ?? '',
    extract: j.extract ?? '',
    cook_pvi: 'N/A',
    population: null,
    });
  } catch {
    out.push({ name: title, wikipedia_url: '', extract: '', cook_pvi: 'N/A', population: null });
  }
}
await fs.mkdir('src/app/data', { recursive: true });
await fs.writeFile('src/app/data/constituencies.json', JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} constituencies`);
