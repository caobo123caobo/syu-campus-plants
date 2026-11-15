"""Build web data from the parsed DOCX + image manifest.

Every derived attribute keeps the source snippet that justified it, so the
output is auditable instead of invented. Family corrections are explicit and
listed in docs/data-review.md.
"""
import os, re, json, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "_source")
OUT_DATA = os.path.join(BASE, "data")
OUT_DOCS = os.path.join(BASE, "docs")
os.makedirs(OUT_DATA, exist_ok=True)
os.makedirs(OUT_DOCS, exist_ok=True)

plants = json.load(open(os.path.join(SRC, "plants_raw.json"), encoding="utf-8"))
imgs = json.load(open(os.path.join(SRC, "image_manifest.json"), encoding="utf-8"))

# ---------------------------------------------------------------- corrections
# Species whose family heading in the DOCX is wrong or is not a family name.
# Reason strings are shown in docs/data-review.md and quoted from standard
# Chinese taxonomic references (中国植物志 / APG IV), never invented.
FAMILY_FIX = {
    "朝天委陵菜": ("蔷薇科", "原文科标题「蔷薇亚目科」不是科名；委陵菜属 Potentilla 属蔷薇科。"),
    "黄刺玫": ("蔷薇科", "原文科标题「蔷薇亚目科」不是科名；蔷薇属 Rosa 属蔷薇科。"),
    "丰花月季": ("蔷薇科", "原文科标题「蔷薇亚目科」不是科名；蔷薇属 Rosa 属蔷薇科。"),
    "树锦鸡儿": ("豆科", "原文科标题「蔷薇亚目科」不是科名；锦鸡儿属 Caragana 属豆科。"),
    "朝鲜槐": ("豆科", "原文标题「豆科（蔷薇亚目科）」括号内为目/亚目注记，规范科名为豆科。"),
    "刺槐": ("豆科", "原文标题「豆科（蔷薇亚目科）」括号内为目/亚目注记，规范科名为豆科。"),
    "红花刺槐": ("豆科", "原文标题「豆科（蔷薇亚目科）」括号内为目/亚目注记，规范科名为豆科。"),
    "白车轴草": ("豆科", "原文标题「豆科（蔷薇亚目科）」括号内为目/亚目注记，规范科名为豆科。"),
    "鸾枝": ("蔷薇科", "原文科标题「牛栓藤科」误标；李属 Prunus 属蔷薇科。"),
    "白花山桃": ("蔷薇科", "原文科标题「牛栓藤科」误标；李属 Prunus 属蔷薇科。"),
    "毛樱桃": ("蔷薇科", "原文科标题「牛栓藤科」误标；李属 Prunus 属蔷薇科。"),
    "大山樱": ("蔷薇科", "原文科标题「牛栓藤科」误标；樱属 Prunus 属蔷薇科。"),
    "紫叶稠李": ("蔷薇科", "原文科标题「牛栓藤科」误标；稠李属 Prunus 属蔷薇科。"),
    "紫叶李": ("蔷薇科", "原文科标题「牛栓藤科」误标；李属 Prunus 属蔷薇科。"),
    "大花马齿苋": ("马齿苋科", "原文归入石竹科；马齿苋属 Portulaca 属马齿苋科。"),
    "火炬树": ("漆树科", "原文归入槭树科；盐肤木属 Rhus 属漆树科。"),
    "单瓣粉花玛格丽特": ("菊科", "原文科标题「桔梗目科」是目名不是科名；木茼蒿属 Argyranthemum 属菊科。"),
    "重瓣玫粉花玛格丽特": ("菊科", "原文科标题「桔梗目科」是目名不是科名；木茼蒿属 Argyranthemum 属菊科。"),
    "大籽蒿": ("菊科", "原文科标题「桔梗目科」是目名不是科名；蒿属 Artemisia 属菊科。"),
    "刺儿菜": ("菊科", "原文科标题「桔梗目科」是目名不是科名；蓟属 Cirsium 属菊科。"),
    "泥胡菜": ("菊科", "原文科标题「桔梗目科」是目名不是科名；泥胡菜属 Hemisteptia 属菊科。"),
    "小苦荬": ("菊科", "原文科标题「桔梗目科」是目名不是科名；小苦荬属 Ixeridium 属菊科。"),
    "假还阳参": ("菊科", "原文科标题「桔梗目科」是目名不是科名；假还阳参属 Crepidiastrum 属菊科。"),
    "蒲公英": ("菊科", "原文科标题「桔梗目科」是目名不是科名；蒲公英属 Taraxacum 属菊科。"),
}

