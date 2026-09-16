/**
 * Ché boluda — servicio local para desarrollar y probar sin Supabase.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Imita a servicio/supabase.js con localStorage y BroadcastChannel: cada
 * pestaña del navegador es una persona (la sesión va en sessionStorage), así
 * que con dos pestañas se prueban invitaciones, salas y la voz en directo.
 * Aplica las mismas reglas que la base de datos para que no haya sorpresas.
 * Nunca se usa en producción: main.jsx solo lo elige si faltan las claves.
 */
import { ALFABETO } from '../invitacion.js';
import { aBase64, deBase64 } from '../audio/senal.js';
import { ErrorApp } from './errores.js';

const CLAVE = 'cheboluda:local:v1';
const CLAVE_SESION = 'cheboluda:local:yo';
const CADUCA_PRESENCIA = 6000;
const MAX_AUDIOS = 40; // localStorage no da para más

const vacia = () => ({ perfiles: {}, contrasenas: {}, codigos: {}, amistades: [], salas: {}, miembros: [], mensajes: [], audios: {} });

function nuevoCodigo() {
  const azar = crypto.getRandomValues(new Uint8Array(8));
  return [...azar].map((b) => ALFABETO[b % ALFABETO.length]).join('');
}

export function crearServicioLocal({ almacen = globalThis.localStorage, sesionTab = globalThis.sessionStorage } = {}) {
  const leer = () => {
    try {
      return { ...vacia(), ...JSON.parse(almacen.getItem(CLAVE)) };
    } catch {
      return vacia();
    }
  };

  let yo = sesionTab?.getItem(CLAVE_SESION) ?? null;
  const oyentesSesion = new Set();
  const oyentesCambio = new Set();
  const canales = new Map(); // sala -> Set de { alVoz, alPresencia }
  const presencia = new Map(); // sala -> Map(persona -> marca)

  const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cheboluda-local') : null;
  const enviarBus = (msg) => bus?.postMessage(msg);

  function guardar(db, cambio) {
    // Recorta audios viejos para no pasarse del cupo de localStorage.
    const rutas = db.mensajes.map((m) => m.audio).filter((r) => db.audios[r]);
    for (const ruta of rutas.slice(0, Math.max(0, rutas.length - MAX_AUDIOS))) delete db.audios[ruta];
    almacen.setItem(CLAVE, JSON.stringify(db));
    if (cambio) {
      enviarBus({ tipo: 'cambio', cambio });
      avisarCambio(cambio);
    }
  }

  const avisarCambio = (cambio) => setTimeout(() => oyentesCambio.forEach((cb) => cb(cambio)), 0);
  const cambiarSesion = (id) => {
    yo = id;
    if (id) sesionTab?.setItem(CLAVE_SESION, id);
    else sesionTab?.removeItem(CLAVE_SESION);
    oyentesSesion.forEach((cb) => cb(id));
  };

  const necesitoSesion = () => {
    if (!yo) throw new ErrorApp('Hay que iniciar sesión.');
    return yo;
  };
  const sonAmigos = (db, x, y) => db.amistades.some(([a, b]) => (a === x && b === y) || (a === y && b === x));
  const esMiembro = (db, sala, quien = yo) => db.miembros.some((m) => m.sala_id === sala && m.perfil_id === quien);
  const publico = ({ id, usuario, nombre, avatar, foto }) => ({ id, usuario, nombre, avatar, foto: foto ?? null });

  // ───────── Presencia entre pestañas ─────────
  function marcarPresente(sala, quien, marca = Date.now()) {
    if (!presencia.has(sala)) presencia.set(sala, new Map());
    presencia.get(sala).set(quien, marca);
    emitirPresencia(sala);
  }
  function emitirPresencia(sala) {
    const ahora = Date.now();
    const mapa = presencia.get(sala) ?? new Map();
    for (const [quien, marca] of mapa) if (ahora - marca > CADUCA_PRESENCIA) mapa.delete(quien);
    const ids = [...mapa.keys()];
    canales.get(sala)?.forEach((c) => c.alPresencia(ids));
  }
  const latido = setInterval(() => {
    if (!yo) return;
    for (const sala of canales.keys()) {
      marcarPresente(sala, yo);
      enviarBus({ tipo: 'presente', sala, quien: yo });
    }
  }, 2000);

  if (bus) {
    bus.onmessage = ({ data }) => {
      if (data.tipo === 'cambio') avisarCambio(data.cambio);
      if (data.tipo === 'presente' && canales.has(data.sala)) marcarPresente(data.sala, data.quien);
      if (data.tipo === 'ausente' && presencia.get(data.sala)?.delete(data.quien)) emitirPresencia(data.sala);
      if (data.tipo === 'voz' && data.de !== yo && canales.has(data.sala) && esMiembro(leer(), data.sala)) {
        canales.get(data.sala).forEach((c) => c.alVoz(data.payload));
      }
    };
  }

  return {
    modo: 'local',

    async sesion() {
      return yo && leer().perfiles[yo] ? yo : null;
    },

    alCambiarSesion(cb) {
      oyentesSesion.add(cb);
      return () => oyentesSesion.delete(cb);
    },

    async usuarioDisponible(usuario) {
      return !Object.values(leer().perfiles).some((p) => p.usuario === usuario);
    },

    async registrarse({ usuario, contrasena, nombre, avatar }) {
      const db = leer();
      if (Object.values(db.perfiles).some((p) => p.usuario === usuario)) throw new ErrorApp('Ese usuario ya existe.');
      const id = crypto.randomUUID();
      db.perfiles[id] = { id, usuario, nombre: nombre.trim(), avatar, foto: null };
      db.contrasenas[id] = contrasena;
      db.codigos[id] = nuevoCodigo();
      guardar(db, { tabla: 'perfiles' });
      cambiarSesion(id);
      return id;
    },

    async entrar({ usuario, contrasena }) {
      const db = leer();
      const perfil = Object.values(db.perfiles).find((p) => p.usuario === usuario);
      if (!perfil || db.contrasenas[perfil.id] !== contrasena) throw new ErrorApp('Usuario o contraseña incorrectos.');
      cambiarSesion(perfil.id);
      return perfil.id;
    },

    async salir() {
      for (const sala of canales.keys()) enviarBus({ tipo: 'ausente', sala, quien: yo });
      cambiarSesion(null);
    },

    async miPerfil() {
      const db = leer();
      const id = necesitoSesion();
      return { ...publico(db.perfiles[id]), codigo: db.codigos[id] };
    },

    async actualizarPerfil(cambios) {
      const db = leer();
      const id = necesitoSesion();
      for (const campo of ['nombre', 'avatar', 'foto']) if (campo in cambios) db.perfiles[id][campo] = cambios[campo];
      guardar(db, { tabla: 'perfiles' });
    },

    async subirFoto(blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return `data:image/jpeg;base64,${aBase64(bytes)}`;
    },

    async regenerarCodigo() {
      const db = leer();
      db.codigos[necesitoSesion()] = nuevoCodigo();
      guardar(db);
      return db.codigos[yo];
    },

    async verInvitacion(codigo) {
      const db = leer();
      const id = Object.keys(db.codigos).find((k) => db.codigos[k] === codigo);
      return id ? publico(db.perfiles[id]) : null;
    },

    async aceptarInvitacion(codigo) {
      const db = leer();
      const id = necesitoSesion();
      const otro = Object.keys(db.codigos).find((k) => db.codigos[k] === codigo);
      if (!otro) throw new ErrorApp('Esa invitación no existe o ya no vale.');
      if (otro === id) throw new ErrorApp('Esa invitación es la tuya 😅');
      if (!sonAmigos(db, id, otro)) db.amistades.push([id, otro]);
      guardar(db, { tabla: 'amistades' });
      return publico(db.perfiles[otro]);
    },

    async amigos() {
      const db = leer();
      const id = necesitoSesion();
      return db.amistades
        .filter(([a, b]) => a === id || b === id)
        .map(([a, b]) => publico(db.perfiles[a === id ? b : a]))
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    },

    async eliminarAmigo(otro) {
      const db = leer();
      const id = necesitoSesion();
      db.amistades = db.amistades.filter(([a, b]) => !((a === id && b === otro) || (a === otro && b === id)));
      guardar(db, { tabla: 'amistades' });
    },

    async salas() {
      const db = leer();
      const id = necesitoSesion();
      return db.miembros
        .filter((m) => m.perfil_id === id)
        .map((yoMiembro) => {
          const s = db.salas[yoMiembro.sala_id];
          const mensajes = db.mensajes.filter((m) => m.sala_id === s.id);
          const ultimo = mensajes.at(-1);
          return {
            ...s,
            silenciada: yoMiembro.silenciada,
            ultimo_leido: yoMiembro.ultimo_leido,
            no_leidos: Math.min(99, mensajes.filter((m) => m.creado_en > yoMiembro.ultimo_leido && m.autor_id !== id).length),
            ultimo: ultimo ? { autor_id: ultimo.autor_id, duracion_ms: ultimo.duracion_ms, creado_en: ultimo.creado_en } : null,
            miembros: db.miembros.filter((m) => m.sala_id === s.id).map((m) => ({ ...publico(db.perfiles[m.perfil_id]), rol: m.rol })),
          };
        })
        .sort((a, b) => (a.ultima_actividad < b.ultima_actividad ? 1 : -1));
    },

    async crearSala({ nombre, emoji, miembros }) {
      const db = leer();
      const id = necesitoSesion();
      if (miembros.some((m) => m !== id && !sonAmigos(db, id, m))) throw new ErrorApp('Solo puedes hacerlo con tus amigos.');
      const ahora = new Date().toISOString();
      const sala = { id: crypto.randomUUID(), tipo: 'grupo', nombre: nombre.trim(), emoji: emoji || '📻', creado_por: id, creado_en: ahora, ultima_actividad: ahora };
      db.salas[sala.id] = sala;
      const fila = (perfil, rol) => ({ sala_id: sala.id, perfil_id: perfil, rol, silenciada: false, ultimo_leido: ahora, unido_en: ahora });
      db.miembros.push(fila(id, 'admin'), ...[...new Set(miembros)].filter((m) => m !== id).map((m) => fila(m, 'miembro')));
      guardar(db, { tabla: 'miembros' });
      return sala.id;
    },

    async abrirDirecto(amigo) {
      const db = leer();
      const id = necesitoSesion();
      if (!sonAmigos(db, id, amigo)) throw new ErrorApp('Solo puedes hacerlo con tus amigos.');
      const clave = [id, amigo].sort().join(':');
      let sala = Object.values(db.salas).find((s) => s.clave_directo === clave);
      const ahora = new Date().toISOString();
      if (!sala) {
        sala = { id: crypto.randomUUID(), tipo: 'directo', nombre: null, emoji: '📻', clave_directo: clave, creado_por: id, creado_en: ahora, ultima_actividad: ahora };
        db.salas[sala.id] = sala;
      }
      for (const p of [id, amigo]) {
        if (!esMiembro(db, sala.id, p)) db.miembros.push({ sala_id: sala.id, perfil_id: p, rol: 'miembro', silenciada: false, ultimo_leido: ahora, unido_en: ahora });
      }
      guardar(db, { tabla: 'miembros' });
      return sala.id;
    },

    async anadirMiembros(salaId, miembros) {
      const db = leer();
      const id = necesitoSesion();
      if (!esMiembro(db, salaId) || db.salas[salaId]?.tipo !== 'grupo') throw new ErrorApp('Ya no estás en esa sala.');
      if (miembros.some((m) => !sonAmigos(db, id, m))) throw new ErrorApp('Solo puedes hacerlo con tus amigos.');
      const ahora = new Date().toISOString();
      for (const m of miembros) {
        if (!esMiembro(db, salaId, m)) db.miembros.push({ sala_id: salaId, perfil_id: m, rol: 'miembro', silenciada: false, ultimo_leido: ahora, unido_en: ahora });
      }
      guardar(db, { tabla: 'miembros' });
    },

    async editarSala(salaId, { nombre, emoji }) {
      const db = leer();
      if (!esMiembro(db, salaId)) throw new ErrorApp('Ya no estás en esa sala.');
      Object.assign(db.salas[salaId], { nombre, emoji });
      guardar(db, { tabla: 'miembros' });
    },

    async silenciarSala(salaId, silenciada) {
      const db = leer();
      const fila = db.miembros.find((m) => m.sala_id === salaId && m.perfil_id === necesitoSesion());
      if (fila) fila.silenciada = silenciada;
      guardar(db, { tabla: 'miembros' });
    },

    async salirDeSala(salaId) {
      const db = leer();
      const id = necesitoSesion();
      db.miembros = db.miembros.filter((m) => !(m.sala_id === salaId && m.perfil_id === id));
      guardar(db, { tabla: 'miembros' });
    },

    async marcarLeido(salaId) {
      const db = leer();
      const fila = db.miembros.find((m) => m.sala_id === salaId && m.perfil_id === necesitoSesion());
      if (fila) fila.ultimo_leido = new Date().toISOString();
      guardar(db);
    },

    async mensajes(salaId, { antesDe, limite = 60 } = {}) {
      const db = leer();
      if (!esMiembro(db, salaId)) return [];
      return db.mensajes
        .filter((m) => m.sala_id === salaId && (!antesDe || m.creado_en < antesDe))
        .slice(-limite)
        .map(({ id, sala_id, autor_id, audio, duracion_ms, onda, creado_en }) => ({ id, sala_id, autor_id, audio, duracion_ms, onda, creado_en }));
    },

    async enviarMensaje({ id, sala, bytes, duracionMs, onda }) {
      const db = leer();
      const autor = necesitoSesion();
      if (!esMiembro(db, sala)) throw new ErrorApp('Ya no estás en esa sala.');
      if (db.mensajes.some((m) => m.id === id)) return null;
      const ruta = `${sala}/${id}.cba`;
      const fila = { id, sala_id: sala, autor_id: autor, audio: ruta, duracion_ms: duracionMs, onda, creado_en: new Date().toISOString() };
      db.audios[ruta] = aBase64(bytes);
      db.mensajes.push(fila);
      db.salas[sala].ultima_actividad = fila.creado_en;
      guardar(db, { tabla: 'mensajes', evento: 'INSERT', fila });
      return fila;
    },

    async descargarAudio(ruta) {
      const b64 = leer().audios[ruta];
      if (!b64) throw new ErrorApp('Este audio ya no está guardado en el modo de prueba.');
      return deBase64(b64);
    },

    async borrarMensaje(mensaje) {
      const db = leer();
      db.mensajes = db.mensajes.filter((m) => !(m.id === mensaje.id && m.autor_id === yo));
      delete db.audios[mensaje.audio];
      guardar(db, { tabla: 'mensajes' });
    },

    alCambiar(cb) {
      oyentesCambio.add(cb);
      return () => oyentesCambio.delete(cb);
    },

    canalDeVoz(sala, { alVoz, alPresencia, alEstado }) {
      const quien = necesitoSesion();
      const oyente = { alVoz, alPresencia };
      if (!canales.has(sala)) canales.set(sala, new Set());
      canales.get(sala).add(oyente);
      marcarPresente(sala, quien);
      enviarBus({ tipo: 'presente', sala, quien });
      setTimeout(() => alEstado?.('SUBSCRIBED'), 0);
      return {
        emitir(payload) {
          enviarBus({ tipo: 'voz', sala, de: quien, payload });
        },
        cerrar() {
          const set = canales.get(sala);
          set?.delete(oyente);
          if (set && !set.size) {
            canales.delete(sala);
            presencia.delete(sala);
            enviarBus({ tipo: 'ausente', sala, quien });
          }
        },
      };
    },

    async guardarSuscripcion() {},
    async borrarSuscripcion() {},
    async avisar() {},

    destruir() {
      clearInterval(latido);
      bus?.close();
    },
  };
}
