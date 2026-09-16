/**
 * Ché boluda — códec IMA ADPCM (4 bits por muestra).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Voz a 16 kHz en 8 kB/s: una cuarta parte del PCM de 16 bits y bastante más
 * nítida que la ley µ a 8 kHz con el mismo tamaño. Sin dependencias ni WASM,
 * y cada bloque lleva en su cabecera el estado del predictor, así que se
 * puede decodificar suelto (lo que llega en directo) o encadenado (el archivo).
 */

const INDICES = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

const PASOS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
  50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
  253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
  1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
  3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442,
  11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767,
];

const acotar = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Estado inicial del predictor. */
export const estadoInicial = () => ({ prediccion: 0, indice: 0 });

/**
 * Codifica `muestras` (Int16Array) en `destino` a partir de `desde` y avanza
 * `estado`. Nibble bajo primero.
 */
export function codificar(muestras, estado, destino, desde = 0) {
  let { prediccion, indice } = estado;
  for (let i = 0; i < muestras.length; i++) {
    let paso = PASOS[indice];
    let diferencia = muestras[i] - prediccion;
    let nibble = 0;
    if (diferencia < 0) {
      nibble = 8;
      diferencia = -diferencia;
    }
    let delta = paso >> 3;
    if (diferencia >= paso) { nibble |= 4; diferencia -= paso; delta += paso; }
    paso >>= 1;
    if (diferencia >= paso) { nibble |= 2; diferencia -= paso; delta += paso; }
    paso >>= 1;
    if (diferencia >= paso) { nibble |= 1; delta += paso; }

    prediccion = acotar(prediccion + (nibble & 8 ? -delta : delta), -32768, 32767);
    indice = acotar(indice + INDICES[nibble], 0, 88);

    const byte = desde + (i >> 1);
    if (i & 1) destino[byte] |= nibble << 4;
    else destino[byte] = nibble;
  }
  estado.prediccion = prediccion;
  estado.indice = indice;
}

/** Decodifica `cantidad` muestras de `origen` (desde `desde`) en un Int16Array. */
export function decodificar(origen, desde, cantidad, estado) {
  const salida = new Int16Array(cantidad);
  let { prediccion, indice } = estado;
  for (let i = 0; i < cantidad; i++) {
    const nibble = (origen[desde + (i >> 1)] >> (i & 1 ? 4 : 0)) & 0x0f;
    const paso = PASOS[indice];
    let delta = paso >> 3;
    if (nibble & 4) delta += paso;
    if (nibble & 2) delta += paso >> 1;
    if (nibble & 1) delta += paso >> 2;
    prediccion = acotar(prediccion + (nibble & 8 ? -delta : delta), -32768, 32767);
    indice = acotar(indice + INDICES[nibble], 0, 88);
    salida[i] = prediccion;
  }
  estado.prediccion = prediccion;
  estado.indice = indice;
  return salida;
}
