/* 校园分布示意图 */
import { S } from '../data.js';
import { escapeHtml, icons } from '../util.js';

let selected = '';
let rootEl = null;

function speciesAt(spotId) {
  return S.plants.filter(p => (p.location?.spots || []).includes(spotId));
}
function spotCount(spotId) {
  return speciesAt(spotId).length;
}

function zoneSvg(zone, spots) {
  const z = S.site.campus[zone];
  const list = spots.filter(s => s.zone === zone);
  const maxCount = Math.max(...list.map(s => spotCount(s.id)), 1);
  const vb = `${z.x - 18} ${z.y - 30} ${z.w + 36} ${z.h + 50}`;
  const label = zone === 'north' ? '北院' : '南院';
  return `<svg class="map-svg" viewBox="${vb}" role="img" aria-label="${label}植物分布示意图">
    <rect class="map-zone" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"/>
    <text class="map-zone-label" x="${z.x + 26}" y="${z.y + 46}">${label}</text>
    ${list.map(s => {
      const n = spotCount(s.id);
      const r = 11 + Math.round((n / maxCount) * 13);
      const labelY = s.y > z.y + z.h - 60 ? s.y - r - 12 : s.y + r + 26;
      return `<g class="spot ${selected === s.id ? 'on' : ''}" data-spot="${s.id}" tabindex="0" role="button"
        aria-label="${escapeHtml(s.name)}，${n} 种植物">
        <circle cx="${s.x}" cy="${s.y}" r="${r}"></circle>
        <text x="${s.x}" y="${labelY}">${escapeHtml(s.name)}</text>
        ${n ? `<text class="spot-n" x="${s.x}" y="${s.y + 5}">${n}</text>` : ''}
      </g>`;
    }).join('')}
  </svg>`;
}

export function renderMap(root) {
  rootEl = root;
  const spots = S.site.spots.filter(s => s.zone !== 'unknown');
  const unknownSpots = S.site.spots.filter(s => s.zone === 'unknown');
  const total = S.site.spots.length;

  root.innerHTML = `
    <div class="container">
      <div class="section" style="padding-bottom:0">
        <div class="section-head">
          <div>
            <div class="eyebrow">Campus map</div>
            <h2>校园植物分布</h2>
          </div>
          <p>${total} 个地点</p>
        </div>
      </div>
    </div>
    <div class="map-note">${icons.warning}
      <span style="margin-left:6px">教学示意图：只表示物种与建筑/区域的对应关系和大致方位，<b>不是实测平面图</b>，点位不代表单株坐标。</span>
    </div>
    <div class="map-wrap">
      ${zoneSvg('north', spots)}
      <div class="map-legend">
        <span><i style="background:var(--leaf)"></i>圆点大小 = 该地点记录到的物种数</span>
        <span>点击圆点查看该地点的植物</span>
      </div>
    </div>
    <div class="map-wrap">
      ${zoneSvg('south', spots)}
    </div>

    <div id="spot-panel">${panelHtml()}</div>

    <div class="section">
      <div class="container"><div class="section-head"><h2>按地点浏览</h2><p>共 ${total} 处</p></div></div>
      <div class="map-list">
        ${spots.map(s => `<div class="zone-card" data-open="${s.id}" style="cursor:pointer">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="font-family:var(--font-serif)">${escapeHtml(s.name)}</strong>
            <span style="font-size:10.5px;color:var(--brand-2);background:var(--leaf-soft);padding:2px 8px;border-radius:999px">
              ${s.zone === 'north' ? '北院' : '南院'}</span>
            <span style="margin-left:auto;font-size:11.5px;color:var(--muted)">${spotCount(s.id)} 种</span>
          </div>
        </div>`).join('')}
        ${unknownSpots.map(s => `<div class="zone-card" data-open="${s.id}" style="cursor:pointer">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="font-family:var(--font-serif)">${escapeHtml(s.name)}</strong>
            <span style="font-size:10.5px;color:var(--warn);background:var(--warn-soft);padding:2px 8px;border-radius:999px">校区未注明</span>
            <span style="margin-left:auto;font-size:11.5px;color:var(--muted)">${spotCount(s.id)} 种</span>
          </div>
        </div>`).join('')}
        ${looseHtml()}
      </div>
    </div>
    <p class="foot-note">地点来自每条物种记录的「校园位置」原文，未做实地测绘。</p>
  `;

  bind();
}

