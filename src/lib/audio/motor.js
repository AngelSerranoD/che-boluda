/**
 * Ché boluda — contexto de audio compartido y sonidos de walkie.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Tres manías de Safari en iPhone que se resuelven aquí:
 *  1. El AudioContext nace suspendido y solo arranca dentro de un gesto. Tras
 *     bloquear la pantalla vuelve a quedarse "interrupted". Se reanuda en cada
 *     toque (escucharGestos) y la interfaz avisa si sigue parado.
 *  2. Con el interruptor de silencio puesto, Web Audio no suena salvo que la
 *     sesión de audio sea 'playback' (navigator.audioSession, iOS 17+).
 *  3. Mientras el micro está abierto el sonido sale bajito por el auricular;
 *     por eso el micro solo se abre mientras se mantiene pulsado.
 */

let ctx = null;
const oyentes = new Set();

export function contexto() {
  if (!ctx) {
    const Clase = globalThis.AudioContext || globalThis.webkitAudioContext;
    ctx = new Clase({ latencyHint: 'interactive' });
    ctx.addEventListener?.('statechange', () => oyentes.forEach((cb) => cb(ctx.state)));
  }
  return ctx;
}

export function sesionDeAudio(tipo) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = tipo;
  } catch {
    /* navegador sin Audio Session API */
  }
}

let cebado = false;

/** Intenta dejar el audio sonando. Llamar dentro de un gesto. */
export async function desbloquear() {
  const c = contexto();
  if (!cebado) {
    sesionDeAudio('playback');
    // Un búfer mudo dentro del gesto termina de abrir la salida en iOS.
    const fuente = c.createBufferSource();
    fuente.buffer = c.createBuffer(1, 1, c.sampleRate);
    fuente.connect(c.destination);
    fuente.start();
    cebado = true;
  }
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* se reintentará en el siguiente toque */
    }
  }
  return c.state === 'running';
}

export const sonando = () => ctx?.state === 'running';

export function alCambiarEstadoAudio(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** Reanuda el audio en cada toque de la persona. */
export function escucharGestos() {
  const intentar = () => {
    if (!ctx || ctx.state !== 'running') desbloquear();
  };
  window.addEventListener('pointerdown', intentar, { capture: true, passive: true });
  window.addEventListener('keydown', intentar, { capture: true, passive: true });
  return () => {
    window.removeEventListener('pointerdown', intentar, { capture: true });
    window.removeEventListener('keydown', intentar, { capture: true });
  };
}

// ───────── Sonidos sintetizados (sin archivos) ─────────

function tono(c, destino, { frecuencia, desde, duracion, volumen = 0.18, forma = 'sine' }) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = forma;
  osc.frequency.setValueAtTime(frecuencia, desde);
  env.gain.setValueAtTime(0.0001, desde);
  env.gain.exponentialRampToValueAtTime(volumen, desde + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, desde + duracion);
  osc.connect(env).connect(destino);
  osc.start(desde);
  osc.stop(desde + duracion + 0.02);
}

/** Ruido de squelch: el "chsss" de soltar el botón de un walkie de verdad. */
function squelch(c, destino, desde, duracion = 0.14, volumen = 0.08) {
  const largo = Math.round(c.sampleRate * duracion);
  const buffer = c.createBuffer(1, largo, c.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / largo);
  const fuente = c.createBufferSource();
  fuente.buffer = buffer;
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 2400;
  filtro.Q.value = 0.8;
  const env = c.createGain();
  env.gain.value = volumen;
  fuente.connect(filtro).connect(env).connect(destino);
  fuente.start(desde);
}

/**
 * 'abrir': doble pitido ascendente (canal abierto, ya puedes hablar).
 * 'recibir': pitido corto cuando alguien empieza a hablar.
 * 'cambio': squelch + pitido de "cambio y corto" al terminar.
 * 'error': zumbido grave.
 * Devuelve lo que dura en milisegundos.
 */
export function sonido(nombre) {
  const c = contexto();
  if (c.state !== 'running') return 0;
  const t = c.currentTime + 0.01;
  const salida = c.destination;
  switch (nombre) {
    case 'abrir':
      tono(c, salida, { frecuencia: 880, desde: t, duracion: 0.07 });
      tono(c, salida, { frecuencia: 1320, desde: t + 0.08, duracion: 0.09 });
      return 190;
    case 'recibir':
      tono(c, salida, { frecuencia: 1175, desde: t, duracion: 0.06, volumen: 0.1 });
      return 80;
    case 'cambio':
      squelch(c, salida, t);
      tono(c, salida, { frecuencia: 1560, desde: t + 0.12, duracion: 0.08, volumen: 0.12 });
      return 220;
    case 'error':
      tono(c, salida, { frecuencia: 180, desde: t, duracion: 0.22, volumen: 0.12, forma: 'square' });
      return 240;
    default:
      return 0;
  }
}
