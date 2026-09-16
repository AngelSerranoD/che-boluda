/**
 * Ché boluda — POST /api/avisar (función de Vercel).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Variables de entorno en Vercel:
 *   VITE_SUPABASE_URL          la misma URL que usa la app
 *   SUPABASE_SERVICE_ROLE_KEY  clave secreta de servicio (nunca en el cliente)
 *   VITE_VAPID_PUBLIC_KEY      clave pública VAPID (npm run vapid)
 *   VAPID_PRIVATE_KEY          clave privada VAPID
 *   VAPID_SUBJECT              opcional: https://… o mailto:… de contacto
 */
import { crearDependencias, procesarAviso } from '../servidor/avisar.js';

let dependencias = null;

function configuracion() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publica = process.env.VITE_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!url || !claveServicio || !publica || !privada) return null;
  return { url, claveServicio, vapid: { sujeto: process.env.VAPID_SUBJECT ?? 'https://che-boluda.vercel.app', publica, privada } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Solo POST' });
  }
  const config = configuracion();
  if (!config) return res.status(503).json({ error: 'Avisos sin configurar en el servidor' });
  dependencias ??= crearDependencias(config);

  try {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const { estado, ...resto } = await procesarAviso(dependencias, { token, cuerpo: req.body ?? {} });
    return res.status(estado).json(resto);
  } catch (error) {
    console.error('avisar:', error);
    return res.status(500).json({ error: 'No se ha podido avisar' });
  }
}