function panelHtml() {
  if (!selected) {
    return `<div class="spot-panel"><h3>选择一个地点</h3>
      <p style="font-size:12.5px;color:var(--muted);margin-top:6px">点击上方地图中的圆点，或下方地点列表，查看该地点记录到的植物。</p></div>`;
  }
  const spot = S.site.spots.find(s => s.id === selected);
  const list = speciesAt(selected);
  const zone = spot?.zone === 'north' ? '北院' : spot?.zone === 'south' ? '南院' : '校区未注明';
  return `<div class="spot-panel">
    <h3>${escapeHtml(spot?.name || '')}<span class="pill">${zone}</span>
      <button class="text-btn" style="margin-left:auto" data-clear-spot>清除</button>
    </h3>
    <div class="spot-list">
      ${list.length ? list.map(p => `<a href="#/plant/${p.id}">${escapeHtml(p.name)}</a>`).join('')
        : '<span style="font-size:12.5px;color:var(--muted)">该地点暂无记录</span>'}
    </div>
  </div>`;
}

function looseHtml() {
  const loose = S.plants.filter(p => !(p.location?.spots || []).length);
  if (!loose.length) return '';
  const north = loose.filter(p => (p.location.campus || []).includes('北院'));
  const south = loose.filter(p => (p.location.campus || []).includes('南院'));
  const other = loose.filter(p => !(p.location.campus || []).length);
  const block = (label, list) => list.length ? `<div style="margin-top:12px">
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">${label} · ${list.length} 种</div>
      <div class="spot-list">${list.map(p => `<a href="#/plant/${p.id}">${escapeHtml(p.name)}</a>`).join('')}</div>
    </div>` : '';
  return `<div class="zone-card" style="margin:0">
    <div style="display:flex;align-items:center;gap:8px">
      <strong style="font-family:var(--font-serif)">仅记录到校区</strong>
      <span style="font-size:10.5px;color:var(--muted);padding:2px 8px;border-radius:999px;background:var(--surface-2)">未标具体地点</span>
      <span style="margin-left:auto;font-size:11.5px;color:var(--muted)">${loose.length} 种</span>
    </div>
    ${block('北院', north)}${block('南院', south)}${block('校区未注明', other)}
  </div>`;
}

function select(id) {
  selected = selected === id ? '' : id;
  if (!rootEl) return;
  rootEl.querySelectorAll('.spot').forEach(g => g.classList.toggle('on', g.dataset.spot === selected));
  const panel = rootEl.querySelector('#spot-panel');
  if (panel) panel.innerHTML = panelHtml();
}

function bind() {
  rootEl.addEventListener('click', e => {
    const g = e.target.closest('[data-spot]');
    if (g) { select(g.dataset.spot); return; }
    const open = e.target.closest('[data-open]');
    if (open) { select(open.dataset.open); rootEl.querySelector('.spot-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (e.target.closest('[data-clear-spot]')) { selected = ''; rootEl.querySelectorAll('.spot').forEach(x => x.classList.remove('on')); const p = rootEl.querySelector('#spot-panel'); if (p) p.innerHTML = panelHtml(); }
  });
  rootEl.addEventListener('keydown', e => {
    const g = e.target.closest('[data-spot]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.spot); }
  });
}

export function focusSpot(id) {
  selected = id;
  if (!rootEl) return;
  rootEl.querySelectorAll('.spot').forEach(g => g.classList.toggle('on', g.dataset.spot === selected));
  const panel = rootEl.querySelector('#spot-panel');
  if (panel) panel.innerHTML = panelHtml();
  rootEl.querySelector('.spot-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
