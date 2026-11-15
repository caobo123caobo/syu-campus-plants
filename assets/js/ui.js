/* 通用界面组件 */
import { $, escapeHtml, icons, toast } from './util.js';
import { favs } from './store.js';
import { coverOf, formText, thumbOf } from './data.js';

export function statusBadges(p) {
  const out = [];
  if (p.toxic) out.push('<span class="badge toxic">有毒</span>');
  else if (p.protected) out.push(`<span class="badge protect">${escapeHtml(p.protected.slice(0, 6))}</span>`);
  return out.join('');
}

export function plantCard(p) {
  const img = p.images[0];
  const media = img
    ? `<img src="${img.thumb}" alt="${escapeHtml(img.alt)}" loading="lazy" decoding="async"
         width="${img.width || img.w}" height="${img.height || img.h}">`
    : `<div class="empty">${icons.pin}</div>`;
  const tagLife = (p.lifeForm || [])[0];
  return `<a class="card" href="#/plant/${p.id}" data-id="${p.id}">
    <div class="card-media" style="background-image:url('${coverOf(p)}')">
      ${media}
      ${statusBadges(p)}
      ${favs.has(p.id) ? `<span class="fav-mark">${icons.bookmarkFill}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-title"><b>${escapeHtml(p.name)}</b><span class="code">${p.code}</span></div>
      <div class="card-latin">${escapeHtml(p.latin)}</div>
      <div class="card-tags">
        <span class="tag leaf">${escapeHtml(p.family)}</span>
        ${tagLife ? `<span class="tag">${escapeHtml(tagLife)}</span>` : ''}
        ${p.toxic ? '' : (p.protected ? '<span class="tag protect">保护</span>' : '')}
      </div>
    </div>
  </a>`;
}

export function renderGrid(list) {
  const grid = $('#plant-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="big">🌿</div><h3>没有匹配的植物</h3>
      <p>试试换个关键词，或清除筛选条件</p></div>`;
    return;
  }
  grid.innerHTML = list.map(plantCard).join('');
}

export function skeletons(n = 8) {
  return Array.from({ length: n }, () => `<div class="sk" style="aspect-ratio:3/4"></div>`).join('');
}

/* ---------------- 轻提示层 / 底部面板 ---------------- */
let sheetEl = null;

export function openSheet(title, bodyHtml, { onMount } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'layer';
  wrap.style.zIndex = '110';
  wrap.innerHTML = `
    <div class="layer-head">
      <strong style="flex:1;font-family:var(--font-serif);font-size:16px">${escapeHtml(title)}</strong>
      <button class="icon-btn" data-close aria-label="关闭">${icons.close}</button>
    </div>
    <div class="layer-body" style="padding:16px 16px calc(24px + var(--safe-b))">${bodyHtml}</div>`;
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  sheetEl = wrap;
  onMount?.(wrap);
  return wrap;
}

export function closeSheet() {
  if (!sheetEl) return;
  sheetEl.remove();
  sheetEl = null;
  document.body.classList.remove('no-scroll');
}

export function confirmDialog(title, text, okText = '确定') {
  return new Promise(resolve => {
    const wrap = openSheet(title, `
      <p style="font-size:13.5px;color:var(--ink-2);line-height:1.8">${escapeHtml(text)}</p>
      <div class="detail-actions" style="margin-top:18px">
        <button class="btn grow" data-no>取消</button>
        <button class="btn primary grow" data-yes>${escapeHtml(okText)}</button>
      </div>`, {
      onMount(el) {
        el.addEventListener('click', e => {
          if (e.target.closest('[data-yes]')) { closeSheet(); resolve(true); }
          if (e.target.closest('[data-no]')) { closeSheet(); resolve(false); }
        });
      },
    });
    wrap.addEventListener('remove', () => resolve(false), { once: true });
  });
}

