/* 纯逻辑测试（无需浏览器）：node scripts/test-logic.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^\.?\//, '');
  const body = readFileSync(resolve(ROOT, rel), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const { loadData, S, plantById } = await import('../assets/js/data.js');
const { search, filters, filterPlants, sortList, resetFilters } = await import('../assets/js/search.js');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

console.log('\n[数据]');
await loadData();
t('物种数 95', S.plants.length === 95, String(S.plants.length));
t('科数 38', S.site.families.length === 38, String(S.site.families.length));
t('每种植物的图片路径非空', S.plants.every(p => p.images.every(i => i.file && i.thumb)));
t('每种都有拉丁名', S.plants.every(p => p.latin.trim().length > 0));
t('id 唯一', new Set(S.plants.map(p => p.id)).size === 95);

console.log('\n[检索]');
const r1 = search('丁香');
t('搜索「丁香」有结果', r1.length >= 4, String(r1.length));
t('「丁香」命中紫丁香', r1.some(x => x.p.name === '紫丁香'));
const r2 = search('pinus');
t('拉丁名 pinus 命中松属', r2.filter(x => x.p.genus.includes('松属')).length >= 5, String(r2.length));
const r3 = search('清热解毒');
t('功效词可检索', r3.length >= 5, String(r3.length));
const r4 = search('凤尾蕉');
t('别名可检索（凤尾蕉→苏铁）', r4[0]?.p.name === '苏铁', r4[0]?.p.name);
const r5 = search('北院3号楼');
t('校园位置可检索', r5.length >= 5, String(r5.length));
const r6 = search('不存在的东西xyz');
t('无结果时返回空数组', r6.length === 0);
const r7 = search('松科 乔木');
t('多词为 AND 关系', r7.every(x => x.p.family === '松科'));

console.log('\n[筛选]');
resetFilters();
filters.lifeForm = '乔木';
const q1 = filterPlants();
t('乔木筛选非空', q1.length > 20, String(q1.length));
t('乔木筛选结果均为乔木', q1.every(p => p.lifeForm.includes('乔木')));
resetFilters();
filters.family = '菊科';
const q2 = filterPlants();
t('菊科 8 种', q2.length === 8, String(q2.length));
resetFilters();
filters.special = 'toxic';
const q3 = filterPlants();
t('有毒 2 种且都有依据', q3.length === 2 && q3.every(p => p.toxic && p.derived.toxic), String(q3.length));
resetFilters();
filters.special = 'protect';
t('保护植物 2 种', filterPlants().length === 2);
resetFilters();
filters.spot = 'b3';
const q4 = filterPlants();
t('3号楼地点有记录', q4.length >= 8, String(q4.length));
t('3号楼记录都含该地点', q4.every(p => p.location.spots.includes('b3')));
resetFilters();
filters.campus = '南院';
t('南院筛选有结果', filterPlants().length > 20);
resetFilters();

console.log('\n[排序]');
filters.sort = 'name';
const sorted = sortList(S.plants);
t('按名称排序第一项存在', !!sorted[0]?.name);
t('排序不丢项', sorted.length === 95);
filters.sort = 'default';
t('默认按编号', sortList(S.plants).every((p, i, a) => i === 0 || a[i - 1].id <= p.id));

console.log('\n[关系]');
const p = plantById(1);
t('plantById 可用', p?.name === '苏铁');
const fam = S.plants.filter(x => x.family === '蔷薇科');
t('蔷薇科物种最多', fam.length >= 16, String(fam.length));
t('同科不少于 1', fam.length > 1);

console.log(`\n结果：${fail ? '❌ ' + fail + ' 失败' : '✅ 全部通过'}（${pass} 项）`);
if (fail) process.exit(1);
