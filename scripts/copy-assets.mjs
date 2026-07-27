// Provisions the engine's runtime assets (atmosphere/cloud/noise/water) that @navara/three
// loads at runtime but that live inside the installed package rather than our source tree.
// Runs before dev/build (see package.json). Output is git-ignored — never committed as blobs.
//
// The engine requests these relative to its own JS chunk, which in the build lands at
// dist/assets/, so the files must end up at dist/assets/assets/<dir>/… . public/ is copied
// verbatim into dist/, hence the public/assets/assets/ destination.
import { createRequire } from "node:module";
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("@navara/three/package.json")), "dist", "assets");
const dest = join("public", "assets", "assets");

rmSync(dest, { recursive: true, force: true });
for (const dir of ["atmosphere", "cloud", "noise", "water"]) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log(`copied engine assets -> ${dest}`);
