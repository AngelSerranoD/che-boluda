/**
 * Ché boluda — la radio: voz en directo entre las personas de cada sala.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Mientras la app está abierta se sintonizan TODAS las salas de la persona:
 * si alguien habla en cualquiera, suena al momento (salvo que esté silenciada).
 *
 * Protocolo por el canal 'sala:<id>' (Realtime Broadcast, evento 'voz'):
 *   { t: 'ini', id, de }          empieza una transmisión
 *   { t: 'voz', id, de, n, b }    bloque ADPCM de 300 ms en base64
 *   { t: 'fin', id, de }          se suelta el botón
 * Los bloques solo se mandan si hay alguien más con la app abierta en la sala
 * (presencia): así no se gasta cupo de mensajes hablando al vacío. Al soltar,
 * la transmisión entera se guarda como mensaje con el MISMO id, y quien no
 * estaba la recibe por push y la oye después.
 */
import { contexto, desbloquear, sonido } from './audio/motor.js';
import { abrirMicrofono } from './audio/microfono.js';
import { crearCodificador, duracionMs, FRECUENCIA, leerBloque, unirArchivo } from './audio/contenedor.js';
import { aBase64, aFlotante, deBase64, formaDeOnda, nivel } from './audio/senal.js';
import { marcarEscuchado } from './escuchados.js';
import { traducirError } from './servicio/errores.js';

export const DURACION_MINIMA_MS = 400;
export const DURACION_MAXIMA_MS = 60_000;
const COLCHON_S = 0.28; // margen para que la red no corte la voz a trompicones
const SILENCIO_MAXIMO_MS = 2500; // sin bloques ni 'fin': se da por terminada

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function juntar(trozos) {
  const total = trozos.reduce((s, t) => s + t.length, 0);
  const salida = new Int16Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.length;
  }
  return salida;
}

/**
 * `servicio.abrirMicrofono`, si existe, sustituye al micro real: lo usa la demo
 * del portfolio para no pedir permiso de micrófono a quien la visita.
 */