# Species whose Chinese name in the DOCX is a typo; corrected name + evidence.
NAME_FIX = {
    "衫松": ("杉松", "原文作「衫松」；拉丁名 Abies holophylla、别名「辽东冷杉」均指向杉松，《中国植物志》中文名为杉松。"),
    "顿萼附地菜": ("钝萼附地菜", "原文作「顿萼」；拉丁名 Trigonotis amblyosepala 种加词意为「钝萼」，原文形态描述亦称「萼片顶端圆钝」，规范中文名为钝萼附地菜。"),
}

# ---------------------------------------------------------------- spots
# Schematic campus layout. Coordinates are illustrative only (the map states
# this in the UI); the *belonging* of a species to a spot comes from its 校园位置 text.
SPOTS = [
    # id, name, zone, x, y, aliases(patterns)
    ("gate_main", "正大门", "north", 150, 545, ["正大门"]),
    ("gate_north", "小北门", "north", 330, 70, ["小北门"]),
    ("library", "图书馆", "north", 95, 145, ["图书馆"]),
    ("b3", "3号楼", "north", 235, 250, ["3号楼", "三号楼"]),
    ("b4", "4号楼", "north", 350, 300, ["4号楼"]),
    ("b8", "8号楼", "north", 375, 175, ["8号楼"]),
    ("dorm9", "九舍", "north", 420, 90, ["九舍"]),
    ("canteen3", "3食堂", "north", 110, 330, ["3食堂"]),
    ("canteen12", "一二食堂", "north", 165, 395, ["一二食堂"]),
    ("plaza", "广场花坛", "north", 265, 375, ["广场花坛"]),
    ("field_n", "操场", "north", 370, 455, ["北院操场"]),
    ("clinic", "医务室", "north", 60, 470, ["医务室"]),
    ("underpass", "地下通道入口", "south", 555, 545, ["地下通道"]),
    ("art", "美术学院", "south", 640, 120, ["美术学院", "美术院"]),
    ("lake", "人工湖", "south", 745, 205, ["人工湖"]),
    ("field_s", "操场外围", "south", 645, 470, ["操场外围"]),
    ("court_s", "篮球场", "south", 720, 380, ["篮球场"]),
    ("museum", "自然博物馆", "south", 855, 300, ["自然博物馆"]),
    ("dorm14", "14舍", "south", 800, 460, ["14舍"]),
    ("dorm15", "15舍", "south", 855, 405, ["15舍"]),
    ("dorm18", "18舍", "south", 930, 205, ["18舍"]),
    ("dorm19", "19舍", "south", 935, 130, ["19舍", "十九舍"]),
    ("canteen_s", "食堂", "south", 875, 490, ["南院食堂"]),
    ("parcel", "菜鸟驿站", "south", 600, 300, ["菜鸟驿站"]),
    ("maple", "红枫广场", "unknown", 0, 0, ["红枫广场"]),
]
SPOT_BY_ID = {s[0]: s for s in SPOTS}

LIFE_FORMS = ["乔木", "灌木", "草本", "藤本", "蕨类", "棕榈"]
USE_TAGS = ["观赏", "药用", "食用", "用材", "生态", "蜜源", "香料", "纤维"]
EFFICACY = [
    ("清热解毒", ["清热", "解毒"]),
    ("活血散瘀", ["活血", "化瘀", "散瘀", "活血通络"]),
    ("祛风除湿", ["祛风", "除湿", "风湿"]),
    ("止血收敛", ["止血", "收敛"]),
    ("利湿通淋", ["利湿", "利尿", "通淋", "利水"]),
    ("止咳化痰", ["止咳", "化痰", "润肺", "祛痰"]),
    ("健胃消食", ["健胃", "消食", "理气", "开胃"]),
    ("补益强壮", ["补益", "滋补", "补虚", "补肾", "养血"]),
    ("消肿止痛", ["消肿", "止痛", "镇痛"]),
    ("杀虫止痒", ["杀虫", "驱虫", "止痒"]),
    ("抗菌消炎", ["抗菌", "消炎", "抗炎", "抑菌"]),
]
NEG = ["不可食用", "不能食用", "不宜食用", "禁止食用", "勿食", "不可内服", "严禁"]


