/**
 * Ché boluda — utilidades de señal: remuestreo, niveles y forma de onda.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

/**
 * Diezmador por promedio de ventana: de la frecuencia del micro (44,1 o 48 kHz
 * en iPhone) a 16 kHz. Promediar cada ventana hace de filtro paso bajo barato,
 * suficiente para voz. Conserva el resto entre llamadas, así que se le puede ir
 * dando el audio en trozos de cualquier tamaño.
 */
export function crearDiezmador(de, a) {
  if (a > de) throw new RangeError('El diezmador solo baja la frecuencia');
  const razon = de / a;
  let posicion = 0;
  let acumulado = 0;
  let cuenta = 0;
  return (entrada /* Float32Array */) => {
    const salida = new Int16Array(Math.floor((posicion + entrada.length) / razon) + 1);
    let n = 0;
    for (let i = 0; i < entrada.length; i++) {
      acumulado += entrada[i];
      cuenta++;
      posicion += 1;
      if (posicion >= razon) {
        const v = acumulado / cuenta;
        salida[n++] = v >= 1 ? 32767 : v <= -1 ? -32768 : Math.round(v * 32767);
        posicion -= razon;
        acumulado = 0;
        cuenta = 0;
      }
    }
    return salida.subarray(0, n);
  };
}

/** Int16 a Float32 remuestreado por interpolación lineal (subir a la frecuencia de salida). */
export function aFlotante(muestras, de, a) {
  const razon = de / a;
  const largo = Math.max(1, Math.floor(muestras.length / razon));
  const salida = new Float32Array(largo);
  for (let i = 0; i < largo; i++) {
    const p = i * razon;
    const j = Math.floor(p);
    const f = p - j;
    const x0 = muestras[j] ?? 0;
    const x1 = muestras[j + 1] ?? x0;
    salida[i] = (x0 + (x1 - x0) * f) / 32768;
  }
  return salida;
}

function rms(muestras) {
  if (!muestras.length) return 0;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i] * muestras[i];
  return Math.sqrt(suma / muestras.length) / 32768;
}

/** Nivel percibido 0..1 para el vúmetro (curva de raíz: la voz baja también se mueve). */
export const nivel = (muestras) => Math.min(1, Math.sqrt(rms(muestras) * 4));

/**
 * `barras` alturas 8..100 para dibujar la burbuja de voz. Con el RMS crudo y
 * normalizado al máximo: con la curva del vúmetro todo satura y sale plano.
 */
export function formaDeOnda(muestras, barras = 28) {
  const alturas = new Array(barras).fill(0);
  if (!muestras.length) return alturas;
  const tramo = muestras.length / barras;
  for (let b = 0; b < barras; b++) {
    alturas[b] = rms(muestras.subarray(Math.floor(b * tramo), Math.floor((b + 1) * tramo)));
  }
  const maximo = Math.max(...alturas) || 1;
  return alturas.map((v) => Math.max(8, Math.round(Math.sqrt(v / maximo) * 100)));
}

/** Uint8Array ⇄ base64 sin reventar la pila con arrays grandes. */
export function aBase64(bytes) {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

export function deBase64(texto) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
