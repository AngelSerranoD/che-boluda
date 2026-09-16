/**
 * Ché boluda — rutas sin dependencias.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 *   /                 salas            /sala/<id>        una sala o chat
 *   /amigos           amigos           /sala/<id>/info   detalles de la sala
 *   /yo               perfil           /i/<código>       invitación
 */
import { useEffect, useState } from 'react';

const oyentes = new Set();

export function navegar(destino, { reemplazar = false } = {}) {
  if (destino === location.pathname) return;
  // `dentro` marca que se llegó navegando por la app: "atrás" puede usar el historial.
  history[reemplazar ? 'replaceState' : 'pushState']({ dentro: true }, '', destino);
  oyentes.forEach((cb) => cb());
}

/** Vuelve atrás si se vino desde la app; si se entró directo (un aviso), va a `respaldo`. */
export function atras(respaldo = '/') {
  if (history.state?.dentro) history.back();
  else navegar(respaldo, { reemplazar: true });
}

export function useRuta() {
  const [ruta, setRuta] = useState(() => location.pathname);
  useEffect(() => {
    const actualizar = () => setRuta(location.pathname);
    window.addEventListener('popstate', actualizar);
    oyentes.add(actualizar);
    return () => {
      window.removeEventListener('popstate', actualizar);
      oyentes.delete(actualizar);
    };
  }, []);
  return ruta;
}

/** '/sala/abc/info' → { pantalla: 'info', sala: 'abc' } */
export function leerRuta(ruta) {
  const sala = ruta.match(/^\/sala\/([0-9a-f-]{36})(\/info)?\/?$/i);
  if (sala) return { pantalla: sala[2] ? 'info' : 'sala', sala: sala[1] };
  if (ruta.startsWith('/amigos')) return { pantalla: 'amigos' };
  if (ruta.startsWith('/yo')) return { pantalla: 'yo' };
  return { pantalla: 'salas' };
}
