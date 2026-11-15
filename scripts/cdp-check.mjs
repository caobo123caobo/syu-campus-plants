/* 用 Chrome DevTools 协议做真实渲染检查 + 截图
   node scripts/cdp-check.mjs [baseUrl] [outDir]  */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';
const OUT = process.argv[3] || join(ROOT, '_shots');
const PORT = 9333;
const CHROME = 'C:\\Users\\16934\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), `syu-cdp-${Date.now()}`);

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--disable-breakpad', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=430,932', 'about:blank',
], { stdio: 'ignore', detached: false });

let ws;
let seq = 0;
const pending = new Map();
const errors = [];

async function version() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome 未启动');
}

function send(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function main() {
  await version();
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 430, height: 932, deviceScaleFactor: 2, mobile: true,
  });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)));addEventListener("unhandledrejection",e=>window.__errs.push(String(e.reason)));',
  });

  const routes = [
    ['home', '#/home'],
    ['detail', '#/plant/1'],
    ['map', '#/map'],
    ['quiz', '#/quiz'],
    ['notes', '#/notes'],
    ['me', '#/me'],
    ['about', '#/about'],
  ];

  const report = [];
  await send('Page.navigate', { url: BASE + '#/home' });
  await sleep(2200);

  for (const [name, route] of routes) {
    await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(route)}` });
    await sleep(900);
    const expr = `(() => {
      const active = document.querySelector('.view.is-active');
      const cardImgs = [...document.querySelectorAll('.card img')].slice(0,3)
        .map(i => ({ nw: i.naturalWidth, ok: i.complete }));
      const wide = [...document.querySelectorAll('body *')]
        .filter(el => el.getBoundingClientRect().width > innerWidth + 1)
        .slice(0,5).map(el => el.tagName + '.' + String(el.className).split(' ')[0]);
      const detail = document.getElementById('detail-layer');
      return { hash: location.hash, view: active?.dataset.view || '',
        cards: document.querySelectorAll('.card').length,
        cardImgs,
        galleryImgs: [...document.querySelectorAll('.gallery-slide img')].map(i => i.naturalWidth).slice(0,3),
        detailOpen: !!(detail && !detail.hidden),
        detailTitle: (document.querySelector('.detail-title')?.innerText || '').slice(0, 24),
        heading: (active?.querySelector('h1,h2')?.innerText || '').slice(0, 30),
        tabbar: Math.round(document.querySelector('.tabbar')?.getBoundingClientRect().width || 0),
        iw: innerWidth, sw: document.documentElement.scrollWidth, wide,
        jsErr: window.__errs || [] };
    })()`;
    const ev = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
    const v = ev.result?.value || {};
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
    report.push({ name, ...v });
  }

  // 深色模式 + Service Worker 状态
  await send('Runtime.evaluate', { expression: `localStorage.setItem('syu.settings.v1', JSON.stringify({theme:'dark',grid:'comfortable',lastTab:'home'})); location.reload();` });
  await sleep(2400);
  const dark = await send('Runtime.evaluate', {
    expression: `({ theme: document.documentElement.dataset.theme,
      sw: navigator.serviceWorker ? (navigator.serviceWorker.controller ? 'controlled' : 'registered-or-pending') : 'unsupported',
      bodyBg: getComputedStyle(document.body).backgroundColor })`,
    returnByValue: true,
  });
  const darkShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'dark.png'), Buffer.from(darkShot.data, 'base64'));
  report.push({ name: 'dark', ...(dark.result?.value || {}) });

  // 桌面宽度
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('syu.settings.v1', JSON.stringify({theme:'light',grid:'comfortable',lastTab:'home'})); location.hash='#/home'; location.reload();`,
  });
  await sleep(2200);
  const deskShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'desktop.png'), Buffer.from(deskShot.data, 'base64'));

  // 搜索层（移动端）
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  await send('Runtime.evaluate', {
    expression: `(async()=>{ document.querySelector('#btn-search').click(); await new Promise(r=>setTimeout(r,250));
      const i=document.querySelector('#search-input'); i.value='松'; i.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,500)); })()`,
    awaitPromise: true,
  });
  const searchShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'search.png'), Buffer.from(searchShot.data, 'base64'));

  console.log(JSON.stringify({ errors, report }, null, 2));
}

try {
  await main();
} catch (e) {
  console.error('CDP 检查失败：', e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
