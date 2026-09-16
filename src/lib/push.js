/**
 * Ché boluda — avisos push (Web Push) y detección de iPhone instalado.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * En iPhone los avisos solo existen si la web está añadida a la pantalla de
 * inicio (iOS 16.4+), y el permiso hay que pedirlo dentro de un toque.
 */
import { ErrorApp } from './servicio/errores.js';

export const esIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const esAppInstalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const pushDisponible = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const permisoAvisos = () => (pushDisponible() ? Notification.permission : 'no-disponible');

function claveServidor() {
  const clave = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!clave) throw new ErrorApp('Faltan las claves de avisos en la configuración (VITE_VAPID_PUBLIC_KEY).');
  const base64 = (clave + '='.repeat((4 - (clave.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function registro() {
  const listo = navigator.serviceWorker.ready;
  const tarde = new Promise((_, rechazar) =>
    setTimeout(() => rechazar(new ErrorApp('La app aún se está instalando. Vuelve a probar en unos segundos.')), 8000)
  );
  return Promise.race([listo, tarde]);
}

/** Llamar directamente desde el onClick: requestPermission va antes de cualquier await. */
export async function activarAvisos(servicio) {
  if (!pushDisponible()) {
    throw new ErrorApp(esIOS() && !esAppInstalada()
      ? 'Primero añade la app a la pantalla de inicio: Compartir → Añadir a pantalla de inicio.'
      : 'Este navegador no admite avisos.');
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new ErrorApp('Sin permiso para avisos. Actívalo en Ajustes → Notificaciones → Ché boluda.');
  }
  const reg = await registro();
  const suscripcion = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveServidor() }));
  await servicio.guardarSuscripcion(suscripcion);
}

/** Tras iniciar sesión: si el dispositivo ya tenía avisos, pasan a esta cuenta. */
export async function sincronizarAvisos(servicio) {
  if (permisoAvisos() !== 'granted') return false;
  try {
    const reg = await registro();
    const suscripcion = await reg.pushManager.getSubscription();
    if (!suscripcion) return false;
    await servicio.guardarSuscripcion(suscripcion);
    return true;
  } catch {
    return false;
  }
}

export async function desactivarAvisos(servicio) {
  if (!pushDisponible()) return;
  const reg = await registro().catch(() => null);
  const suscripcion = await reg?.pushManager.getSubscription();
  if (!suscripcion) return;
  await servicio.borrarSuscripcion(suscripcion.endpoint).catch(() => {});
  await suscripcion.unsubscribe().catch(() => {});
}

/** Número en el icono de la app (iOS 16.4+ con permiso de avisos). */
export function ponerInsignia(total) {
  try {
    if (total > 0) navigator.setAppBadge?.(total)?.catch(() => {});
    else navigator.clearAppBadge?.()?.catch(() => {});
  } catch {
    /* sin Badging API */
  }
}
