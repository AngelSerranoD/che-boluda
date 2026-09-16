/* Ché boluda · service worker
   Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.

   1. Guarda la interfaz para que la app abra aunque la red vaya mal.
   2. Recibe los avisos push cuando alguien habla y la app está cerrada.
   Solo se cachea lo del propio origen: Supabase (datos y audios) nunca pasa
   por aquí. __VERSION__ lo sustituye la build con la huella del index.html. */

const CACHE = 'cheboluda-__VERSION__';

const BASE = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/audio/captura.worklet.js',
  '/icons/icon-32.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

async function guardar(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res.ok) await cache.put(url, res);
  } catch { /* se pedirá a la red la primera vez que haga falta */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Los nombres de JS y CSS llevan hash: se leen del propio index.html para
    // que la app quede completa desde la primera visita.
    try {
      const res = await fetch('/', { cache: 'reload' });
      if (res.ok) {
        await cache.put('/', res.clone());
        const html = await res.text();
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await Promise.all(assets.map((url) => guardar(cache, url)));
      }
    } catch { /* sin red en la instalación: se reintentará */ }
    await Promise.all(BASE.map((url) => guardar(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('cheboluda-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Red primero para la página, con límite: una red lenta no deja la app en blanco. */
async function pagina(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), 3500)),
    ]);
    if (res.ok) cache.put('/', res.clone());
    return res;
  } catch {
    return (await cache.match('/')) ?? new Response('Sin conexión', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(pagina(request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(request, { ignoreSearch: true });
    // /assets/ lleva hash y nunca cambia: con la copia basta.
    if (guardada && url.pathname.startsWith('/assets/')) return guardada;
    // El resto (iconos, manifest, worklet) se sirve de la copia y se refresca por detrás.
    const deRed = fetch(request)
      .then((res) => {
        if (res.ok && res.type === 'basic') cache.put(request, res.clone());
        return res;
      })
      .catch(() => null);
    return guardada ?? (await deRed) ?? new Response('Sin conexión', { status: 503 });
  })());
});

// ───────── Avisos ─────────

self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch { /* aviso sin datos legibles: se enseña uno genérico */ }

  event.waitUntil((async () => {
    // iOS retira el permiso si un push no enseña notificación: siempre se muestra.
    await self.registration.showNotification(aviso.titulo || 'Ché boluda', {
      body: aviso.texto || '🎙️ Tienes un mensaje nuevo',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: aviso.sala ? `sala-${aviso.sala}` : 'cheboluda',
      renotify: true,
      data: { url: aviso.url || '/' },
    });
    if (typeof aviso.insignia === 'number' && self.navigator.setAppBadge) {
      await self.navigator.setAppBadge(aviso.insignia).catch(() => {});
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
    if (abierta) {
      await abierta.focus();
      abierta.postMessage({ tipo: 'navegar', url: new URL(destino).pathname });
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
