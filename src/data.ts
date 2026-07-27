// Loads the hiking dataset from public/data/ (prepared by scripts/fetch.py).
//   route.csv rows:  lat lon ellipsoidal-height(m) timestamp(unix-seconds)
//   catalog.txt rows: lat lon yymmdd title ascent descent  (only id + title are used)

export type TrackPoint = { lat: number; lng: number; ele: number; t: number };
export type HikeMeta = { id: string; title: string };

const BASE = import.meta.env.BASE_URL; // respects Vite `base` (works under a Pages subpath)
const rows = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const fetchText = async (path: string) => (await fetch(`${BASE}${path}`)).text();

export async function loadCatalog(): Promise<HikeMeta[]> {
  return rows(await fetchText("data/catalog.txt"))
    .map((r) => r.split(/\s+/))
    .map((p) => ({ id: p[2], title: p.slice(3, -2).join(" ") }))
    .sort((a, b) => b.id.localeCompare(a.id)); // newest first
}

export async function loadTrack(id: string): Promise<TrackPoint[]> {
  return rows(await fetchText(`data/${id}/route.csv`)).map((r) => {
    const [lat, lng, ele, t] = r.split(/\s+/).map(Number);
    return { lat, lng, ele, t };
  });
}

export type TrackStats = {
  points: TrackPoint[];
  duration: number; // seconds along the log
  maxEle: number;
  relief: number; // max - min elevation, meters
  lengthKm: number; // horizontal great-circle length
};

function haversine(a: TrackPoint, b: TrackPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}

export function computeStats(points: TrackPoint[]): TrackStats {
  let min = Infinity, max = -Infinity, meters = 0;
  points.forEach((p, i) => {
    min = Math.min(min, p.ele);
    max = Math.max(max, p.ele);
    if (i > 0) meters += haversine(points[i - 1], p);
  });
  return {
    points,
    duration: points[points.length - 1].t - points[0].t,
    maxEle: max,
    relief: max - min,
    lengthKm: meters / 1000,
  };
}
