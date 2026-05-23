'use strict';

const CACHE_VERSION = 'cast-cad-field-v1';
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const SHELL_ASSETS = [
  '/projects/cast-cad.html',
  '/projects/cast-cad.js',
  '/projects/cast-project-controls-data.js',
  '/cast-build.css',
  '/cast-build-components.css',
  '/cast-build-shell.js',
  '/cast-xlsx-export.js',
  '/assets/brand/brand.js',
  '/assets/brand/cast-monogram-logo.svg',
];

function isShellAsset(url) {
  return SHELL_ASSETS.includes(url.pathname);
}

function isPrivateOrMutable(url) {
  return url.pathname.startsWith('/api/')
    || url.pathname.includes('/safe-data/')
    || url.pathname.includes('/data/')
    || url.searchParams.has('sheetId')
    || /\.pdf$/i.test(url.pathname);
}

async function cacheShellAssets() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_ASSETS);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShellAssets().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_VERSION.split(':')[0]) && name !== SHELL_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivateOrMutable(url)) return;
  if (!isShellAsset(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || network;
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CAST_CAD_FIELD_CACHE_REFRESH') {
    event.waitUntil(cacheShellAssets().then(() => event.source?.postMessage?.({ type: 'CAST_CAD_FIELD_CACHE_READY', cache: SHELL_CACHE, privateAssetsCached: false })));
  }
});
