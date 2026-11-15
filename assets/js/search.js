/* 检索与筛选 */
import { S } from './data.js';

export const filters = {
  q: '',
  family: '',
  lifeForm: '',
  use: '',
  efficacy: '',
  campus: '',
  spot: '',
  special: '', // 'toxic' | 'protect' | 'gymno' | ''
  sort: 'default',
};

export function resetFilters(keepQuery = false) {
  const q = filters.q;
  Object.assign(filters, {
    q: keepQuery ? q : '', family: '', lifeForm: '', use: '',
    efficacy: '', campus: '', spot: '', special: '', sort: filters.sort,
  });
}

export function activeFilterCount() {
  let n = 0;
  for (const k of ['family', 'lifeForm', 'use', 'efficacy', 'campus', 'spot', 'special']) {
    if (filters[k]) n++;
  }
  return n;
}

function matchesSpecial(p) {
  switch (filters.special) {
    case 'toxic': return !!p.toxic;
    case 'protect': return !!p.protected;
    case 'gymno': return (p.taxon || []).includes('裸子植物');
    default: return true;
  }
}

export function filterPlants() {
  let list = S.plants;
  if (filters.family) list = list.filter(p => p.family === filters.family);
  if (filters.lifeForm) list = list.filter(p => (p.lifeForm || []).includes(filters.lifeForm));
  if (filters.use) list = list.filter(p => (p.use || []).includes(filters.use));
  if (filters.efficacy) list = list.filter(p => (p.efficacy || []).includes(filters.efficacy));
  if (filters.campus) list = list.filter(p => (p.location?.campus || []).includes(filters.campus));
  if (filters.spot) list = list.filter(p => (p.location?.spots || []).includes(filters.spot));
  list = list.filter(matchesSpecial);
  return list;
}

function scoreOne(p, tokens) {
  let score = 0;
  const why = new Set();
  for (const t of tokens) {
    let matched = false;
    if (p._name === t) { score += 140; why.add('名称'); matched = true; }
    else if (p._name.startsWith(t)) { score += 110; why.add('名称'); matched = true; }
    else if (p._name.includes(t)) { score += 85; why.add('名称'); matched = true; }
    if (p._alias.includes(t)) { score += 70; why.add('别名'); matched = true; }
    if (p._latin.includes(t)) { score += 62; why.add('拉丁名'); matched = true; }
    if (p._genus.includes(t) || p._family.includes(t)) { score += 44; why.add('科属'); matched = true; }
    if ((p.location?.raw || '').toLowerCase().includes(t)) { score += 26; why.add('校园位置'); matched = true; }
    if ((p.use || []).join('').includes(t) || (p.efficacy || []).join('').includes(t)) { score += 22; why.add('用途/功效'); matched = true; }
    if (p._hay.includes(t)) { score += 12; why.add('正文'); matched = true; }
    if (p._short.includes(t)) matched = true;
    if (!matched) return null;
  }
  return { p, score, why: [...why] };
}

export function search(q) {
  const raw = (q || '').trim();
  if (!raw) return [];
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const p of S.plants) {
    const r = scoreOne(p, tokens);
    if (r) out.push(r);
  }
  out.sort((a, b) => b.score - a.score || a.p.id - b.p.id);
  return out;
}

export function sortList(list) {
  const arr = list.slice();
  if (filters.sort === 'name') {
    const coll = new Intl.Collator('zh-Hans-CN');
    arr.sort((a, b) => coll.compare(a.name, b.name));
  } else if (filters.sort === 'family') {
    arr.sort((a, b) => a.family.localeCompare(b.family, 'zh-Hans-CN') || a.id - b.id);
  } else if (filters.sort === 'images') {
    arr.sort((a, b) => b.images.length - a.images.length || a.id - b.id);
  } else {
    arr.sort((a, b) => a.id - b.id);
  }
  return arr;
}
