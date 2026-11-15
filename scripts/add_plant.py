"""Add one species to data/plants.json (+ convert its photos to webp).

Example:
  python scripts/add_plant.py --name 白蜡 --latin "Fraxinus chinensis Roxb." \
    --family 木樨科 --genus 白蜡属 --location "北院8号楼西侧" \
    --morphology "落叶乔木，高10-12米……" --ecology "喜光，耐寒……" \
    --value "可作行道树；木材供家具……" --life-form 乔木 \
    --images "D:/a.jpg,D:/b.jpg"
"""
import argparse, base64, io, json, os, re, sys
from datetime import date

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTS = os.path.join(BASE, "data", "plants.json")
SITE = os.path.join(BASE, "data", "site.json")
IMG_ROOT = os.path.join(BASE, "images")

LIFE = ["乔木", "灌木", "草本", "藤本", "蕨类"]
USES = ["观赏", "药用", "食用", "用材", "生态", "蜜源", "香料", "纤维"]
EFF = [
    ("清热解毒", ["清热", "解毒"]), ("活血散瘀", ["活血", "化瘀", "散瘀"]),
    ("祛风除湿", ["祛风", "除湿", "风湿"]), ("止血收敛", ["止血", "收敛"]),
    ("利湿通淋", ["利湿", "利尿", "通淋", "利水"]), ("止咳化痰", ["止咳", "化痰", "润肺", "祛痰"]),
    ("健胃消食", ["健胃", "消食", "理气", "开胃"]), ("补益强壮", ["补益", "滋补", "补虚", "补肾", "养血"]),
    ("消肿止痛", ["消肿", "止痛", "镇痛"]), ("杀虫止痒", ["杀虫", "驱虫", "止痒"]),
    ("抗菌消炎", ["抗菌", "消炎", "抗炎", "抑菌"]),
]
USE_PAT = {
    "观赏": r"观赏|园林|绿化|景观|花境|行道树|盆景|庭园",
    "药用": r"药用|入药|药材|中药|药效|功效",
    "食用": r"食用|野菜|果酱|酿酒|可食|生食|做馅|茶饮",
    "用材": r"木材|用材|建筑|家具|雕刻|造纸",
    "生态": r"生态|水土保持|固土|防风固沙|护坡|抗污染|滞尘",
    "蜜源": r"蜜源", "香料": r"香料|芳香油|精油|挥发油",
    "纤维": r"纤维|编织|搓绳",
}
NEG = ["不可食用", "不能食用", "不宜食用", "禁止食用", "勿食"]


def clean(t):
    if not t:
        return ""
    t = t.replace("\u3000", " ").replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


def snip(text, start, before=20, after=24):
    a, b = max(0, start - before), min(len(text), start + after)
    return ("…" if a else "") + text[a:b] + ("…" if b < len(text) else "")


def split_alias(raw):
    out = []
    for p in re.split(r"[，,、；;/／\s]+", raw or ""):
        p = p.strip("。. ")
        if p and p not in out:
            out.append(p)
    return out


def derive(text, life_hint=None):
    life, habit, uses, effs, ev = [], [], [], [], {}
    if life_hint:
        for k in re.split(r"[/,，\s]+", life_hint):
            if k in LIFE:
                life.append(k)
        if life:
            ev["lifeForm"] = "命令行指定：" + "、".join(life)
    if not life:
        for k in LIFE:
            m = re.search(k, text)
            if m:
                life.append(k)
                ev.setdefault("lifeForm", snip(text, m.start()))
        if not life:
            m = re.search(r"木本|树冠|胸径|树干|主干", text)
            if m:
                life = ["乔木"]
                ev["lifeForm"] = snip(text, m.start())
    for k in ("常绿", "落叶"):
        if re.search(k, text):
            habit.append(k)
            ev.setdefault("habit", snip(text, text.index(k)))
    for tag, pat in USE_PAT.items():
        m = re.search(pat, text)
        if not m:
            continue
        seg = text[max(0, m.start() - 12):m.start() + 16]
        if tag == "食用" and any(n in seg for n in NEG):
            continue
        uses.append(tag)
        ev.setdefault("use", {})[tag] = snip(text, m.start())
    for name, keys in EFF:
        for k in keys:
            m = re.search(k, text)
            if m:
                effs.append(name)
                ev.setdefault("efficacy", {})[name] = snip(text, m.start())
                break
    return life, habit, uses, effs, ev


def toxic_of(text):
    for pat in ("有毒", "中毒", "毒性", "含毒", "剧毒", "小毒"):
        for m in re.finditer(pat, text):
            pre = text[max(0, m.start() - 2):m.start()]
            if pre.endswith(("解", "消", "无")):
                continue
            return True, snip(text, m.start())
    return False, ""


def period(text, key):
    m = re.search(key + r"\s*[:：]?\s*([0-9０-９一二三四五六七八九十]{1,2}\s*[-–—~～至]?\s*"
                       r"[0-9０-９一二三四五六七八九十]{0,2}\s*月)", text)
    return re.sub(r"\s+", "", m.group(1)) if m else ""


def convert_images(paths, code):
    out = []
    d = os.path.join(IMG_ROOT, code)
    os.makedirs(d, exist_ok=True)
    for n, src in enumerate(paths, 1):
        im = ImageOps.exif_transpose(Image.open(src))
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")

        full = im.copy()
        full.thumbnail((1000, 1000), Image.LANCZOS)
        fp = os.path.join(d, f"{n:02d}.webp")
        full.save(fp, "WEBP", quality=70, method=6)

        thumb = im.copy()
        thumb.thumbnail((320, 320), Image.LANCZOS)
        tp = os.path.join(d, f"{n:02d}s.webp")
        thumb.save(tp, "WEBP", quality=62, method=6)

        lq = im.copy()
        lq.thumbnail((24, 24), Image.LANCZOS)
        buf = io.BytesIO()
        lq.save(buf, "WEBP", quality=55, method=6)
        lqip = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

        out.append({
            "file": f"images/{code}/{n:02d}.webp",
            "thumb": f"images/{code}/{n:02d}s.webp",
            "lqip": lqip,
            "w": full.width, "h": full.height,
            "alt": "",
            "bytes": os.path.getsize(fp),
        })
    return out


