/**
 * Ché boluda — pruebas de invitaciones, validación, fechas y paleta.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { codigoDeRuta, codigoLegible, enlaceInvitacion, enlaceWhatsApp, extraerCodigo, mensajeInvitacion } from '../src/lib/invitacion.js';
import { errorContrasena, errorNombre, errorUsuario, normalizarUsuario } from '../src/lib/validar.js';
import { cuandoCorto, duracion, separadorDia } from '../src/lib/tiempo.js';

test('extraerCodigo acepta enlace, mensaje de WhatsApp y código a mano', () => {
  const enlace = enlaceInvitacion('https://che-boluda.vercel.app/', 'K7M2QX9P');
  assert.equal(enlace, 'https://che-boluda.vercel.app/i/K7M2QX9P');
  assert.equal(extraerCodigo(enlace), 'K7M2QX9P');
  assert.equal(extraerCodigo(mensajeInvitacion('Lucía', enlace)), 'K7M2QX9P');
  assert.equal(extraerCodigo(' k7m2-qx9p '), 'K7M2QX9P');
  assert.equal(extraerCodigo(codigoLegible('K7M2QX9P')), 'K7M2QX9P');
});

test('extraerCodigo rechaza lo que no es un código', () => {
  for (const malo of ['', 'hola', 'K7M2QX9', 'K7M2QX9PP', 'K7M2QX0P', 'IIIIIIII', null, 42]) {
    assert.equal(extraerCodigo(malo), null, String(malo));
  }
});

test('codigoDeRuta', () => {
  assert.equal(codigoDeRuta('/i/K7M2QX9P'), 'K7M2QX9P');
  assert.equal(codigoDeRuta('/i/k7m2qx9p?x=1'), 'K7M2QX9P');
  assert.equal(codigoDeRuta('/sala/123'), null);
});

test('enlaceWhatsApp codifica el texto', () => {
  assert.equal(enlaceWhatsApp('¡hola & adiós!'), 'https://wa.me/?text=%C2%A1hola%20%26%20adi%C3%B3s!');
});

test('usuario: normaliza y valida', () => {
  assert.equal(normalizarUsuario('  @Lucia.Perez '), 'lucia.perez');
  assert.equal(errorUsuario('lucia_99'), null);
  assert.match(errorUsuario('lu'), /Mínimo/);
  assert.match(errorUsuario('lucía'), /Solo letras/);
  assert.match(errorUsuario('.lucia'), /punto/);
  assert.match(errorUsuario('lu..cia'), /punto/);
  assert.match(errorUsuario('a'.repeat(21)), /Máximo/);
});

test('nombre y contraseña', () => {
  assert.equal(errorNombre('Lucía 🌸'), null);
  assert.match(errorNombre('   '), /Pon/);
  assert.equal(errorContrasena('123456'), null);
  assert.match(errorContrasena('12345'), /Mínimo/);
});

test('duracion', () => {
  assert.equal(duracion(0), '0:00');
  assert.equal(duracion(7400), '0:07');
  assert.equal(duracion(7600), '0:08');
  assert.equal(duracion(62000), '1:02');
});

test('cuandoCorto y separadorDia', () => {
  const ahora = new Date(2026, 8, 16, 18, 30); // miércoles 16 sep 2026
  assert.equal(cuandoCorto(new Date(2026, 8, 16, 18, 29, 30), ahora), 'ahora');
  assert.equal(cuandoCorto(new Date(2026, 8, 16, 18, 5), ahora), 'hace 25 min');
  assert.equal(cuandoCorto(new Date(2026, 8, 16, 9, 7), ahora), '09:07');
  assert.equal(cuandoCorto(new Date(2026, 8, 15, 23, 50), ahora), 'ayer');
  assert.equal(cuandoCorto(new Date(2026, 8, 14, 10, 0), ahora), 'lun');
  assert.equal(cuandoCorto(new Date(2026, 7, 2, 10, 0), ahora), '2 ago');
  assert.equal(cuandoCorto(new Date(2025, 7, 2, 10, 0), ahora), '2 ago 2025');
  assert.equal(separadorDia(new Date(2026, 8, 16, 1, 0), ahora), 'Hoy');
  assert.equal(separadorDia(new Date(2026, 8, 15, 1, 0), ahora), 'Ayer');
  assert.equal(separadorDia(new Date(2026, 8, 14, 1, 0), ahora), 'Lunes 14 de septiembre');
});

/** Contraste WCAG 2.x entre dos colores #RRGGBB. */
function contraste(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

test('la paleta cumple los contrastes que documenta tailwind.config.js', () => {
  const config = readFileSync(new URL('../tailwind.config.js', import.meta.url), 'utf8');
  const color = (nombre) => config.match(new RegExp(`${nombre}: '(#[0-9A-F]{6})'`))[1];
  const casos = [
    ['tinta', 'hueso', 7], ['corteza', 'hueso', 4.5], ['cuero', 'hueso', 4.5],
    ['tinta', 'piedra', 4.5], ['tinta', 'lino', 7], ['blanco', 'cuero', 4.5],
    ['corteza', 'arena', 4.5],
  ];
  for (const [texto, fondo, minimo] of casos) {
    const valor = contraste(color(texto), color(fondo));
    assert.ok(valor >= minimo, `${texto} sobre ${fondo}: ${valor.toFixed(2)} < ${minimo}`);
  }
});
