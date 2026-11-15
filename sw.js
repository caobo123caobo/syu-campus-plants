/* 沈阳大学校园植物图鉴 — Service Worker
   策略：应用外壳预缓存；data/*.json 先缓存后更新；图片按需缓存优先。
   升级版本号即可让客户端拉取新资源。 */
const VERSION = 'syu-v1.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/js/app.js',
  './assets/js/util.js',
  './assets/js/store.js',
  './assets/js/data.js',
  './assets/js/search.js',
  './assets/js/ui.js',
  './assets/js/views/home.js',
  './assets/js/views/detail.js',
  './assets/js/views/map.js',
  './assets/js/views/quiz.js',
  './assets/js/views/notes.js',
  './assets/js/views/me.js',
  './assets/js/views/about.js',
  './assets/js/views/search-view.js',
  './data/site.json',
  './data/plants.json',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，离线回退到缓存的首页
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 数据文件：先给缓存，同时后台更新
  if (url.pathname.endsWith('/data/plants.json') || url.pathname.endsWith('/data/site.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    })());
    return;
  }

  // 图片：缓存优先，按需写入
  if (url.pathname.includes('/images/')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // 其余静态资源：缓存优先 + 后台更新
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
