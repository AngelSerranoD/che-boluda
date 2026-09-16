/**
 * Ché boluda — reproductor de mensajes guardados.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Reproduce una cola de mensajes uno detrás de otro ("Escuchar nuevos") o uno
 * suelto al tocar su burbuja. Se para solo si alguien empieza a hablar en
 * directo o si la propia persona pulsa para hablar.
 */
import { contexto, desbloquear } from './audio/motor.js';
import { leerArchivo } from './audio/contenedor.js';
import { aFlotante } from './audio/senal.js';
import { marcarEscuchado } from './escuchados.js';
import { traducirError } from './servicio/errores.js';

export function crearReproductor({ servicio }) {
  let cola = [];
  let actual = null; // { mensaje, cargando, fuente, inicio, duracion, error }
  const oyentes = new Set();
  let instantanea = null;

  function notificar() {
    instantanea = actual && { id: actual.mensaje.id, cargando: Boolean(actual.cargando), inicio: actual.inicio, duracion: actual.duracion, error: actual.error };
    oyentes.forEach((cb) => cb());
  }

  async function siguiente() {
    const mensaje = cola.shift();
    if (!mensaje) {
      actual = null;
      notificar();
      return;
    }
    const turno = { mensaje, cargando: true };
    actual = turno;
    notificar();
    try {
      await desbloquear();
      const { muestras, frecuencia } = leerArchivo(await servicio.descargarAudio(mensaje.audio));
      if (actual !== turno) return;
      const c = contexto();
      const datos = aFlotante(muestras, frecuencia, c.sampleRate);
      const buffer = c.createBuffer(1, datos.length, c.sampleRate);
      buffer.getChannelData(0).set(datos);
      const fuente = c.createBufferSource();
      fuente.buffer = buffer;
      fuente.connect(c.destination);
      fuente.onended = () => {
        if (actual !== turno) return;
        marcarEscuchado(mensaje.id);
        siguiente();
      };
      turno.inicio = c.currentTime + 0.05;
      turno.duracion = buffer.duration;
      turno.fuente = fuente;
      turno.cargando = false;
      fuente.start(turno.inicio);
      notificar();
    } catch (error) {
      if (actual !== turno) return;
      turno.cargando = false;
      turno.error = traducirError(error).message;
      notificar();
      setTimeout(() => actual === turno && siguiente(), 1500);
    }
  }

  function parar() {
    cola = [];
    const turno = actual;
    actual = null;
    if (turno?.fuente) {
      turno.fuente.onended = null;
      try {
        turno.fuente.stop();
      } catch {
        /* ya había terminado */
      }
    }
    notificar();
  }

  return {
    reproducir(mensajes) {
      parar();
      cola = [...mensajes];
      siguiente();
    },
    parar,
    /** 0..1 del mensaje que suena, calculado al vuelo con el reloj del audio. */
    progreso() {
      if (!actual?.duracion) return 0;
      return Math.min(1, Math.max(0, (contexto().currentTime - actual.inicio) / actual.duracion));
    },
    estado: () => instantanea,
    suscribir(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
  };
}
