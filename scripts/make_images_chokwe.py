import os, time, warnings
import numpy as np
import asf_search as asf
import earthaccess
import h5py
from PIL import Image

R0, R1, C0, C1 = 8870, 11870, 15321, 18321
B = 6  # block size for averaging (multilook)
G = "/science/LSAR/GCOV/grids/frequencyA/"
os.makedirs("cache", exist_ok=True)
os.makedirs("out_test", exist_ok=True)

wkt = "POLYGON((32.5 -25.4, 33.6 -25.4, 33.6 -24.0, 32.5 -24.0, 32.5 -25.4))"
res = asf.geo_search(platform=[asf.PLATFORM.NISAR], intersectsWith=wkt,
                     start="2026-01-01", end="2026-01-20",
                     processingLevel=["GCOV"], maxResults=50)
targets = {"before": "009_114_A_165", "event": "010_114_A_165"}
urls = {}
for r in res:
    p = r.properties
    for k, key in targets.items():
        if key in p["fileName"] and p["url"].endswith(".h5"):
            urls[k] = p["url"]

earthaccess.login(strategy="environment")
fs = earthaccess.get_fsspec_https_session()

raw = {}
for k, url in urls.items():
    f = None
    for pol in ("HH", "HV"):
        path = f"cache/{k}_{pol}.npy"
        if os.path.exists(path):
            raw[(k, pol)] = np.load(path)
            continue
        if f is None:
            f = h5py.File(fs.open(url, mode="rb", cache_type="background", block_size=4 * 1024 * 1024), "r")
        ds = f[G + pol * 2]
        print(k, pol, "dtype", ds.dtype, "chunks", ds.chunks, "compression", ds.compression)
        print("   attrs:", {a: (v.decode() if isinstance(v, bytes) else v) for a, v in ds.attrs.items()})
        t0 = time.time()
        a = ds[R0:R1, C0:C1].astype("float32")
        print("   read", a.shape, "in", round(time.time() - t0), "s")
        np.save(path, a)
        raw[(k, pol)] = a
    if f is not None:
        f.close()

def multilook_db(a):
    a = a.copy()
    a[~np.isfinite(a) | (a <= 0)] = np.nan
    h, w = (a.shape[0] // B) * B, (a.shape[1] // B) * B
    blocks = a[:h, :w].reshape(h // B, B, w // B, B)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = np.nanmean(blocks, axis=(1, 3))   # average in linear power
        return 10 * np.log10(m)               # then convert to dB

def to_u8(x, lo, hi):
    y = np.clip((x - lo) / (hi - lo), 0, 1) * 255
    y[~np.isfinite(x)] = 0
    return y.astype("uint8")

for pol in ("HH", "HV"):
    b = multilook_db(raw[("before", pol)])
    e = multilook_db(raw[("event", pol)])
    lo, hi = np.nanpercentile(np.concatenate([b.ravel(), e.ravel()]), [2, 98])
    print(pol, "shape", b.shape, "stretch dB:", round(float(lo), 2), round(float(hi), 2),
          "| nodata before/event:", round(float(np.isnan(b).mean()), 4), round(float(np.isnan(e).mean()), 4),
          "| mean dB before/event:", round(float(np.nanmean(b)), 2), round(float(np.nanmean(e)), 2))
    ub, ue = to_u8(b, lo, hi), to_u8(e, lo, hi)
    Image.fromarray(ub).save(f"out_test/before_{pol}.png")
    Image.fromarray(ue).save(f"out_test/event_{pol}.png")
    # red = brighter in BEFORE, cyan = brighter in the later image
    chg = np.stack([ub, ue, ue], axis=-1)
    nodata = ~np.isfinite(b) | ~np.isfinite(e)
    chg[nodata] = 0
    Image.fromarray(chg).save(f"out_test/change_{pol}.png")
print("done")
