/**
 * Ché boluda — mensajes ya escuchados en este dispositivo.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * "No leídos" (el número de la lista) lo lleva el servidor con ultimo_leido.
 * Esto es más fino: qué burbujas concretas has oído, en directo o después,
 * para marcar con un punto las que faltan dentro de la sala.
 */
const CLAVE = 'cheboluda:escuchados';
const MAXIMO = 800;

let ids = cargar();
const oyentes = new Set();

function cargar() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE)) ?? []);
  } catch {
    return new Set();
  }
}

export const escuchado = (id) => ids.has(id);

export function marcarEscuchado(id) {
  if (ids.has(id)) return;
  ids.add(id);
  if (ids.size > MAXIMO) ids = new Set([...ids].slice(-MAXIMO));
  try {
    localStorage.setItem(CLAVE, JSON.stringify([...ids]));
  } catch {
    /* sin almacenamiento: se queda en memoria */
  }
  oyentes.forEach((cb) => cb());
}

export function alCambiarEscuchados(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

export const versionEscuchados = () => ids.size;
