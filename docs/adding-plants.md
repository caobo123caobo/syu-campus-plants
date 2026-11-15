# 添加 / 修改植物

本项目的植物数据是静态 JSON，添加一种植物**不需要写代码**。有两种方式，任选其一。

---

## 方式一：脚本（推荐）

准备好照片后，在项目根目录执行：

```bash
python scripts/add_plant.py \
  --name "白蜡" \
  --latin "Fraxinus chinensis Roxb." \
  --family "木樨科" \
  --genus "白蜡属" \
  --alias "白蜡树、青榔木" \
  --morphology "落叶乔木，高10–12米；树皮灰褐色，纵裂；奇数羽状复叶对生，小叶5–7枚……" \
  --ecology "喜光，耐寒，耐水湿，对土壤要求不严……" \
  --value "树形优美，可作行道树；木材坚韧，供家具、农具用……" \
  --location "北院8号楼西侧" \
  --life-form 乔木 \
  --images "D:/照片/白蜡1.jpg,D:/照片/白蜡2.jpg"
```

脚本会：

1. 自动分配下一个编号（`096`、`097`……）；
2. 把照片压缩成 `images/<编号>/01.webp`（大图，长边 ≤1000）和 `01s.webp`（缩略图，长边 ≤320），并生成模糊占位图；
3. 从正文关键词提取用途、功效等标签（与内置数据同一套规则）；
4. 追加到 `data/plants.json`，同步更新 `data/site.json` 的计数与科列表。

新增的科会自动加进筛选列表；新增地点请参考下方的「地点」说明。

---

## 方式二：手工编辑

### 1. 图片

```
images/096/01.webp      大图，长边 ≤ 1000px
images/096/01s.webp     缩略图，长边 ≤ 320px
images/096/02.webp
images/096/02s.webp
```

- 编号三位，与物种 `code` 一致；
- 每张图必须有同名 `s` 版本（卡片、列表只加载缩略图）；
- 建议 WebP，质量 70 左右；
- 可以把原图放进 `_source/images_raw/`，再改 `scripts/build_images.py` 里的 `PLANTS` 来源重新生成（该目录不进入仓库）。

### 2. 数据

在 `data/plants.json` 数组末尾追加一条（完整字段说明见 [data-dictionary.md](data-dictionary.md)）：

```json
{
  "id": 96,
  "code": "096",
  "name": "白蜡",
  "latin": "Fraxinus chinensis Roxb.",
  "alias": ["白蜡树", "青榔木"],
  "family": "木樨科",
  "familyRaw": "木樨科",
  "familyNote": "",
  "genus": "白蜡属",
  "genusNote": "",
  "lifeForm": ["乔木"],
  "habit": ["落叶"],
  "taxon": ["被子植物"],
  "use": ["观赏", "用材"],
  "efficacy": [],
  "toxic": false,
  "protected": "",
  "flower": "4月",
  "fruit": "9–10月",
  "intro": "",
  "morphology": "……",
  "ecology": "……",
  "ecologyLabel": "生态习性",
  "distribution": "",
  "value": "……",
  "location": { "raw": "北院8号楼西侧", "campus": ["北院"], "spots": ["b8"] },
  "images": [
    { "file": "images/096/01.webp", "thumb": "images/096/01s.webp", "lqip": "data:image/webp;base64,...", "w": 1000, "h": 750, "alt": "白蜡 照片 1" }
  ],
  "derived": { "lifeForm": "原文：落叶乔木", "use": { "观赏": "原文：可作行道树" } }
}
```

`id` 必须唯一且递增；`lqip` 可以省略（会显示纯色占位）。

### 3. 科与地点

- **新科**：把科名加入 `data/site.json` 的 `families`；`familyCount` 由脚本维护，手工改时同步加一。
- **新地点**：在 `data/site.json` 的 `spots` 里加一条 `{ "id": "b10", "name": "10号楼", "zone": "north", "x": 300, "y": 400 }`。
  - `zone`：`north`（北院）/ `south`（南院）/ `unknown`（校区未注明，不画到图上）；
  - `x`、`y` 是示意坐标（北院区域 `x:20–460`、`y:40–600`；南院 `x:520–960`），**不是真实经纬度**。
  - 然后在物种的 `location.spots` 里填对应的 `id`。

### 4. 自检

```bash
node scripts/validate.mjs
```

会检查：JSON 能否解析、字段是否齐全、图片文件是否都存在、科/地点引用是否有效、计数是否一致、有毒/保护标记是否都有原文依据。

### 5. 发布

如果是已部署的站点，修改后记得把 `sw.js` 顶部的版本号改一下（如 `syu-v1.0.1`），否则老访客可能继续用缓存的旧数据。

---

## 常见问题

**Q：照片拍的是横的还是竖的？**
会按 EXIF 自动旋转；如果源文件本身方向不对，请先在图片工具里转正。

**Q：一种植物有很多张照片怎么办？**
继续加 `03.webp` / `03s.webp`，并在 `images` 数组里按顺序追加。

**Q：原文没有某个字段怎么办？**
留空即可，页面会显示「原文未载」。**不要为了填满而补写没有出处的信息**——本项目的原则是所有内容可溯源。

**Q：能不能只填名称和图片？**
可以。形态、生态、价值留空，页面显示「原文未载」，检索仍能命中名称和别名。但建议至少补一句辨识特征，方便别人认。

**Q：想批量导入 Excel？**
把表头整理成与 `plants.json` 字段一致，写一个 Node/Python 脚本转成 JSON，再运行 `validate.mjs`。`scripts/add_plant.py` 也可以循环调用。