def main():
    ap = argparse.ArgumentParser(description="向图鉴追加一种植物")
    ap.add_argument("--name", required=True)
    ap.add_argument("--latin", default="")
    ap.add_argument("--family", required=True)
    ap.add_argument("--genus", default="")
    ap.add_argument("--alias", default="")
    ap.add_argument("--morphology", default="")
    ap.add_argument("--ecology", default="")
    ap.add_argument("--value", default="")
    ap.add_argument("--intro", default="")
    ap.add_argument("--location", default="")
    ap.add_argument("--life-form", default="")
    ap.add_argument("--flower", default="")
    ap.add_argument("--fruit", default="")
    ap.add_argument("--protected", default="")
    ap.add_argument("--toxic", action="store_true")
    ap.add_argument("--images", default="")
    ap.add_argument("--allow-no-image", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    plants = json.load(open(PLANTS, encoding="utf-8"))
    site = json.load(open(SITE, encoding="utf-8"))
    if any(p["name"] == a.name for p in plants):
        sys.exit(f"已存在同名物种：{a.name}")

    pid = max(p["id"] for p in plants) + 1
    code = f"{pid:03d}"
    morph, eco, val = clean(a.morphology), clean(a.ecology), clean(a.value)
    blob = " ".join([morph, eco, val, a.intro])
    life, habit, uses, effs, ev = derive(blob, a.life_form or None)
    toxic, tox_ev = toxic_of(blob)
    if a.toxic:
        toxic, tox_ev = True, tox_ev or "（命令行标记）"

    imgs = []
    paths = [p.strip() for p in a.images.split(",") if p.strip()]
    if not paths and not a.dry_run and not a.allow_no_image:
        sys.exit("至少需要一张图片：--images \"a.jpg,b.jpg\"（确实没有图可加 --allow-no-image）")
    if paths:
        missing = [p for p in paths if not os.path.exists(p)]
        if missing:
            sys.exit("找不到图片：" + ", ".join(missing))
        if not a.dry_run:
            imgs = convert_images(paths, code)
            for i, im in enumerate(imgs, 1):
                im["alt"] = f"{a.name} 照片 {i}"
    elif not a.dry_run:
        print("! 没有提供图片，该物种将显示占位图")

    spots = []
    for s in site.get("spots", []):
        if s["name"] and s["name"] in a.location:
            spots.append(s["id"])
    campus = [c for c in ("北院", "南院") if c in a.location]
    if not campus:
        for sid in spots:
            z = next(x.get("zone") for x in site["spots"] if x["id"] == sid)
            campus.append("北院" if z == "north" else "南院" if z == "south" else "")

    rec = {
        "id": pid, "code": code, "name": a.name,
        "latin": a.latin, "alias": split_alias(a.alias),
        "family": a.family, "familyRaw": a.family, "familyNote": "",
        "genus": a.genus, "genusNote": "",
        "lifeForm": life, "habit": habit,
        "taxon": ["裸子植物"] if a.family in {"苏铁科", "银杏科", "松科", "柏科", "红豆杉科"} else ["被子植物"],
        "use": uses, "efficacy": effs,
        "toxic": toxic, "protected": a.protected,
        "flower": a.flower or period(morph + " " + eco, "花期"),
        "fruit": a.fruit or period(morph + " " + eco, "果期"),
        "intro": clean(a.intro),
        "morphology": morph,
        "ecology": eco, "ecologyLabel": "生态习性" if eco else "", "distribution": "",
        "value": val,
        "location": {"raw": a.location, "campus": [c for c in campus if c], "spots": spots},
        "images": imgs,
        "derived": {k: v for k, v in {
            "lifeForm": ev.get("lifeForm", ""), "habit": ev.get("habit", ""),
            "use": ev.get("use", {}), "efficacy": ev.get("efficacy", {}),
            "toxic": tox_ev, "protected": "",
        }.items() if v},
    }

    if a.dry_run:
        print(json.dumps(rec, ensure_ascii=False, indent=1)[:1200])
        print("\n[dry-run] 未写入文件")
        return

    plants.append(rec)
    site.setdefault("families", [])
    if a.family not in site["families"]:
        site["families"].append(a.family)
    site.setdefault("familyCount", {})
    site["familyCount"] = {}
    for p in plants:
        site["familyCount"][p["family"]] = site["familyCount"].get(p["family"], 0) + 1
    site.setdefault("counts", {})
    site["counts"] = {
        "species": len(plants),
        "images": sum(len(p.get("images", [])) for p in plants),
        "families": len(site["familyCount"]),
    }
    site["updated"] = date.today().isoformat()

    with open(PLANTS, "w", encoding="utf-8") as f:
        json.dump(plants, f, ensure_ascii=False, indent=1)
    with open(SITE, "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2)

    print(f"OK  #{pid} {a.name}  科={a.family}  图片={len(imgs)}  "
          f"生活型={life or '-'}  用途={uses or '-'}  功效={effs or '-'}")
    print("下一步：node scripts/validate.mjs（并记得修改 sw.js 的 VERSION）")


if __name__ == "__main__":
    main()