def clean(t):
    if not t:
        return ""
    t = t.replace("\u3000", " ").replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"^[\s，。；、:：|]+", "", t)
    t = re.sub(r"\s*([，。；：])\s*", r"\1", t)
    return t.strip()


def snippet(text, start, before=24, after=26):
    a = max(0, start - before)
    b = min(len(text), start + after)
    return ("…" if a else "") + text[a:b].replace("\n", " ") + ("…" if b < len(text) else "")


def split_alias(raw, name):
    parts = re.split(r"[，,、；;/／\s]+", raw)
    out = []
    for p in parts:
        p = clean(p).strip("。.．")
        p = re.sub(r"[（(].*?[）)]", "", p).strip()
        if not p or p == name or len(p) > 12:
            continue
        if p not in out:
            out.append(p)
    return out


def derive_lifeform(text):
    tags, ev = [], ""
    for tag, pat in [("藤本", r"藤本|攀援|攀缘"),
                     ("草本", r"草本"),
                     ("乔木", r"乔木"),
                     ("灌木", r"灌木"),
                     ("蕨类", r"蕨类植物|蕨类")]:
        m = re.search(pat, text)
        if m:
            tags.append(tag)
            if not ev:
                ev = snippet(text, m.start())
    if not tags:
        # no explicit life-form word: woody wording is still direct evidence of a tree
        m = re.search(r"木本|树冠|胸径|树干|主干", text)
        if m:
            tags.append("乔木")
            ev = snippet(text, m.start())
    order = ["乔木", "灌木", "草本", "藤本", "蕨类"]
    return [t for t in order if t in tags], ev


def derive_habit(text):
    tags, ev = [], ""
    for tag, pat in [("常绿", r"常绿"), ("落叶", r"落叶")]:
        m = re.search(pat, text)
        if m:
            tags.append(tag)
            ev = ev or snippet(text, m.start())
    return tags, ev


def derive_use(text):
    pats = {
        "观赏": r"观赏|园林|绿化|景观|花境|行道树|盆景|庭园",
        "药用": r"药用|入药|药材|中药|药效|功效",
        "食用": r"食用|野菜|果酱|酿酒|可食|生食|做馅|茶饮",
        "用材": r"木材|用材|建筑|家具|雕刻|造纸",
        "生态": r"生态|水土保持|固土|防风固沙|护坡|抗污染|滞尘",
        "蜜源": r"蜜源",
        "香料": r"香料|芳香油|精油|挥发油",
        "纤维": r"纤维|编织|搓绳",
    }
    tags, ev = [], {}
    for tag, pat in pats.items():
        for m in re.finditer(pat, text):
            seg_start = max(0, m.start() - 12)
            seg = text[seg_start:m.start() + 16]
            if tag == "食用" and any(n in seg for n in NEG):
                continue
            tags.append(tag)
            ev.setdefault(tag, snippet(text, m.start()))
            break
    return [t for t in USE_TAGS if t in tags], ev


def derive_efficacy(text):
    tags, ev = [], {}
    for name, keys in EFFICACY:
        for k in keys:
            m = re.search(k, text)
            if m:
                tags.append(name)
                ev[name] = snippet(text, m.start())
                break
    return tags, ev


def derive_toxic(*texts):
    blob = " ".join(t for t in texts if t)
    for pat in [r"有毒", r"中毒", r"毒性", r"含毒", r"剧毒", r"小毒"]:
        for m in re.finditer(pat, blob):
            pre = blob[max(0, m.start() - 2):m.start()]
            if pre.endswith("解") or pre.endswith("消") or pre.endswith("无"):
                continue
            return True, snippet(blob, m.start())
    return False, ""