/* ---------------- 图片灯箱 ---------------- */
export function openLightbox(images, start = 0, title = '') {
  const layer = $('#lightbox');
  if (!layer || !images.length) return;
  let idx = Math.max(0, Math.min(start, images.length - 1));
  const render = () => {
    const img = images[idx];
    layer.innerHTML = `
      <div class="lb-bar"><span>${escapeHtml(title)}</span>
        <span style="opacity:.7">${idx + 1} / ${images.length}</span>
        <button class="lb-close" data-close aria-label="关闭">${icons.close}</button></div>
      ${images.length > 1 ? `<button class="lb-nav prev" data-prev aria-label="上一张">${icons.back}</button>` : ''}
      <img src="${img.file}" alt="${escapeHtml(img.alt || '')}" style="background:url('${img.lqip}') center/cover">
      ${images.length > 1 ? `<button class="lb-nav next" data-next aria-label="下一张">${icons.chevron}</button>` : ''}`;
  };
  render();
  layer.hidden = false;
  document.body.classList.add('no-scroll');

  const close = () => {
    layer.hidden = true;
    layer.innerHTML = '';
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
  };
  const go = d => { idx = (idx + d + images.length) % images.length; render(); };
  const onKey = e => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };
  layer.onclick = e => {
    if (e.target.closest('[data-close]') || e.target === layer) close();
    if (e.target.closest('[data-next]')) go(1);
    if (e.target.closest('[data-prev]')) go(-1);
  };
  document.addEventListener('keydown', onKey);

  let startX = 0, startY = 0;
  layer.ontouchstart = e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; };
  layer.ontouchend = e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };
}

/* ---------------- 详情图片轮播 ---------------- */
export function mountGallery(root, p) {
  const imgs = p.images;
  if (!imgs.length) {
    root.innerHTML = `<div class="empty-state" style="padding:40px"><div class="big">🌿</div><p>暂无照片</p></div>`;
    return;
  }
  let idx = 0;
  root.innerHTML = `
    <div class="gallery-track" id="g-track">
      ${imgs.map((img, i) => `<div class="gallery-slide" style="background-image:url('${img.lqip}')">
        <img src="${img.file}" alt="${escapeHtml(img.alt)}" ${i ? 'loading="lazy"' : ''} data-i="${i}">
      </div>`).join('')}
    </div>
    ${imgs.length > 1 ? `<div class="gallery-count" id="g-count">1 / ${imgs.length}</div>
      <div class="gallery-dots" id="g-dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
      <button class="gallery-nav prev" data-gprev aria-label="上一张">${icons.back}</button>
      <button class="gallery-nav next" data-gnext aria-label="下一张">${icons.chevron}</button>` : ''}`;

  const track = $('#g-track', root);
  const count = $('#g-count', root);
  const dots = $$('.gallery-dots i', root);
  const apply = () => {
    track.style.transform = `translateX(${-idx * 100}%)`;
    if (count) count.textContent = `${idx + 1} / ${imgs.length}`;
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
  };
  const go = d => { idx = (idx + d + imgs.length) % imgs.length; apply(); };

  root.addEventListener('click', e => {
    if (e.target.closest('[data-gnext]')) go(1);
    if (e.target.closest('[data-gprev]')) go(-1);
    const im = e.target.closest('.gallery-slide img');
    if (im) openLightbox(imgs, Number(im.dataset.i), p.name);
  });
  let sx = 0, sy = 0;
  root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function $$(sel, root) { return Array.from(root.querySelectorAll(sel)); }

/* ---------------- 片段 ---------------- */
export function chip(label, { active = false, onClick = '', extra = '', count = null } = {}) {
  return `<button class="chip ${extra}" aria-pressed="${active}" onclick="${onClick}">${escapeHtml(label)}${count != null ? `<span class="chip-count">${count}</span>` : ''}</button>`;
}

export function fact(label, value) {
  return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

export function section(title, body, { empty = '', tags = '' } = {}) {
  const content = body
    ? `<div class="prose">${body}</div>`
    : `<div class="missing">${escapeHtml(empty || '原文未载')}</div>`;
  return `<section class="dsection"><h2>${escapeHtml(title)}</h2>${content}${tags}</section>`;
}

export function copyHint() {
  toast('已复制');
}
