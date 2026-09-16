/**
 * Ché boluda — bloques de voz y archivo de mensaje.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Bloque (lo que viaja en directo, unos 300 ms):
 *   u16 muestras · i16 predicción · u8 índice · u8 0 · nibbles ADPCM
 * Archivo (lo que se guarda en Supabase):
 *   "CB" · u8 versión · u8 0 · u32 frecuencia · bloques uno detrás de otro
 * Todo en little-endian. El archivo es la concatenación de los mismos bloques
 * que se emitieron: no hay que volver a codificar al soltar el botón.
 */
import { codificar, decodificar, estadoInicial } from './adpcm.js';

export const FRECUENCIA = 16000;
export const MUESTRAS_POR_BLOQUE = 4800; // 300 ms
const CABECERA_BLOQUE = 6;
const CABECERA_ARCHIVO = 8;
const VERSION = 1;

function empaquetar(muestras, estado) {
  const bloque = new Uint8Array(CABECERA_BLOQUE + Math.ceil(muestras.length / 2));
  const vista = new DataView(bloque.buffer);
  vista.setUint16(0, muestras.length, true);
  vista.setInt16(2, estado.prediccion, true);
  vista.setUint8(4, estado.indice);
  codificar(muestras, estado, bloque, CABECERA_BLOQUE);
  return bloque;
}

/**
 * Va recibiendo PCM de 16 bits a FRECUENCIA y suelta bloques completos.
 * `terminar()` devuelve el último bloque, incompleto, o null si no queda nada.
 */
export function crearCodificador(muestrasPorBloque = MUESTRAS_POR_BLOQUE) {
  const estado = estadoInicial();
  let pendiente = new Int16Array(muestrasPorBloque);
  let lleno = 0;
  let total = 0;

  return {
    get muestras() {
      return total;
    },
    añadir(pcm) {
      const bloques = [];
      let i = 0;
      while (i < pcm.length) {
        const cabe = Math.min(muestrasPorBloque - lleno, pcm.length - i);
        pendiente.set(pcm.subarray(i, i + cabe), lleno);
        lleno += cabe;
        i += cabe;
        if (lleno === muestrasPorBloque) {
          bloques.push(empaquetar(pendiente, estado));
          total += lleno;
          lleno = 0;
        }
      }
      return bloques;
    },
    terminar() {
      if (lleno === 0) return null;
      const bloque = empaquetar(pendiente.subarray(0, lleno), estado);
      total += lleno;
      lleno = 0;
      return bloque;
    },
  };
}

/** Lee un bloque suelto. Devuelve { muestras: Int16Array, tamaño } o lanza si está corrupto. */
export function leerBloque(bytes, desde = 0) {
  if (bytes.length - desde < CABECERA_BLOQUE) throw new RangeError('Bloque de voz truncado');
  const vista = new DataView(bytes.buffer, bytes.byteOffset + desde);
  const cantidad = vista.getUint16(0, true);
  const estado = { prediccion: vista.getInt16(2, true), indice: vista.getUint8(4) };
  const tamaño = CABECERA_BLOQUE + Math.ceil(cantidad / 2);
  if (estado.indice > 88 || bytes.length - desde < tamaño) throw new RangeError('Bloque de voz corrupto');
  return { muestras: decodificar(bytes, desde + CABECERA_BLOQUE, cantidad, estado), tamaño };
}

/** Junta los bloques emitidos en un archivo de mensaje. */
export function unirArchivo(bloques, frecuencia = FRECUENCIA) {
  const largo = bloques.reduce((suma, b) => suma + b.length, CABECERA_ARCHIVO);
  const archivo = new Uint8Array(largo);
  archivo[0] = 0x43; // C
  archivo[1] = 0x42; // B
  archivo[2] = VERSION;
  new DataView(archivo.buffer).setUint32(4, frecuencia, true);
  let desde = CABECERA_ARCHIVO;
  for (const bloque of bloques) {
    archivo.set(bloque, desde);
    desde += bloque.length;
  }
  return archivo;
}

/** Decodifica un archivo entero: { frecuencia, muestras: Int16Array }. */
export function leerArchivo(bytes) {
  if (bytes.length < CABECERA_ARCHIVO || bytes[0] !== 0x43 || bytes[1] !== 0x42) {
    throw new TypeError('No es un audio de Ché boluda');
  }
  if (bytes[2] !== VERSION) throw new TypeError(`Versión de audio desconocida: ${bytes[2]}`);
  const frecuencia = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
  const trozos = [];
  let total = 0;
  let desde = CABECERA_ARCHIVO;
  while (desde < bytes.length) {
    const { muestras, tamaño } = leerBloque(bytes, desde);
    trozos.push(muestras);
    total += muestras.length;
    desde += tamaño;
  }
  const muestras = new Int16Array(total);
  let i = 0;
  for (const t of trozos) {
    muestras.set(t, i);
    i += t.length;
  }
  return { frecuencia, muestras };
}

export const duracionMs = (muestras, frecuencia = FRECUENCIA) => Math.round((muestras / frecuencia) * 1000);
