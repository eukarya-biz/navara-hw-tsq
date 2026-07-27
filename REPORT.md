# Assignment Report — 3D Hiking Replay

> The assignment values the learning process and insights over completeness.
> This is a scaffold — fill the TODOs with your own observations before submitting.

## What I made

A 3D map that replays my own GPS hiking logs at true recorded speed over
photorealistic terrain. Each log carries per-point timestamps, so the marker moves
at the pace I actually walked — slow on climbs, quick on descents, paused at rests.
Multiple hikes are selectable from a dropdown.

Live: TODO (GitHub Pages URL once IT enables Pages)

## Why this theme

I already had a corpus of GPS logs from a previous assignment (hiking logs uploaded to
Re:Earth CMS). This reuses that dataset and asks a different question: what do these
routes look like as motion over real 3D terrain, rather than flat lines on a 2D map.

## How it's built

- Photoreal base scene (Navara `DefaultPlugin` + Re:Earth terrain + EOX Sentinel-2).
- Track is a ground-clamped polyline (`vector` layer, `polyline.clampToGround`) built from
  lon/lat only, so it drapes on the DEM at every LOD and needs no elevation or geoid.
- Marker is a `SphereMeshDesc` moved each frame; its height comes from `sampleTerrainHeight`,
  so it rides the terrain surface. The camera target uses the same sampled height.
- Playback maps scaled wall-clock time onto the logs' unix timestamps and interpolates.
- Tracks are provisioned same-origin into `public/data/` by `scripts/fetch-tracks.mjs` (CI +
  local, gitignored), which also writes a `tracks.json` manifest. A dropdown lists the
  built-in hikes; a URL box takes any relative path or full URL.

## What went well

- TODO (e.g. `clampToGround` polyline drapes the route on terrain from lon/lat alone — no height or geoid needed)
- TODO
- TODO

## What was hard / confusing

- TODO (e.g. which transform mode to use for the marker; camera-follow behavior; anything under-documented)
- TODO

## Product feedback for the Navara team

- The built-in controller's zoom is scroll-wheel/pinch only, with no configurable binding, so a scroll-less three-button mouse can't zoom at all. CesiumJS's default controls avoid this (e.g. right-drag zoom), so this feels like a gap rather than a design choice.
- TODO (concrete friction points, missing docs, API surprises — this is the part the team wants most)
- TODO

## If I had more time

- TODO (e.g. two-tone traveled vs upcoming route, photo/weather waypoint popups, a walking GLTF marker, multi-log compare)
