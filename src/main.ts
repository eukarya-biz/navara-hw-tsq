import ThreeView, { Color, geodeticToVector3, degreeToRadian } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";
import { SphereMeshDesc } from "@navara/three_default_descs";
import { loadTrack, loadCatalog, type TrackPoint } from "./data";
import { Playback } from "./playback";

// Photoreal base scene with a self-owned orbit camera that follows the playback marker.

const view = new ThreeView<DefaultDescriptions>({ shadow: true });
const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
await view.init();

defaultPlugin.addDefaultPhotorealScene();
view.toneMappingExposure = 10;

// We own the camera fully (see the orbit controller below), so the built-in
// gesture controller stays off — otherwise both drive the camera and fight.
view.camera.options = {
  enableSpin: false,
  enableZoom: false,
  enableTilt: false,
  autoAdjustNearFar: true,
};

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
  requestWaterMask: true,
});
view.addLayer({ type: "terrain", source: terrain, terrain: { castShadow: true, receiveShadow: true } });

// Esri World Imagery instead of EOX Sentinel-2: the latter is ~10m/px native resolution
// and looks blocky/blurry once the camera closes in on the trail, since raising maxZoom
// only upsamples the same coarse tiles. Esri's source imagery is much finer at close zoom.
const imagery = view.addSource({
  type: "raster-tile",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maxZoom: 19,
});
view.addLayer({ type: "raster", source: imagery });

view.attribution?.add([
  { attribution: "© Re:Earth Terrain", attributionUrl: "https://terrain.reearth.land/" },
  {
    attribution: "© Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    attributionUrl: "https://www.esri.com/",
  },
  {
    attribution: "Peak names © OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
]);

// Peak name labels. GSI's official vector tiles only carry a sparse, curated set of
// mountain names (misses most local summits, e.g. the whole Numazu Alps ridge), so this
// is provisioned from OpenStreetMap natural=peak nodes instead (see scripts/fetch-peaks.mjs
// + scripts/build-peak-tiles.mjs) — community-mapped and far more complete.
const peakLabels = view.addSource({
  type: "vector-tile",
  url: "data/peaks/{z}/{x}/{y}.pbf",
  maxZoom: 12,
});
const peakLabelLayer = view.addLayer({
  type: "vector",
  source: peakLabels,
  sourceLayers: ["peaks"],
  text: {
    lang: "ja",
    font: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-700-normal.woff2",
    color: new Color().setStyle("#ffffff"),
    outlineColor: new Color().setStyle("#000000"),
    outlineWidth: 2,
    sizeInMeters: true, // scale perspectively with distance, so far peaks don't read as large/near ones
    size: 70,
    clampToGround: true,
    offsetDepth: true, // avoid the label z-fighting into the DEM at the summit
    depthTest: true, // let closer terrain/peaks occlude farther labels instead of blending on top
    center: { x: 0.5, y: 0 },
  },
});
const shownPeaks = new Set<bigint>();
peakLabelLayer.on("featureUpdated", ({ evaluator }) => {
  if (shownPeaks.has(evaluator.id)) return;
  shownPeaks.add(evaluator.id);
  evaluator.evaluate(
    ({ properties }) => {
      const name = properties?.["name"] as string | undefined;
      return name ? { text: name, show: true } : { text: "", show: false };
    },
    { filters: ["name"] },
  );
});

const ecef = (lng: number, lat: number, height: number) =>
  geodeticToVector3({ lng: degreeToRadian(lng), lat: degreeToRadian(lat), height });

// Terrain height (ellipsoidal, meters) at a lng/lat in degrees. Returns undefined until
// the covering terrain tile is resident, so we hold the last good value to avoid jumps.
let lastHeight = 0;
function sampleHeight(lng: number, lat: number): number {
  const h = view.sampleTerrainHeight({ lng: degreeToRadian(lng), lat: degreeToRadian(lat), height: 0 });
  if (typeof h === "number" && isFinite(h)) lastHeight = h;
  return lastHeight;
}

// Track state — reassigned by load(). The route is a ground-clamped polyline (lng/lat
// only), so no elevation or geoid conversion is needed; it drapes on the DEM at every LOD.
let points: TrackPoint[] = [];
let playback = new Playback(points);
let speed = 120; // hike seconds advanced per real second; editable via the tape control
let routeSource: ReturnType<typeof view.addSource> | undefined;
let marker: ReturnType<typeof view.addMesh<SphereMeshDesc>> | undefined;

const routeGeoJson = (pts: TrackPoint[]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: pts.map((p) => [p.lng, p.lat]) },
});

