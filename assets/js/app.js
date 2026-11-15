/* 应用入口：路由、主题、全局事件、离线注册 */
import { loadData, S } from './data.js';
import { settings, setSetting } from './store.js';
import { $, $$, toast } from './util.js';
import { filters } from './search.js';
import { renderHome, updateGrid } from './views/home.js';
import { renderDetail, closeDetail } from './views/detail.js';
import { renderMap, focusSpot } from './views/map.js';
import { renderQuiz } from './views/quiz.js';
import { renderNotes, openNoteForm } from './views/notes.js';
import { renderMe } from './views/me.js';
import { renderAbout } from './views/about.js';
import { openSearch, closeSearch, isSearchOpen } from './views/search-view.js';

const VIEWS = {
  home: renderHome,
  map: renderMap,
  quiz: renderQuiz,
  notes: renderNotes,
  me: renderMe,
  about: renderAbout,
};

let currentView = 'home';

/* ---------------- 主题 ---------------- */
const mql = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(mode) {
  const dark = mode === 'dark' || (mode === 'auto' && mql.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#101613' : '#0f3d2e');
}
mql.addEventListener?.('change', () => { if (settings.theme === 'auto') applyTheme('auto'); });

/* ---------------- 路由 ---------------- */
function viewEl(name) {
  return document.querySelector(`#view-${name}`);
}

function setTab(name) {
  $$('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
}

function route() {
  const hash = location.hash || '#/home';

  if (hash.startsWith('#/plant/')) {
    const id = Number(hash.split('/')[2]);
    if (Number.isFinite(id)) {
      renderDetail(id);
      return;
    }
  }

  closeDetail({ silent: true });
  const name = (hash.replace(/^#\/?/, '').split('/')[0] || 'home');
  const view = VIEWS[name] ? name : 'home';
  currentView = view;

  $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
  setTab(view);
  const titles = {
    home: '沈阳大学校园植物图鉴',
    map: '校园分布 · 沈阳大学校园植物图鉴',
    quiz: '小测验 · 沈阳大学校园植物图鉴',
    notes: '观察记录 · 沈阳大学校园植物图鉴',
    me: '我的 · 沈阳大学校园植物图鉴',
    about: '关于 · 沈阳大学校园植物图鉴',
  };
  document.title = titles[view] || titles.home;

  window.scrollTo(0, 0);
  VIEWS[view](viewEl(view));
}

/* ---------------- 启动 ---------------- */
async function boot() {
  applyTheme(settings.theme);
  try {
    await loadData();
  } catch (err) {
    document.getElementById('main').innerHTML = `<div class="empty-state" style="padding-top:80px">
      <div class="big">🌿</div><h3>数据加载失败</h3>
      <p>${String(err.message || err)}</p>
      <p style="margin-top:8px">若是本地打开，请用本地服务器访问（例如 <code>npx serve</code>）。</p></div>`;
    return;
  }
  route();
  window.addEventListener('hashchange', route);
  bindGlobal();
  registerSW();
}

function bindGlobal() {
  $('#brand').addEventListener('click', () => { location.hash = '#/home'; });
  $('#btn-search').addEventListener('click', openSearch);
  $('#btn-theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const next = dark ? 'light' : 'dark';
    setSetting('theme', next);
    applyTheme(next);
    toast(next === 'dark' ? '深色模式' : '浅色模式');
    if (currentView === 'me') renderMe(viewEl('me'));
  });

  window.addEventListener('syu:search', openSearch);
  window.addEventListener('syu:theme', e => applyTheme(e.detail.theme));

  window.addEventListener('syu:filter', e => {
    const { key, value } = e.detail || {};
    if (!key) return;
    filters[key] = value;
    filters.q = '';
    if (location.hash !== '#/home') location.hash = '#/home';
    const home = viewEl('home');
    if (home.classList.contains('is-active')) {
      renderHome(home);
      toast(`已筛选：${value}`);
    }
  });

  window.addEventListener('syu:map-spot', e => {
    const spot = e.detail?.spot;
    closeDetail({ silent: true });
    location.hash = '#/map';
    if (spot) setTimeout(() => focusSpot(spot), 60);
  });

  window.addEventListener('syu:note', async e => {
    const plantId = e.detail?.plantId || null;
    location.hash = '#/notes';
    await new Promise(r => setTimeout(r, 80));
    openNoteForm(plantId);
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && isSearchOpen()) closeSearch();
  });

  window.addEventListener('online', () => toast('网络已恢复'));
  window.addEventListener('offline', () => toast('已离线，可继续浏览已缓存的页面'));
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* 忽略：无 SW 也能用 */ });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
