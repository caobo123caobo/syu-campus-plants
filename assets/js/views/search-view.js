/* 全屏搜索 */
import { escapeHtml, icons, debounce, toast } from '../util.js';
import { search } from '../search.js';
import { readJSON, writeJSON } from '../util.js';

const RECENT_KEY = 'syu.recent.v1';
let built = false;
let panelRun = null;

const HOTS = ['清热解毒', '乔木', '松科', '有毒', '宿根', '观花', '东北', '丁香'];

export function openSearch() {
  const layer = document.getElementById('search-layer');
  if (!layer) return;
  layer.hidden = false;
  document.body.classList.add('no-scroll');
  if (!built) {
    layer.innerHTML = `
      <div class="layer-head">
        <button class="icon-btn" data-close aria-label="关闭搜索">${icons.back}</button>
        <div class="searchbox">
          ${icons.search}
          <input id="search-input" type="search" placeholder="名称 / 别名 / 拉丁名 / 特征 / 功效" autocomplete="off" spellcheck="false">
          <button class="clear" id="search-clear" aria-label="清空">${icons.close}</button>
        </div>
      </div>
      <div class="layer-body">
        <div id="search-panel"></div>
      </div>`;
    built = true;
    const input = layer.querySelector('#search-input');
    const clear = layer.querySelector('#search-clear');
    const panel = layer.querySelector('#search-panel');
    let last = '';

    const run = () => {
      const q = input.value.trim();
      last = q;
      clear.classList.toggle('show', !!q);
      if (!q) { panel.innerHTML = hintsHtml(); bindHints(panel, input, run); return; }
      const res = search(q).slice(0, 60);
      panel.innerHTML = `
        <div class="search-status">找到 ${res.length} 个结果${res.length > 60 ? '（显示前 60）' : ''}</div>
        <div class="res-list">
          ${res.map(({ p, why }) => `<a class="res" href="#/plant/${p.id}" data-pick>
            <div class="res-thumb">${p.images[0] ? `<img src="${p.images[0].thumb}" alt="" loading="lazy">` : ''}</div>
            <div class="res-main">
              <div class="res-name">${hl(p.name, q)}<span class="code">${p.code}</span></div>
              <div class="res-sub">${escapeHtml(p.latin)} · ${escapeHtml(p.family)}</div>
              ${why.length ? `<div class="res-why">匹配：${escapeHtml(why.join(' / '))}</div>` : ''}
            </div>
            <span class="res-go">${icons.chevron}</span>
          </a>`).join('') || `<div class="empty-state"><div class="big">🌿</div><h3>没有找到</h3><p>换个词试试，比如「丁香」「松科」「止血」</p></div>`}
        </div>`;
      panel.querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => {
        saveRecent(q);
        closeSearch();
      }));
    };

    input.addEventListener('input', debounce(() => run(), 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = panel.querySelector('[data-pick]');
        if (first) { saveRecent(input.value.trim()); closeSearch(); location.hash = first.getAttribute('href'); }
        else toast('没有结果');
      }
    });
    clear.addEventListener('click', () => { input.value = ''; run(); input.focus(); });
    layer.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSearch(); });
    panel.innerHTML = hintsHtml();
    bindHints(panel, input, run);
    panelRun = run;
  }
  const input = layer.querySelector('#search-input');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 60);
  }
  panelRun?.();
}

export function closeSearch() {
  const layer = document.getElementById('search-layer');
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  document.body.classList.remove('no-scroll');
}

export function isSearchOpen() {
  const layer = document.getElementById('search-layer');
  return layer && !layer.hidden;
}

function hl(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  try {
    return safe.replace(new RegExp(escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`);
  } catch { return safe; }
}

function hintsHtml() {
  const recent = readJSON(RECENT_KEY, []);
  return `<div class="search-hints">
    ${recent.length ? `<div class="hint-title">最近搜索</div>
      <div class="hint-list">${recent.map(x => `<button class="hint" data-hint="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>` : ''}
    <div class="hint-title">试试这些</div>
    <div class="hint-list">${HOTS.map(x => `<button class="hint" data-hint="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>
    <div class="hint-title">搜索范围</div>
    <p style="font-size:12.5px;color:var(--muted);line-height:1.9">
      中文名、别名、科名、属名、拉丁名、形态特征、生态习性、价值功用、校园位置。<br>
      多个词用空格分隔，结果为同时满足（AND）。
    </p>
  </div>`;
}

function bindHints(panel, input, run) {
  panel.querySelectorAll('[data-hint]').forEach(b => b.addEventListener('click', () => {
    input.value = b.dataset.hint;
    run();
  }));
}

function saveRecent(q) {
  if (!q) return;
  const list = readJSON(RECENT_KEY, []).filter(x => x !== q);
  list.unshift(q);
  writeJSON(RECENT_KEY, list.slice(0, 8));
}
