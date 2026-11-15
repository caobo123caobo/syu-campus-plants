/* 首页：图鉴浏览 + 筛选 */
import { S, countBy } from '../data.js';
import { filters, filterPlants, sortList, activeFilterCount, resetFilters } from '../search.js';
import { renderGrid, openSheet, closeSheet } from '../ui.js';
import { escapeHtml, toast, icons } from '../util.js';

let built = false;
let rootEl = null;

const QUICK = [
  { key: 'lifeForm', value: '乔木', label: '乔木' },
  { key: 'lifeForm', value: '灌木', label: '灌木' },
  { key: 'lifeForm', value: '草本', label: '草本' },
  { key: 'lifeForm', value: '藤本', label: '藤本' },
  { key: 'special', value: 'toxic', label: '有毒' },
  { key: 'special', value: 'protect', label: '保护植物' },
];

function shell() {
  const c = S.site.counts;
  return `
  <div class="hero">
    <h1>沈阳大学校园植物</h1>
    <p class="hero-sub">一眼认出身边的草木 · 实习随身查</p>
    <div class="hero-stats">
      <div><b>${c.species}</b><span>种植物</span></div>
      <div><b>${c.families}</b><span>个科</span></div>
      <div><b>${c.images}</b><span>张照片</span></div>
    </div>
    <p class="hero-tip">${icons.pin}<span>按科、生活型、用途、功效筛选，也可搜索中文名、别名或拉丁名</span></p>
  </div>

  <button class="search-entry" id="open-search">
    ${icons.search}<span>搜索植物名称、别名、拉丁名、辨识特征…</span><kbd>/</kbd>
  </button>

  <div class="chiprow" id="quick-chips" style="margin-top:12px">
    <button class="chip" data-q="" aria-pressed="true" id="quick-all">全部</button>
    ${QUICK.map(q => `<button class="chip ${q.value === 'toxic' ? 'toxic' : q.value === 'protect' ? 'protect' : ''}"
      data-q="${q.key}:${q.value}" aria-pressed="false">${q.label}</button>`).join('')}
  </div>

  <div class="resultbar">
    <span class="count" id="result-count"></span>
    <span class="spacer"></span>
    <button class="text-btn" id="btn-random">随便看看</button>
    <button class="text-btn" id="btn-filter">${icons.filter} 筛选 <span id="filter-n"></span></button>
    <select class="select" id="sort-select" aria-label="排序方式">
      <option value="default">按编号</option>
      <option value="name">按名称</option>
      <option value="family">按科</option>
      <option value="images">按图片数</option>
    </select>
  </div>

  <div class="grid" id="plant-grid"></div>

  <p class="foot-note">
    数据来自《沈阳大学校园植物》名录（${c.species} 种），正文为原文，标签由原文关键词生成。<br>
    本应用仅用于植物识别教学，不构成任何药用或食用建议。
  </p>`;
}

function activeQuick() {
  for (const q of QUICK) {
    if (filters[q.key] === q.value) return `${q.key}:${q.value}`;
  }
  return '';
}

export function renderHome(root) {
  rootEl = root;
  if (!built) {
    root.innerHTML = shell();
    built = true;
    bind();
  }
  syncChips();
  updateGrid();
}

function bind() {
  const root = rootEl;
  root.querySelector('#open-search').addEventListener('click', () => window.dispatchEvent(new CustomEvent('syu:search')));
  root.querySelector('#quick-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const raw = b.dataset.q;
    if (!raw) { filters.lifeForm = ''; filters.special = ''; }
    else {
      const [k, v] = raw.split(':');
      filters.lifeForm = '';
      filters.special = '';
      if (filters[k] === v) filters[k] = '';
      else filters[k] = v;
    }
    syncChips();
    updateGrid();
  });
  root.querySelector('#btn-filter').addEventListener('click', openFilterSheet);
  root.querySelector('#btn-random').addEventListener('click', () => {
    const list = filterPlants();
    const pool = list.length ? list : S.plants;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    location.hash = `#/plant/${pick.id}`;
  });
  root.querySelector('#sort-select').addEventListener('change', e => {
    filters.sort = e.target.value;
    updateGrid();
  });
  root.querySelector('#sort-select').value = filters.sort;
}

