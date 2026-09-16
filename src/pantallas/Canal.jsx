/**
 * Ché boluda — una sala o un chat: historial de voz y botón de hablar.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buscarPerfil, nombreSala, otraPersona, useApp, useEscuchados, useRadio, useReproductor, useSesion } from '../contexto.js';
import { Avatar, Boton } from '../componentes/Base.jsx';
import { AltavozTachado, Atras, Girando, Info, Reproducir } from '../componentes/Iconos.jsx';
import BotonHablar from '../componentes/BotonHablar.jsx';
import Burbuja from '../componentes/Burbuja.jsx';
import { Vumetro } from '../componentes/EnElAire.jsx';
import { escuchado } from '../lib/escuchados.js';
import { atras, navegar } from '../lib/ruta.js';
import { duracion, mismoDia, separadorDia } from '../lib/tiempo.js';

const POR_PAGINA = 60;

function unir(anteriores, nuevos) {
  const porId = new Map();
  for (const m of [...(anteriores ?? []), ...nuevos]) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => (a.creado_en < b.creado_en ? -1 : 1));
}

export default function Canal({ salaId }) {
  const { servicio, avisar } = useApp();
  const sesion = useSesion();
  const { yo, salas, radio, reproductor, recargar } = sesion;
  const estadoRadio = useRadio();
  const reproduciendo = useReproductor();
  useEscuchados();

  const sala = salas.find((s) => s.id === salaId);
  const [mensajes, setMensajes] = useState(null);
  const [hayAnteriores, setHayAnteriores] = useState(false);
  const leidoAlEntrar = useRef(sala?.ultimo_leido ?? new Date().toISOString());
  const lista = useRef(null);
  const pegadoAbajo = useRef(true);
  const alturaAntes = useRef(null);
  const primeraCarga = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const recientes = await servicio.mensajes(salaId, { limite: POR_PAGINA });
      // Con una página llena se conservan los anteriores ya cargados; si no, la
      // página trae todo y se sustituye (así desaparecen los borrados).
      setMensajes((previos) =>
        unir(previos?.filter((m) => recientes.length === POR_PAGINA && m.creado_en < recientes[0]?.creado_en), recientes)
      );
      if (primeraCarga.current) {
        primeraCarga.current = false;
        setHayAnteriores(recientes.length === POR_PAGINA);
      }
    } catch (error) {
      avisar(error.message);
    }
  }, [servicio, salaId, avisar]);

  useEffect(() => {
    cargar();
    const quitarCambios = servicio.alCambiar((c) => {
      if (c.tabla === 'mensajes' && (!c.fila?.sala_id || c.fila.sala_id === salaId)) cargar();
    });
    const quitarEventos = radio.alEvento((e) => e.tipo === 'enviado' && e.sala === salaId && cargar());
    return () => {
      quitarCambios();
      quitarEventos();
      reproductor.parar();
    };
  }, [servicio, salaId, cargar, radio, reproductor]);

  // Al entrar y con cada mensaje nuevo, la sala queda leída.
  const total = mensajes?.length ?? 0;
  useEffect(() => {
    if (document.visibilityState === 'hidden') return undefined;
    const id = setTimeout(() => servicio.marcarLeido(salaId).then(recargar).catch(() => {}), 600);
    return () => clearTimeout(id);
  }, [total, servicio, salaId, recargar]);

  // Mantiene la vista abajo si ya lo estaba; al cargar anteriores, conserva la posición.
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    if (alturaAntes.current !== null) {
      el.scrollTop = el.scrollHeight - alturaAntes.current;
      alturaAntes.current = null;
    } else if (pegadoAbajo.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mensajes, estadoRadio.pendientes.length]);

  async function verAnteriores() {
    if (!mensajes?.length) return;
    try {
      const viejos = await servicio.mensajes(salaId, { antesDe: mensajes[0].creado_en, limite: POR_PAGINA });
      alturaAntes.current = lista.current?.scrollHeight ?? null;
      setHayAnteriores(viejos.length === POR_PAGINA);
      setMensajes((previos) => unir(previos, viejos));
    } catch (error) {
      avisar(error.message);
    }
  }

  if (!sala) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl">📻</p>
        <h1 className="mt-3 text-2xl font-black">Esta sala ya no está</h1>
        <p className="mt-2 text-corteza">Puede que hayas salido o que te hayan quitado.</p>
        <Boton className="mt-6 w-full" onClick={() => navegar('/', { reemplazar: true })}>Volver</Boton>
      </div>
    );
  }

  const directo = sala.tipo === 'directo';
  const otro = directo ? otraPersona(sala, yo) : null;
  const presentes = (estadoRadio.presentes[salaId] ?? []).filter((id) => id !== yo);
  const hablandoAqui = estadoRadio.hablando[salaId];
  const quienHabla = hablandoAqui && buscarPerfil(sesion, hablandoAqui.de);
  const nuevos = (mensajes ?? []).filter((m) => m.autor_id !== yo && m.creado_en > leidoAlEntrar.current && !escuchado(m.id));
  const pendientes = estadoRadio.pendientes.filter((p) => p.sala === salaId);

  let subtitulo;
  if (directo) subtitulo = presentes.includes(otro?.id) ? 'Con la app abierta' : `@${otro?.usuario ?? ''}`;
  else subtitulo = `${sala.miembros.length} personas${presentes.length ? ` · ${presentes.length} con la app abierta` : ''}`;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="z-20 flex items-center gap-1 border-b border-lino bg-hueso/95 px-2 pb-2 pt-[max(env(safe-area-inset-top),8px)] backdrop-blur-md">
        <button type="button" onClick={() => atras(directo ? '/amigos' : '/')} aria-label="Atrás" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-cuero active:bg-arena">
          <Atras className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => navegar(`/sala/${salaId}/info`)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left active:bg-arena">
          {directo ? (
            <Avatar perfil={otro} tamano={42} presente={presentes.includes(otro?.id)} />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-lino bg-arena text-2xl shadow-hundido">{sala.emoji}</span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[18px] font-black leading-tight">{nombreSala(sala, yo)}</span>
              {sala.silenciada && <AltavozTachado className="h-4 w-4 shrink-0 text-corteza" />}
            </span>
            <span className="block truncate text-[13px] text-corteza">{subtitulo}</span>
          </span>
        </button>
        <button type="button" onClick={() => navegar(`/sala/${salaId}/info`)} aria-label="Detalles" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-cuero active:bg-arena">
          <Info />
        </button>
      </header>

      <div
        ref={lista}
        onScroll={(e) => {
          const el = e.currentTarget;
          pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2"
      >
        {hayAnteriores && (
          <button type="button" onClick={verAnteriores} className="mx-auto mb-2 block rounded-full bg-arena px-4 py-2 text-sm font-bold text-cuero">
            Ver mensajes anteriores
          </button>
        )}
        {mensajes === null ? (
          <div className="grid h-full place-items-center text-cuero"><Girando className="h-8 w-8" /></div>
        ) : mensajes.length === 0 && !pendientes.length ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <p className="text-5xl">👋</p>
              <p className="mt-3 text-lg font-black">Aún no ha hablado nadie</p>
              <p className="mt-1 text-[15px] text-corteza">
                {directo
                  ? 'Mantén pulsado el botón y di hola. Te oirá al momento si tiene la app abierta; si no, le llegará un aviso.'
                  : 'Mantén pulsado el botón y di hola. Os oirán al momento quienes tengan la app abierta; al resto les llegará un aviso.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {mensajes.map((m, i) => {
              const fecha = new Date(m.creado_en);
              const anterior = mensajes[i - 1];
              const mia = m.autor_id === yo;
              return (
                <div key={m.id} className="flex flex-col gap-2.5">
                  {(!anterior || !mismoDia(new Date(anterior.creado_en), fecha)) && (
                    <p className="mx-auto mt-2 rounded-full bg-arena px-3 py-1 text-[12px] font-bold text-corteza">{separadorDia(fecha)}</p>
                  )}
                  <Burbuja
                    mensaje={m}
                    mia={mia}
                    autor={buscarPerfil(sesion, m.autor_id)}
                    enGrupo={!directo}
                    conNombre={!directo && (!anterior || anterior.autor_id !== m.autor_id || !mismoDia(new Date(anterior.creado_en), fecha))}
                    nuevo={!mia && !escuchado(m.id)}
                    alTocar={() => (reproduciendo?.id === m.id ? reproductor.parar() : reproductor.reproducir([m]))}
                  />
                </div>
              );
            })}
          </div>
        )}
        {pendientes.map((p) => (
          <div key={p.id} className="ml-auto mt-2.5 w-[260px] rounded-[22px] border border-dashed border-cuero/50 bg-blanco p-3 text-[14px]">
            {p.error ? (
              <>
                <p className="font-bold">No se ha enviado ({duracion(p.duracionMs)})</p>
                <p className="text-corteza">{p.error}</p>
                <div className="mt-2 flex gap-2">
                  <Boton className="min-h-[38px] flex-1 px-3 text-[14px]" onClick={() => radio.reintentar(p.id)}>Reintentar</Boton>
                  <Boton variante="fantasma" className="min-h-[38px] px-3 text-[14px]" onClick={() => radio.descartar(p.id)}>Descartar</Boton>
                </div>
              </>
            ) : (
              <p className="flex items-center gap-2 font-semibold text-corteza"><Girando className="h-4 w-4" /> Guardando {duracion(p.duracionMs)}…</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-t-[36px] border-t border-blanco bg-arena px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-12px_30px_-20px_rgba(74,53,38,0.5)]">
        <div className="flex min-h-[44px] items-center justify-between gap-2">
          {hablandoAqui ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar perfil={quienHabla} tamano={38} hablando />
              <span className="truncate text-[15px] font-bold">{quienHabla?.nombre ?? 'Alguien'} está hablando</span>
              <Vumetro nivel={hablandoAqui.nivel} />
            </span>
          ) : presentes.length ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex -space-x-2">
                {presentes.slice(0, 5).map((id) => <Avatar key={id} perfil={buscarPerfil(sesion, id)} tamano={30} className="shadow-none" />)}
              </span>
              <span className="truncate text-[14px] font-semibold text-corteza">escuchando ahora</span>
            </span>
          ) : (
            <span className="text-[14px] text-corteza">{directo ? 'No tiene' : 'Nadie tiene'} la app abierta · llegará aviso</span>
          )}
          {nuevos.length > 0 && !hablandoAqui && (
            <Boton variante="suave" className="min-h-[40px] shrink-0 px-3 text-[14px]" onClick={() => reproductor.reproducir(nuevos)}>
              <Reproducir className="h-4 w-4" /> {nuevos.length === 1 ? '1 nuevo' : `${nuevos.length} nuevos`}
            </Boton>
          )}
        </div>
        <BotonHablar sala={salaId} ocupado={hablandoAqui ? quienHabla?.nombre ?? 'Alguien' : null} />
      </div>
    </div>
  );
}
