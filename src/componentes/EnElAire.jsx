/**
 * Ché boluda — aviso flotante de "está hablando" en otra sala, y aviso de
 * sonido bloqueado cuando llega voz en directo que no se puede reproducir.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { buscarPerfil, nombreSala, useRadio, useSesion } from '../contexto.js';
import { Avatar } from './Base.jsx';
import { AltavozTachado } from './Iconos.jsx';
import { desbloquear } from '../lib/audio/motor.js';
import { navegar } from '../lib/ruta.js';

export function Vumetro({ nivel = 0, className = '' }) {
  return (
    <span className={`flex h-5 items-center gap-[3px] ${className}`} aria-hidden="true">
      {[0.55, 1, 0.75, 0.9, 0.5].map((f, i) => (
        <span key={i} className="w-[3px] rounded-full bg-cuero transition-[height] duration-100" style={{ height: `${Math.max(18, Math.min(100, nivel * 100 * f + 18))}%` }} />
      ))}
    </span>
  );
}

export default function EnElAire({ salaActual }) {
  const sesion = useSesion();
  const radio = useRadio();

  const sinSonido = Object.values(radio.hablando).some((h) => h.sinSonido);
  const fuera = Object.entries(radio.hablando).filter(([sala]) => sala !== salaActual);

  if (!sinSonido && !fuera.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),10px)] z-40 flex flex-col items-center gap-2 px-4">
      {sinSonido && (
        <button type="button" onClick={desbloquear} className="pointer-events-auto flex animate-asomar items-center gap-2 rounded-full bg-tinta px-4 py-2.5 text-[15px] font-bold text-hueso shadow-xl">
          <AltavozTachado className="h-5 w-5" /> Toca para escuchar en directo
        </button>
      )}
      {fuera.map(([salaId, h]) => {
        const sala = sesion.salas.find((s) => s.id === salaId);
        const quien = buscarPerfil(sesion, h.de);
        return (
          <button
            key={salaId}
            type="button"
            onClick={() => navegar(`/sala/${salaId}`)}
            className="pointer-events-auto flex max-w-full animate-asomar items-center gap-2.5 rounded-full border border-lino bg-blanco py-1.5 pl-1.5 pr-4 text-left shadow-arcilla"
          >
            <Avatar perfil={quien} tamano={34} hablando />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold">{quien?.nombre ?? 'Alguien'} está hablando</span>
              {sala?.tipo === 'grupo' && <span className="block truncate text-[12px] text-corteza">en {sala.emoji} {nombreSala(sala, sesion.yo)}</span>}
            </span>
            <Vumetro nivel={h.nivel} />
          </button>
        );
      })}
    </div>
  );
}
