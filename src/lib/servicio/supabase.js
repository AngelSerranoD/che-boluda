/**
 * Ché boluda — servicio sobre Supabase (Auth, Postgres, Storage y Realtime).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Misma interfaz que servicio/local.js. Las reglas de acceso viven en la base
 * de datos (supabase/migrations): aquí no se confía en nada del cliente.
 */
import { createClient } from '@supabase/supabase-js';
import { emailDeUsuario } from '../validar.js';
import { comprobar, ErrorApp, traducirError } from './errores.js';

const CAMPOS_PERFIL = 'id, usuario, nombre, avatar, foto';
const CAMPOS_MENSAJE = 'id, sala_id, autor_id, audio, duracion_ms, onda, creado_en';

export function crearServicioSupabase({ url, clave }) {
  const sb = createClient(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cheboluda:sesion' },
    realtime: { params: { eventsPerSecond: 30 } },
  });

  let yo = null;
  const audios = new Map(); // caché pequeña de descargas

  sb.auth.onAuthStateChange((_evento, sesion) => {
    yo = sesion?.user?.id ?? null;
  });

  const necesitoSesion = () => {
    if (!yo) throw new ErrorApp('Hay que iniciar sesión.');
    return yo;
  };

  const rpc = async (nombre, args) => comprobar(await sb.rpc(nombre, args));

  return {
    modo: 'supabase',

    // ───────── Sesión ─────────
    async sesion() {
      const { data } = await sb.auth.getSession();
      yo = data.session?.user?.id ?? null;
      return yo;
    },

    alCambiarSesion(cb) {
      const { data } = sb.auth.onAuthStateChange((_evento, sesion) => cb(sesion?.user?.id ?? null));
      return () => data.subscription.unsubscribe();
    },

    async usuarioDisponible(usuario) {
      return rpc('usuario_disponible', { p_usuario: usuario });
    },

    async registrarse({ usuario, contrasena, nombre, avatar }) {
      if (!(await this.usuarioDisponible(usuario))) throw new ErrorApp('Ese usuario ya existe.');
      const data = comprobar(
        await sb.auth.signUp({
          email: emailDeUsuario(usuario),
          password: contrasena,
          options: { data: { usuario, nombre: nombre.trim(), avatar } },
        })
      );
      if (!data.session) {
        throw new ErrorApp('Falta desactivar «Confirm email» en Supabase (Authentication → Sign In / Providers → Email).');
      }
      yo = data.session.user.id;
      return yo;
    },

    async entrar({ usuario, contrasena }) {
      const data = comprobar(await sb.auth.signInWithPassword({ email: emailDeUsuario(usuario), password: contrasena }));
      yo = data.session.user.id;
      return yo;
    },

    async salir() {
      await sb.auth.signOut();
      yo = null;
      audios.clear();
    },

    // ───────── Perfil ─────────
    async miPerfil() {
      const id = necesitoSesion();
      const [perfil, codigo] = await Promise.all([
        sb.from('perfiles').select(CAMPOS_PERFIL).eq('id', id).single().then(comprobar),
        sb.from('codigos').select('codigo').eq('perfil_id', id).single().then(comprobar),
      ]);
      return { ...perfil, codigo: codigo.codigo };
    },

    async actualizarPerfil(cambios) {
      const id = necesitoSesion();
      const permitido = {};
      for (const campo of ['nombre', 'avatar', 'foto']) if (campo in cambios) permitido[campo] = cambios[campo];
      comprobar(await sb.from('perfiles').update(permitido).eq('id', id));
    },

    /** Sube la foto (JPEG ya recortado) y devuelve su URL pública. Borra las anteriores. */
    async subirFoto(blob) {
      const id = necesitoSesion();
      const cubo = sb.storage.from('avatares');
      const ruta = `${id}/${Date.now()}.jpg`;
      comprobar(await cubo.upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      const { data: viejas } = await cubo.list(id);
      const sobran = (viejas ?? []).map((f) => `${id}/${f.name}`).filter((r) => r !== ruta);
      if (sobran.length) cubo.remove(sobran).catch(() => {});
      return cubo.getPublicUrl(ruta).data.publicUrl;
    },

    async regenerarCodigo() {
      return rpc('regenerar_codigo');
    },

    // ───────── Amigos ─────────
    async verInvitacion(codigo) {
      const filas = await rpc('ver_invitacion', { p_codigo: codigo });
      return filas?.[0] ?? null;
    },

    async aceptarInvitacion(codigo) {
      const filas = await rpc('aceptar_invitacion', { p_codigo: codigo });
      return filas[0];
    },

    async amigos() {
      const id = necesitoSesion();
      const pares = comprobar(await sb.from('amistades').select('a, b, creado_en'));
      if (!pares.length) return [];
      const ids = pares.map((p) => (p.a === id ? p.b : p.a));
      const perfiles = comprobar(await sb.from('perfiles').select(CAMPOS_PERFIL).in('id', ids));
      return perfiles.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    },

    async eliminarAmigo(otro) {
      const id = necesitoSesion();
      const [a, b] = id < otro ? [id, otro] : [otro, id];
      comprobar(await sb.from('amistades').delete().eq('a', a).eq('b', b));
    },

    // ───────── Salas ─────────
    async salas() {
      return rpc('listar_salas');
    },

    async crearSala({ nombre, emoji, miembros }) {
      return rpc('crear_sala', { p_nombre: nombre, p_emoji: emoji, p_miembros: miembros });
    },

    async abrirDirecto(amigo) {
      return rpc('abrir_directo', { p_amigo: amigo });
    },

    async anadirMiembros(sala, miembros) {
      await rpc('anadir_miembros', { p_sala: sala, p_miembros: miembros });
    },

    async editarSala(sala, { nombre, emoji }) {
      comprobar(await sb.from('salas').update({ nombre, emoji }).eq('id', sala));
    },

    async silenciarSala(sala, silenciada) {
      comprobar(await sb.from('miembros').update({ silenciada }).eq('sala_id', sala).eq('perfil_id', necesitoSesion()));
    },

    async salirDeSala(sala) {
      comprobar(await sb.from('miembros').delete().eq('sala_id', sala).eq('perfil_id', necesitoSesion()));
    },

    async marcarLeido(sala) {
      await rpc('marcar_leido', { p_sala: sala });
    },

    // ───────── Mensajes ─────────
    async mensajes(sala, { antesDe, limite = 60 } = {}) {
      let consulta = sb.from('mensajes').select(CAMPOS_MENSAJE).eq('sala_id', sala)
        .order('creado_en', { ascending: false }).limit(limite);
      if (antesDe) consulta = consulta.lt('creado_en', antesDe);
      return comprobar(await consulta).reverse();
    },

    async enviarMensaje({ id, sala, bytes, duracionMs, onda }) {
      const autor = necesitoSesion();
      const ruta = `${sala}/${id}.cba`;
      const subida = await sb.storage.from('audios')
        .upload(ruta, new Blob([bytes], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' });
      // Si ya estaba subido (reintento tras un corte), se sigue con el registro.
      if (subida.error && !/exists|Duplicate/i.test(subida.error.message)) throw traducirError(subida.error);
      audios.set(ruta, bytes);
      const fila = await sb.from('mensajes')
        .upsert({ id, sala_id: sala, autor_id: autor, audio: ruta, duracion_ms: duracionMs, onda }, { onConflict: 'id', ignoreDuplicates: true })
        .select(CAMPOS_MENSAJE);
      return comprobar(fila)?.[0] ?? null;
    },

    async descargarAudio(ruta) {
      if (audios.has(ruta)) return audios.get(ruta);
      const blob = comprobar(await sb.storage.from('audios').download(ruta));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      audios.set(ruta, bytes);
      if (audios.size > 40) audios.delete(audios.keys().next().value);
      return bytes;
    },

    async borrarMensaje(mensaje) {
      comprobar(await sb.from('mensajes').delete().eq('id', mensaje.id));
      await sb.storage.from('audios').remove([mensaje.audio]);
    },

    // ───────── Tiempo real ─────────
    /** Llama a `cb({ tabla, evento, fila })` con cada cambio que afecte a la persona. */
    alCambiar(cb) {
      const canal = sb.channel(`cambios:${yo}`);
      for (const tabla of ['mensajes', 'miembros', 'amistades']) {
        canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (c) =>
          cb({ tabla, evento: c.eventType, fila: c.new && Object.keys(c.new).length ? c.new : c.old })
        );
      }
      canal.subscribe();
      return () => sb.removeChannel(canal);
    },

    /**
     * Canal de voz de una sala: `alVoz(payload)` con lo que emiten otros y
     * `alPresencia(ids)` con quién tiene la app abierta (incluida una misma).
     */
    canalDeVoz(sala, { alVoz, alPresencia, alEstado }) {
      const id = necesitoSesion();
      const canal = sb.channel(`sala:${sala}`, {
        config: { private: true, broadcast: { self: false, ack: false }, presence: { key: id } },
      });
      canal
        .on('broadcast', { event: 'voz' }, ({ payload }) => alVoz(payload))
        .on('presence', { event: 'sync' }, () => alPresencia(Object.keys(canal.presenceState())));

      let conectado = false;
      // Los canales privados necesitan el token de la sesión antes de suscribirse.
      Promise.resolve(sb.realtime.setAuth()).catch(() => {}).finally(() => {
        canal.subscribe((estado) => {
          conectado = estado === 'SUBSCRIBED';
          alEstado?.(estado);
          if (conectado) canal.track({ desde: Date.now() }).catch(() => {});
        });
      });

      return {
        emitir(payload) {
          if (!conectado) return;
          canal.send({ type: 'broadcast', event: 'voz', payload }).catch(() => {});
        },
        cerrar() {
          sb.removeChannel(canal);
        },
      };
    },

    // ───────── Avisos push ─────────
    async guardarSuscripcion(suscripcion) {
      const { endpoint, keys } = suscripcion.toJSON();
      await rpc('guardar_suscripcion', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
    },

    async borrarSuscripcion(endpoint) {
      await sb.from('suscripciones_push').delete().eq('endpoint', endpoint);
    },

    /** Pide al servidor que avise por push a quien no estaba escuchando. No bloquea. */
    async avisar({ mensaje, excluir }) {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      fetch('/api/avisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensaje, excluir }),
        keepalive: true,
      }).catch(() => {});
    },
  };
}
