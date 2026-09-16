/**
 * Ché boluda — registro del service worker.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * La CSP exige Trusted Types, y register() es un destino protegido: la URL
 * tiene que pasar por la política 'cheboluda-sw', que solo admite /sw.js.
 */
import { navegar } from './lib/ruta.js';

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Al tocar un aviso con la app ya abierta, el service worker pide ir a la sala.
  navigator.serviceWorker.addEventListener('message', ({ data }) => {
    if (data?.tipo === 'navegar' && typeof data.url === 'string' && data.url.startsWith('/')) navegar(data.url);
  });

  if (!import.meta.env.PROD) return;

  let url = '/sw.js';
  if (window.trustedTypes?.createPolicy) {
    const politica = window.trustedTypes.createPolicy('cheboluda-sw', {
      createScriptURL(valor) {
        if (valor !== '/sw.js') throw new TypeError('URL de service worker no permitida');
        return valor;
      },
    });
    url = politica.createScriptURL('/sw.js');
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url, { scope: '/' }).catch(() => {});
  });
}
