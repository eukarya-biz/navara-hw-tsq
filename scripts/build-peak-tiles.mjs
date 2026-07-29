// Turns public/data/peaks.geojson into an XYZ vector tileset at public/data/peaks/{z}/{x}/{y}.pbf
// via tippecanoe (must be on PATH; CI installs it via apt, see .github/workflows/deploy.yml).
// Skipped locally when tippecanoe isn't installed — the peak-label layer just won't render.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("public/data/peaks.geojson")) {
  console.log("peak tiles: no peaks.geojson, run fetch-peaks.mjs first");
  process.exit(0);
}
try {
  execSync("tippecanoe --version", { stdio: "ignore" });
} catch {
  console.warn("peak tiles: tippecanoe not found on PATH, skipping tileset generation");
  process.exit(0);
}
// Fixed zoom range, not -zg: peaks are sparse at a national scale, so tippecanoe's density-based
// zoom guess stops around z6 — far short of the z12+ the app requests once zoomed into a hike,
// leaving every deeper tile 404. maxZoom here MUST match (or exceed) the source's maxZoom in
// main.ts.
// --no-tile-compression: tippecanoe gzips .pbf files by default, but these are served as plain
// static files (no Content-Encoding: gzip header), so the browser won't decompress them.
execSync(
  "tippecanoe -f -e public/data/peaks -l peaks -Z0 -z12 --no-tile-compression public/data/peaks.geojson",
  { stdio: "inherit" },
);
console.log("peak tiles: generated public/data/peaks/{z}/{x}/{y}.pbf");
