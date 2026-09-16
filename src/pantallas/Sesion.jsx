/**
 * Ché boluda — todo lo que vive mientras hay sesión: datos, radio y rutas.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextoSesion, useApp } from '../contexto.js';
import { crearRadio } from '../lib/radio.js';
import { crearReproductor } from '../lib/reproductor.js';
import { leerRuta } from '../lib/ruta.js';
import { leerInvitacionPendiente, olvidarInvitacionPendiente } from '../lib/pendiente.js';
import { ponerInsignia, sincronizarAvisos } from '../lib/push.js';
import Inicio from './Inicio.jsx';
import Canal from './Canal.jsx';
import DetallesSala from './DetallesSala.jsx';
import EnElAire from '../componentes/EnElAire.jsx';

export default function Sesion({ yo, ruta }) {
  const { servicio, avisar } = useApp();
  const [perfil, setPerfil] = useState(null);
  const [salas, setSalas] = useState(null);
  const [amigos, setAmigos] = useState(null);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const temporizador = useRef(null);

  const radio = useMemo(() => crearRadio({ servicio, yo }), [servicio, yo]);
  const reproductor = useMemo(() => crearReproductor({ servicio }), [servicio]);

  const recargar = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      try {
        const [p, s, a] = await Promise.all([servicio.miPerfil(), servicio.salas(), servicio.amigos()]);
        setPerfil(p);
        setSalas(s);
        setAmigos(a);
      } catch (error) {
        avisar(error.message);
      }
    }, 120);
  }, [servicio, avisar]);

  useEffect(() => {
    recargar();
    return servicio.alCambiar(recargar);
  }, [servicio, recargar]);

  // En segundo plano iOS congela la app: se suelta el micro y se cierran los
  // canales. Al volver se recarga todo (lo que llegó mientras tanto) y se resintoniza.
  useEffect(() => {
    const cambio = () => {
      const ahora = document.visibilityState !== 'hidden';
      setVisible(ahora);
      if (ahora) recargar();
      else {
        radio.soltar();
        reproductor.parar();
      }
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, [radio, reproductor, recargar]);

  useEffect(() => {
    if (!salas) return;
    if (visible) radio.sintonizar(salas.map((s) => ({ id: s.id, silenciada: s.silenciada })));
    else radio.desintonizar();
  }, [salas, visible, radio]);

  useEffect(() => () => radio.desintonizar(), [radio]);

  useEffect(
    () =>
      radio.alEvento((evento) => {
        if (evento.tipo === 'entrante' || evento.tipo === 'emision') reproductor.parar();
      }),
    [radio, reproductor]
  );

  useEffect(() => {
    if (salas) ponerInsignia(salas.reduce((total, s) => total + s.no_leidos, 0));
  }, [salas]);

  useEffect(() => {
    sincronizarAvisos(servicio);
  }, [servicio]);

  // Invitación abierta antes de tener cuenta: se acepta al entrar.
  useEffect(() => {
    const codigo = leerInvitacionPendiente();
    if (!codigo) return;
    olvidarInvitacionPendiente();
    servicio
      .aceptarInvitacion(codigo)
      .then((amiga) => {
        avisar(`Ya tienes a ${amiga.nombre} en tus amigos 🎉`);
        recargar();
      })
      .catch((error) => avisar(error.message));
  }, [servicio, avisar, recargar]);

  const valor = useMemo(
    () => ({ yo, perfil, salas, amigos, radio, reproductor, recargar }),
    [yo, perfil, salas, amigos, radio, reproductor, recargar]
  );

  if (!perfil || !salas || !amigos) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <img src="/icons/icon-192.png" alt="Cargando" className="h-20 w-20 animate-latido rounded-[22px] border border-lino shadow-arcilla" />
      </div>
    );
  }

  const { pantalla, sala } = leerRuta(ruta);
  return (
    <ContextoSesion.Provider value={valor}>
      {pantalla === 'sala' && <Canal key={sala} salaId={sala} />}
      {pantalla === 'info' && <DetallesSala key={sala} salaId={sala} />}
      {!['sala', 'info'].includes(pantalla) && <Inicio pestana={pantalla} />}
      <EnElAire salaActual={pantalla === 'sala' ? sala : null} />
    </ContextoSesion.Provider>
  );
}
