import os, time, warnings
import numpy as np
import asf_search as asf
import earthaccess
import h5py
from PIL import Image

R0, R1, C0, C1 = 12315, 15315, 11941, 14941
B = 6  # 6x6 block average -> 500x500 px (60 m spacing, 30x30 km)
G = "/science/LSAR/GCOV/grids/frequencyA/"

os.makedirs("cache/volcano", exist_ok=True)
os.makedirs("out_test/volcano_gcov", exist_ok=True)

granules = {
    "2026-06-23": "NISAR_L2_PR_GCOV_023_132_D_061_4005_DHDH_A_20260623T084110_20260623T084146_P05023_N_F_J_001",
    "2026-07-17": "NISAR_L2_PR_GCOV_025_132_D_061_4005_DHDH_A_20260717T084109_20260717T084145_P05023_N_F_J_001",
    "2026-08-22": "NISAR_L2_PR_GCOV_028_132_D_061_4005_DHDH_A_20260822T084107_20260822T084143_P05023_N_F_J_001",
    "2026-10-09": "NISAR_L2_PR_GCOV_032_132_D_061_4005_DHDH_A_20261009T084107_20261009T084142_P05023_N_F_J_001",
}

res = asf.granule_search(list(granules.values()))
urls = {}
for r in res:
    p = r.properties
    if not p["url"].endswith(".h5"):
        continue
    for dt, gname in granules.items():
        if gname in p["fileName"]:
            urls[dt] = p["url"]

earthaccess.login(strategy="environment")
fs = earthaccess.get_fsspec_https_session()

raw = {}
printed_attrs = False
for dt in granules:
    url = urls[dt]
    f = None
    for pol in ("HH", "HV"):
        cpath = f"cache/volcano/{dt}_{pol}.npy"
        if os.path.exists(cpath):
            raw[(dt, pol)] = np.load(cpath)
            continue
        if f is None:
            f = h5py.File(fs.open(url, mode="rb", cache_type="background", block_size=4 * 1024 * 1024), "r")
        ds = f[G + pol * 2]
        if not printed_attrs:
            print("Dataset attrs:", {a: (v.decode() if isinstance(v, bytes) else v) for a, v in ds.attrs.items()})
            printed_attrs = True
        t0 = time.time()
        a = ds[R0:R1, C0:C1].astype("float32")
        print(f"Read {dt} {pol}: shape={a.shape} in {time.time() - t0:.1f}s")
        np.save(cpath, a)
        raw[(dt, pol)] = a
    if f is not None:
        f.close()

def multilook_db(a):
    a = a.copy()
    a[~np.isfinite(a) | (a <= 0)] = np.nan
    h, w = (a.shape[0] // B) * B, (a.shape[1] // B) * B
    blocks = a[:h, :w].reshape(h // B, B, w // B, B)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = np.nanmean(blocks, axis=(1, 3))
        return 10.0 * np.log10(m)

def to_u8(x, lo, hi):
    y = np.clip((x - lo) / (hi - lo), 0, 1) * 255.0
    y[~np.isfinite(x)] = 0
    return y.astype("uint8")

db = {}
print("\n=== Single-Date Radiometric Summary ===")
for dt in granules:
    for pol in ("HH", "HV"):
        arr = multilook_db(raw[(dt, pol)])
        db[(dt, pol)] = arr
        p2, p98 = np.nanpercentile(arr, [2, 98])
        print(f"{dt} {pol} | mean={np.nanmean(arr):6.2f} dB | p2..p98=[{p2:6.2f}, {p98:6.2f}] | nodata={np.isnan(arr).mean():.4f}")

pairs = [
    ("pairA_0623_to_0822", "2026-06-23", "2026-08-22"),
    ("pairB_0717_to_0822", "2026-07-17", "2026-08-22"),
    ("pairC_0717_to_1009", "2026-07-17", "2026-10-09"),
]

print("\n=== Rendering Candidate Change Pairs ===")
for tag, d1, d2 in pairs:
    for pol in ("HH", "HV"):
        b, e = db[(d1, pol)], db[(d2, pol)]
        lo, hi = np.nanpercentile(np.concatenate([b.ravel(), e.ravel()]), [2, 98])
        ub, ue = to_u8(b, lo, hi), to_u8(e, lo, hi)
        chg = np.stack([ub, ue, ue], axis=-1)
        chg[~np.isfinite(b) | ~np.isfinite(e)] = 0
        im = Image.fromarray(chg)
        im.save(f"out_test/volcano_gcov/{tag}_change_{pol}.png")
        # Save central 15x15 km (250x250 px) zoom around caldera
        im.crop((125, 125, 375, 375)).save(f"out_test/volcano_gcov/{tag}_zoom_{pol}.png")
        if tag == "pairB_0717_to_0822":
            Image.fromarray(ub).save(f"out_test/volcano_gcov/0717_{pol}.png")
            Image.fromarray(ue).save(f"out_test/volcano_gcov/0822_{pol}.png")
    print(f"Saved {tag} (full + caldera zoom)")

print("Done!")
