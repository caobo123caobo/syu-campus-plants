"""Generate app icons (leaf mark) as PNG + SVG."""
import os, math
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "icons")
os.makedirs(OUT, exist_ok=True)

BG1 = (15, 61, 46)
BG2 = (47, 125, 93)
LEAF = (216, 243, 220)


def leaf_points(cx, cy, length, width, angle=-38, steps=120):
    """Two mirrored quadratic curves forming a pointed leaf."""
    pts_up, pts_dn = [], []
    for i in range(steps + 1):
        t = i / steps
        x = (t - 0.5) * length
        y = -width * (1 - (2 * t - 1) ** 2) / 2
        pts_up.append((x, y))
        pts_dn.append((x, -y))
    allp = pts_up + pts_dn[::-1]
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in allp]


def make(size, pad_ratio=0.0, maskable=False):
    S = size * 4  # supersample
    img = Image.new("RGB", (S, S), BG1)
    d = ImageDraw.Draw(img)
    # diagonal gradient background
    for y in range(S):
        r = y / S
        col = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * (0.35 + 0.65 * r)) for i in range(3))
        d.line([(0, y), (S, y)], fill=col)
    # rounded corners (non-maskable)
    if not maskable and pad_ratio == 0:
        mask = Image.new("L", (S, S), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        bg = Image.new("RGB", (S, S), (247, 245, 239))
        img = Image.composite(img, bg, mask)

    cx = cy = S / 2
    scale = 1 - 2 * pad_ratio
    length, width = S * 0.52 * scale, S * 0.30 * scale
    pts = leaf_points(cx, cy - S * 0.02, length, width)
    d.polygon(pts, fill=LEAF)
    # main vein
    d.line([(cx - length * 0.34 * math.cos(math.radians(38)), cy - length * 0.02),
            (cx + length * 0.34 * math.cos(math.radians(38)), cy + length * 0.02)],
           fill=BG1, width=max(2, int(S * 0.008)))
    # stem
    d.line([(cx - length * 0.44, cy + length * 0.24), (cx - length * 0.16, cy + length * 0.08)],
           fill=LEAF, width=max(3, int(S * 0.012)))
    return img.resize((size, size), Image.LANCZOS)


for size in (192, 512):
    make(size).save(os.path.join(OUT, f"icon-{size}.png"))
make(512, pad_ratio=0.12, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f3d2e"/><stop offset="1" stop-color="#2f7d5d"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M32 50c0-12 6-20 15-24-1.5 12-7 20-15 24z" fill="#d8f3dc"/>
  <path d="M32 50c0-12-6-20-15-24 1.5 12 7 20 15 24z" fill="#d8f3dc" opacity=".6"/>
  <path d="M32 52V34" stroke="#0f3d2e" stroke-width="2.4" stroke-linecap="round"/>
</svg>'''
open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8").write(svg)
print("icons ok")
