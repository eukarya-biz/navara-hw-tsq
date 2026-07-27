import ThreeView, { Color, geodeticToVector3, degreeToRadian } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";
import { TubeMeshDesc, SphereMeshDesc } from "@navara/three_default_descs";
import { loadTrack } from "./data";
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

const imagery = view.addSource({
  type: "raster-tile",
  url:
    "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default" +
    "&tilematrixset=g&Service=WMTS&Request=GetTile" +
    "&Version=1.0.0&Format=image%2Fjpeg" +
    "&TileMatrix={z}&TileCol={x}&TileRow={y}",
  maxZoom: 15,
});
view.addLayer({ type: "raster", source: imagery });

view.attribution?.add([
  { attribution: "© Re:Earth Terrain", attributionUrl: "https://terrain.reearth.land/" },
  {
    attributionHtml:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
  },
]);

// One static track tube (hike 260719), drawn at real GPS elevation over the terrain.
const points = await loadTrack("260719");
view.addMesh<TubeMeshDesc>({
  tube: {
    points: points.map((p) =>
      geodeticToVector3({ lng: degreeToRadian(p.lng), lat: degreeToRadian(p.lat), height: p.ele }),
    ),
    tubularSegments: Math.min(6000, Math.max(64, points.length)),
    radius: 18,
    radialSegments: 6,
    tension: 0.5,
    color: new Color().setHex(0xff5a3c),
    emissiveColor: new Color().setHex(0xff5a3c),
    emissiveIntensity: 0.25,
  },
});

const ecef = (lng: number, lat: number, ele: number) =>
  geodeticToVector3({ lng: degreeToRadian(lng), lat: degreeToRadian(lat), height: ele });

// Marker at the start.
const marker = view.addMesh<SphereMeshDesc>({
  sphere: {
    radius: 40,
    color: new Color().setHex(0xffe14a),
    emissiveColor: new Color().setHex(0xffe14a),
    emissiveIntensity: 0.8,
  },
  position: ecef(points[0].lng, points[0].lat, points[0].ele),
});

const playback = new Playback(points);

// Self-owned orbit camera. We hold the orbit state ourselves (azimuth, elevation,
// distance) and every frame place the camera relative to the LIVE marker position via
// lookAt(target, enuOffset). Because the target is re-read each frame, following the
// moving marker and free user rotation are the same thing — no separate follow mode,
// no fighting with a built-in controller (which we disabled above).
const DEG = Math.PI / 180;
const orbit = { azimuth: 0, elevation: 30 * DEG, distance: 1800 };
const MIN_EL = 2 * DEG, MAX_EL = 85 * DEG;
const MIN_DIST = 60, MAX_DIST = 20000;

function place() {
  const s = playback.sample();
  const r = orbit.distance * Math.cos(orbit.elevation);
  view.lookAt(
    { lng: s.lng, lat: s.lat, height: s.ele },
    {
      x: r * Math.sin(orbit.azimuth), // east
      y: r * Math.cos(orbit.azimuth), // north
      z: orbit.distance * Math.sin(orbit.elevation), // up
    } as any,
  );
}

let last = performance.now();
function tick(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (playback.isPlaying) {
    const s = playback.advance(dt, 120);
    marker.update({ position: ecef(s.lng, s.lat, s.ele) });
  }
  place();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

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
  if (e.key === "+" || e.key === "=") zoom(0.8);
  else if (e.key === "-" || e.key === "_") zoom(1.25);
});

playback.play();
