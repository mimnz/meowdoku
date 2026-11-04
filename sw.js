/*
 * Meowdoku PWA - cache offline do app shell.
 * Ao alterar arquivos publicados, mude CACHE_VERSION para forçar um cache novo.
 * Tudo é relativo ao sw.js, portanto funciona em /meowdoku/ no GitHub Pages.
 */
const CACHE_VERSION = 'meowdoku-static-v2';
const CACHE_PREFIX = 'meowdoku-static-';
const BASE = new URL('./', self.location.href);
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './js/core.js', './js/app.js', './js/pwa.js',
  './assets/favicon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-maskable-512.png', './assets/apple-touch-icon.png',
  './assets/audio/cat.wav', './assets/audio/hint.wav',
  './assets/audio/mark.wav', './assets/audio/wrong.wav',
  './assets/audio/victory.wav'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Preferir rede atualizada; se faltar internet, recuperar o último arquivo válido.
// A rota com ?seed=... funciona offline porque o HTML inicial é o mesmo.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        // Guardamos a entrada canônica: seeds não geram cópias do HTML em cache.
        const key = request.mode === 'navigate' ? new URL('./index.html', BASE).href : request;
        await cache.put(key, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await cache.match(new URL('./index.html', BASE).href);
        if (fallback) return fallback;
      }
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return Response.error();
    }
  })());
});
