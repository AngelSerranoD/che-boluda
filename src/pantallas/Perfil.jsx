/**
 * Ché boluda — pestaña "Yo": perfil, invitación, avisos y sesión.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useState } from 'react';
import { useApp, useSesion } from '../contexto.js';
import { Avatar, Boton, Interruptor, ModoPrueba, Seccion } from '../componentes/Base.jsx';
import { Altavoz, Lapiz, Refrescar, Salir } from '../componentes/Iconos.jsx';
import { BotonesInvitar, EditarPerfil } from '../componentes/Hojas.jsx';
import { Cabecera } from '../componentes/Cabecera.jsx';
import { desbloquear, sonido } from '../lib/audio/motor.js';
import { activarAvisos, desactivarAvisos, esAppInstalada, esIOS, permisoAvisos, pushDisponible } from '../lib/push.js';
import { codigoLegible } from '../lib/invitacion.js';

function Avisos() {
  const { servicio, avisar } = useApp();
  const [permiso, setPermiso] = useState(permisoAvisos);
  const [cargando, setCargando] = useState(false);

  let descripcion = 'Te avisa cuando te hablan con la app cerrada.';
  if (!pushDisponible()) {
    descripcion = esIOS() && !esAppInstalada()
      ? 'Primero añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio).'
      : 'Este navegador no admite avisos.';
  } else if (permiso === 'denied') {
    descripcion = 'Bloqueados. Actívalos en Ajustes → Notificaciones → Ché boluda.';
  } else if (servicio.modo !== 'supabase') {
    descripcion = 'No disponibles en el modo de prueba.';
  }

  function cambiar(activar) {
    setCargando(true);
    const accion = activar ? activarAvisos(servicio) : desactivarAvisos(servicio);
    accion
      .then(() => avisar(activar ? 'Avisos activados 🔔' : 'Avisos desactivados en este móvil'))
      .catch((error) => avisar(error.message))
      .finally(() => {
        setCargando(false);
        setPermiso(activar ? permisoAvisos() : 'default');
      });
  }

  return (
    <Interruptor
      etiqueta="Avisos"
      descripcion={descripcion}
      activo={permiso === 'granted'}
      alCambiar={cambiar}
      disabled={cargando || !pushDisponible() || permiso === 'denied' || servicio.modo !== 'supabase'}
    />
  );
}

export default function Perfil() {
  const { servicio, avisar } = useApp();
  const { perfil, recargar } = useSesion();
  const [editando, setEditando] = useState(false);

  async function cambiarCodigo() {
    if (!window.confirm('Tu enlace actual dejará de funcionar. ¿Crear uno nuevo?')) return;
    try {
      await servicio.regenerarCodigo();
      recargar();
      avisar('Enlace nuevo listo');
    } catch (error) {
      avisar(error.message);
    }
  }

  async function probarSonido() {
    if (await desbloquear()) sonido('abrir');
    else avisar('El sonido está bloqueado. Toca otra vez.');
  }

  async function salir() {
    if (!window.confirm('¿Cerrar sesión en este móvil?')) return;
    await desactivarAvisos(servicio).catch(() => {});
    await servicio.salir();
  }

  return (
    <>
      <Cabecera titulo="Yo" />
      <div className="px-4">
        <div className="tarjeta flex flex-col items-center px-6 pb-6 pt-7 text-center">
          <button type="button" onClick={() => setEditando(true)} className="relative" aria-label="Cambiar avatar">
            <Avatar perfil={perfil} tamano={112} />
            <span className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border-2 border-blanco bg-cuero text-blanco">
              <Lapiz className="h-4 w-4" />
            </span>
          </button>
          <h2 className="mt-4 text-[26px] font-black leading-tight">{perfil.nombre}</h2>
          <p className="text-corteza">@{perfil.usuario}</p>
          <Boton variante="suave" className="mt-4 min-h-[44px] text-[15px]" onClick={() => setEditando(true)}>
            Editar perfil
          </Boton>
        </div>

        <Seccion titulo="Tu invitación">
          <div className="tarjeta p-4">
            <p className="text-[15px] text-corteza">
              Quien abra tu enlace podrá agregarte. Tu código es{' '}
              <strong className="whitespace-nowrap tracking-widest text-tinta">{codigoLegible(perfil.codigo)}</strong>.
            </p>
            <BotonesInvitar className="mt-4" />
            <button type="button" onClick={cambiarCodigo} className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-semibold text-cuero">
              <Refrescar className="h-4 w-4" /> Crear un enlace nuevo
            </button>
          </div>
        </Seccion>

        <Seccion titulo="Ajustes">
          <div className="tarjeta divide-y divide-lino overflow-hidden">
            <Avisos />
            <button type="button" onClick={probarSonido} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-arena">
              <Altavoz className="h-6 w-6 text-cuero" />
              <span className="flex-1">
                <span className="block text-[17px] font-semibold">Probar sonido</span>
                <span className="block text-sm text-corteza">Si no suena, sube el volumen del iPhone.</span>
              </span>
            </button>
            <button type="button" onClick={salir} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-arena">
              <Salir className="h-6 w-6 text-cuero" />
              <span className="text-[17px] font-semibold">Cerrar sesión</span>
            </button>
          </div>
        </Seccion>

        <footer className="mt-8 text-center text-[13px] text-corteza">
          <img src="/icons/icon-192.png" alt="" className="mx-auto mb-2 h-10 w-10 rounded-xl border border-lino" />
          Ché boluda · © 2026 Ángel Serrano Domínguez
          {servicio.modo === 'local' && <ModoPrueba />}
        </footer>
      </div>
      <EditarPerfil abierta={editando} alCerrar={() => setEditando(false)} />
    </>
  );
}
