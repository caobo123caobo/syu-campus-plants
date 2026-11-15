/* 数据与资源完整性校验：node scripts/validate.mjs */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const ok = (msg) => console.log('  ✓ ' + msg);
const bad = (msg) => { errors.push(msg); console.log('  ✗ ' + msg); };
const warn = (msg) => { warns.push(msg); console.log('  ! ' + msg); };

function readJSON(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) { bad(`缺少文件 ${rel}`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { bad(`${rel} JSON 解析失败：${e.message}`); return null; }
}

console.log('\n[1] JSON 与字段');
const site = readJSON('data/site.json');
const plants = readJSON('data/plants.json');
if (site && plants) {
  ok(`site.json / plants.json 可解析（${plants.length} 条物种）`);
  const ids = new Set();
  for (const p of plants) {
    if (ids.has(p.id)) bad(`id 重复：${p.id}`); else ids.add(p.id);
    for (const k of ['name', 'latin', 'family', 'genus', 'code']) {
      if (!p[k]) bad(`${p.id} 缺少字段 ${k}`);
    }
    if (!/^\d{3}$/.test(p.code)) bad(`${p.id} code 格式异常：${p.code}`);
    if (!p.morphology) bad(`${p.name} 缺少形态特征`);
    if (!Array.isArray(p.images) || p.images.length === 0) bad(`${p.name} 没有图片`);
    if (!p.location || !p.location.raw) bad(`${p.name} 缺少校园位置`);
    if (p.familyRaw && !p.familyNote && p.familyRaw !== p.family) {
      bad(`${p.name} 科名与原文不同但未记录原因`);
    }
    for (const k of ['use', 'efficacy', 'lifeForm', 'habit']) {
      if (!Array.isArray(p[k])) bad(`${p.name} 字段 ${k} 不是数组`);
    }
  }
  ok('字段结构检查完成');

  const fams = new Set(plants.map(p => p.family));
  for (const f of fams) if (!site.families.includes(f)) bad(`site.families 缺少 ${f}`);
  for (const f of site.families) if (!fams.has(f)) warn(`site.families 多出未使用的 ${f}`);
  const spots = new Set(site.spots.map(s => s.id));
  for (const p of plants) for (const s of p.location.spots || []) if (!spots.has(s)) bad(`${p.name} 引用了不存在的地点 ${s}`);
  ok(`科 ${fams.size} 个 / 地点 ${spots.size} 个引用一致`);

  if (site.counts.species !== plants.length) bad(`site.counts.species=${site.counts.species} 与实际 ${plants.length} 不符`);
  const imgN = plants.reduce((n, p) => n + p.images.length, 0);
  if (site.counts.images !== imgN) bad(`site.counts.images=${site.counts.images} 与实际 ${imgN} 不符`);
  ok('计数一致');
}

console.log('\n[2] 图片文件');
if (plants) {
  let missing = 0, checked = 0, bytes = 0;
  for (const p of plants) {
    for (const img of p.images) {
      checked += 1;
      for (const rel of [img.file, img.thumb]) {
        const abs = resolve(ROOT, rel);
        if (!existsSync(abs) || statSync(abs).size === 0) { missing += 1; if (missing <= 6) bad(`缺失图片 ${rel}`); }
      }
      bytes += img.bytes || 0;
    }
  }
  if (missing === 0) ok(`${checked} 条图片记录、${checked * 2} 个文件全部存在`);
  else bad(`共 ${missing} 个图片文件缺失`);
  ok(`原图合计约 ${(bytes / 1048576).toFixed(1)} MB`);
}

console.log('\n[3] 页面入口');
for (const rel of ['index.html', 'manifest.webmanifest', 'sw.js', 'assets/css/app.css',
  'assets/icons/favicon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png']) {
  if (!existsSync(resolve(ROOT, rel))) bad(`缺少 ${rel}`);
}
ok('入口文件检查完成');

const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('http'));
for (const r of refs) {
  if (!existsSync(resolve(ROOT, r))) bad(`index.html 引用了不存在的 ${r}`);
}
ok(`index.html 中的 ${refs.length} 个本地引用均存在`);

const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const coreBlock = sw.match(/const CORE = \[([\s\S]*?)\];/);
if (coreBlock) {
  const files = [...coreBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(x => x !== './');
  let miss = 0;
  for (const f of files) {
    if (!existsSync(resolve(ROOT, f.replace(/^\.\//, '')))) { miss += 1; bad(`sw.js 预缓存缺失 ${f}`); }
  }
  if (!miss) ok(`sw.js 预缓存 ${files.length} 个资源均存在`);
} else warn('未能解析 sw.js 的 CORE 列表');

console.log('\n[4] 内容对照');
if (plants) {
  const chars = plants.reduce((n, p) => n + [p.morphology, p.ecology, p.value, p.intro].join('').length, 0);
  ok(`正文合计 ${chars.toLocaleString()} 字（${(chars / plants.length).toFixed(0)} 字/种）`);
  const noAlias = plants.filter(p => !p.alias?.length).map(p => p.name);
  const noLoc = plants.filter(p => !p.location?.spots?.length).map(p => p.name);
  if (noAlias.length) warn(`无别名：${noAlias.join('、')}`);
  if (noLoc.length) warn(`仅到校区、未定位到具体地点：${noLoc.join('、')}`);
  ok('别名 / 地点覆盖统计完成');
}

console.log('\n[5] 引用一致性（派生标签）');
if (plants) {
  const withToxic = plants.filter(p => p.toxic);
  for (const p of withToxic) if (!p.derived?.toxic) bad(`${p.name} 标记有毒但无原文依据`);
  const withProt = plants.filter(p => p.protected);
  for (const p of withProt) if (!p.derived?.protected) bad(`${p.name} 标记保护但无原文依据`);
  const withLife = plants.filter(p => p.lifeForm.length);
  const missingEv = withLife.filter(p => !p.derived?.lifeForm);
  if (missingEv.length) bad(`生活型缺少依据：${missingEv.map(p => p.name).join('、')}`);
  ok(`有毒 ${withToxic.length} / 保护 ${withProt.length} / 有生活型 ${withLife.length}，依据齐全`);
}

console.log(`\n结果：${errors.length ? '❌ ' + errors.length + ' 个错误' : '✅ 全部通过'}` +
  (warns.length ? `，${warns.length} 个提示` : ''));
if (errors.length) {
  console.log('\n错误清单：');
  errors.forEach(e => console.log(' - ' + e));
  process.exit(1);
}
