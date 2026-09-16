/**
 * Ché boluda — une clases condicionales.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
export const cx = (...clases) => clases.filter(Boolean).join(' ');
