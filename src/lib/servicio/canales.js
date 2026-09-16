/**
 * Ché boluda — canales de Realtime compartidos entre varios oyentes.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Tres manías de supabase-js que rompían la app con Supabase real (el modo
 * local no las tiene):
 *  1. `sb.channel(tema)` devuelve el canal EXISTENTE si ya hay uno con ese tema.
 *  2. Añadir `.on(...)` a un canal ya suscrito lanza una excepción. Dos
 *     pantallas escuchando lo mismo = pantalla en blanco.
 *  3. `removeChannel` es asíncrono: si se pide el mismo tema mientras se cierra,
 *     llega el canal moribundo.
 * Aquí hay UN canal por tema, que reparte los eventos entre sus oyentes, se
 * cierra con un margen cuando se va el último y no se reabre hasta que el
 * cierre anterior ha terminado.
 */

export const MARGEN_CIERRE_MS = 1500;

export function crearCanalesCompartidos(sb, { margen = MARGEN_CIERRE_MS } = {}) {
  const temas = new Map();

  function programarCierre(c) {
    if (c.oyentes.size || c.temporizador) return;
    c.temporizador = setTimeout(() => {
      c.temporizador = null;
      if (c.oyentes.size || !c.canal) return;
      const canal = c.canal;
      c.canal = null;
      c.suscrito = false;
      c.cerrando = Promise.resolve(sb.removeChannel(canal)).catch(() => {});
    }, margen);
  }

  function abrir(tema, c) {
    c.abriendo = c.cerrando
      .then(async () => {
        if (!c.oyentes.size || c.canal) return;
        await Promise.resolve(sb.realtime?.setAuth?.()).catch(() => {});
        const canal = sb.channel(tema, c.opciones);
        c.preparar(canal, c);
        canal.subscribe((estado, error) => {
          if (c.canal !== canal) return;
          c.estado = error ? `${estado}: ${error.message}` : estado;
          c.suscrito = estado === 'SUBSCRIBED';
          if (c.suscrito) c.alSuscribir?.(canal, c);
          c.oyentes.forEach((o) => o.alEstado?.(estado));
        });
        c.canal = canal;
        programarCierre(c); // por si todos se fueron mientras se abría
      })
      .finally(() => {
        c.abriendo = null;
      });
  }

  return {
    /**
     * Une `oyente` al canal de `tema`. `preparar(canal, compartido)` registra los
     * `.on(...)` una sola vez y reparte con `compartido.oyentes`.
     * Devuelve { compartido, soltar() }.
     */
    unir(tema, { opciones, preparar, alSuscribir }, oyente) {
      let c = temas.get(tema);
      if (!c) {
        c = { oyentes: new Set(), canal: null, suscrito: false, temporizador: null, cerrando: Promise.resolve(), abriendo: null, opciones, preparar, alSuscribir, datos: {} };
        temas.set(tema, c);
      }
      clearTimeout(c.temporizador);
      c.temporizador = null;
      c.oyentes.add(oyente);
      if (c.suscrito) oyente.alUnirse?.(c);
      else if (!c.canal && !c.abriendo) abrir(tema, c);

      let suelto = false;
      return {
        compartido: c,
        soltar() {
          if (suelto) return;
          suelto = true;
          c.oyentes.delete(oyente);
          programarCierre(c);
        },
      };
    },

    /** Para pruebas y al cerrar sesión: cuántos temas tienen canal vivo. */
    vivos: () => [...temas.values()].filter((c) => c.canal).length,

    /** Para depurar: estado de cada tema. */
    resumen: () =>
      [...temas.entries()].map(([tema, c]) => ({ tema, oyentes: c.oyentes.size, canal: Boolean(c.canal), abriendo: Boolean(c.abriendo), estado: c.estado ?? null, presentes: c.datos.presentes?.length ?? null })),
  };
}
