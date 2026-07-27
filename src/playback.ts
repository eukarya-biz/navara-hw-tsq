// True-speed playback over a GPS track.
//
// The track carries real unix timestamps, so playback maps wall-clock elapsed time
// (scaled by `speed`) onto track time and interpolates position between fixes. A
// speed of 60 means one real second advances 60 seconds of the hike.

import type { TrackPoint } from "./data";

export type Sample = {
  lng: number;
  lat: number;
  ele: number;
  heading: number; // degrees, direction of travel (0 = north, 90 = east)
  progress: number; // 0..1 along track time
  trackTime: number; // seconds since track start
};

function bearing(a: TrackPoint, b: TrackPoint): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * toRad) * Math.cos(b.lat * toRad);
  const x =
    Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
    Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lng - a.lng) * toRad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export class Playback {
  private points: TrackPoint[];
  private t0: number; // track start timestamp
  readonly duration: number; // track seconds
  private trackTime = 0;
  private playing = false;
  private idx = 0; // cursor hint into points for the current trackTime

  constructor(points: TrackPoint[]) {
    this.points = points;
    this.t0 = points[0]?.t ?? 0;
    this.duration = points.length ? points[points.length - 1].t - this.t0 : 0;
  }

  get isPlaying() {
    return this.playing;
  }
  get currentTime() {
    return this.trackTime;
  }

  play() {
    if (this.trackTime >= this.duration) this.seek(0);
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  seek(trackTime: number) {
    this.trackTime = Math.max(0, Math.min(this.duration, trackTime));
    this.idx = 0; // reset the cursor; advance() re-scans from here
  }

  // Advance by `realDeltaSec` of wall time at the given speed multiplier; returns the
  // interpolated sample at the new position. Call once per animation frame.
  advance(realDeltaSec: number, speed: number): Sample {
    if (this.playing) {
      this.trackTime += realDeltaSec * speed;
      if (this.trackTime >= this.duration) {
        this.trackTime = this.duration;
        this.playing = false;
      }
    }
    return this.sample();
  }

  sample(): Sample {
    const pts = this.points;
    const absT = this.t0 + this.trackTime;
    // Advance the cursor forward to the segment containing absT.
    while (this.idx < pts.length - 2 && pts[this.idx + 1].t <= absT) this.idx++;
    while (this.idx > 0 && pts[this.idx].t > absT) this.idx--;

    const a = pts[this.idx];
    const b = pts[Math.min(this.idx + 1, pts.length - 1)];
    const span = b.t - a.t;
    const f = span > 0 ? Math.max(0, Math.min(1, (absT - a.t) / span)) : 0;

    const ae = a.ele ?? 0, be = b.ele ?? 0;
    return {
      lng: a.lng + (b.lng - a.lng) * f,
      lat: a.lat + (b.lat - a.lat) * f,
      ele: ae + (be - ae) * f,
      heading: bearing(a, b),
      progress: this.duration > 0 ? this.trackTime / this.duration : 0,
      trackTime: this.trackTime,
    };
  }
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
