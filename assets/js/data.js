/* 数据加载与索引 */
export const S = {
  site: null,
  plants: [],
  byId: new Map(),
  loaded: false,
};

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 加载失败：${res.status}`);
  return res.json();
}

export async function loadData() {
  if (S.loaded) return S;
  const [site, plants] = await Promise.all([
    fetchJSON('data/site.json'),
    fetchJSON('data/plants.json'),
  ]);
  S.site = site;
  S.plants = plants.slice().sort((a, b) => a.id - b.id);
  S.byId = new Map(S.plants.map(p => [p.id, p]));
  // 预生成检索用的小写串
  for (const p of S.plants) {
    p._name = p.name.toLowerCase();
    p._alias = (p.alias || []).join(' ').toLowerCase();
    p._latin = (p.latin || '').toLowerCase();
    p._genus = (p.genus || '').toLowerCase();
    p._family = (p.family || '').toLowerCase();
    p._hay = [p.morphology, p.ecology, p.value, p.intro, p.location?.raw,
      (p.use || []).join(' '), (p.efficacy || []).join(' ')].join(' ').toLowerCase();
    p._short = [p.name, ...(p.alias || []), p.latin, p.family, p.genus].join(' ').toLowerCase();
  }
  S.loaded = true;
  return S;
}

export const plantById = id => S.byId.get(Number(id)) || null;

export function thumbOf(p, i = 0) {
  const img = p?.images?.[i];
  return img ? img.thumb : '';
}
export function coverOf(p) {
  const img = p?.images?.[0];
  return img ? img.lqip : '';
}

export function formText(p) {
  const parts = [...(p.lifeForm || []), ...(p.habit || [])];
  return parts.length ? parts.join(' · ') : '生活型原文未标注';
}

export function aliasText(p) {
  return (p.alias || []).join('、');
}

export function campusText(p) {
  const c = p.location?.campus || [];
  return c.length ? c.join(' / ') : '校区未注明';
}

export function locationText(p) {
  const raw = p.location?.raw || '';
  const campus = campusText(p);
  if (!raw) return campus;
  if (campus === '校区未注明') return raw;
  return raw;
}

export function spotNames(p) {
  const map = new Map((S.site?.spots || []).map(s => [s.id, s.name]));
  return (p.location?.spots || []).map(id => map.get(id)).filter(Boolean);
}

export function familyPlants(family) {
  return S.plants.filter(p => p.family === family);
}

export function neighbours(p) {
  const list = S.plants;
  const i = list.findIndex(x => x.id === p.id);
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
  };
}

export function speciesByFamily() {
  const map = new Map();
  for (const f of S.site?.families || []) map.set(f, []);
  for (const p of S.plants) {
    if (!map.has(p.family)) map.set(p.family, []);
    map.get(p.family).push(p);
  }
  return map;
}

export function countBy(keyFn) {
  const m = new Map();
  for (const p of S.plants) {
    const keys = [].concat(keyFn(p) || []);
    for (const k of keys) if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

export function speciesWithAny(list, key, value) {
  return list.filter(p => (p[key] || []).includes(value));
}
