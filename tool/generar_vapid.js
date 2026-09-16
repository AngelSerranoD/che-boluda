/**
 * Ché boluda — genera el par de claves VAPID para los avisos push.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Uso: npm run vapid
 * La pública va a .env.local y a Vercel; la privada SOLO a Vercel.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('# Pública: en .env.local y en Vercel');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log('');
console.log('# Privada: SOLO en Vercel (Settings → Environment Variables). No la subas a Git.');
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
