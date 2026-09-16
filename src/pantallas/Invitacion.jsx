/**
 * Ché boluda — página del enlace de invitación (/i/<código>).
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * En iPhone el enlace de WhatsApp abre Safari, NO la app instalada (que guarda
 * sus datos aparte). Por eso hay tres caminos: aceptar aquí si ya hay sesión,
 * crear la cuenta aquí mismo, o copiar la invitación y pegarla dentro de la app.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../contexto.js';
import { Avatar, Boton, ModoPrueba } from '../componentes/Base.jsx';
import { Copiar } from '../componentes/Iconos.jsx';
import { codigoLegible, enlaceInvitacion } from '../lib/invitacion.js';
import { guardarInvitacionPendiente } from '../lib/pendiente.js';
import { esAppInstalada, esIOS } from '../lib/push.js';
import { navegar } from '../lib/ruta.js';

export default function Invitacion({ codigo, yo }) {
  const { servicio, avisar } = useApp();
  const [invitante, setInvitante] = useState(undefined);
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    servicio.verInvitacion(codigo).then(setInvitante).catch(() => setInvitante(null));
  }, [codigo, servicio]);

  async function aceptar() {
    setCargando(true);
    try {
      const amiga = await servicio.aceptarInvitacion(codigo);
      const sala = await servicio.abrirDirecto(amiga.id);
      avisar(`Ya tienes a ${amiga.nombre} en tus amigos 🎉`);
      navegar(`/sala/${sala}`, { reemplazar: true });
    } catch (error) {
      avisar(error.message);
      setCargando(false);
    }
  }

  function seguirSinCuenta() {
    guardarInvitacionPendiente(codigo);
    navegar('/', { reemplazar: true });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlaceInvitacion(location.origin, codigo));
      guardarInvitacionPendiente(codigo);
      setCopiado(true);
    } catch {
      avisar(`Copia este código a mano: ${codigoLegible(codigo)}`);
    }
  }

  if (invitante === undefined) {
    return <div className="grid min-h-dvh place-items-center text-corteza">Buscando la invitación…</div>;
  }

  const enSafariDeIphone = esIOS() && !esAppInstalada();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[max(env(safe-area-inset-top),28px)]">
      <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-[18px] border border-lino shadow-arcilla" />
      <p className="mt-2 text-center text-[15px] font-bold text-cuero">ché boluda</p>

      {!invitante ? (
        <div className="tarjeta mt-8 p-6 text-center">
          <p className="text-4xl">🤷</p>
          <h1 className="mt-3 text-2xl font-black">Esta invitación ya no vale</h1>
          <p className="mt-2 text-corteza">Puede que hayan creado un enlace nuevo. Pide que te lo manden otra vez.</p>
          <Boton className="mt-6 w-full" onClick={() => navegar('/', { reemplazar: true })}>Ir a la app</Boton>
        </div>
      ) : (
        <>
          <div className="tarjeta mt-8 flex flex-col items-center p-6 text-center">
            <Avatar perfil={invitante} tamano={96} />
            <h1 className="mt-4 text-[26px] font-black leading-tight tracking-tight">{invitante.nombre} te invita a hablar por walkie</h1>
            <p className="mt-1 text-corteza">@{invitante.usuario}</p>
            <p className="mt-4 text-[15px] text-corteza">Pulsas, hablas y te escucha al momento. Como un walkie-talkie, pero en el móvil.</p>
          </div>

          {yo ? (
            <Boton className="mt-6 w-full" cargando={cargando} onClick={aceptar}>Aceptar y hablar</Boton>
          ) : enSafariDeIphone ? (
            <div className="mt-6 flex flex-col gap-3">
              <ol className="tarjeta flex flex-col gap-3 p-4 text-[15px] text-corteza">
                <li><strong className="text-tinta">1.</strong> Copia la invitación con el botón de abajo.</li>
                <li><strong className="text-tinta">2.</strong> Pulsa <strong className="text-tinta">Compartir</strong> → <strong className="text-tinta">Añadir a pantalla de inicio</strong>.</li>
                <li><strong className="text-tinta">3.</strong> Abre Ché boluda desde el icono, crea tu perfil y pulsa <strong className="text-tinta">Pegar una invitación</strong>.</li>
              </ol>
              <Boton onClick={copiar} className="w-full">
                <Copiar className="h-5 w-5" /> {copiado ? 'Copiada ✓' : 'Copiar invitación'}
              </Boton>
              <Boton variante="suave" onClick={seguirSinCuenta} className="w-full">Usarla aquí en Safari</Boton>
              <p className="text-center text-[13px] text-corteza">Código: <strong className="tracking-widest text-tinta">{codigoLegible(codigo)}</strong></p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              <Boton onClick={seguirSinCuenta} className="w-full">Crear mi perfil</Boton>
              <Boton variante="suave" onClick={seguirSinCuenta} className="w-full">Ya tengo cuenta</Boton>
            </div>
          )}
        </>
      )}
      {servicio.modo === 'local' && <ModoPrueba />}
    </main>
  );
}
