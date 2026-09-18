// 以下兩行由 vite.config.ts 的 precache plugin 在 build 時替換
const PRECACHE_MANIFEST = []; /* __PRECACHE_MANIFEST__ */
const CACHE_VERSION = 'dev'; /* __CACHE_VERSION__ */

const CACHE_NAME = `zplit-${CACHE_VERSION}`;
const APP_SHELL = '/index.html';
// 網路太慢時改用快取的 App shell，避免弱網路下一直白等
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  // 預先快取整個 App（含所有延遲載入的頁面），第一次造訪後即可完全離線使用
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([APP_SHELL, ...PRECACHE_MANIFEST]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('zplit-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function networkFirstNavigation(request) {
  const network = fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, clone));
    }
    return response;
  });

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(caches.match(APP_SHELL)), NAVIGATION_TIMEOUT_MS);
  });

  return Promise.race([network, timeout])
    .then((response) => response || network)
    .catch(() => caches.match(APP_SHELL))
    .then((response) => response || fetch(request));
}

// 檔名含 hash 的建置產物永不改變：快取優先
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
  });
}

// 圖示、manifest 等固定路徑檔案：先回快取，同時在背景更新
function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const network = fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => cached);
    return cached || network;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Firebase / Cloudflare 等外部請求由各自的 SDK 處理（Firestore 有自己的離線快取）
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (PRECACHE_MANIFEST.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
