/**
 * Ché boluda — enlaces de invitación.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Cada perfil tiene un código de 8 caracteres sin letras que se confunden
 * (ni I, L, O, 0 ni 1). El enlace es /i/<código>. En iPhone ese enlace abre
 * Safari y no la app instalada, que guarda sus datos aparte, así que el código
 * tiene que poder copiarse y pegarse dentro de la app.
 */

export const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 8;

const SOLO_ALFABETO = new RegExp(`^[${ALFABETO}]{${LARGO_CODIGO}}$`);

/**
 * Saca el código de lo que la persona haya pegado: el enlace entero, el
 * mensaje de WhatsApp con el enlace dentro, o el código a mano con guiones o
 * espacios y en minúsculas. Devuelve null si no hay un código válido.
 */
export function extraerCodigo(texto) {
  if (typeof texto !== 'string') return null;
  const enlace = texto.match(/\/i\/([A-Za-z0-9-]{8,9})(?![A-Za-z0-9])/);
  const candidato = (enlace ? enlace[1] : texto).replace(/[\s-]/g, '').toUpperCase();
  return SOLO_ALFABETO.test(candidato) ? candidato : null;
}

/** K7M2QX9P → K7M2-QX9P, para leerlo en voz alta o copiarlo a mano. */
export const codigoLegible = (codigo) => `${codigo.slice(0, 4)}-${codigo.slice(4)}`;

export const enlaceInvitacion = (origen, codigo) => `${origen.replace(/\/$/, '')}/i/${codigo}`;

export function mensajeInvitacion(nombre, enlace) {
  return `¡Ché boluda! 📻 Soy ${nombre}. Agrégame para hablar por walkie-talkie: ${enlace}`;
}

export const enlaceWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** Código de invitación a partir de la ruta /i/<código>, o null. */
export function codigoDeRuta(ruta) {
  const m = ruta.match(/^\/i\/([^/?#]+)/);
  return m ? extraerCodigo(m[1]) : null;
}
