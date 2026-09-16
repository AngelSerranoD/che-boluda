/**
 * Ché boluda — micrófono a PCM de 16 kHz.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { contexto, sesionDeAudio } from './motor.js';
import { FRECUENCIA } from './contenedor.js';
import { crearDiezmador } from './senal.js';
import { ErrorApp } from '../servicio/errores.js';

const contextosConWorklet = new WeakSet();

/**
 * Micro falso para desarrollo: una "voz" sintética. Permite probar la emisión
 * en el navegador de pruebas, que no tiene micrófono. Se activa con
 * ?micro=falso o con localStorage 'cheboluda:micro-falso' = '1'. Nunca en producción.
 */
export function usarMicroFalso() {
  if (!import.meta.env?.DEV) return false;
  if (new URLSearchParams(globalThis.location?.search ?? '').get('micro') === 'falso') return true;
  try {
    return localStorage.getItem('cheboluda:micro-falso') === '1';
  } catch {
    return false;
  }
}

function fuenteFalsa(c) {
  const voz = c.createOscillator();
  voz.type = 'sawtooth';
  voz.frequency.value = 190;
  const vibrato = c.createOscillator();
  vibrato.frequency.value = 5;
  const cuanto = c.createGain();
  cuanto.gain.value = 25;
  vibrato.connect(cuanto).connect(voz.frequency);
  const silabas = c.createOscillator();
  silabas.frequency.value = 3;
  const envolvente = c.createGain();
  envolvente.gain.value = 0.25;
  silabas.connect(envolvente.gain);
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 1800;
  voz.connect(filtro).connect(envolvente);
  [voz, vibrato, silabas].forEach((o) => o.start());
  return { nodo: envolvente, parar: () => [voz, vibrato, silabas].forEach((o) => o.stop()) };
}

/**
 * Abre el micro y llama a `alPcm(Int16Array)` con audio a 16 kHz.
 * Devuelve `cerrar()`, que espera a que el hilo de audio suelte lo último.
 */
export async function abrirMicrofono({ alPcm }) {
  const c = contexto();
  let parar = () => {};
  let fuente;

  if (usarMicroFalso()) {
    const falsa = fuenteFalsa(c);
    fuente = falsa.nodo;
    parar = falsa.parar;
  } else {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ErrorApp('Este navegador no deja usar el micrófono. Abre la app desde la pantalla de inicio o en Safari.');
    }
    sesionDeAudio('play-and-record');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (error) {
      sesionDeAudio('playback');
      if (error?.name === 'NotAllowedError') {
        throw new ErrorApp('Sin permiso para el micrófono. Actívalo en Ajustes → Safari → Micrófono (o en los ajustes de la app).', error);
      }
      throw new ErrorApp('No se ha podido abrir el micrófono.', error);
    }
    fuente = c.createMediaStreamSource(stream);
    parar = () => {
      stream.getTracks().forEach((t) => t.stop());
      sesionDeAudio('playback');
    };
  }

  if (c.state !== 'running') await c.resume().catch(() => {});

  const diezmar = crearDiezmador(c.sampleRate, FRECUENCIA);
  const mudo = c.createGain();
  mudo.gain.value = 0; // el nodo tiene que llegar al destino para que el navegador lo procese
  mudo.connect(c.destination);

  if (c.audioWorklet) {
    if (!contextosConWorklet.has(c)) {
      await c.audioWorklet.addModule('/audio/captura.worklet.js');
      contextosConWorklet.add(c);
    }
    const nodo = new AudioWorkletNode(c, 'captura-cheboluda', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    let alTerminar;
    const terminado = new Promise((r) => (alTerminar = r));
    nodo.port.onmessage = ({ data }) => {
      if (data === 'fin') alTerminar();
      else alPcm(diezmar(data));
    };
    fuente.connect(nodo);
    nodo.connect(mudo);
    return {
      async cerrar() {
        nodo.port.postMessage('fin');
        await Promise.race([terminado, new Promise((r) => setTimeout(r, 250))]);
        fuente.disconnect();
        nodo.disconnect();
        mudo.disconnect();
        parar();
      },
    };
  }

  // Safari antiguo sin AudioWorklet.
  const procesador = c.createScriptProcessor(2048, 1, 1);
  procesador.onaudioprocess = (e) => alPcm(diezmar(e.inputBuffer.getChannelData(0)));
  fuente.connect(procesador);
  procesador.connect(mudo);
  return {
    async cerrar() {
      fuente.disconnect();
      procesador.disconnect();
      mudo.disconnect();
      parar();
    },
  };
}
