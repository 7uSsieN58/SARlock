import json, os
from PIL import Image, ImageDraw

d = json.load(open("data/case-01-chokwe/case-01.json", encoding="utf-8"))

def find(o, key):
    if isinstance(o, dict):
        if key in o:
            return o[key]
        for v in o.values():
            r = find(v, key)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find(v, key)
            if r is not None:
                return r
    return None

hs = find(d, "hotspots")
print("hotspots:", len(hs))
for i, h in enumerate(hs, 1):
    print(i, json.dumps(h, ensure_ascii=False))

os.makedirs("out_test", exist_ok=True)
for ch in ("HH", "HV"):
    path = f"data/case-01-chokwe/change_{ch}.png"
    if not os.path.exists(path):
        print("missing:", path)
        continue
    img = Image.open(path).convert("RGB")
    S = 2
    img = img.resize((img.width * S, img.height * S))
    dr = ImageDraw.Draw(img)
    for i, h in enumerate(hs, 1):
        fx, fy = float(h["x"]), float(h["y"])
        if max(fx, fy) <= 1.0:
            fx, fy = fx * 100, fy * 100
        cx, cy = fx / 100 * img.width, fy / 100 * img.height
        dr.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=(255, 255, 0), width=4)
        dr.text((cx - 5, cy - 7), str(i), fill=(255, 255, 0))
    img.save(f"out_test/hotspots_check_{ch}.png")
    print("saved out_test/hotspots_check_" + ch + ".png")