async function load(url: string) {
  const pts = await loadTrack(url);
  if (!pts.length) throw new Error("empty track");
  points = pts;
  playback = new Playback(pts);

  if (!routeSource) {
    routeSource = view.addSource({ type: "geojson", data: routeGeoJson(pts) });
    view.addLayer({
      type: "vector",
      source: routeSource,
      polyline: { color: new Color().setHex(0xff5a3c), width: 4, clampToGround: true },
    });
  } else {
    routeSource.update({ data: routeGeoJson(pts) });
  }

  if (!marker) {
    marker = view.addMesh<SphereMeshDesc>({
      sphere: {
        radius: 40,
        color: new Color().setHex(0xffe14a),
        emissiveColor: new Color().setHex(0xffe14a),
        emissiveIntensity: 0.8,
      },
      position: ecef(pts[0].lng, pts[0].lat, sampleHeight(pts[0].lng, pts[0].lat)),
    });
  }

  // Light the scene with the real time of day this hike happened. GPS timestamps are UTC
  // unix seconds and a Date is an absolute instant, so the sun's ECEF direction comes out
  // correct without any timezone handling. The photoreal scene's sun light follows it.
  sunMinute = -1;
  view.atmosphere.date = new Date(pts[0].t * 1000);
  setElevation(pts);
  resetOrbit();
}

// Self-owned orbit camera. We hold the orbit state ourselves (azimuth, elevation,
// distance) and every frame place the camera relative to the LIVE marker position via
// lookAt(target, enuOffset). Because the target is re-read each frame, following the
// moving marker and free user rotation are the same thing — no separate follow mode,
// no fighting with a built-in controller (which we disabled above).
const DEG = Math.PI / 180;
const orbit = { azimuth: 0, elevation: 30 * DEG, distance: 1800 };
const MIN_EL = 2 * DEG, MAX_EL = 85 * DEG;
const MIN_DIST = 60, MAX_DIST = 20000;
const resetOrbit = () => Object.assign(orbit, { azimuth: 0, elevation: 30 * DEG, distance: 1800 });

function place(lng: number, lat: number, height: number) {
  const r = orbit.distance * Math.cos(orbit.elevation);
  view.lookAt(
    { lng, lat, height },
    {
      x: r * Math.sin(orbit.azimuth), // east
      y: r * Math.cos(orbit.azimuth), // north
      z: orbit.distance * Math.sin(orbit.elevation), // up
    } as any,
  );
}

// Advance the sun to the hike's current time so shadows shift over the replay. Throttled
// to whole-minute changes of hike time; the sun barely moves within a minute and each set
// recomputes the atmosphere.
let sunMinute = -1;
function updateSun(trackTime: number) {
  const minute = Math.floor((points[0].t + trackTime) / 60);
  if (minute === sunMinute) return;
  sunMinute = minute;
  view.atmosphere.date = new Date(minute * 60 * 1000);
}

let last = performance.now();
function tick(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  // Advance time only while playing, but always render the current sample so that a
  // seek while paused still moves the marker, sun, and camera on the next frame.
  if (playback.isPlaying) playback.advance(dt, speed);
  const s = playback.sample();
  const h = sampleHeight(s.lng, s.lat); // drape the marker + camera target on the DEM
  marker?.update({ position: ecef(s.lng, s.lat, h) });
  updateSun(s.trackTime);
  place(s.lng, s.lat, h);
  updateTape();
  requestAnimationFrame(tick);
}

// Mouse drag orbits; wheel and buttons/keys zoom. All feed the same orbit state.
const canvas = document.getElementById("navara-canvas")!;
let dragging = false, px = 0, py = 0;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true; px = e.clientX; py = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  orbit.azimuth += (e.clientX - px) * 0.005;
  orbit.elevation = Math.min(MAX_EL, Math.max(MIN_EL, orbit.elevation + (e.clientY - py) * 0.005));
  px = e.clientX; py = e.clientY;
});

