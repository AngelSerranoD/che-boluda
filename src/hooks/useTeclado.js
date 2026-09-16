/**
 * Ché boluda — altura del teclado en iPhone.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Safari no encoge la ventana al sacar el teclado, solo el visualViewport:
 * una hoja pegada abajo quedaría tapada, con el teclado fuera.
 */
import { useEffect, useState } from 'react';

export function useAlturaTeclado(activo = true) {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const vista = window.visualViewport;
    if (!activo || !vista) return undefined;
    const medir = () => {
      const tapado = window.innerHeight - vista.height - vista.offsetTop;
      setAltura(tapado > 60 ? Math.round(tapado) : 0); // < 60 px: barras del navegador, no teclado
    };
    medir();
    vista.addEventListener('resize', medir);
    vista.addEventListener('scroll', medir);
    return () => {
      vista.removeEventListener('resize', medir);
      vista.removeEventListener('scroll', medir);
    };
  }, [activo]);

  return altura;
}
