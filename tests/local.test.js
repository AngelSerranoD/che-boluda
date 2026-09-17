/**
 * Ché boluda — el servicio local con un bus inyectado (lo que usa la demo del
 * portfolio): dos "pestañas" en memoria que se invitan, crean sala y hablan.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioLocal } from '../src/lib/servicio/local.js';

function memoria() {
  const datos = new Map();
  return { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) };
}

/** Bus compartido: lo que publica una pestaña le llega a las demás. */
function redDePestanas() {
  const buses = [];
  return () => {
    const bus = {
      onmessage: null,
      postMessage: (data) => buses.filter((b) => b !== bus).forEach((b) => setTimeout(() => b.onmessage?.({ data }), 0)),
      close: () => buses.splice(buses.indexOf(bus), 1),
    };
    buses.push(bus);
    return bus;
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('dos pestañas con bus inyectado: invitación, sala, presencia y voz', async () => {
  const almacen = memoria();
  const nuevoBus = redDePestanas();
  const lucia = crearServicioLocal({ almacen, sesionTab: memoria(), bus: nuevoBus() });
  const marta = crearServicioLocal({ almacen, sesionTab: memoria(), bus: nuevoBus() });
  try {
    await lucia.registrarse({ usuario: 'lucia', contrasena: 'secreto', nombre: 'Lucía', avatar: '🌸' });
    await marta.registrarse({ usuario: 'marta', contrasena: 'secreto', nombre: 'Marta', avatar: '🍉' });
    const { codigo } = await lucia.miPerfil();
    const amiga = await marta.aceptarInvitacion(codigo);
    assert.equal(amiga.nombre, 'Lucía');

    const sala = await marta.crearSala({ nombre: 'Las chicas', emoji: '💅', miembros: [amiga.id] });
    assert.equal((await lucia.salas()).length, 1);

    const oidos = [];
    let presentesLucia = [];
    const canalLucia = lucia.canalDeVoz(sala, { alVoz: (p) => oidos.push(p), alPresencia: (ids) => (presentesLucia = ids) });
    const canalMarta = marta.canalDeVoz(sala, { alVoz: () => {}, alPresencia: () => {} });
    await esperar(20);
    assert.ok(presentesLucia.length === 2, `presentes: ${presentesLucia.length}`);

    canalMarta.emitir({ t: 'ini', id: 'x', de: 'marta' });
    await esperar(20);
    assert.deepEqual(oidos.map((p) => p.t), ['ini']);

    canalLucia.cerrar();
    canalMarta.cerrar();
  } finally {
    lucia.destruir();
    marta.destruir();
  }
});
