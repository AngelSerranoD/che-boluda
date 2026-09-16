/**
 * Ché boluda — pruebas de los canales compartidos contra un supabase-js falso
 * que imita sus manías reales (canal reutilizado por tema, .on() prohibido tras
 * subscribe y cierre asíncrono).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCanalesCompartidos } from '../src/lib/servicio/canales.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function supabaseFalso() {
  const canales = [];
  const creados = [];
  return {
    creados,
    realtime: { setAuth: async () => {} },
    channel(tema) {
      const existente = canales.find((c) => c.tema === tema);
      if (existente) return existente; // manía 1
      const canal = {
        tema,
        suscrito: false,
        manejadores: [],
        on(tipo, filtro, fn) {
          if (this.suscrito) throw new Error(`cannot add \`${tipo}\` callbacks after \`subscribe()\``); // manía 2
          this.manejadores.push(fn);
          return this;
        },
        subscribe(cb) {
          this.suscrito = true;
          setTimeout(() => cb('SUBSCRIBED'), 5);
          return this;
        },
        emitir(dato) {
          this.manejadores.forEach((fn) => fn(dato));
        },
      };
      canales.push(canal);
      creados.push(canal);
      return canal;
    },
    async removeChannel(canal) {
      await esperar(30); // manía 3
      canales.splice(canales.indexOf(canal), 1);
    },
  };
}

const preparar = (canal, c) => canal.on('broadcast', {}, (dato) => c.oyentes.forEach((o) => o.alDato(dato)));

test('dos oyentes del mismo tema comparten canal sin lanzar', async () => {
  const sb = supabaseFalso();
  const registro = crearCanalesCompartidos(sb, { margen: 10 });
  const a = [];
  const b = [];
  registro.unir('sala:1', { preparar }, { alDato: (d) => a.push(d) });
  await esperar(20);
  // El segundo llega con el canal ya suscrito: con supabase-js a pelo, esto lanzaba.
  const segundo = registro.unir('sala:1', { preparar }, { alDato: (d) => b.push(d), alUnirse: () => b.push('unida') });
  assert.equal(sb.creados.length, 1);
  sb.creados[0].emitir('hola');
  assert.deepEqual(a, ['hola']);
  assert.deepEqual(b, ['unida', 'hola']);
  segundo.soltar();
  sb.creados[0].emitir('adiós');
  assert.deepEqual(b, ['unida', 'hola']);
});

test('se cierra al irse el último y no se reabre sobre el canal moribundo', async () => {
  const sb = supabaseFalso();
  const registro = crearCanalesCompartidos(sb, { margen: 10 });
  const oyente = { alDato: () => {} };
  const union = registro.unir('sala:2', { preparar }, oyente);
  await esperar(20);
  union.soltar();
  await esperar(15); // ya se está cerrando (removeChannel tarda 30 ms)
  const recibidos = [];
  registro.unir('sala:2', { preparar }, { alDato: (d) => recibidos.push(d) });
  await esperar(60);
  assert.equal(sb.creados.length, 2, 'abre un canal nuevo tras el cierre');
  sb.creados[1].emitir('de nuevo');
  assert.deepEqual(recibidos, ['de nuevo']);
});

test('irse y volver dentro del margen reutiliza el canal (StrictMode, cambio de pantalla)', async () => {
  const sb = supabaseFalso();
  const registro = crearCanalesCompartidos(sb, { margen: 50 });
  registro.unir('cambios:yo', { preparar }, { alDato: () => {} }).soltar();
  registro.unir('cambios:yo', { preparar }, { alDato: () => {} });
  await esperar(80);
  assert.equal(sb.creados.length, 1);
  assert.equal(registro.vivos(), 1);
});

test('si todos se van mientras se abre, se cierra igualmente', async () => {
  const sb = supabaseFalso();
  const registro = crearCanalesCompartidos(sb, { margen: 5 });
  registro.unir('sala:3', { preparar }, { alDato: () => {} }).soltar();
  await esperar(80);
  assert.equal(registro.vivos(), 0);
});
