/* 我的：收藏、进度、打卡、设置 */
import { S, plantById } from '../data.js';
import { favs, progress, quizStats, wrongBook, settings, setSetting, clearAll } from '../store.js';
import { plantCard, confirmDialog } from '../ui.js';
import { escapeHtml, icons, toast, todayKey } from '../util.js';

export function renderMe(root) {
  const total = S.plants.length;
  const favList = favs.list().map(plantById).filter(Boolean);
  const viewed = progress.viewedCount();
  const mastered = progress.masteredCount();
  const stats = quizStats.get();
  const acc = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
  const streak = progress.streak();
  const days = progress.days();

  root.innerHTML = `<div class="container">
    <div class="me-head">
      <div class="avatar">植</div>
      <div>
        <h2>我的图鉴</h2>
        <p>数据保存在本机浏览器，不上传服务器</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><b>${favs.size()}</b><span>收藏</span></div>
      <div class="stat"><b>${viewed}</b><span>已浏览</span></div>
      <div class="stat"><b>${mastered}</b><span>已掌握</span></div>
      <div class="stat"><b>${streak}</b><span>连续天数</span></div>
    </div>

    <div class="card-block">
      <h3>学习进度 <span class="pill">${viewed}/${total}</span></h3>
      <div class="bar"><i style="width:${Math.round(viewed / total * 100)}%"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px">
        <span>浏览 ${Math.round(viewed / total * 100)}%</span><span>掌握 ${Math.round(mastered / total * 100)}%</span>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.round(mastered / total * 100)}%;background:linear-gradient(90deg,var(--accent),#d9b45c)"></i></div>
    </div>

    <div class="card-block">
      <h3>学习打卡 <span class="pill">最近 28 天</span></h3>
      <div class="calendar" style="grid-template-columns:repeat(7,1fr)">
        ${calendarCells(days)}
      </div>
      <p style="font-size:11px;color:var(--muted);margin-top:8px">打开任意物种详情即记为当天学习。</p>
    </div>

    <div class="card-block">
      <h3>测验记录 <span class="pill">${stats.rounds} 轮</span></h3>
      <div class="row-line"><span class="grow">累计答题<span class="sub"><br>${stats.answered} 题</span></span><b>${stats.correct}</b></div>
      <div class="row-line"><span class="grow">正确率<span class="sub"><br>历史最佳 ${stats.best}%</span></span><b>${acc}%</b></div>
      <div class="row-line"><span class="grow">错题本</span><b>${wrongBook.size()} 条</b></div>
      <div class="detail-actions" style="margin-top:12px">
        <a class="btn grow" href="#/quiz">去测验</a>
      </div>
    </div>

    <div class="card-block">
      <h3>我的收藏 <span class="pill">${favList.length}</span></h3>
      ${favList.length ? `<div class="grid" style="padding:12px 0 0;grid-template-columns:repeat(2,minmax(0,1fr))">
          ${favList.map(plantCard).join('')}
        </div>` : `<p style="font-size:12.5px;color:var(--muted);margin-top:8px">在物种详情页点击书签，即可加入收藏。</p>`}
    </div>

    <div class="card-block">
      <h3>设置</h3>
      <div class="row-line">
        <span class="grow">深色模式<span class="sub"><br>跟随系统或手动切换</span></span>
        <button class="switch" id="sw-theme" role="switch" aria-checked="${document.documentElement.dataset.theme === 'dark'}"></button>
      </div>
      <div class="row-line">
        <span class="grow">离线可用<span class="sub"><br>首次访问后缓存页面与图片</span></span>
        <span style="font-size:12px;color:var(--brand-2)">${'serviceWorker' in navigator ? '已启用' : '浏览器不支持'}</span>
      </div>
      <div class="row-line">
        <span class="grow">数据来源<span class="sub"><br>${escapeHtml(S.site.source)}</span></span>
      </div>
      <div class="row-line">
        <button class="text-btn" id="btn-clear" style="color:var(--danger)">清除全部本地数据</button>
        <span class="grow"></span>
        <a class="text-btn" href="#/about">关于</a>
      </div>
    </div>

    <p class="foot-note">本应用仅用于校园植物识别教学，药用信息为名录原文，不构成诊断或用药建议。</p>
  </div>`;

  root.querySelector('#sw-theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark';
    const next = cur ? 'light' : 'dark';
    setSetting('theme', next);
    window.dispatchEvent(new CustomEvent('syu:theme', { detail: { theme: next } }));
    toast(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
    renderMe(root);
  });

  root.querySelector('#btn-clear').addEventListener('click', async () => {
    const ok = await confirmDialog('清除全部本地数据？', '收藏、掌握记录、测验统计、打卡和观察记录都会被删除，无法恢复。', '全部清除');
    if (!ok) return;
    clearAll();
    toast('已清除');
    renderMe(root);
  });
}

function calendarCells(days) {
  const cells = [];
  const d = new Date();
  d.setDate(d.getDate() - 27);
  for (let i = 0; i < 28; i++) {
    const key = todayKey(d);
    const n = days[key] || 0;
    cells.push(`<i class="${n ? 'on' : ''}" title="${key}${n ? ' · ' + n + ' 种' : ''}"></i>`);
    d.setDate(d.getDate() + 1);
  }
  return cells.join('');
}
