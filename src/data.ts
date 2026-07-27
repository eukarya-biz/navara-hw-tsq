// Loads a hiking track directly from a CSV URL, in the browser.
//   rows: `lat lon [ele] t`  (whitespace-separated; ele optional; t = unix seconds)
// Heights are ignored for 3D placement (the route drapes on the DEM), so a lon/lat-only
// log works too. `ele`, when present, is kept only for the elevation profile chart.

export type TrackPoint = { lat: number; lng: number; ele?: number; t: number };
export type Hike = { id: string; title: string; path: string };

const rows = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

// The built-in hikes, provisioned same-origin by scripts/fetch-tracks.mjs.
export async function loadCatalog(): Promise<Hike[]> {
  const res = await fetch(import.meta.env.BASE_URL + "data/tracks.json");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function loadTrack(url: string): Promise<TrackPoint[]> {
  // Relative paths resolve against the Vite base so they work under a Pages subpath;
  // absolute URLs pass through unchanged.
  const target = /^https?:\/\//.test(url) ? url : import.meta.env.BASE_URL + url;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return rows(await res.text()).map((r) => {
    const p = r.split(/\s+/).map(Number);
    return p.length >= 4
      ? { lat: p[0], lng: p[1], ele: p[2], t: p[3] }
      : { lat: p[0], lng: p[1], t: p[2] };
  });
}