def derive_protected(*texts):
    blob = " ".join(t for t in texts if t)
    m = re.search(r"(国家一级保护[^。；，]*|国家二级保护[^。；，]*|国家[一二]级保护植物|重点保护野生植物)", blob)
    if m:
        return m.group(1)[:20], snippet(blob, m.start())
    return "", ""


def derive_period(text, key):
    pat = (key + r"\s*[:：]?\s*"
           r"([0-9０-９一二三四五六七八九十]{1,2}\s*[-–—~～至]?\s*"
           r"[0-9０-９一二三四五六七八九十]{0,2}\s*月)")
    m = re.search(pat, text)
    return re.sub(r"\s+", "", m.group(1)) if m else ""


def parse_location(raw):
    campus, spots, rest = [], [], raw
    for key, pat in [("北院", r"北院"), ("南院", r"南院")]:
        if re.search(pat, raw):
            campus.append(key)
    for sid, name, zone, x, y, al in SPOTS:
        for a in al:
            if a in raw:
                spots.append(sid)
                break
    # strip spot words to guess campus when only one campus is implied by the spot
    if not campus:
        for sid in spots:
            z = SPOT_BY_ID[sid][2]
            if z in ("north", "south") and z not in campus:
                campus.append("北院" if z == "north" else "南院")
    return campus, spots


def genus_clean(g):
    g = clean(g)
    note = ""
    m = re.search(r"[（(]([^）)]*)[）)]", g)
    if m:
        note = m.group(1)
        g = g[:m.start()] + g[m.end():]
    g = g.strip()
    g = re.sub(r"^[\u4e00-\u9fff]{1,3}科", "", g)
    return g.strip(), note


rows, review = [], []
for sp in plants:
    f = sp["fields"]
    name = sp["name"]
    morphology = clean(f.get("形态特征", ""))
    eco_raw = clean(f.get("生态习性", ""))
    dist = clean(f.get("分布地区", ""))
    if eco_raw:
        ecology, eco_label = eco_raw, "生态习性"
    elif dist:
        ecology, eco_label = dist, "分布地区"
    else:
        ecology, eco_label = "", ""
    value = clean(f.get("价值功用", ""))
    intro = clean(f.get("简要介绍", ""))
    loc_raw = clean(f.get("校园位置", ""))
    genus, genus_note = genus_clean(sp["genus"])
    family_raw = sp["familyRaw"]
    if name in FAMILY_FIX:
        family, why = FAMILY_FIX[name]
        review.append({"kind": "family", "species": name, "from": family_raw, "to": family, "reason": why})
    else:
        family, why = family_raw, ""

    name_raw = name
    if name in NAME_FIX:
        fixed_name, name_why = NAME_FIX[name]
        review.append({"kind": "name", "species": name, "from": name, "to": fixed_name, "reason": name_why})
        name = fixed_name

    all_text = " ".join([morphology, ecology, value, intro])
    life, life_ev = derive_lifeform(morphology + " " + ecology)
    habit, habit_ev = derive_habit(morphology + " " + ecology + " " + value + " " + intro)
    taxon = ["裸子植物"] if family in {"苏铁科", "银杏科", "松科", "柏科", "红豆杉科"} else ["被子植物"]
    use, use_ev = derive_use(value + " " + intro)
    eff, eff_ev = derive_efficacy(value + " " + " ".join(f.values()))
    toxic, tox_ev = derive_toxic(all_text)
    protected, prot_ev = derive_protected(all_text)
    flower = derive_period(morphology + " " + ecology, "花期")
    fruit = derive_period(morphology + " " + ecology, "果期")
    campus, spots = parse_location(loc_raw)

    if not life:
        review.append({"kind": "lifeform_missing", "species": name, "text": morphology[:40]})
    if not ecology:
        review.append({"kind": "ecology_missing", "species": name, "note": "原文无「生态习性/分布地区」段落"})
    if not spots and not campus:
        review.append({"kind": "location_unparsed", "species": name, "raw": loc_raw})
    if toxic:
        review.append({"kind": "toxic", "species": name, "evidence": tox_ev})
    if protected:
        review.append({"kind": "protected", "species": name, "value": protected, "evidence": prot_ev})

    im = imgs[str(sp["id"])]
    images = []
    for n, it in enumerate(im["items"], 1):
        images.append({
            "file": it["file"], "thumb": it["thumb"], "lqip": it["lqip"],
            "w": it["w"], "h": it["h"], "color": it.get("color", "#e8f0e8"),
            "alt": f"{name} 照片 {n}",
        })

    rows.append({
        "id": sp["id"], "code": im["code"],
        "name": name, "nameRaw": name_raw if name_raw != name else "",
        "latin": clean(sp["latin"]), "alias": split_alias(f.get("别名", ""), name),
        "family": family, "familyRaw": family_raw, "familyNote": why,
        "genus": genus, "genusNote": genus_note,
        "lifeForm": life, "habit": habit, "taxon": taxon, "use": use, "efficacy": eff,
        "toxic": toxic, "protected": protected,
        "flower": flower, "fruit": fruit,
        "intro": intro, "morphology": morphology, "ecology": ecology,
        "ecologyLabel": eco_label, "distribution": dist, "value": value,
        "location": {"raw": loc_raw, "campus": campus, "spots": spots},
        "images": images,
        "derived": {
            "lifeForm": life_ev, "habit": habit_ev,
            "use": use_ev, "efficacy": eff_ev,
            "toxic": tox_ev, "protected": prot_ev,
        },
    })

