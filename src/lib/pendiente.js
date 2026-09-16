/**
 * Ché boluda — invitación guardada hasta que haya sesión.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Quien abre un enlace de invitación sin cuenta la crea después: el código se
 * guarda aquí y se acepta solo en cuanto entra.
 */
const CLAVE = 'cheboluda:invitacion';

export function guardarInvitacionPendiente(codigo) {
  try {
    localStorage.setItem(CLAVE, codigo);
  } catch {
    /* sin almacenamiento: tendrá que pegarla a mano */
  }
}

export function leerInvitacionPendiente() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function olvidarInvitacionPendiente() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
