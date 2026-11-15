# 数据字典

## 一、`data/plants.json`（数组，每项一个物种）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 唯一编号，从 1 递增 |
| `code` | string | 三位编号，对应 `images/<code>/` 目录 |
| `name` | string | 中文名（原文标题里的种名） |
| `latin` | string | 拉丁学名（原文） |
| `alias` | string[] | 别名，来自原文「别名」栏 |
| `family` | string | 规范科名（可能经订正） |
| `familyRaw` | string | 原文科标题原样保留 |
| `familyNote` | string | 科名订正理由；为空表示未改动 |
| `genus` / `genusNote` | string | 属名；括号内的亚属批注单独放在 `genusNote` |
| `lifeForm` | string[] | 生活型：乔木 / 灌木 / 草本 / 藤本 / 蕨类；原文未明示则为空数组 |
| `habit` | string[] | 常绿 / 落叶 |
| `taxon` | string[] | 裸子植物 / 被子植物 |
| `use` | string[] | 用途标签：观赏 / 药用 / 食用 / 用材 / 生态 / 蜜源 / 香料 / 纤维 |
| `efficacy` | string[] | 药用功效标签（清热解毒、活血散瘀……），仅用于检索 |
| `toxic` | boolean | 原文是否出现毒性表述 |
| `protected` | string | 保护等级，如「国家一级保护植物」 |
| `flower` / `fruit` | string | 花期 / 果期，仅在原文明确写出时填写，如 `4~5月` |
| `intro` | string | 原文「简要介绍」（少数物种有） |
| `morphology` | string | 形态特征（原文；原文用「表型特征」的已归入此字段） |
| `ecology` | string | 生态习性（原文；若无则用「分布地区」补充） |
| `ecologyLabel` | string | `生态习性` 或 `分布地区`，用于详情页显示来源栏目 |
| `distribution` | string | 原文「分布地区」原样（即使已并入 ecology 也保留） |
| `value` | string | 价值功用（原文；「经济价值/主要价值/功用价值」等已归入此字段，重复段落会合并） |
| `location` | object | `{ raw, campus[], spots[] }`：原文位置、所属校区、地点 id 列表 |
| `images` | object[] | `{ file, thumb, lqip, w, h, alt }`，`lqip` 为 base64 模糊占位图 |
| `derived` | object | 每个自动标签的**原文依据片段**，用于详情页「依据」展开与人工复核 |

### 派生规则（可复核）

- 生活型：优先匹配「乔木/灌木/草本/藤本/蕨类」；都没有时，若出现「木本/树冠/胸径/树干/主干」判为乔木。
- 常绿/落叶：匹配「常绿」「落叶」。
- 用途：观赏（观赏/园林/景观/花境/行道树…）、药用（药用/入药/药材…）、食用（食用/野菜/果酱…）、用材、生态、蜜源、香料、纤维；「不可食用」等否定句会被排除。
- 功效：11 类关键词表，命中即打标签；仅为检索服务，不构成医学结论。
- 有毒：出现「有毒/中毒/毒性/含毒/剧毒/小毒」且前一字不是「解/消/无」时标记。
- 保护等级：匹配「国家一级/二级保护」「重点保护野生植物」。

## 二、`data/site.json`

| 字段 | 说明 |
|---|---|
| `name` / `short` / `subtitle` | 站点标题 |
| `campus` | 三个区域：`north`（北院）、`south`（南院）、`unknown`；含示意坐标 `x,y,w,h` |
| `spots` | 地点数组：`{ id, name, zone, x, y }` |
| `families` | 科名列表（按原文出现顺序，已归并） |
| `familyCount` | 各科物种数 |
| `lifeForms` / `uses` / `efficacy` / `taxa` | 筛选项枚举 |
| `counts` | `{ species, images, families }` |
| `updated` | 数据日期 |
| `source` | 数据来源说明 |
| `repo` | GitHub 仓库地址，留空则关于页显示占位提示 |
| `review` | 数据订正记录：科名订正、有毒/保护清单、缺生态习性/生活型的物种 |

## 三、图片目录

```
images/<code>/01.webp     大图（长边 ≤1000，q70）
images/<code>/01s.webp    缩略图（长边 ≤320，q62）
```

`code` 与物种 `code` 一致；编号从 `01` 起，按原文档中的图片顺序。

## 四、本地存储

| 键 / 库 | 内容 |
|---|---|
| `syu.favs.v1` | 收藏的物种 id |
| `syu.viewed.v1` / `syu.mastered.v1` | 已浏览 / 已掌握 |
| `syu.quiz.v1` / `syu.wrong.v1` | 测验统计 / 错题本 |
| `syu.settings.v1` | 主题等设置 |
| `syu.days.v1` | 打卡日期与当日学习数 |
| `syu.recent.v1` | 最近搜索词 |
| IndexedDB `syu-notes` | 观察记录（含压缩后的照片 Blob） |

清除浏览器数据会丢失以上全部内容；观察记录可在「记录」页导出 JSON（不含照片文件）。
