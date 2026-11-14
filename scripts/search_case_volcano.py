import asf_search as asf
from collections import defaultdict
from shapely.geometry import shape, Point

wkt = "POLYGON((159.6 54.2, 161.0 54.2, 161.0 55.0, 159.6 55.0, 159.6 54.2))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2025-10-01",
    end="2026-11-13",
    processingLevel=["GCOV"],
    maxResults=500,
)

pt = Point(160.27, 54.59)  # approximate coordinates for Krasheninnikov volcano
groups = defaultdict(list)
covered = 0

for r in res:
    p = r.properties
    if not shape(r.geometry).contains(pt):
        continue
    covered += 1
    key = (
        p["pathNumber"],
        p["frameNumber"],
        p["flightDirection"],
        p["collectionName"],
        "DHDH" in p["fileName"],
    )
    groups[key].append(p["startTime"][:10])

print("total:", len(res), "| covering the point:", covered)
for k in sorted(groups, key=lambda k: (k[0], k[1], k[3])):
    d = sorted(groups[k])
    print("path/frame/dir/collection/DHDH:", k, "count", len(d), d[0], "->", d[-1])
    print("   ", " ".join(d))
