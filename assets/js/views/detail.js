/* 物种详情 */
import { S, plantById, neighbours, familyPlants, formText, aliasText, campusText, spotNames } from '../data.js';
import { favs, progress } from '../store.js';
import { mountGallery, section, fact, statusBadges } from '../ui.js';
import { escapeHtml, icons, toast, share, fmtDate } from '../util.js';

let currentId = null;

const layer = () => document.getElementById('detail-layer');

export function renderDetail(id) {
  const p = plantById(id);
  if (!p) { goHome(); return; }
  currentId = p.id;
  progress.markViewed(p.id);
  const el = layer();
  el.hidden = false;
  document.body.classList.add('no-scroll');
  el.innerHTML = detailHtml(p);
  el.scrollTop = 0;
  mountGallery(el.querySelector('#detail-gallery'), p);
  bind(p);
  document.title = `${p.name} · 沈阳大学校园植物图鉴`;
}

export function closeDetail({ silent = false } = {}) {
  const el = layer();
  if (!el || el.hidden) return;
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('no-scroll');
  currentId = null;
  document.title = '沈阳大学校园植物图鉴';
  if (!silent && location.hash.startsWith('#/plant/')) location.hash = '#/home';
}

function goHome() {
  closeDetail({ silent: true });
  location.hash = '#/home';
}

function detailHtml(p) {
  const isFav = favs.has(p.id);
  const isMastered = progress.isMastered(p.id);
  const chips = [
    `<span class="chip-static leaf">${escapeHtml(p.family)}</span>`,
    p.genus ? `<span class="chip-static">${escapeHtml(p.genus)}</span>` : '',
    p.lifeForm?.length ? `<span class="chip-static">${escapeHtml(p.lifeForm.join(' / '))}</span>` : '',
    p.habit?.length ? `<span class="chip-static">${escapeHtml(p.habit.join(' / '))}</span>` : '',
    p.taxon?.length ? `<span class="chip-static">${escapeHtml(p.taxon[0])}</span>` : '',
    p.toxic ? '<span class="chip-static toxic">⚠ 有毒</span>' : '',
    p.protected ? `<span class="chip-static protect">${escapeHtml(p.protected)}</span>` : '',
  ].filter(Boolean).join('');

  const located = spotNames(p);
  const evidence = buildEvidence(p);

  return `
  <div class="detail">
    <div class="detail-head">
      <button class="icon-btn" data-back aria-label="返回">${icons.back}</button>
      <div class="title">${escapeHtml(p.name)}</div>
      <button class="icon-btn" data-fav aria-label="收藏" aria-pressed="${isFav}">${isFav ? icons.bookmarkFill : icons.bookmark}</button>
      <button class="icon-btn" data-share aria-label="分享">${icons.share}</button>
    </div>
    <div class="detail-scroll">
      <div class="gallery" id="detail-gallery"></div>
      <div class="detail-body">
        <div class="detail-title-row">
          <div>
            <h1 class="detail-title">${escapeHtml(p.name)}</h1>
            <div class="detail-code">No. ${p.code}</div>
            <div class="detail-latin">${escapeHtml(p.latin)}</div>
            ${p.nameRaw ? `<div style="font-size:11.5px;color:var(--muted);margin-top:3px">原文写作「${escapeHtml(p.nameRaw)}」，已按拉丁名订正</div>` : ''}
            ${p.alias?.length ? `<div class="detail-alias"><span>别名：</span>${escapeHtml(aliasText(p))}</div>` : ''}
          </div>
        </div>

        <div class="chips">${chips}</div>

        ${p.toxic ? `<div class="callout toxic">${icons.warning}<span><b>注意：</b>原文记载该植物有毒性表述，请勿采食或自行药用。${escapeHtml(evidence.toxic || '')}</span></div>` : ''}
        ${p.protected ? `<div class="callout protect">${icons.shield}<span><b>保护植物：</b>${escapeHtml(p.protected)}。请勿采摘或破坏。</span></div>` : ''}

        <dl class="facts">
          ${fact('科', escapeHtml(p.family))}
          ${fact('属', escapeHtml(p.genus || '原文未载'))}
          ${fact('生活型', escapeHtml(formText(p)))}
          ${fact('校区', escapeHtml(campusText(p)))}
        </dl>

        ${section('形态特征', esc(p.morphology), { empty: '原文未载形态特征' })}
        ${section(p.ecology ? (p.ecologyLabel || '生态习性') : '生态习性', esc(p.ecology), { empty: '原文未写生态习性，也未列分布地区' })}
        ${section('价值功用', esc(p.value), { empty: '原文未载' })}
        ${p.intro ? section('补充简介', esc(p.intro)) : ''}

        <section class="dsection">
          <h2>校园位置</h2>
          <div class="prose">${escapeHtml(p.location?.raw || '原文未载')}</div>
          ${located.length ? `<div class="tags-line">${located.map(n => `<span class="tag-btn">${escapeHtml(n)}</span>`).join('')}
            <button class="tag-btn" data-map="${escapeHtml((p.location.spots || [])[0] || '')}">${icons.pin} 在地图中查看</button></div>` : ''}
        </section>

        ${tagsSection(p)}

        <section class="dsection">
          <h2>数据说明</h2>
          <div class="callout source">${icons.warning}<span>本条正文原样摘自校园植物名录（${escapeHtml(S.site.source)}）；生活型、用途、功效等标签为原文关键词提取，点击上方标签可查看依据。图片 ${p.images.length} 张。</span></div>
        </section>

        <div class="detail-actions">
          <button class="btn ${isFav ? 'is-on' : ''}" data-fav-big>${isFav ? icons.bookmarkFill : icons.bookmark} ${isFav ? '已收藏' : '收藏'}</button>
          <button class="btn ${isMastered ? 'is-on' : ''}" data-master>${icons.check} ${isMastered ? '已掌握' : '标记掌握'}</button>
          <button class="btn" data-note>${icons.camera} 记录观察</button>
        </div>

        ${relatedHtml(p)}
        ${navHtml(p)}
        <div style="height:8px"></div>
      </div>
    </div>
  </div>`;
}

