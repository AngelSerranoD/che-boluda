/**
 * Ché boluda — contextos de React y ganchos de estado compartido.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { alCambiarEscuchados, versionEscuchados } from './lib/escuchados.js';

/** { servicio, avisar(texto) } — disponible siempre. */
export const ContextoApp = createContext(null);
/** { yo, perfil, salas, amigos, radio, reproductor, recargar } — solo con sesión. */
export const ContextoSesion = createContext(null);

export const useApp = () => useContext(ContextoApp);
export const useSesion = () => useContext(ContextoSesion);

export function useRadio() {
  const { radio } = useSesion();
  return useSyncExternalStore(radio.suscribir, radio.estado);
}

export function useReproductor() {
  const { reproductor } = useSesion();
  return useSyncExternalStore(reproductor.suscribir, reproductor.estado);
}

/** Vuelve a pintar cuando se marca algo como escuchado. */
export const useEscuchados = () => useSyncExternalStore(alCambiarEscuchados, versionEscuchados);

/** Fuerza un repintado cada `ms` mientras `activo` (cronómetros, "hace 5 min"). */
export function useTic(activo, ms = 250) {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setTic((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [activo, ms]);
}

/** Perfil de una persona a partir de las listas cargadas. */
export function buscarPerfil(sesion, id) {
  if (id === sesion.yo) return sesion.perfil;
  for (const sala of sesion.salas ?? []) {
    const m = sala.miembros.find((x) => x.id === id);
    if (m) return m;
  }
  return sesion.amigos?.find((a) => a.id === id) ?? null;
}

/** En un chat directo, la otra persona. */
export const otraPersona = (sala, yo) => sala?.miembros.find((m) => m.id !== yo) ?? null;

export const nombreSala = (sala, yo) => (sala?.tipo === 'directo' ? otraPersona(sala, yo)?.nombre ?? 'Chat' : sala?.nombre ?? 'Sala');
