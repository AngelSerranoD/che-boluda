/**
 * Ché boluda — configuración de Vite.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Sella el service worker con la huella del index.html compilado. Cada build
 * que cambia algo estrena caché y la vieja se borra sola al activarse.
 */
function sellarServiceWorker() {
  let salida;
  return {
    name: 'cheboluda:sellar-sw',
    apply: 'build',
    configResolved(config) {
      salida = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const ruta = resolve(salida, 'sw.js');
      const sw = readFileSync(ruta, 'utf8');
      if (!sw.includes('__VERSION__')) throw new Error('sw.js ha perdido el marcador __VERSION__');
      const huella = createHash('sha256')
        .update(readFileSync(resolve(salida, 'index.html')))
        .digest('hex')
        .slice(0, 12);
      writeFileSync(ruta, sw.replaceAll('__VERSION__', huella));
    },
  };
}

/**
 * `vite preview` sirve las mismas cabeceras que Vercel (CSP incluida) para
 * probar la build tal cual. Fuera lo que en http://localhost no tiene sentido.
 */
function cabecerasDeVercel() {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
  const globales = vercel.headers.find((h) => h.source === '/(.*)').headers;
  return Object.fromEntries(
    globales
      .filter((h) => h.key !== 'Strict-Transport-Security')
      .map((h) => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')])
  );
}

export default defineConfig({
  plugins: [react(), sellarServiceWorker()],
  preview: { headers: cabecerasDeVercel() },
});
