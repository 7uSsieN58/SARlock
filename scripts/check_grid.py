import asf_search as asf
import earthaccess
import h5py
import numpy as np

wkt = "POLYGON((32.5 -25.4, 33.6 -25.4, 33.6 -24.0, 32.5 -24.0, 32.5 -25.4))"
res = asf.geo_search(
    platform=[asf.PLATFORM.NISAR],
    intersectsWith=wkt,
    start="2026-01-01",
    end="2026-01-20",
    processingLevel=["GCOV"],
    maxResults=50,
)
targets = {"before": "009_114_A_165", "event": "010_114_A_165"}
urls = {}
for r in res:
    p = r.properties
    for k, key in targets.items():
        if key in p["fileName"] and p["url"].endswith(".h5"):
            urls[k] = (p["fileName"], p["url"])
print("found:", {k: v[0] for k, v in urls.items()})

earthaccess.login(strategy="environment")
fs = earthaccess.get_fsspec_https_session()
G = "/science/LSAR/GCOV/grids/frequencyA/"
info = {}
for k, (name, url) in urls.items():
    f = h5py.File(fs.open(url, mode="rb", cache_type="background", block_size=4 * 1024 * 1024), "r")
    g = f[G]
    x = g["xCoordinates"][:]
    y = g["yCoordinates"][:]
    info[k] = dict(
        x=x, y=y,
        dx=float(g["xCoordinateSpacing"][()]), dy=float(g["yCoordinateSpacing"][()]),
        shape=g["HHHH"].shape,
        pols=[s.decode() if isinstance(s, bytes) else s for s in g["listOfPolarizations"][:]],
        proj=g["projection"][()], proj_attrs=dict(g["projection"].attrs),
    )
    print(k, "shape", info[k]["shape"], "pols", info[k]["pols"])
    print("   x:", x[0], x[-1], "dx", info[k]["dx"], "| y:", y[0], y[-1], "dy", info[k]["dy"])
    print("   projection:", info[k]["proj"], info[k]["proj_attrs"])
    f.close()

if "before" in info and "event" in info:
    a, b = info["before"], info["event"]
    print("same shape:", a["shape"] == b["shape"])
    print("same spacing:", a["dx"] == b["dx"] and a["dy"] == b["dy"])
    if a["x"].shape == b["x"].shape and a["y"].shape == b["y"].shape:
        print("x identical:", np.array_equal(a["x"], b["x"]), "max |dx|:", float(np.abs(a["x"] - b["x"]).max()))
        print("y identical:", np.array_equal(a["y"], b["y"]), "max |dy|:", float(np.abs(a["y"] - b["y"]).max()))
    else:
        print("different array sizes; x offset (pixels):", (b["x"][0] - a["x"][0]) / a["dx"], "y offset (pixels):", (b["y"][0] - a["y"][0]) / a["dy"])
