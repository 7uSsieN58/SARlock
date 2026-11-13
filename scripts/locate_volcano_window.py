import asf_search as asf
import earthaccess
import h5py
from pyproj import Transformer

granule = "NISAR_L2_PR_GCOV_023_132_D_061_4005_DHDH_A_20260623T084110_20260623T084146_P05023_N_F_J_001"
res = asf.granule_search([granule])
url = [u for u in [res[0].properties["url"]] if u.endswith(".h5")][0]

earthaccess.login(strategy="environment")
fs = earthaccess.get_fsspec_https_session()

G = "/science/LSAR/GCOV/grids/frequencyA/"
with h5py.File(fs.open(url, mode="rb", cache_type="background", block_size=2 * 1024 * 1024), "r") as f:
    epsg = int(f[G + "projection"][()])
    xs = f[G + "xCoordinates"][:]
    ys = f[G + "yCoordinates"][:]
    n_rows, n_cols = f[G + "HHHH"].shape

x0, y0 = float(xs[0]), float(ys[0])
dx, dy = float(xs[1] - xs[0]), float(ys[1] - ys[0])
print(f"EPSG:{epsg} | grid=({n_rows} x {n_cols}) | origin=({x0}, {y0}) | step=({dx}, {dy})")

t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
lon, lat = 160.273, 54.593
x, y = t.transform(lon, lat)
col = int(round((x - x0) / dx))
row = int(round((y - y0) / dy))

W = 3000  # 30 km x 30 km at 10 m posting
r0, c0 = row - W // 2, col - W // 2
r1, c1 = r0 + W, c0 + W
inside = (0 <= r0) and (r1 <= n_rows) and (0 <= c0) and (c1 <= n_cols)
print(f"Krasheninnikov center: x={round(x)}, y={round(y)} | row={row}, col={col}")
print(f"Window: R0={r0}, R1={r1}, C0={c0}, C1={c1} | inside_grid={inside}")
