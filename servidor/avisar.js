/**
 * Ché boluda — lógica del aviso push al guardar un mensaje.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * La llama api/avisar.js (función de Vercel). Todo lo externo (Supabase y el
 * envío Web Push) entra por `dep`, así se prueba sin red en tests/avisar.test.js.
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { duracion } from '../src/lib/tiempo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANTIGUEDAD_MAXIMA_MS = 5 * 60_000; // no se reavisa de mensajes viejos

/**
 * @returns {Promise<{ estado: number, error?: string, enviados?: number }>}
 */
export async function procesarAviso(dep, { token, cuerpo, ahora = Date.now() }) {
  if (!token) return { estado: 401, error: 'Falta la sesión' };
  const yo = await dep.usuario(token);
  if (!yo) return { estado: 401, error: 'Sesión no válida' };

  const idMensaje = cuerpo?.mensaje;
  if (typeof idMensaje !== 'string' || !UUID.test(idMensaje)) return { estado: 400, error: 'Mensaje no válido' };
  const mensaje = await dep.mensaje(idMensaje);
  if (!mensaje) return { estado: 404, error: 'No existe ese mensaje' };
  if (mensaje.autor_id !== yo) return { estado: 403, error: 'Ese mensaje no es tuyo' };
  if (ahora - Date.parse(mensaje.creado_en) > ANTIGUEDAD_MAXIMA_MS) return { estado: 409, error: 'Mensaje demasiado antiguo' };

  // Quien estaba con la app abierta ya lo ha oído en directo.
  const excluir = new Set((Array.isArray(cuerpo.excluir) ? cuerpo.excluir : []).filter((id) => typeof id === 'string'));
  const [sala, miembros, autor] = await Promise.all([dep.sala(mensaje.sala_id), dep.miembros(mensaje.sala_id), dep.perfil(yo)]);
  const destinatarios = miembros
    .filter((m) => m.perfil_id !== yo && !m.silenciada && !excluir.has(m.perfil_id))
    .map((m) => m.perfil_id);
  if (!destinatarios.length) return { estado: 200, enviados: 0 };

  const [suscripciones, noLeidos] = await Promise.all([dep.suscripciones(destinatarios), dep.noLeidos(destinatarios)]);
  const esGrupo = sala.tipo === 'grupo';
  const aviso = {
    titulo: esGrupo ? `${sala.emoji} ${sala.nombre}` : autor.nombre,
    texto: esGrupo ? `${autor.nombre}: 🎙️ ${duracion(mensaje.duracion_ms)}` : `🎙️ Te ha hablado · ${duracion(mensaje.duracion_ms)}`,
    sala: sala.id,
    url: `/sala/${sala.id}`,
  };

  const resultados = await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await dep.enviar(s, { ...aviso, insignia: noLeidos[s.perfil_id] ?? 1 });
        return true;
      } catch (error) {
        // 404/410: el dispositivo ya no existe o retiró el permiso.
        if (error?.statusCode === 404 || error?.statusCode === 410) await dep.borrarSuscripcion(s.endpoint);
        return false;
      }
    })
  );
  return { estado: 200, enviados: resultados.filter(Boolean).length };
}

/** Dependencias reales: Supabase con la clave de servicio y web-push con VAPID. */
export function crearDependencias({ url, claveServicio, vapid }) {
  const admin = createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } });
  webpush.setVapidDetails(vapid.sujeto, vapid.publica, vapid.privada);

  const unaFila = async (consulta) => {
    const { data, error } = await consulta;
    if (error) throw error;
    return data;
  };

  return {
    async usuario(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    mensaje: (id) => unaFila(admin.from('mensajes').select('id, sala_id, autor_id, duracion_ms, creado_en').eq('id', id).maybeSingle()),
    sala: (id) => unaFila(admin.from('salas').select('id, tipo, nombre, emoji').eq('id', id).single()),
    miembros: (sala) => unaFila(admin.from('miembros').select('perfil_id, silenciada').eq('sala_id', sala)),
    perfil: (id) => unaFila(admin.from('perfiles').select('nombre').eq('id', id).single()),
    suscripciones: (ids) => unaFila(admin.from('suscripciones_push').select('endpoint, perfil_id, p256dh, auth').in('perfil_id', ids)),
    async noLeidos(ids) {
      const filas = await unaFila(admin.rpc('no_leidos_de', { p_perfiles: ids }));
      return Object.fromEntries(filas.map((f) => [f.perfil_id, f.total]));
    },
    async borrarSuscripcion(endpoint) {
      await admin.from('suscripciones_push').delete().eq('endpoint', endpoint);
    },
    enviar: (s, aviso) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), {
        TTL: 60 * 60,
        urgency: 'high',
      }),
  };
}