function zoom(factor: number) {
  orbit.distance = Math.min(MAX_DIST, Math.max(MIN_DIST, orbit.distance * factor));
}
canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
document.getElementById("zoomin")!.addEventListener("click", () => zoom(0.8));
document.getElementById("zoomout")!.addEventListener("click", () => zoom(1.25));
document.getElementById("reset")!.addEventListener("click", () => {
  orbit.azimuth = 0; orbit.elevation = 30 * DEG; orbit.distance = 1800;
});
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return; // don't hijack typing in the URL/speed fields
  if (e.key === "+" || e.key === "=") zoom(0.8);
  else if (e.key === "-" || e.key === "_") zoom(1.25);
  else if (e.key === " ") {
    e.preventDefault();
    togglePlay();
  }
});

// --- Tape controller (bottom bar): transport, speed, elevation scrub. ---

const scrub = document.getElementById("scrub")!;
const played = document.getElementById("played")!;
const clock = document.getElementById("clock")!;
const playBtn = document.getElementById("playpause")!;

// Semitransparent elevation profile behind the scrub bar: an area chart of the recorded
// elevation over track time, stretched to fill the bar. Skipped for lon/lat-only logs.
function setElevation(pts: TrackPoint[]) {
  scrub.querySelector("svg")?.remove();
  if (!pts.every((p) => typeof p.ele === "number")) return;
  const t0 = pts[0].t;
  const span = pts[pts.length - 1].t - t0 || 1;
  let min = Infinity, max = -Infinity;
  for (const p of pts) { min = Math.min(min, p.ele!); max = Math.max(max, p.ele!); }
  const rng = max - min || 1;
  const xy = pts.map((p) => `${((p.t - t0) / span) * 100},${100 - ((p.ele! - min) / rng) * 100}`);
  scrub.insertAdjacentHTML(
    "afterbegin",
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` +
      `<polygon points="0,100 ${xy.join(" ")} 100,100" fill="#7cc6ff" />` +
      `<polyline points="${xy.join(" ")}" fill="none" stroke="#cde8ff" stroke-width="1" vector-effect="non-scaling-stroke" />` +
      `</svg>`,
  );
}

function togglePlay() {
  playback.isPlaying ? playback.pause() : playback.play();
}
playBtn.addEventListener("click", togglePlay);
document.getElementById("start")!.addEventListener("click", () => playback.seek(0));
document.getElementById("end")!.addEventListener("click", () => playback.seek(playback.duration));

const speedInput = document.getElementById("speed") as HTMLInputElement;
speedInput.addEventListener("change", () => {
  const v = parseFloat(speedInput.value);
  if (v > 0) speed = v;
  else speedInput.value = String(speed);
});

// Click anywhere on the bar to seek to that fraction of the hike.
scrub.addEventListener("click", (e) => {
  const r = scrub.getBoundingClientRect();
  playback.seek(((e.clientX - r.left) / r.width) * playback.duration);
});

const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function updateTape() {
  const frac = playback.duration > 0 ? playback.currentTime / playback.duration : 0;
  played.style.width = `${frac * 100}%`;
  playBtn.textContent = playback.isPlaying ? "⏸" : "▶";
  clock.textContent = jstFormatter.format(new Date((points[0].t + playback.currentTime) * 1000));
}

// --- Track source: load any CSV URL (defaults to a Fuji hike). ---

const urlInput = document.getElementById("url") as HTMLInputElement;
async function loadFrom(url: string) {
  try {
    await load(url.trim());
  } catch (err) {
    // Most likely a bad URL or a CORS-blocked host (the CSV is fetched from the browser).
    alert(`Could not load track:\n${(err as Error).message}`);
  }
}
document.getElementById("loadbtn")!.addEventListener("click", () => loadFrom(urlInput.value));
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadFrom(urlInput.value);
});

// Populate the built-in dropdown from the provisioned manifest; selecting one loads it.
const trackSelect = document.getElementById("track") as HTMLSelectElement;
try {
  for (const h of await loadCatalog()) {
    trackSelect.add(new Option(h.title, h.path));
  }
  trackSelect.value = urlInput.value; // preselect the default hike
} catch {
  trackSelect.hidden = true; // manifest missing (not provisioned) — the URL box still works
}
trackSelect.addEventListener("change", () => {
  urlInput.value = trackSelect.value;
  loadFrom(trackSelect.value);
});

// Initial load, then start the render loop. Playback stays paused until the user presses
// Space or Play, by which point the first frame and terrain around the start are up.
await loadFrom(urlInput.value);
requestAnimationFrame(tick);
updateTape();
