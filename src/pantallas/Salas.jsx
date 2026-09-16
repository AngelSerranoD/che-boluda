/**
 * Ché boluda — pestaña de salas.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useState } from 'react';
import { buscarPerfil, useApp, useRadio, useSesion, useTic } from '../contexto.js';
import { Avatar, Boton, Insignia } from '../componentes/Base.jsx';
import { AltavozTachado, Campana, Mas } from '../componentes/Iconos.jsx';
import { NuevaSala } from '../componentes/Hojas.jsx';
import { ConsejoInstalar } from './Acceso.jsx';
import { activarAvisos, esAppInstalada, permisoAvisos } from '../lib/push.js';
import { navegar } from '../lib/ruta.js';
import { cuandoCorto, duracion } from '../lib/tiempo.js';
import { Cabecera } from '../componentes/Cabecera.jsx';

function TarjetaAvisos() {
  const { servicio, avisar } = useApp();
  const [permiso, setPermiso] = useState(permisoAvisos);
  const [cargando, setCargando] = useState(false);
  if (servicio.modo !== 'supabase' || !esAppInstalada() || permiso !== 'default') return null;

  function activar() {
    setCargando(true);
    activarAvisos(servicio)
      .then(() => avisar('Avisos activados 🔔'))
      .catch((error) => avisar(error.message))
      .finally(() => {
        setCargando(false);
        setPermiso(permisoAvisos());
      });
  }

  return (
    <div className="tarjeta flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-arena text-cuero"><Campana /></span>
      <p className="flex-1 text-[15px] text-corteza">
        <strong className="block text-tinta">Activa los avisos</strong>
        Para enterarte cuando te hablen con la app cerrada.
      </p>
      <Boton onClick={activar} cargando={cargando} className="min-h-[44px] px-4 text-[15px]">Activar</Boton>
    </div>
  );
}

export function FilaSala({ sala, titulo, icono, hablando, presentes = [], alTocar }) {
  const sesion = useSesion();
  const ultimo = sala.ultimo;
  const autor = ultimo && buscarPerfil(sesion, ultimo.autor_id);
  let resumen;
  if (hablando) resumen = `🎙️ ${buscarPerfil(sesion, hablando.de)?.nombre ?? 'Alguien'} está hablando…`;
  else if (ultimo) resumen = `${ultimo.autor_id === sesion.yo ? 'Tú' : autor?.nombre ?? 'Alguien'}: 🎙️ ${duracion(ultimo.duracion_ms)}`;
  else resumen = sala.tipo === 'grupo' ? `${sala.miembros.length} ${sala.miembros.length === 1 ? 'persona' : 'personas'} · aún no ha hablado nadie` : 'Aún no os habéis hablado';

  return (
    <button type="button" onClick={alTocar} className="tarjeta flex w-full items-center gap-3 p-3 text-left transition-transform active:scale-[0.99]">
      {icono}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[17px] font-bold">{titulo}</span>
          {sala.silenciada && <AltavozTachado className="h-4 w-4 shrink-0 text-corteza" />}
        </span>
        <span className={`mt-0.5 block truncate text-[15px] ${hablando ? 'font-semibold text-cuero' : 'text-corteza'}`}>{resumen}</span>
        {sala.tipo === 'grupo' && (
          <span className="mt-1.5 flex -space-x-2">
            {sala.miembros.slice(0, 6).map((m) => (
              <Avatar key={m.id} perfil={m} tamano={24} presente={m.id !== sesion.yo && presentes.includes(m.id)} className="shadow-none" />
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1">
        <span className="text-xs text-corteza">{cuandoCorto(new Date(sala.ultima_actividad))}</span>
        <Insignia numero={sala.no_leidos} />
      </span>
    </button>
  );
}

export default function Salas() {
  const { salas, amigos } = useSesion();
  const radio = useRadio();
  const [creando, setCreando] = useState(false);
  useTic(true, 30_000);
  const grupos = salas.filter((s) => s.tipo === 'grupo');

  return (
    <>
      <Cabecera
        titulo="Salas"
        accion={
          <button type="button" onClick={() => setCreando(true)} aria-label="Nueva sala" className="grid h-10 w-10 place-items-center rounded-full border border-lino bg-blanco text-cuero shadow-arcilla active:bg-arena">
            <Mas />
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        <ConsejoInstalar />
        <TarjetaAvisos />

        {grupos.length === 0 ? (
          <div className="tarjeta mt-2 flex flex-col items-center px-6 py-8 text-center">
            <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-[22px] border border-lino" />
            <h2 className="mt-4 text-xl font-black">Aún no tienes salas</h2>
            <p className="mt-2 text-[15px] text-corteza">
              Crea una y mete a tus amigos: lo que digas sonará al momento en los móviles de todos.
            </p>
            <Boton className="mt-5 w-full" onClick={() => (amigos.length ? setCreando(true) : navegar('/amigos', { reemplazar: true }))}>
              {amigos.length ? 'Crear una sala' : 'Primero, invita a tus amigos'}
            </Boton>
          </div>
        ) : (
          grupos.map((sala) => (
            <FilaSala
              key={sala.id}
              sala={sala}
              titulo={sala.nombre}
              hablando={radio.hablando[sala.id]}
              presentes={radio.presentes[sala.id]}
              alTocar={() => navegar(`/sala/${sala.id}`)}
              icono={
                <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-lino bg-arena text-3xl shadow-hundido">
                  {sala.emoji}
                  {radio.hablando[sala.id] && <span className="absolute inset-0 animate-onda rounded-2xl border-2 border-cuero" />}
                </span>
              }
            />
          ))
        )}
      </div>
      <NuevaSala abierta={creando} alCerrar={() => setCreando(false)} />
    </>
  );
}
