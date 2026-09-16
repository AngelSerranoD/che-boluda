/**
 * Ché boluda — pruebas del aviso push (sin red).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procesarAviso } from '../servidor/avisar.js';

const LUCIA = '11111111-1111-4111-8111-111111111111';
const MARTA = '22222222-2222-4222-8222-222222222222';
const ANA = '33333333-3333-4333-8333-333333333333';
const PAULA = '44444444-4444-4444-8444-444444444444';
const SALA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MENSAJE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AHORA = Date.parse('2026-09-16T18:00:00Z');

function dependencias({ tipo = 'grupo', autor = LUCIA, creado = '2026-09-16T17:59:30Z', fallos = {} } = {}) {
  const enviados = [];
  const borradas = [];
  return {
    enviados,
    borradas,
    usuario: async (token) => ({ 'token-lucia': LUCIA, 'token-marta': MARTA })[token] ?? null,
    mensaje: async (id) => (id === MENSAJE ? { id, sala_id: SALA, autor_id: autor, duracion_ms: 7400, creado_en: creado } : null),
    sala: async () => ({ id: SALA, tipo, nombre: tipo === 'grupo' ? 'Las chicas' : null, emoji: '💅' }),
    miembros: async () => [
      { perfil_id: LUCIA, silenciada: false },
      { perfil_id: MARTA, silenciada: false },
      { perfil_id: ANA, silenciada: true },
      { perfil_id: PAULA, silenciada: false },
    ],
    perfil: async () => ({ nombre: 'Lucía' }),
    suscripciones: async (ids) =>
      [
        { endpoint: 'https://push/marta-iphone', perfil_id: MARTA },
        { endpoint: 'https://push/marta-ipad', perfil_id: MARTA },
        { endpoint: 'https://push/ana', perfil_id: ANA },
        { endpoint: 'https://push/paula', perfil_id: PAULA },
      ].filter((s) => ids.includes(s.perfil_id)),
    noLeidos: async () => ({ [MARTA]: 3 }),
    borrarSuscripcion: async (endpoint) => borradas.push(endpoint),
    enviar: async (s, aviso) => {
      if (fallos[s.endpoint]) throw Object.assign(new Error('push'), { statusCode: fallos[s.endpoint] });
      enviados.push({ endpoint: s.endpoint, aviso });
    },
  };
}

const pedir = (dep, cuerpo, token = 'token-lucia') => procesarAviso(dep, { token, cuerpo, ahora: AHORA });

test('avisa a los miembros no silenciados, menos a la autora y a quien lo oyó en directo', async () => {
  const dep = dependencias();
  const r = await pedir(dep, { mensaje: MENSAJE, excluir: [PAULA] });
  assert.deepEqual(r, { estado: 200, enviados: 2 });
  assert.deepEqual(dep.enviados.map((e) => e.endpoint), ['https://push/marta-iphone', 'https://push/marta-ipad']);
  assert.deepEqual(dep.enviados[0].aviso, {
    titulo: '💅 Las chicas',
    texto: 'Lucía: 🎙️ 0:07',
    sala: SALA,
    url: `/sala/${SALA}`,
    insignia: 3,
  });
});

test('en un chat directo el título es quien habla', async () => {
  const dep = dependencias({ tipo: 'directo' });
  await pedir(dep, { mensaje: MENSAJE, excluir: [] });
  assert.equal(dep.enviados[0].aviso.titulo, 'Lucía');
  assert.equal(dep.enviados[0].aviso.texto, '🎙️ Te ha hablado · 0:07');
  const paula = dep.enviados.find((e) => e.endpoint === 'https://push/paula');
  assert.equal(paula.aviso.insignia, 1, 'sin dato de pendientes, al menos 1');
});

test('rechaza sin sesión, con mensaje ajeno, inventado o antiguo', async () => {
  assert.equal((await pedir(dependencias(), { mensaje: MENSAJE }, '')).estado, 401);
  assert.equal((await pedir(dependencias(), { mensaje: MENSAJE }, 'token-falso')).estado, 401);
  assert.equal((await pedir(dependencias(), { mensaje: 'no-uuid' })).estado, 400);
  assert.equal((await pedir(dependencias(), { mensaje: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).estado, 404);
  assert.equal((await pedir(dependencias(), { mensaje: MENSAJE }, 'token-marta')).estado, 403);
  const viejo = dependencias({ creado: '2026-09-16T17:50:00Z' });
  assert.equal((await pedir(viejo, { mensaje: MENSAJE })).estado, 409);
  assert.equal(viejo.enviados.length, 0);
});

test('borra las suscripciones caducadas (404/410) y sigue con el resto', async () => {
  const dep = dependencias({ fallos: { 'https://push/marta-ipad': 410, 'https://push/paula': 500 } });
  const r = await pedir(dep, { mensaje: MENSAJE });
  assert.equal(r.enviados, 1);
  assert.deepEqual(dep.borradas, ['https://push/marta-ipad']);
});

test('si todos lo oyeron en directo no se manda nada', async () => {
  const dep = dependencias();
  assert.deepEqual(await pedir(dep, { mensaje: MENSAJE, excluir: [MARTA, PAULA] }), { estado: 200, enviados: 0 });
});
