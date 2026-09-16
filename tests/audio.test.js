/**
 * Ché boluda — pruebas del códec y del contenedor de voz.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCodificador, leerArchivo, leerBloque, unirArchivo, duracionMs, FRECUENCIA } from '../src/lib/audio/contenedor.js';
import { aBase64, aFlotante, crearDiezmador, deBase64, formaDeOnda, nivel } from '../src/lib/audio/senal.js';

/** Voz sintética: dos parciales con vibrato y envolvente, a 16 kHz. */
function vozSintetica(segundos) {
  const n = Math.round(segundos * FRECUENCIA);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FRECUENCIA;
    const f = 180 + 30 * Math.sin(2 * Math.PI * 5 * t);
    const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
    pcm[i] = Math.round(12000 * env * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * 3 * f * t)));
  }
  return pcm;
}

function snrDb(original, reconstruida) {
  let señal = 0;
  let ruido = 0;
  for (let i = 0; i < original.length; i++) {
    señal += original[i] ** 2;
    ruido += (original[i] - reconstruida[i]) ** 2;
  }
  return 10 * Math.log10(señal / ruido);
}

test('ida y vuelta por bloques conserva la voz con buena relación señal/ruido', () => {
  const pcm = vozSintetica(1.37);
  const codificador = crearCodificador();
  const bloques = [];
  // Trozos irregulares, como los que manda el micro.
  for (let i = 0; i < pcm.length; i += 1023) bloques.push(...codificador.añadir(pcm.subarray(i, i + 1023)));
  const ultimo = codificador.terminar();
  if (ultimo) bloques.push(ultimo);

  assert.equal(codificador.muestras, pcm.length);
  assert.equal(bloques.length, Math.ceil(pcm.length / 4800));

  const { frecuencia, muestras } = leerArchivo(unirArchivo(bloques));
  assert.equal(frecuencia, FRECUENCIA);
  assert.equal(muestras.length, pcm.length);
  assert.ok(snrDb(pcm, muestras) > 20, `SNR ${snrDb(pcm, muestras).toFixed(1)} dB`);
});

test('cada bloque se decodifica suelto igual que dentro del archivo', () => {
  const pcm = vozSintetica(1);
  const codificador = crearCodificador();
  const bloques = [...codificador.añadir(pcm), codificador.terminar()].filter(Boolean);
  const { muestras } = leerArchivo(unirArchivo(bloques));
  const tercero = leerBloque(bloques[2]).muestras;
  assert.deepEqual(tercero, muestras.subarray(9600, 9600 + tercero.length));
});

test('el archivo pesa unos 8 kB por segundo', () => {
  const codificador = crearCodificador();
  const bloques = [...codificador.añadir(vozSintetica(10)), codificador.terminar()].filter(Boolean);
  const bytes = unirArchivo(bloques).length;
  assert.ok(bytes > 79_000 && bytes < 81_500, `${bytes} bytes`);
  assert.equal(duracionMs(codificador.muestras), 10000);
});

test('rechaza archivos ajenos o truncados', () => {
  assert.throws(() => leerArchivo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /No es un audio/);
  const codificador = crearCodificador();
  const archivo = unirArchivo([...codificador.añadir(vozSintetica(0.4)), codificador.terminar()]);
  assert.throws(() => leerArchivo(archivo.subarray(0, archivo.length - 10)), /corrupto|truncado/);
});

test('diezmador de 48 kHz y 44,1 kHz a 16 kHz da el número de muestras esperado', () => {
  for (const de of [48000, 44100]) {
    const diezmar = crearDiezmador(de, FRECUENCIA);
    let total = 0;
    for (let i = 0; i < 100; i++) total += diezmar(new Float32Array(128).fill(0.5)).length;
    const esperado = (12800 * FRECUENCIA) / de;
    assert.ok(Math.abs(total - esperado) <= 1, `${de}: ${total} frente a ${esperado}`);
  }
});

test('diezmador satura en vez de desbordar', () => {
  const salida = crearDiezmador(48000, 16000)(new Float32Array([2, 2, 2, -2, -2, -2]));
  assert.deepEqual([...salida], [32767, -32768]);
});

test('aFlotante sube a la frecuencia de salida y normaliza', () => {
  const salida = aFlotante(new Int16Array([0, 16384, 32767, 0]), 16000, 48000);
  assert.equal(salida.length, 12);
  assert.equal(salida[0], 0);
  assert.ok(Math.abs(salida[3] - 0.5) < 1e-6);
});

test('nivel y forma de onda', () => {
  assert.equal(nivel(new Int16Array(10)), 0);
  assert.ok(nivel(vozSintetica(0.2)) > 0.5);
  const forma = formaDeOnda(vozSintetica(2), 28);
  assert.equal(forma.length, 28);
  assert.ok(forma.every((v) => v >= 8 && v <= 100));
  assert.ok(forma.includes(100));
});

test('base64 ida y vuelta con más de 32 kB', () => {
  const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) & 0xff);
  assert.deepEqual(deBase64(aBase64(bytes)), bytes);
});
