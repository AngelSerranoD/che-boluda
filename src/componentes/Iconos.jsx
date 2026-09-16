/**
 * Ché boluda — iconos de trazo redondeado, a juego con el contorno del icono.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

function Trazo({ children, className = 'h-6 w-6', grosor = 2.2 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const Atras = (p) => <Trazo {...p}><path d="M15 5l-7 7 7 7" /></Trazo>;
export const Mas = (p) => <Trazo {...p}><path d="M12 5v14M5 12h14" /></Trazo>;
export const Cerrar = (p) => <Trazo {...p}><path d="M6 6l12 12M18 6L6 18" /></Trazo>;
export const Check = (p) => <Trazo {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Trazo>;
export const Info = (p) => <Trazo {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></Trazo>;
export const Lapiz = (p) => <Trazo {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></Trazo>;
export const Copiar = (p) => <Trazo {...p}><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></Trazo>;
export const Compartir = (p) => <Trazo {...p}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M6 11H5a1 1 0 00-1 1v7a2 2 0 002 2h12a2 2 0 002-2v-7a1 1 0 00-1-1h-1" /></Trazo>;
export const Pegar = (p) => <Trazo {...p}><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4.5V3.8A.8.8 0 019.8 3h4.4a.8.8 0 01.8.8v.7M9 11h6M9 15h4" /></Trazo>;
export const Campana = (p) => <Trazo {...p}><path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20.5a2.2 2.2 0 004 0" /></Trazo>;
export const Salir = (p) => <Trazo {...p}><path d="M14 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h9" /></Trazo>;
export const Camara = (p) => <Trazo {...p}><path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0120 8.5V18a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18V8.5z" /><circle cx="12" cy="13" r="3.5" /></Trazo>;
export const Refrescar = (p) => <Trazo {...p}><path d="M20 12a8 8 0 11-2.3-5.6M20 4v4.5h-4.5" /></Trazo>;
export const Mensaje = (p) => <Trazo {...p}><path d="M5 18.5l-1.5 3 4-1.5A9 9 0 103 12a8.9 8.9 0 002 6.5z" /><path d="M9 10.5c.5 2 2.5 4 4.5 4.5l1.5-1.5 2 1-.5 1.5c-3.5.5-8-4-7.5-7.5l1.5-.5 1 2L9 10.5z" /></Trazo>;
export const Enlace = (p) => <Trazo {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></Trazo>;

export const AltavozTachado = (p) => (
  <Trazo {...p}>
    <path d="M4 9.5h3l4.5-4v13L7 14.5H4v-5zM16 9.5l5 5M21 9.5l-5 5" />
  </Trazo>
);

export const Altavoz = (p) => (
  <Trazo {...p}>
    <path d="M4 9.5h3l4.5-4v13L7 14.5H4v-5zM15.5 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" />
  </Trazo>
);

/** Walkie-talkie: pestaña de salas. */
export const Walkie = (p) => (
  <Trazo {...p}>
    <path d="M9 7V2.5" />
    <rect x="6" y="7" width="12" height="15" rx="3.5" />
    <rect x="9" y="10" width="6" height="4.5" rx="1.5" />
    <path d="M10 18h4" />
  </Trazo>
);

export const Personas = (p) => (
  <Trazo {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 20a6 6 0 0112 0" />
    <path d="M16 5.2a3.5 3.5 0 010 6.6M18 14.5a6 6 0 013 5.5" />
  </Trazo>
);

export const Yo = (p) => (
  <Trazo {...p}>
    <circle cx="12" cy="9" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
  </Trazo>
);

export const Reproducir = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 001.5.9l10.5-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z" fill="currentColor" />
  </svg>
);

export const Pausa = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
  </svg>
);

/** Rejilla de altavoz del walkie del icono: filas de 3, 4, 4 y 3 agujeros. */
export function Rejilla({ className = 'h-16 w-16' }) {
  const filas = [3, 4, 4, 3];
  const puntos = [];
  filas.forEach((n, f) => {
    for (let i = 0; i < n; i++) puntos.push([12 + (i - (n - 1) / 2) * 5, 4.5 + f * 5]);
  });
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {puntos.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.55" fill="currentColor" />
      ))}
    </svg>
  );
}

export function Girando({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
