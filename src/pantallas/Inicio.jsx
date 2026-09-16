/**
 * Ché boluda — pantalla principal con pestañas: Salas, Amigos y Yo.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useSesion } from '../contexto.js';
import { Insignia } from '../componentes/Base.jsx';
import { Personas, Walkie, Yo } from '../componentes/Iconos.jsx';
import { cx } from '../lib/cx.js';
import { navegar } from '../lib/ruta.js';
import Salas from './Salas.jsx';
import Amigos from './Amigos.jsx';
import Perfil from './Perfil.jsx';

function BarraPestanas({ activa }) {
  const { salas } = useSesion();
  const pendientes = (tipo) => salas.filter((s) => s.tipo === tipo).reduce((t, s) => t + s.no_leidos, 0);
  const pestanas = [
    { id: 'salas', ruta: '/', texto: 'Salas', Icono: Walkie, numero: pendientes('grupo') },
    { id: 'amigos', ruta: '/amigos', texto: 'Amigos', Icono: Personas, numero: pendientes('directo') },
    { id: 'yo', ruta: '/yo', texto: 'Yo', Icono: Yo, numero: 0 },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-lino bg-hueso/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid max-w-md grid-cols-3 px-3">
        {pestanas.map(({ id, ruta, texto, Icono, numero }) => (
          <button
            key={id}
            type="button"
            onClick={() => navegar(ruta, { reemplazar: true })}
            aria-current={activa === id ? 'page' : undefined}
            className={cx('flex flex-col items-center gap-0.5 pb-2 pt-2 text-[12px] font-bold', activa === id ? 'text-tinta' : 'text-corteza')}
          >
            <span className={cx('relative grid h-8 w-14 place-items-center rounded-full transition-colors', activa === id && 'bg-arena')}>
              <Icono className="h-6 w-6" />
              {numero > 0 && (
                <span className="absolute -right-1 -top-1.5">
                  <Insignia numero={numero} />
                </span>
              )}
            </span>
            {texto}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function Inicio({ pestana }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(env(safe-area-inset-bottom)+96px)]">
      {pestana === 'amigos' ? <Amigos /> : pestana === 'yo' ? <Perfil /> : <Salas />}
      <BarraPestanas activa={pestana} />
    </div>
  );
}
