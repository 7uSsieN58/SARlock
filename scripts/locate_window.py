from pyproj import Transformer

x0, y0 = 329765.0, 7390795.0
dx, dy = 10.0, -10.0
n_rows, n_cols = 32040, 33120

t = Transformer.from_crs("EPSG:4326", "EPSG:32736", always_xy=True)
pts = {"Chokwe": (32.98, -24.53), "Macia": (33.10, -25.03)}
W = 3000  # window size in pixels (30 km at 10 m)

for name, (lon, lat) in pts.items():
    x, y = t.transform(lon, lat)
    col = int(round((x - x0) / dx))
    row = int(round((y - y0) / dy))
    r0, c0 = row - W // 2, col - W // 2
    inside = 0 <= r0 and r0 + W <= n_rows and 0 <= c0 and c0 + W <= n_cols
    print(name, "x,y:", round(x), round(y), "row,col:", row, col,
          "| window rows", r0, "to", r0 + W, "cols", c0, "to", c0 + W, "| inside grid:", inside)
