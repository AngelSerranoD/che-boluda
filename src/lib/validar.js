/**
 * Ché boluda — validación de los datos de perfil y acceso.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Las mismas reglas están en la base de datos (supabase/migrations): aquí solo
 * sirven para avisar antes de enviar.
 */

/**
 * Supabase Auth necesita un email, pero la app entra con usuario y contraseña
 * para no depender del correo (el SMTP gratuito de Supabase solo manda dos
 * por hora). Se construye un email interno que nunca recibe nada.
 */
export const DOMINIO_INTERNO = 'usuarios.cheboluda.app';

export const emailDeUsuario = (usuario) => `${usuario}@${DOMINIO_INTERNO}`;

/** Quita la arroba, los espacios y pasa a minúsculas. */
export const normalizarUsuario = (texto) => String(texto ?? '').trim().replace(/^@+/, '').toLowerCase();

export function errorUsuario(usuario) {
  if (usuario.length < 3) return 'Mínimo 3 caracteres.';
  if (usuario.length > 20) return 'Máximo 20 caracteres.';
  if (!/^[a-z0-9_.]+$/.test(usuario)) return 'Solo letras sin tilde, números, punto y guion bajo.';
  if (/^\.|\.$|\.\./.test(usuario)) return 'El punto no puede ir al principio, al final ni repetido.';
  return null;
}

export function errorNombre(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return 'Pon cómo quieres que te vean.';
  if ([...limpio].length > 40) return 'Máximo 40 caracteres.';
  return null;
}

export function errorContrasena(contrasena) {
  if (String(contrasena ?? '').length < 6) return 'Mínimo 6 caracteres.';
  return null;
}

export function errorNombreSala(nombre) {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return 'Ponle nombre a la sala.';
  if ([...limpio].length > 40) return 'Máximo 40 caracteres.';
  return null;
}