export function crearRadio({ servicio, yo }) {
  const abrirMicro = servicio.abrirMicrofono ?? abrirMicrofono;
  const canales = new Map(); // sala → { conexion, presentes, silenciada }
  const entrantes = new Map(); // id → transmisión que se está oyendo
  const pendientes = new Map(); // id → envío que falló
  const oyentes = new Set();
  const oyentesEventos = new Set();
  let emision = null;
  let instantanea = construir();
  let marcoNivel = 0;

  function construir() {
    const hablando = {};
    for (const e of entrantes.values()) {
      if (!e.silenciada) hablando[e.sala] = { id: e.id, de: e.de, nivel: e.nivel, sinSonido: e.sinSonido };
    }
    const presentes = {};
    for (const [sala, c] of canales) presentes[sala] = c.presentes;
    return {
      hablando,
      presentes,
      emision: emision && { sala: emision.sala, estado: emision.estado, nivel: emision.nivel, inicio: emision.inicio },
      pendientes: [...pendientes.values()].map(({ id, sala, duracionMs: ms, error }) => ({ id, sala, duracionMs: ms, error })),
    };
  }

  function notificar() {
    instantanea = construir();
    oyentes.forEach((cb) => cb());
  }

  /** Para el vúmetro: como mucho unas 20 actualizaciones por segundo. */
  function notificarNivel() {
    const ahora = performance.now();
    if (ahora - marcoNivel < 50) return;
    marcoNivel = ahora;
    notificar();
  }

  const lanzarEvento = (evento) => oyentesEventos.forEach((cb) => cb(evento));

  // ───────── Recepción ─────────

  function alVoz(sala, p) {
    const canal = canales.get(sala);
    if (!canal || !p || p.de === yo || typeof p.id !== 'string') return;
    let e = entrantes.get(p.id);
    if (!e) {
      if (p.t === 'fin') return;
      e = { id: p.id, sala, de: p.de, siguiente: 0, nivel: 0, silenciada: canal.silenciada, sinSonido: false, vigilante: null, cerrando: false };
      entrantes.set(p.id, e);
      if (!e.silenciada) {
        lanzarEvento({ tipo: 'entrante', sala, de: p.de });
        sonido('recibir');
      }
    }
    if (e.cerrando) return;
    clearTimeout(e.vigilante);
    e.vigilante = setTimeout(() => terminarEntrante(e), SILENCIO_MAXIMO_MS);

    if (p.t === 'voz' && typeof p.b === 'string' && !e.silenciada) {
      reproducirBloque(e, p.b);
      notificarNivel();
    } else if (p.t === 'fin') {
      terminarEntrante(e);
    } else {
      notificar();
    }
  }

  function reproducirBloque(e, b64) {
    let muestras;
    try {
      muestras = leerBloque(deBase64(b64)).muestras;
    } catch {
      return; // bloque dañado: se salta, el mensaje guardado seguirá entero
    }
    e.nivel = nivel(muestras);
    const c = contexto();
    if (c.state !== 'running') {
      e.sinSonido = true;
      return;
    }
    const datos = aFlotante(muestras, FRECUENCIA, c.sampleRate);
    const buffer = c.createBuffer(1, datos.length, c.sampleRate);
    buffer.getChannelData(0).set(datos);
    const fuente = c.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(c.destination);
    if (e.siguiente < c.currentTime + 0.03) e.siguiente = c.currentTime + COLCHON_S;
    fuente.start(e.siguiente);
    e.siguiente += buffer.duration;
  }

  function terminarEntrante(e) {
    if (e.cerrando) return;
    e.cerrando = true;
    clearTimeout(e.vigilante);
    const c = contexto();
    const queda = c.state === 'running' ? Math.max(0, (e.siguiente - c.currentTime) * 1000) : 0;
    setTimeout(() => {
      if (entrantes.get(e.id) !== e) return;
      entrantes.delete(e.id);
      if (!e.silenciada && !e.sinSonido && e.siguiente > 0) {
        marcarEscuchado(e.id);
        sonido('cambio');
      }
      notificar();
    }, queda);
    notificar();
  }

  // ───────── Sintonía ─────────

  function sintonizar(salas) {
    const quiero = new Map(salas.map((s) => [s.id, s]));
    for (const [id, c] of canales) {
      if (!quiero.has(id)) {
        c.conexion.cerrar();
        canales.delete(id);
      }
    }
    for (const s of salas) {
      const existente = canales.get(s.id);
      if (existente) {
        existente.silenciada = Boolean(s.silenciada);
        continue;
      }
      const canal = { presentes: [], silenciada: Boolean(s.silenciada), conexion: null };
      canales.set(s.id, canal);
      canal.conexion = servicio.canalDeVoz(s.id, {
        alVoz: (p) => alVoz(s.id, p),
        alPresencia: (ids) => {
          canal.presentes = ids;
          notificar();
        },
      });
    }
    notificar();
  }

  function desintonizar() {
    for (const c of canales.values()) c.conexion.cerrar();
    canales.clear();
    for (const e of entrantes.values()) clearTimeout(e.vigilante);
    entrantes.clear();
    notificar();
  }

  const hayOyentes = (sala) => (canales.get(sala)?.presentes ?? []).some((id) => id !== yo);

  // ───────── Emisión ─────────

  function emitir(e, datos) {
    canales.get(e.sala)?.conexion.emitir({ ...datos, id: e.id, de: yo });
  }

  function capturar(e, pcm) {
    if (e.estado !== 'hablando' || !pcm.length) return;
    e.pcm.push(pcm);
    e.nivel = nivel(pcm);
    for (const bloque of e.codificador.añadir(pcm)) {
      e.bloques.push(bloque);
      if (hayOyentes(e.sala)) emitir(e, { t: 'voz', n: e.n++, b: aBase64(bloque) });
    }
    notificarNivel();
  }

  /**
   * Empieza a hablar en `sala`. Se resuelve cuando el micro ya está abierto y
   * ha sonado el pitido. Si se suelta antes, se cancela sola.
   */
  async function hablar(sala) {
    if (emision || !canales.has(sala)) return;
    const e = {
      id: crypto.randomUUID(), sala, estado: 'abriendo', nivel: 0, inicio: 0,
      codificador: crearCodificador(), bloques: [], pcm: [], n: 0, soltado: false, micro: null, limite: null,
    };
    emision = e;
    lanzarEvento({ tipo: 'emision', sala });
    notificar();

    const abandonar = async () => {
      await e.micro?.cerrar();
      if (emision === e) emision = null;
      notificar();
    };

    try {
      await desbloquear();
      e.micro = await abrirMicro({ alPcm: (pcm) => capturar(e, pcm) });
    } catch (error) {
      await abandonar();
      sonido('error');
      throw traducirError(error);
    }
    if (e.soltado) return abandonar();
    // Pitido de canal abierto; se espera a que acabe para no grabarlo.
    await esperar(sonido('abrir') + 30);
    if (e.soltado) return abandonar();

    e.estado = 'hablando';
    e.inicio = Date.now();
    emitir(e, { t: 'ini' });
    e.limite = setTimeout(() => soltar(), DURACION_MAXIMA_MS);
    notificar();
  }

  /** Suelta el botón. Devuelve { corto } si no dio tiempo a decir nada. */
  async function soltar() {
    const e = emision;
    if (!e) return { corto: true };
    if (e.estado === 'abriendo') {
      e.soltado = true;
      return { corto: true };
    }
    if (e.estado !== 'hablando') return {};
    clearTimeout(e.limite);
    await e.micro.cerrar(); // recoge lo último que quedaba en el hilo de audio
    e.estado = 'enviando';
    const ultimo = e.codificador.terminar();
    if (ultimo) {
      e.bloques.push(ultimo);
      if (hayOyentes(e.sala)) emitir(e, { t: 'voz', n: e.n++, b: aBase64(ultimo) });
    }
    emitir(e, { t: 'fin' });
    emision = null;
    notificar();

    const ms = duracionMs(e.codificador.muestras);
    if (ms < DURACION_MINIMA_MS) return { corto: true };
    sonido('cambio');
    marcarEscuchado(e.id);
    await enviar({ id: e.id, sala: e.sala, bytes: unirArchivo(e.bloques), duracionMs: ms, onda: formaDeOnda(juntar(e.pcm)) });
    return { id: e.id };
  }

  async function enviar(envio) {
    pendientes.set(envio.id, { ...envio, error: null });
    notificar();
    try {
      await servicio.enviarMensaje(envio);
      pendientes.delete(envio.id);
      const excluir = (canales.get(envio.sala)?.presentes ?? []).filter((id) => id !== yo);
      servicio.avisar({ mensaje: envio.id, excluir });
      lanzarEvento({ tipo: 'enviado', sala: envio.sala, id: envio.id });
    } catch (error) {
      pendientes.set(envio.id, { ...envio, error: traducirError(error).message });
    }
    notificar();
  }

  return {
    sintonizar,
    desintonizar,
    hablar,
    soltar,
    reintentar: (id) => pendientes.has(id) && enviar(pendientes.get(id)),
    descartar(id) {
      pendientes.delete(id);
      notificar();
    },
    estado: () => instantanea,
    suscribir(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    alEvento(cb) {
      oyentesEventos.add(cb);
      return () => oyentesEventos.delete(cb);
    },
  };
}
