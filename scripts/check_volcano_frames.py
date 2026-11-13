import asf_search as asf
from shapely.geometry import shape, Point

wkt = "POLYGON((159.6 54.2, 161.0 54.2, 161.0 55.0, 159.6 55.0, 159.6 54.2))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2026-06-01",
    end="2026-10-23",
    processingLevel=["GCOV"],
    maxResults=500,
)

pt = Point(160.27, 54.59)
items = []

for r in res:
    p = r.properties
    if (
        p["collectionName"] == "NISAR_L2_GCOV_PROVISIONAL_V1"
        and "DHDH" in p["fileName"]
        and p["pathNumber"] == 132
        and p["frameNumber"] == 61
        and p["flightDirection"] == "DESCENDING"
    ):
        poly = shape(r.geometry)
        if poly.contains(pt):
            b_raw = p.get("bytes")
            if isinstance(b_raw, dict):
                h5_vals = [
                    (v["bytes"] if isinstance(v, dict) else v)
                    for k, v in b_raw.items()
                    if k.endswith(".h5")
                ]
                size_bytes = sum(h5_vals) if h5_vals else 0
            else:
                size_bytes = b_raw or 0
            items.append((p["startTime"][:10], size_bytes / (1024 * 1024), p))

items.sort(key=lambda x: x[0])
print(f"=== Path 132 | Frame 61 | DESCENDING ({len(items)} granules) ===")
for dt, size_mb, p in items:
    browse = (p.get("browse") or ["N/A"])[0]
    print(f"{dt} | {size_mb:7.1f} MB | {p['fileName']}")
    print(f"   browse: {browse}")
