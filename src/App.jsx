/**
 * Ché boluda — raíz: sesión, avisos breves y a qué pantalla se va.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextoApp } from './contexto.js';
import { codigoDeRuta } from './lib/invitacion.js';
import { useRuta } from './lib/ruta.js';
import Acceso from './pantallas/Acceso.jsx';
import Invitacion from './pantallas/Invitacion.jsx';
import Sesion from './pantallas/Sesion.jsx';

function Arranque() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <img src="/icons/icon-192.png" alt="Ché boluda" className="h-24 w-24 animate-latido rounded-[26px] border border-lino shadow-arcilla" />
    </div>
  );
}

function AvisoBreve({ texto }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[70] flex justify-center px-5">
      {texto && (
        <p className="animate-asomar rounded-2xl border border-lino bg-tinta px-4 py-3 text-center text-[15px] font-semibold text-hueso shadow-xl">
          {texto}
        </p>
      )}
    </div>
  );
}

export default function App({ servicio }) {
  const [yo, setYo] = useState(undefined); // undefined mientras se mira si hay sesión
  const [aviso, setAviso] = useState(null);
  const temporizador = useRef(null);
  const ruta = useRuta();

  useEffect(() => {
    let vivo = true;
    servicio.sesion().then((id) => vivo && setYo(id)).catch(() => vivo && setYo(null));
    const quitar = servicio.alCambiarSesion((id) => vivo && setYo(id));
    return () => {
      vivo = false;
      quitar();
    };
  }, [servicio]);

  const avisar = useCallback((texto) => {
    clearTimeout(temporizador.current);
    setAviso(texto);
    temporizador.current = setTimeout(() => setAviso(null), 3400);
  }, []);

  const valor = useMemo(() => ({ servicio, avisar }), [servicio, avisar]);
  const codigo = codigoDeRuta(ruta);

  let pantalla;
  if (yo === undefined) pantalla = <Arranque />;
  else if (codigo) pantalla = <Invitacion codigo={codigo} yo={yo} />;
  else if (!yo) pantalla = <Acceso />;
  else pantalla = <Sesion key={yo} yo={yo} ruta={ruta} />;

  return (
    <ContextoApp.Provider value={valor}>
      {pantalla}
      <AvisoBreve texto={aviso} />
    </ContextoApp.Provider>
  );
}
