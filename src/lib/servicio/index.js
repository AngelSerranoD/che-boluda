/**
 * Ché boluda — elige el servicio según la configuración.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY → Supabase.
 * Sin ellas → modo de prueba local (la interfaz lo señala siempre).
 */
import { crearServicioLocal } from './local.js';
import { crearServicioSupabase } from './supabase.js';

export function crearServicio() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && clave) return crearServicioSupabase({ url, clave });
  return crearServicioLocal();
}
