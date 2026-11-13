import asf_search as asf
from shapely.geometry import shape, Point

wkt = "POLYGON((32.5 -25.4, 33.6 -25.4, 33.6 -24.0, 32.5 -24.0, 32.5 -25.4))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2025-12-20",
    end="2026-01-20",
    processingLevel=["GCOV"],
    maxResults=100,
)
res = [r for r in res if r.properties.get("pathNumber") == 114]
res.sort(key=lambda r: (r.properties["startTime"], r.properties["frameNumber"]))

# approximate points (lon, lat) from memory, to be verified
pts = {"Chokwe": Point(32.98, -24.53), "Macia": Point(33.10, -25.03)}

for r in res:
    p = r.properties
    g = shape(r.geometry)
    print(p["startTime"][:10], "frame", p["frameNumber"], "bounds(w,s,e,n):", [round(x, 2) for x in g.bounds],
          {k: g.contains(v) for k, v in pts.items()})
    print("   ", p["fileName"])
