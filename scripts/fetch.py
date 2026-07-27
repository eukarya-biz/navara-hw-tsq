#!/usr/bin/env python3
"""Fetch hiking tracks and prepare them for the app.

For each id in HIKES: download route.csv, convert its height from orthometric (GPS MSL)
to ellipsoidal so it matches Navara's terrain (GSIGEO2011 geoid), and write it under
public/data/<id>/. Also writes catalog.txt (the selector list) from the site's index."""
import os, urllib.request, pyproj
from pyproj import Transformer

HIKES = ["260719", "260506", "260412", "260628"]
BASE = "https://6e5d.com/hiking"

# Use the local GSIGEO2011 grid when present, else download it from the PROJ CDN (for CI).
# allow_ballpark=False guarantees the geoid is actually applied — no silent approximation.
pyproj.network.set_network_enabled(True)
tf = Transformer.from_crs("EPSG:6697", "EPSG:4979", always_xy=True, allow_ballpark=False)
get = lambda url: urllib.request.urlopen(url).read().decode()

for hid in HIKES:
    rows = [r.split() for r in get(f"{BASE}/{hid}/route.csv").split("\n") if r.strip()]
    lines = [f"{lat} {lon} {tf.transform(float(lon), float(lat), float(ele))[2]:.1f} {t}"
             for lat, lon, ele, t in rows]
    os.makedirs(f"public/data/{hid}", exist_ok=True)
    open(f"public/data/{hid}/route.csv", "w").write("\n".join(lines) + "\n")
    print(f"{hid}: {len(lines)} points")

catalog = [r for r in get(f"{BASE}/visited.csv").split("\n") if r.split()[2:3] and r.split()[2] in HIKES]
open("public/data/catalog.txt", "w").write("\n".join(catalog) + "\n")
