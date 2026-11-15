"""Convert the DOCX-extracted photos into web-ready WebP (full + thumb + LQIP) per species.

Output layout:
  images/<code>/<nn>.webp    full   (long edge <= 1000, q70)
  images/<code>/<nn>s.webp   thumb  (long edge <= 320,  q62)
  images/<code>/<nn>l.webp   LQIP   (long edge <= 24,  inlined into plants.json as data URI)
"""
import os, json, base64, io
from PIL import Image, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "_source", "images_raw")
OUT = os.path.join(BASE, "images")
FULL_MAX, FULL_Q = 1000, 70
THUMB_MAX, THUMB_Q = 320, 62
LQIP_MAX, LQIP_Q = 24, 55

plants = json.load(open(os.path.join(BASE, "_source", "plants_raw.json"), encoding="utf-8"))
manifest = {}
tot = {"full": 0, "thumb": 0}

for sp in plants:
    code = f"{sp['id']:03d}"
    d = os.path.join(OUT, code)
    os.makedirs(d, exist_ok=True)
    items = []
    for n, media in enumerate(sp["images"], 1):
        src = os.path.join(RAW, media)
        if not os.path.exists(src):
            print("MISSING", media)
            continue
        im = ImageOps.exif_transpose(Image.open(src))
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        ow, oh = im.size

        full = im.copy()
        full.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
        fp = os.path.join(d, f"{n:02d}.webp")
        full.save(fp, "WEBP", quality=FULL_Q, method=6)

        thumb = im.copy()
        thumb.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        tp = os.path.join(d, f"{n:02d}s.webp")
        thumb.save(tp, "WEBP", quality=THUMB_Q, method=6)

        lq = im.copy()
        lq.thumbnail((LQIP_MAX, LQIP_MAX), Image.LANCZOS)
        buf = io.BytesIO()
        lq.save(buf, "WEBP", quality=LQIP_Q, method=6)
        lqip = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

        fs, ts = os.path.getsize(fp), os.path.getsize(tp)
        tot["full"] += fs
        tot["thumb"] += ts
        items.append({
            "file": f"images/{code}/{n:02d}.webp",
            "thumb": f"images/{code}/{n:02d}s.webp",
            "lqip": lqip,
            "w": full.width, "h": full.height,
            "ow": ow, "oh": oh,
            "bytes": fs,
        })
    manifest[sp["id"]] = {"code": code, "count": len(items), "items": items, "orig": sp["images"]}

json.dump(manifest, open(os.path.join(BASE, "_source", "image_manifest.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"species {len(manifest)}  full {tot['full']/1048576:.1f}MB  thumb {tot['thumb']/1048576:.1f}MB  "
      f"total {(tot['full']+tot['thumb'])/1048576:.1f}MB")
