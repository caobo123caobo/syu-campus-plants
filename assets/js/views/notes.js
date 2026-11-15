/* 观察记录：拍照 + 地点 + 笔记，存 IndexedDB，可导出 */
import { S, plantById } from '../data.js';
import { notes } from '../store.js';
import { escapeHtml, fmtDate, relTime, toast, download, icons } from '../util.js';
import { openSheet, closeSheet, confirmDialog } from '../ui.js';

let rootEl = null;
let cache = [];
let urls = [];

export async function renderNotes(root) {
  rootEl = root;
  root.innerHTML = `<div class="container">
    <div class="section" style="padding-bottom:0">
      <div class="section-head">
        <div><div class="eyebrow">Field notes</div><h2>我的观察记录</h2></div>
        <button class="btn small primary" id="add-note">${icons.plus} 记一笔</button>
      </div>
    </div>
    <div id="note-body"><div class="sk" style="height:120px;margin:16px"></div></div>
  </div>`;
  root.querySelector('#add-note').addEventListener('click', () => openNoteForm());
  root.querySelector('#note-body').addEventListener('click', onBodyClick);
  await refresh();
}

async function onBodyClick(e) {
  const del = e.target.closest('[data-del]');
  if (del) {
    const ok = await confirmDialog('删除这条记录？', '删除后不可恢复，照片也会一并删除。', '删除');
    if (!ok) return;
    await notes.remove(del.dataset.del);
    toast('已删除');
    refresh();
    return;
  }
  if (e.target.closest('[data-export]')) exportNotes();
  if (e.target.closest('[data-add]')) openNoteForm();
}

async function refresh() {
  const body = rootEl?.querySelector('#note-body');
  if (!body) return;
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  try {
    cache = await notes.all();
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="big">📷</div><h3>无法读取本地记录</h3>
      <p>${escapeHtml(e.message || '浏览器不支持 IndexedDB')}</p></div>`;
    return;
  }
  if (!cache.length) {
    body.innerHTML = `<div class="empty-state"><div class="big">🌱</div>
      <h3>还没有观察记录</h3>
      <p>在校园里遇到不认识的植物，拍一张照片、记下地点，<br>回来对着图鉴核对。</p>
      <div class="detail-actions" style="justify-content:center;margin-top:16px">
        <button class="btn primary" data-add>${icons.camera} 新建记录</button></div></div>`;
    body.querySelector('[data-add]')?.addEventListener('click', () => openNoteForm());
    return;
  }
  body.innerHTML = `<div class="note-list">
    ${cache.map(n => {
      const p = n.plantId ? plantById(n.plantId) : null;
      let photo = '';
      if (n.photo instanceof Blob) {
        const u = URL.createObjectURL(n.photo);
        urls.push(u);
        photo = `<div class="note-photo"><img src="${u}" alt="观察照片" loading="lazy"></div>`;
      }
      return `<article class="note-card" data-id="${n.id}">
        ${photo}
        <div class="note-body">
          <div class="note-meta"><span>${escapeHtml(fmtDate(n.createdAt))}</span>
            <span>·</span><span>${escapeHtml(relTime(n.createdAt))}</span>
            ${n.place ? `<span>·</span><span>${icons.pin} ${escapeHtml(n.place)}</span>` : ''}</div>
          <div class="note-species">${p ? `<a href="#/plant/${p.id}" style="color:var(--brand-2)">${escapeHtml(p.name)}</a>` : escapeHtml(n.plantName || '未关联物种')}</div>
          ${n.text ? `<div class="note-text">${escapeHtml(n.text)}</div>` : ''}
          <div class="note-actions">
            ${p ? `<a class="btn small" href="#/plant/${p.id}">查看物种</a>` : ''}
            <button class="btn small" data-del="${n.id}">${icons.trash} 删除</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>
    <div class="detail-actions" style="padding:0 16px 8px">
      <button class="btn grow" data-export>导出记录（JSON）</button>
    </div>
    <p class="foot-note">记录只保存在本机浏览器中，不会上传到服务器。清理浏览器数据会删除记录。</p>`;
}

async function exportNotes() {
  const list = cache.map(n => ({
    id: n.id, createdAt: n.createdAt,
    plantId: n.plantId, plantName: n.plantName,
    place: n.place, text: n.text,
    hasPhoto: n.photo instanceof Blob,
  }));
  download(`syu-plant-notes-${fmtDate(new Date().toISOString())}.json`, JSON.stringify(list, null, 2));
  toast('已导出（不含照片文件）');
}

/* ---------------- 新建记录 ---------------- */
export function openNoteForm(plantId = null) {
  const selected = plantId ? plantById(plantId) : null;
  const el = openSheet('新建观察记录', `
    <form class="note-form" id="note-form">
      <div>
        <label>关联物种（可选）</label>
        <select class="select-full" id="nf-plant">
          <option value="">不关联 / 暂不确定</option>
          ${S.plants.map(p => `<option value="${p.id}" ${selected && selected.id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}（${escapeHtml(p.family)}）</option>`).join('')}
        </select>
      </div>
      <div>
        <label>地点</label>
        <input class="input" id="nf-place" placeholder="例如：北院 3 号楼正北侧" maxlength="60">
      </div>
      <div>
        <label>照片</label>
        <label class="photo-drop" for="nf-photo">
          <div id="nf-preview" style="display:grid;place-items:center;width:64px;height:64px;border-radius:10px;background:var(--surface-3)">${icons.camera}</div>
          <div>
            <div style="color:var(--ink);font-size:13px">拍照或选择图片</div>
            <div style="font-size:11px">图片会压缩后保存在本机</div>
          </div>
        </label>
        <input type="file" id="nf-photo" accept="image/*" capture="environment">
      </div>
      <div>
        <label>备注</label>
        <textarea class="textarea" id="nf-text" placeholder="叶形、花色、生境、数量……" maxlength="500"></textarea>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn grow" data-close>取消</button>
        <button type="submit" class="btn primary grow">保存记录</button>
      </div>
      <p style="font-size:11px;color:var(--muted);line-height:1.7">建议记录：发现地点、日期、数量、花期状态。照片只在本机处理，不会上传。</p>
    </form>`, {
    onMount(node) {
      let photoBlob = null;
      const input = node.querySelector('#nf-photo');
      node.querySelector('[data-close]').addEventListener('click', closeSheet);
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          photoBlob = await compressImage(file);
          const u = URL.createObjectURL(photoBlob);
          node.querySelector('#nf-preview').outerHTML = `<img id="nf-preview" src="${u}" alt="预览">`;
        } catch {
          toast('图片处理失败，换一张试试');
        }
      });
      node.querySelector('#note-form').addEventListener('submit', async e => {
        e.preventDefault();
        const pid = node.querySelector('#nf-plant').value;
        const p = pid ? plantById(Number(pid)) : null;
        await notes.add({
          plantId: p ? p.id : null,
          plantName: p ? p.name : '',
          place: node.querySelector('#nf-place').value.trim(),
          text: node.querySelector('#nf-text').value.trim(),
          photo: photoBlob,
        });
        closeSheet();
        toast('记录已保存');
        if (rootEl && document.querySelector('#view-notes.is-active')) refresh();
        else location.hash = '#/notes';
      });
    },
  });
  return el;
}

function compressImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}