function tagsSection(p) {
  const use = p.use || [];
  const eff = p.efficacy || [];
  if (!use.length && !eff.length && !p.flower && !p.fruit) return '';
  const tags = [
    ...use.map(u => `<button class="tag-btn" data-tag="use:${escapeHtml(u)}">${escapeHtml(u)}</button>`),
    ...eff.map(u => `<button class="tag-btn" data-tag="efficacy:${escapeHtml(u)}">${escapeHtml(u)}</button>`),
    p.flower ? `<span class="tag-btn">花期 ${escapeHtml(p.flower)}</span>` : '',
    p.fruit ? `<span class="tag-btn">果期 ${escapeHtml(p.fruit)}</span>` : '',
  ].filter(Boolean).join('');
  const ev = buildEvidence(p);
  const evLines = Object.entries(ev).filter(([k]) => k !== 'toxic').map(([k, v]) =>
    `<li><b>${escapeHtml(labelOf(k))}</b>：${escapeHtml(v)}</li>`).join('');
  return `<section class="dsection">
    <h2>识别标签</h2>
    <div class="tags-line">${tags}</div>
    ${evLines ? `<details style="margin-top:10px"><summary style="font-size:11.5px;color:var(--muted);cursor:pointer">这些标签的依据（原文片段）</summary>
      <ul style="font-size:11.5px;color:var(--muted);line-height:1.8;margin-top:8px;padding-left:16px">${evLines}</ul></details>` : ''}
  </section>`;
}

function labelOf(k) {
  return ({
    lifeForm: '生活型', habit: '常绿/落叶', use: '用途', efficacy: '功效',
    flower: '花期', fruit: '果期', toxic: '毒性', protected: '保护等级',
  })[k] || k;
}

