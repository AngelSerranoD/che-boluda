/**
 * Ché boluda — errores legibles.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

export class ErrorApp extends Error {
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.causa = causa;
  }
}

const TRADUCCIONES = [
  [/Invalid login credentials/i, 'Usuario o contraseña incorrectos.'],
  [/User already registered/i, 'Ese usuario ya existe.'],
  [/Password should be at least/i, 'La contraseña necesita al menos 6 caracteres.'],
  [/Email not confirmed/i, 'Falta desactivar «Confirm email» en Supabase (Authentication → Sign In / Providers → Email).'],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un minuto.'],
  [/Failed to fetch|NetworkError|Load failed|network/i, 'Sin conexión. Comprueba el internet y vuelve a probar.'],
  [/row-level security|permission denied/i, 'No tienes permiso para hacer eso.'],
  [/Invitación no válida/, 'Esa invitación no existe o ya no vale.'],
  [/Es tu propia invitación/, 'Esa invitación es la tuya 😅'],
  [/Solo puedes (añadir a|hablar con) tus amigos/, 'Solo puedes hacerlo con tus amigos.'],
  [/No estás en esa sala/, 'Ya no estás en esa sala.'],
  [/perfiles_usuario_check/, 'Ese usuario no es válido.'],
  [/duplicate key.*perfiles_usuario_key|Database error saving new user/i, 'Ese usuario ya existe.'],
];

/** Convierte cualquier error (Supabase, red, propio) en un ErrorApp con texto para la persona. */
export function traducirError(error) {
  if (error instanceof ErrorApp) return error;
  const texto = String(error?.message ?? error ?? '');
  for (const [patron, mensaje] of TRADUCCIONES) {
    if (patron.test(texto)) return new ErrorApp(mensaje, error);
  }
  return new ErrorApp('Algo ha fallado. Vuelve a probar en un momento.', error);
}

/** Lanza traducido si la respuesta de Supabase trae error; si no, devuelve data. */
export function comprobar({ data, error }) {
  if (error) throw traducirError(error);
  return data;
}