# ---------------------------------------------------------------- site meta
fam_order = []
for r in rows:
    if r["family"] not in fam_order:
        fam_order.append(r["family"])
fam_count = {}
for r in rows:
    fam_count[r["family"]] = fam_count.get(r["family"], 0) + 1

sitespots = [{"id": s[0], "name": s[1], "zone": s[2], "x": s[3], "y": s[4]} for s in SPOTS]

site = {
    "name": "沈阳大学校园植物图鉴",
    "short": "沈大植物图鉴",
    "subtitle": "校园植物识别 · 实习辅助",
    "campus": {
        "north": {"id": "north", "name": "北院", "x": 20, "y": 40, "w": 440, "h": 560},
        "south": {"id": "south", "name": "南院", "x": 520, "y": 40, "w": 440, "h": 560},
        "unknown": {"id": "unknown", "name": "校区未注明", "x": 0, "y": 0, "w": 0, "h": 0},
    },
    "spots": sitespots,
    "families": fam_order,
    "familyCount": fam_count,
    "lifeForms": [t for t in LIFE_FORMS if any(t in r["lifeForm"] for r in rows)],
    "taxa": ["裸子植物", "被子植物"],
    "uses": USE_TAGS,
    "efficacy": [e[0] for e in EFFICACY],
    "counts": {
        "species": len(rows),
        "images": sum(len(r["images"]) for r in rows),
        "families": len(fam_order),
    },
    "updated": datetime.date(2026, 11, 15).isoformat(),
    "source": "《11.11校园植物》文档（沈阳大学校园植物名录）",
    "repo": "",
    "review": {
        "name": [{"species": r["from"], "to": r["to"], "reason": r["reason"]}
                 for r in review if r["kind"] == "name"],
        "family": [{"species": r["species"], "from": r["from"], "to": r["to"], "reason": r["reason"]}
                   for r in review if r["kind"] == "family"],
        "toxic": [{"species": r["species"], "evidence": r["evidence"]}
                  for r in review if r["kind"] == "toxic"],
        "protected": [{"species": r["species"], "value": r["value"], "evidence": r["evidence"]}
                      for r in review if r["kind"] == "protected"],
        "missingEcology": [r["species"] for r in review if r["kind"] == "ecology_missing"],
        "missingLifeForm": [r["species"] for r in review if r["kind"] == "lifeform_missing"],
    },
}

