import asf_search as asf

wkt = "POLYGON((32.5 -25.4, 33.6 -25.4, 33.6 -24.0, 32.5 -24.0, 32.5 -25.4))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2025-10-01",
    end="2026-11-13",
    processingLevel=["GCOV"],
    maxResults=300,
)
res = [r for r in res if r.properties.get("pathNumber") == 114]
res.sort(key=lambda r: r.properties["startTime"])
print("track 114 count:", len(res))
if res:
    print("bytes raw example:", res[0].properties.get("bytes"))

def size_gb(b):
    if isinstance(b, (int, float)):
        return round(b / 1e9, 2)
    if isinstance(b, dict):
        total = 0
        for v in b.values():
            if isinstance(v, dict):
                v = v.get("bytes", 0)
            if isinstance(v, (int, float)):
                total += v
        return round(total / 1e9, 2)
    return None

for r in res:
    p = r.properties
    print(
        p["startTime"][:10],
        "frame", p.get("frameNumber"),
        p.get("collectionName"),
        size_gb(p.get("bytes")), "GB",
        p.get("centerLat"), p.get("centerLon"),
        p.get("frameCoverage"),
        p.get("polarization"),
    )
print("example url:", res[0].properties.get("url") if res else None)
