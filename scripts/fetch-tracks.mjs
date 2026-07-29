// Provision hiking tracks into public/data/ (gitignored) so the app loads them same-origin.
// Runs in CI and locally via the predev/prebuild hooks. No conversion: heights pass through
// untouched (the app drapes the route on the DEM and ignores z). Skips already-cached CSVs.
// Also writes data/tracks.json (id + title + path) that the app's dropdown reads.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

// A varied set: Fuji, ridge climbs, a gorge, an island loop, a coast walk.
const HIKES = ["260719", "260412", "260506", "260530", "260509", "260425"];
const BASE = "https://6e5d.com/hiking";

// visited.csv rows: `lat lon id title ascent descent` (title is a single token).
const titles = new Map();
for (const line of (await (await fetch(`${BASE}/visited.csv`)).text()).split("\n")) {
  const p = line.trim().split(/\s+/);
  if (p[2]) titles.set(p[2], p[3] ?? p[2]);
}

const manifest = [];
for (const id of HIKES) {
  const dest = `public/data/${id}/route.csv`;
  if (existsSync(dest)) {
    console.log(`${id}: cached`);
  } else {
    const res = await fetch(`${BASE}/${id}/route.csv`);
    if (!res.ok) throw new Error(`${id}: ${res.status} ${res.statusText}`);
    await mkdir(`public/data/${id}`, { recursive: true });
    await writeFile(dest, await res.text());
    console.log(`${id}: fetched`);
  }
  manifest.push({ id, title: titles.get(id) ?? id, path: `data/${id}/route.csv` });
}

await writeFile("public/data/tracks.json", JSON.stringify(manifest, null, 2));
console.log(`manifest: ${manifest.length} tracks`);
