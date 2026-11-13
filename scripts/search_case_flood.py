import asf_search as asf

wkt = "POLYGON((32.5 -25.4, 33.6 -25.4, 33.6 -24.0, 32.5 -24.0, 32.5 -25.4))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2025-12-01",
    end="2026-02-28",
    processingLevel=["GCOV"],
    maxResults=200,
)
print("count:", len(res))
if res:
    print("keys:", sorted(res[0].properties.keys()))
for r in res:
    p = r.properties
    print(p.get("startTime"), p.get("platform"), p.get("pathNumber"), p.get("frameNumber"), p.get("flightDirection"), p.get("fileID"))
