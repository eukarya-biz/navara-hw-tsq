// Provision named peak points into public/data/peaks.geojson from OpenStreetMap via Overpass.
// natural=peak is community-mapped and far more complete than GSI's curated mountain-name
// annotations — it covers small local summits (e.g. Numazu Alps ridge) GSI omits.
//
// The Overpass query is slow (nationwide scan), so unlike the other provisioning scripts this
// file IS committed to git as a cache (see .gitignore) and only re-fetched when deleted. The
// tileset itself (public/data/peaks/) is still rebuilt from it on every build.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

if (existsSync("public/data/peaks.geojson")) {
  console.log("peaks: cached");
  process.exit(0);
}

const JAPAN_BBOX = "24.0,122.0,46.0,146.5"; // south,west,north,east
const QUERY = `[out:json][timeout:180];\nnode["natural"="peak"](${JAPAN_BBOX});\nout body;`;

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": "navara-hw peak-label provisioning (https://github.com/eukarya-biz/navara-hw-tsq)",
  },
  body: `data=${encodeURIComponent(QUERY)}`,
});
if (!res.ok) throw new Error(`overpass: ${res.status} ${res.statusText}`);
const { elements } = await res.json();

const features = [];
for (const el of elements) {
  const name = el.tags?.["name:ja"] ?? el.tags?.name;
  if (!name) continue;
  features.push({
    type: "Feature",
    properties: { name },
    geometry: { type: "Point", coordinates: [el.lon, el.lat] },
  });
}

await mkdir("public/data", { recursive: true });
await writeFile("public/data/peaks.geojson", JSON.stringify({ type: "FeatureCollection", features }));
console.log(`peaks: ${features.length} named summits fetched from OSM`);
