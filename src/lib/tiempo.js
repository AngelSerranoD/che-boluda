/**
 * Ché boluda — formato de duraciones y fechas.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Nombres de día y mes escritos a mano: Safari y Chrome abrevian distinto con
 * Intl y las pruebas tienen que dar lo mismo en todos lados.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dos = (n) => String(n).padStart(2, '0');

/** 7400 → "0:07", 62000 → "1:02". Redondea hacia arriba a partir de medio segundo. */
export function duracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${dos(s % 60)}`;
}

export const hora = (fecha) => `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;

/** Días de calendario local entre dos fechas (0 = mismo día). */
function diasEntre(fecha, ahora) {
  const a = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const b = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12);
  return Math.round((b - a) / 86_400_000);
}

/** Para las listas: "ahora", "hace 5 min", "14:32", "ayer", "lun", "12 sep". */
export function cuandoCorto(fecha, ahora = new Date()) {
  const segundos = (ahora - fecha) / 1000;
  if (segundos < 60) return 'ahora';
  const dias = diasEntre(fecha, ahora);
  if (segundos < 3600 && dias === 0) return `hace ${Math.floor(segundos / 60)} min`;
  if (dias === 0) return hora(fecha);
  if (dias === 1) return 'ayer';
  if (dias < 7) return DIAS_CORTOS[fecha.getDay()];
  const texto = `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? texto : `${texto} ${fecha.getFullYear()}`;
}

/** Separador del historial: "Hoy", "Ayer", "Lunes 14 de septiembre". */
export function separadorDia(fecha, ahora = new Date()) {
  const dias = diasEntre(fecha, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  const dia = DIAS[fecha.getDay()];
  const texto = `${dia[0].toUpperCase()}${dia.slice(1)} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? texto : `${texto} de ${fecha.getFullYear()}`;
}

export const mismoDia = (a, b) => diasEntre(a, b) === 0;
