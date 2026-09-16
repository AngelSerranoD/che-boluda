/**
 * Ché boluda — burbuja de un mensaje de voz guardado.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react';
import { useReproductor, useSesion } from '../contexto.js';
import { Avatar } from './Base.jsx';
import { Girando, Pausa, Reproducir } from './Iconos.jsx';
import { cx } from '../lib/cx.js';
import { duracion, hora } from '../lib/tiempo.js';

/** Progreso 0..1 del mensaje que suena, a 60 fps solo mientras suena. */
function useProgreso(activo) {
  const { reproductor } = useSesion();
  const [progreso, setProgreso] = useState(0);
  useEffect(() => {
    if (!activo) {
      setProgreso(0);
      return undefined;
    }
    let marco;
    const paso = () => {
      setProgreso(reproductor.progreso());
      marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [activo, reproductor]);
  return progreso;
}

export function Onda({ valores, progreso = 0, mia }) {
  const barras = valores?.length ? valores : new Array(28).fill(30);
  return (
    <span className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden="true">
      {barras.map((v, i) => (
        <span
          key={i}
          className={cx('w-[3px] flex-1 rounded-full', i / barras.length < progreso ? 'bg-cuero' : mia ? 'bg-corteza/35' : 'bg-piedra')}
          style={{ height: `${Math.max(12, v)}%` }}
        />
      ))}
    </span>
  );
}

export default function Burbuja({ mensaje, autor, mia, enGrupo, conNombre, nuevo, alTocar }) {
  const estado = useReproductor();
  const suena = estado?.id === mensaje.id;
  const progreso = useProgreso(suena && !estado.cargando);

  return (
    <div className={cx('flex items-end gap-2', mia ? 'justify-end pl-10' : 'justify-start pr-10')}>
      {!mia && enGrupo && (conNombre ? <Avatar perfil={autor} tamano={30} className="mb-1" /> : <span className="w-[30px] shrink-0" />)}
      <div
        className={cx(
          'w-[260px] max-w-full rounded-[26px] border px-2.5 pb-1.5 pt-2.5 shadow-arcilla',
          mia ? 'rounded-br-lg border-piedra bg-lino' : 'rounded-bl-lg border-lino bg-blanco'
        )}
      >
        {!mia && conNombre && <p className="mb-1 px-1.5 text-[13px] font-bold text-cuero">{autor?.nombre ?? 'Alguien'}</p>}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={alTocar}
            aria-label={suena ? 'Parar' : `Escuchar mensaje de ${duracion(mensaje.duracion_ms)}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cuero text-blanco shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3)] active:scale-95"
          >
            {suena && estado.cargando ? <Girando /> : suena ? <Pausa /> : <Reproducir className="ml-0.5 h-5 w-5" />}
          </button>
          <Onda valores={mensaje.onda} progreso={progreso} mia={mia} />
        </div>
        <p className="mt-1 flex items-center justify-between px-1.5 text-[12px] tabular-nums text-corteza">
          <span>{duracion(mensaje.duracion_ms)}</span>
          <span className="flex items-center gap-1.5">
            {nuevo && <span className="h-2 w-2 rounded-full bg-cuero" title="Sin escuchar" />}
            {hora(new Date(mensaje.creado_en))}
          </span>
        </p>
        {suena && estado.error && <p className="px-1.5 pb-1 text-[12px] font-semibold text-cuero">{estado.error}</p>}
      </div>
    </div>
  );
}
