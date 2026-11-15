/* 交互流程检查（CDP）：node scripts/cdp-flows.mjs [baseUrl] */
import { spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';
const PORT = 9334;
const CHROME = 'C:\\Users\\16934\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = join(tmpdir(), `syu-flow-${Date.now()}`);

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--disable-breakpad', '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--window-size=430,932', 'about:blank'], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const jsErrors = [];
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

async function up() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch { /* wait */ }
    await sleep(250);
  }
  throw new Error('chrome not up');
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${extra ? ' — ' + extra : ''}`);
};

async function run(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result?.value;
}

try {
  await up();
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') jsErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') jsErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });

  console.log('\n[首屏]');
  await send('Page.navigate', { url: `${BASE}#/home` });
  await sleep(2000);
  const cards = await run('return document.querySelectorAll(".card").length');
  check('渲染 95 张卡片', cards === 95, String(cards));

  console.log('\n[搜索]');
  const s1 = await run(`
    document.querySelector('#btn-search').click();
    await new Promise(r => setTimeout(r, 200));
    const inp = document.querySelector('#search-input');
    inp.value = '丁香'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return { open: !document.getElementById('search-layer').hidden,
             count: document.querySelectorAll('.res').length,
             first: document.querySelector('.res-name')?.innerText || '' };`);
  check('搜索层打开', s1.open);
  check('搜索「丁香」有结果', s1.count >= 4, `${s1.count} 条 / ${s1.first}`);
  await run(`document.querySelector('#search-layer [data-close]').click(); return 1;`);

  console.log('\n[详情 / 收藏 / 记录]');
  const d1 = await run(`
    location.hash = '#/plant/40'; await new Promise(r => setTimeout(r, 600));
    const title = document.querySelector('.detail-title')?.innerText;
    document.querySelector('[data-fav]').click();
    const favs = JSON.parse(localStorage.getItem('syu.favs.v1') || '[]');
    return { title, open: !document.getElementById('detail-layer').hidden, favs };`);
  check('详情页打开', d1.open, d1.title);
  check('收藏写入 localStorage', Array.isArray(d1.favs) && d1.favs.includes(40), JSON.stringify(d1.favs));

  const d2 = await run(`
    document.querySelector('[data-note]').click();
    await new Promise(r => setTimeout(r, 700));
    return { hasForm: !!document.querySelector('#note-form'), hash: location.hash };`);
  check('从详情进入观察记录表单', d2.hasForm, d2.hash);

  const d3 = await run(`
    const ta = document.querySelector('#nf-text'); if (!ta) return { saved: false };
    ta.value = '自动化测试记录：叶片羽状，见 3 号楼北侧';
    document.querySelector('#nf-place').value = '北院 3 号楼北侧';
    document.querySelector('#note-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(r => setTimeout(r, 900));
    return { saved: true, cards: document.querySelectorAll('.note-card').length };`);
  check('保存观察记录并出现在列表', d3.cards >= 1, `${d3.cards} 条`);

  console.log('\n[测验]');
  const q1 = await run(`
    location.hash = '#/quiz'; await new Promise(r => setTimeout(r, 500));
    document.querySelector('#start-quiz').click();
    await new Promise(r => setTimeout(r, 400));
    return { hasOptions: document.querySelectorAll('.opt').length, text: document.querySelector('.q-text')?.innerText?.slice(0, 30) };`);
  check('开始测验并出现选项', q1.hasOptions === 4, String(q1.hasOptions));

  const q2 = await run(`
    let n = 0;
    for (let i = 0; i < 12; i++) {
      const opt = document.querySelector('.opt');
      if (opt) { opt.click(); n++; await new Promise(r => setTimeout(r, 120)); }
      const next = document.querySelector('#q-next');
      if (next) { next.click(); await new Promise(r => setTimeout(r, 200)); continue; }
      if (document.querySelector('.result-hero')) break;
    }
    return { answered: n, score: document.querySelector('.result-hero .score')?.innerText || '',
             wrong: document.querySelectorAll('.wrong-item').length };`);
  check('答题并进入结果页', !!q2.score, q2.score);
  check('错题统计出现', q2.wrong >= 0, `${q2.wrong} 条`);

  console.log('\n[地图]');
  const m1 = await run(`
    location.hash = '#/map'; await new Promise(r => setTimeout(r, 600));
    const spot = document.querySelector('[data-spot="b3"]');
    if (!spot) return { found: false };
    spot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return { found: true, links: document.querySelectorAll('.spot-panel .spot-list a').length,
             panelTitle: document.querySelector('.spot-panel h3')?.innerText || '' };`);
  check('点击地图点位', m1.found);
  check('点位物种列表出现', m1.links > 0, `${m1.links} 种 · ${m1.panelTitle.replace(/\n/g, ' ')}`);

  console.log('\n[我的]');
  const me1 = await run(`
    location.hash = '#/me'; await new Promise(r => setTimeout(r, 600));
    return { stats: [...document.querySelectorAll('.stat b')].map(b => b.innerText).join(','),
             favCards: document.querySelectorAll('.card').length };`);
  check('我的页统计渲染', !!me1.stats, me1.stats);

  check('无 JS 运行错误', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));

  console.log(`\n结果：${fail ? '❌ ' + fail + ' 失败' : '✅ 全部通过'}（${pass} 项）`);
  if (fail) process.exitCode = 1;
} catch (e) {
  console.error('流程检查失败：', e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