json.dump(rows, open(os.path.join(OUT_DATA, "plants.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(site, open(os.path.join(OUT_DATA, "site.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# ---------------------------------------------------------------- review doc
L = []
A = L.append
A("# 数据复核清单\n")
A("本文件记录从原文档进站时的**每一处主动改动**及其依据。页面上的物种正文均为原文，未改写。\n")
A(f"- 物种数：**{len(rows)}**")
A(f"- 图片：**{sum(len(r['images']) for r in rows)} 张**")
A(f"- 科：**{len(fam_order)}**\n")

name_fix = [r for r in review if r["kind"] == "name"]
A("## 〇、中文名订正（共 %d 种）\n" % len(name_fix))
if name_fix:
    A("| 原文 | 改为 | 依据 |")
    A("|---|---|---|")
    for r in name_fix:
        A(f"| {r['from']} | {r['to']} | {r['reason']} |")
else:
    A("无。")
A("\n")

A("## 一、科名纠正（共 %d 种）\n" % sum(1 for r in review if r["kind"] == "family"))
A("| 物种 | 原文科标题 | 改为 | 依据 |")
A("|---|---|---|---|")
for r in review:
    if r["kind"] == "family":
        A(f"| {r['species']} | {r['from']} | {r['to']} | {r['reason']} |")

A("\n## 二、原文未写「生态习性」的物种（%d 种）\n" % sum(1 for r in review if r["kind"] == "ecology_missing"))
A("这些物种的形态与价值信息完整，但原文没有独立的生态习性/分布段落，页面留空并在详情页标注「原文未载」，不做补写。\n")
for r in review:
    if r["kind"] == "ecology_missing":
        A(f"- {r['species']}")

A("\n## 三、有毒判定（%d 种）\n" % sum(1 for r in review if r["kind"] == "toxic"))
A("仅当原文出现「有毒／中毒／毒性」等表述时标记，并附原句。未在原文出现的物种不标记。\n")
for r in review:
    if r["kind"] == "toxic":
        A(f"- **{r['species']}**：{r['evidence']}")

A("\n## 四、保护等级（%d 种）\n" % sum(1 for r in review if r["kind"] == "protected"))
for r in review:
    if r["kind"] == "protected":
        A(f"- **{r['species']}**：{r['value']}（原文：{r['evidence']}）")

A("\n## 五、生活型未能自动判定（%d 种）\n" % sum(1 for r in review if r["kind"] == "lifeform_missing"))
for r in review:
    if r["kind"] == "lifeform_missing":
        A(f"- {r['species']}：{r['text']}")

A("\n## 六、校园位置未能解析出具体地点（%d 种）\n" % sum(1 for r in review if r["kind"] == "location_unparsed"))
for r in review:
    if r["kind"] == "location_unparsed":
        A(f"- {r['species']}：{r['raw']}")

A("\n## 七、目录与正文不一致（未改动，仅记录）\n")
A("- **美国地锦**：目录列为独立条目，正文没有对应段落；它与正文的「五叶地锦」（*Parthenocissus quinquefolia*）为同一物种，故未凭空补写。")
A("- **白忍冬**：目录作「白忍冬」，正文条目为「长白忍冬」（*Lonicera ruprechtiana*），以正文为准。")
A("- **锦带花属**：目录作「锦带花属」，正文条目为「锦带花」（*Weigela florida*），以正文为准。")

A("\n## 八、说明\n")
A("- 生活型、常绿/落叶、用途、功效、花期、果期等标签均来自原文关键词匹配，证据保存在 `data/plants.json` 的 `derived` 字段。")
A("- 功效标签只为「检索/筛选」提供入口，不构成任何用药建议。")
A("- 科名未做 APG 大合并（如槭树科→无患子科、藜科→苋科、虎耳草科→绣球花科），保持《中国植物志》与教材通行科名，避免与教学口径冲突。")
A("- 地图为示意图，点位只表示物种所属建筑/区域，不是植株实测坐标。")

open(os.path.join(OUT_DOCS, "data-review.md"), "w", encoding="utf-8").write("\n".join(L))

print("plants", len(rows), "families", len(fam_order), "images", sum(len(r["images"]) for r in rows))
print("review items", len(review), {k: sum(1 for r in review if r['kind'] == k) for k in
      {r['kind'] for r in review}})
print("toxic:", [r['species'] for r in review if r['kind'] == 'toxic'])
print("no lifeform:", [r['species'] for r in review if r['kind'] == 'lifeform_missing'])
print("loc unparsed:", [r['species'] for r in review if r['kind'] == 'location_unparsed'])