function buildEvidence(p) {
  const d = p.derived || {};
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (!v) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'object') {
      const first = Object.values(v)[0];
      if (typeof first === 'string') out[k] = first;
    }
  }
  if (p.flower) out.flower = `原文：花期 ${p.flower}`;
  if (p.fruit) out.fruit = `原文：果期 ${p.fruit}`;
  return out;
}

function relatedHtml(p) {
  const list = familyPlants(p.family).filter(x => x.id !== p.id).slice(0, 10);
  if (!list.length) return '';
  return `<section class="related">
    <h3>同科植物 · ${escapeHtml(p.family)}</h3>
    <div class="related-row">
      ${list.map(x => `<a class="related-card" href="#/plant/${x.id}">
        <div class="thumb"><img src="${x.images[0]?.thumb || ''}" alt="${escapeHtml(x.name)}" loading="lazy"></div>
        <span>${escapeHtml(x.name)}</span>
      </a>`).join('')}
    </div>
  </section>`;
}

function navHtml(p) {
  const { prev, next } = neighbours(p);
  return `<div class="nav-pair">
    ${prev ? `<a href="#/plant/${prev.id}"><span>← 上一种</span><b>${escapeHtml(prev.name)}</b></a>` : '<span></span>'}
    ${next ? `<a class="next" href="#/plant/${next.id}"><span>下一种 →</span><b>${escapeHtml(next.name)}</b></a>` : '<span></span>'}
  </div>`;
}

function esc(t) {
  return escapeHtml(t || '');
}

function bind(p) {
  const el = layer();
  el.querySelector('[data-back]').addEventListener('click', () => {
    if (history.length > 1) history.back(); else goHome();
  });
  el.querySelector('[data-share]').addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}#/plant/${p.id}`;
    share({ title: `${p.name} · 沈阳大学校园植物图鉴`, text: `${p.name}（${p.latin}）`, url });
  });

  const refreshFav = () => {
    const on = favs.has(p.id);
    const head = el.querySelector('[data-fav]');
    head.innerHTML = on ? icons.bookmarkFill : icons.bookmark;
    head.setAttribute('aria-pressed', String(on));
    const big = el.querySelector('[data-fav-big]');
    if (big) {
      big.classList.toggle('is-on', on);
      big.innerHTML = `${on ? icons.bookmarkFill : icons.bookmark} ${on ? '已收藏' : '收藏'}`;
    }
  };
  const refreshMaster = () => {
    const on = progress.isMastered(p.id);
    const b = el.querySelector('[data-master]');
    if (!b) return;
    b.classList.toggle('is-on', on);
    b.innerHTML = `${icons.check} ${on ? '已掌握' : '标记掌握'}`;
  };

  el.querySelector('[data-fav]').addEventListener('click', () => {
    const on = favs.toggle(p.id);
    refreshFav();
    toast(on ? '已加入收藏' : '已取消收藏');
  });
  el.querySelector('[data-fav-big]').addEventListener('click', () => {
    const on = favs.toggle(p.id);
    refreshFav();
    toast(on ? '已加入收藏' : '已取消收藏');
  });
  el.querySelector('[data-master]').addEventListener('click', () => {
    const on = progress.setMastered(p.id, !progress.isMastered(p.id));
    refreshMaster();
    toast(on ? '已标记为掌握' : '已取消掌握');
  });
  el.querySelector('[data-note]').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('syu:note', { detail: { plantId: p.id } }));
  });
  el.addEventListener('click', e => {
    const mapBtn = e.target.closest('[data-map]');
    if (mapBtn) {
      const spot = mapBtn.dataset.map;
      window.dispatchEvent(new CustomEvent('syu:map-spot', { detail: { spot } }));
      return;
    }
    const tag = e.target.closest('[data-tag]');
    if (tag) {
      const [key, value] = tag.dataset.tag.split(':');
      closeDetail({ silent: true });
      window.dispatchEvent(new CustomEvent('syu:filter', { detail: { key, value } }));
    }
  });
}

export function getCurrentDetailId() { return currentId; }
