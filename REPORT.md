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
- Track drawn with `SmoothLineMeshDesc` from raw `{lng, lat, height}` GPS points.
- Marker is a `SphereMeshDesc` at an ECEF position, moved every animation frame.
- Playback maps scaled wall-clock time onto the logs' unix timestamps and interpolates.

## What went well

- TODO (e.g. feeding lng/lat/height straight into SmoothLine — no ECEF math needed for the track)
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

- TODO (e.g. growing "traveled" trail, elevation profile chart, photo/weather waypoint popups, more logs)
