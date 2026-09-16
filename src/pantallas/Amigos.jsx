/**
 * Ché boluda — pestaña de amigos (y sus chats individuales).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useState } from 'react';
import { otraPersona, useApp, useRadio, useSesion, useTic } from '../contexto.js';
import { Avatar, Boton } from '../componentes/Base.jsx';
import { Mas, Mensaje } from '../componentes/Iconos.jsx';
import { AnadirAmigo } from '../componentes/Hojas.jsx';
import { navegar } from '../lib/ruta.js';
import { Cabecera } from '../componentes/Cabecera.jsx';
import { FilaSala } from './Salas.jsx';

export default function Amigos() {
  const { servicio, avisar } = useApp();
  const { yo, salas, amigos } = useSesion();
  const radio = useRadio();
  const [invitando, setInvitando] = useState(false);
  const [abriendo, setAbriendo] = useState(null);
  useTic(true, 30_000);

  // Sala directa de cada amigo (si ya existe).
  const directos = new Map();
  for (const sala of salas) {
    if (sala.tipo === 'directo') {
      const otro = otraPersona(sala, yo);
      if (otro) directos.set(otro.id, sala);
    }
  }
  const ordenados = [...amigos].sort((a, b) => {
    const fa = directos.get(a.id)?.ultima_actividad ?? '';
    const fb = directos.get(b.id)?.ultima_actividad ?? '';
    return fa === fb ? a.nombre.localeCompare(b.nombre, 'es') : fa < fb ? 1 : -1;
  });

  async function abrir(amigo) {
    const existente = directos.get(amigo.id);
    if (existente) return navegar(`/sala/${existente.id}`);
    setAbriendo(amigo.id);
    try {
      navegar(`/sala/${await servicio.abrirDirecto(amigo.id)}`);
    } catch (error) {
      avisar(error.message);
      setAbriendo(null);
    }
  }

  return (
    <>
      <Cabecera
        titulo="Amigos"
        accion={
          <button type="button" onClick={() => setInvitando(true)} aria-label="Añadir amigos" className="grid h-10 w-10 place-items-center rounded-full border border-lino bg-blanco text-cuero shadow-arcilla active:bg-arena">
            <Mas />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {amigos.length < 3 && (
          <div className="tarjeta flex flex-col items-center px-6 py-7 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-arena text-cuero shadow-hundido"><Mensaje className="h-9 w-9" /></span>
            <h2 className="mt-4 text-xl font-black">{amigos.length ? 'Invita a más gente' : 'Invita a tus amigos'}</h2>
            <p className="mt-2 text-[15px] text-corteza">Mándales tu enlace por WhatsApp. Cuando creen su perfil, os tendréis agregados.</p>
            <Boton className="mt-5 w-full" onClick={() => setInvitando(true)}>Invitar</Boton>
          </div>
        )}

        {ordenados.map((amigo) => {
          const sala = directos.get(amigo.id);
          const presente = sala ? (radio.presentes[sala.id] ?? []).includes(amigo.id) : false;
          const icono = <Avatar perfil={amigo} tamano={56} presente={presente} hablando={Boolean(sala && radio.hablando[sala.id])} />;
          if (sala) {
            return (
              <FilaSala key={amigo.id} sala={sala} titulo={amigo.nombre} icono={icono} hablando={radio.hablando[sala.id]} alTocar={() => abrir(amigo)} />
            );
          }
          return (
            <button key={amigo.id} type="button" onClick={() => abrir(amigo)} disabled={abriendo === amigo.id} className="tarjeta flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] disabled:opacity-60">
              {icono}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold">{amigo.nombre}</span>
                <span className="block truncate text-[15px] text-corteza">@{amigo.usuario} · pulsa para hablar</span>
              </span>
            </button>
          );
        })}
      </div>
      <AnadirAmigo abierta={invitando} alCerrar={() => setInvitando(false)} />
    </>
  );
}