export function updateGrid() {
  if (!rootEl) return;
  let list = filterPlants();
  list = sortList(list);
  renderGrid(list);
  const n = list.length;
  const el = rootEl.querySelector('#result-count');
  if (el) el.innerHTML = `共 <b>${n}</b> 种${activeFilterCount() ? ' · 已筛选' : ''}`;
  const fn = rootEl.querySelector('#filter-n');
  if (fn) fn.textContent = activeFilterCount() ? `(${activeFilterCount()})` : '';
  syncChips();
}

function syncChips() {
  if (!rootEl) return;
  const q = activeQuick();
  rootEl.querySelectorAll('#quick-chips [data-q]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.q === q));
  });
  rootEl.querySelector('#quick-all').setAttribute('aria-pressed', String(!q));
}

/* ---------------- 筛选面板 ---------------- */
function group(title, key, values, counts, { extra = '' } = {}) {
  return `
    <div class="field">
      <label>${escapeHtml(title)}</label>
      <div class="chiprow wrap" style="padding:0">
        ${values.map(v => `<button class="chip ${extra}" data-f="${key}" data-v="${escapeHtml(v)}"
          aria-pressed="${filters[key] === v}">${escapeHtml(v)}<span class="chip-count">${counts.get(v) || 0}</span></button>`).join('')}
      </div>
    </div>`;
}

function sheetHtml() {
  const famCount = countBy(p => p.family);
  const useCount = countBy(p => p.use);
  const effCount = countBy(p => p.efficacy);
  const camCount = countBy(p => p.location?.campus);
  return `
    ${group('科', 'family', S.site.families, famCount)}
    ${group('生活型', 'lifeForm', S.site.lifeForms, countBy(p => p.lifeForm))}
    ${group('用途', 'use', S.site.uses, useCount)}
    ${group('药用功效（原文关键词）', 'efficacy', S.site.efficacy, effCount)}
    ${group('校区', 'campus', ['北院', '南院'], camCount)}
    <div class="field">
      <label>特殊标记</label>
      <div class="chiprow wrap" style="padding:0">
        <button class="chip toxic" data-f="special" data-v="toxic" aria-pressed="${filters.special === 'toxic'}">有毒
          <span class="chip-count">${S.plants.filter(p => p.toxic).length}</span></button>
        <button class="chip protect" data-f="special" data-v="protect" aria-pressed="${filters.special === 'protect'}">保护植物
          <span class="chip-count">${S.plants.filter(p => p.protected).length}</span></button>
        <button class="chip" data-f="special" data-v="gymno" aria-pressed="${filters.special === 'gymno'}">裸子植物
          <span class="chip-count">${S.plants.filter(p => p.taxon?.includes('裸子植物')).length}</span></button>
      </div>
    </div>
    <div class="detail-actions" style="margin-top:20px">
      <button class="btn grow" data-clear>清除全部</button>
      <button class="btn primary grow" data-close-sheet>查看结果（<span id="sheet-n">0</span>）</button>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:12px;line-height:1.7">
      标签由原文档文字自动提取，仅用于检索定位，不代表分类学或医学结论。
    </p>`;
}

function openFilterSheet() {
  const el = openSheet('筛选', sheetHtml(), {
    onMount(node) {
      const setN = () => { const n = node.querySelector('#sheet-n'); if (n) n.textContent = filterPlants().length; };
      setN();
      node.addEventListener('click', e => {
        const b = e.target.closest('[data-f]');
        if (b) {
          const { f, v } = b.dataset;
          filters[f] = filters[f] === v ? '' : v;
          node.querySelectorAll(`[data-f="${f}"]`).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === filters[f])));
          setN();
          updateGrid();
          return;
        }
        if (e.target.closest('[data-clear]')) {
          resetFilters(true);
          closeSheet();
          toast('已清除筛选');
          updateGrid();
        }
        if (e.target.closest('[data-close-sheet]')) closeSheet();
      });
    },
  });
  return el;
}

export function invalidateHome() { built = false; }
