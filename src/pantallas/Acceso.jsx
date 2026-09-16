/**
 * Ché boluda — crear cuenta o entrar.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../contexto.js';
import { AVATARES, Boton, ModoPrueba, SelectorEmoji } from '../componentes/Base.jsx';
import { Pegar } from '../componentes/Iconos.jsx';
import { extraerCodigo } from '../lib/invitacion.js';
import { guardarInvitacionPendiente, leerInvitacionPendiente, olvidarInvitacionPendiente } from '../lib/pendiente.js';
import { esAppInstalada, esIOS } from '../lib/push.js';
import { errorContrasena, errorNombre, errorUsuario, normalizarUsuario } from '../lib/validar.js';
import { cx } from '../lib/cx.js';

export function ConsejoInstalar({ className }) {
  if (!esIOS() || esAppInstalada()) return null;
  return (
    <div className={cx('tarjeta p-4 text-[15px] text-corteza', className)}>
      <p className="font-bold text-tinta">Instálala en tu iPhone 📲</p>
      <p className="mt-1">
        En Safari pulsa <strong className="text-tinta">Compartir</strong> y luego{' '}
        <strong className="text-tinta">Añadir a pantalla de inicio</strong>. Así te llegan los avisos y se abre como una app.
      </p>
    </div>
  );
}

export default function Acceso() {
  const { servicio, avisar } = useApp();
  const [modo, setModo] = useState('crear');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARES[Math.floor(Math.random() * AVATARES.length)]);
  const [ver, setVer] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [libre, setLibre] = useState(null);
  const [invitante, setInvitante] = useState(null);

  // Si viene de un enlace de invitación, se enseña quién invita.
  useEffect(() => {
    const codigo = leerInvitacionPendiente();
    if (!codigo) return;
    servicio.verInvitacion(codigo).then((p) => (p ? setInvitante(p) : olvidarInvitacionPendiente())).catch(() => {});
  }, [servicio]);

  const limpio = normalizarUsuario(usuario);
  const errores = {
    nombre: modo === 'crear' ? errorNombre(nombre) : null,
    usuario: errorUsuario(limpio),
    contrasena: errorContrasena(contrasena),
  };

  // Comprueba si el usuario está libre mientras se escribe.
  useEffect(() => {
    setLibre(null);
    if (modo !== 'crear' || errorUsuario(limpio)) return undefined;
    const id = setTimeout(() => servicio.usuarioDisponible(limpio).then(setLibre).catch(() => {}), 400);
    return () => clearTimeout(id);
  }, [limpio, modo, servicio]);

  async function enviar(e) {
    e.preventDefault();
    setEnviado(true);
    if (Object.values(errores).some(Boolean) || (modo === 'crear' && libre === false)) return;
    setCargando(true);
    try {
      if (modo === 'crear') await servicio.registrarse({ usuario: limpio, contrasena, nombre, avatar });
      else await servicio.entrar({ usuario: limpio, contrasena });
    } catch (error) {
      avisar(error.message);
      setCargando(false);
    }
  }

  async function pegarInvitacion() {
    try {
      const codigo = extraerCodigo(await navigator.clipboard.readText());
      if (!codigo) return avisar('En el portapapeles no hay ninguna invitación.');
      const perfil = await servicio.verInvitacion(codigo);
      if (!perfil) return avisar('Esa invitación no existe o ya no vale.');
      guardarInvitacionPendiente(codigo);
      setInvitante(perfil);
    } catch {
      avisar('No se ha podido leer el portapapeles.');
    }
  }

  const error = (campo) => enviado && errores[campo] && <p className="mt-1.5 px-1 text-sm font-semibold text-cuero">{errores[campo]}</p>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[max(env(safe-area-inset-top),28px)]">
      <img src="/icons/icon-512.png" alt="" className="mx-auto h-28 w-28 rounded-[30px] border border-lino shadow-arcilla" />
      <h1 className="mt-4 text-center text-[40px] font-black leading-none tracking-tight">Ché boluda</h1>
      <p className="mt-2 text-center text-[17px] text-corteza">Pulsa, habla y que te escuchen al momento.</p>

      {invitante && (
        <div className="tarjeta mt-6 flex items-center gap-3 p-3">
          <span className="text-3xl" aria-hidden="true">{invitante.avatar}</span>
          <p className="text-[15px] text-corteza">
            <strong className="text-tinta">{invitante.nombre}</strong> te ha invitado. En cuanto entres, os tendréis agregados.
          </p>
        </div>
      )}

      <div role="tablist" className="mt-7 grid grid-cols-2 rounded-2xl bg-arena p-1 shadow-hundido">
        {[['crear', 'Crear cuenta'], ['entrar', 'Ya tengo cuenta']].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={modo === valor}
            onClick={() => { setModo(valor); setEnviado(false); }}
            className={cx('rounded-xl py-2.5 text-[15px] font-bold transition-colors', modo === valor ? 'bg-blanco text-tinta shadow-arcilla' : 'text-corteza')}
          >
            {texto}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} noValidate className="mt-5 flex flex-col gap-4">
        {modo === 'crear' && (
          <>
            <div>
              <p className="mb-2 px-1 text-sm font-bold text-corteza">Tu avatar</p>
              <SelectorEmoji opciones={AVATARES} valor={avatar} alCambiar={setAvatar} etiqueta="Avatar" />
            </div>
            <label className="block">
              <span className="mb-1.5 block px-1 text-sm font-bold text-corteza">Nombre</span>
              <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cómo te verán tus amigos" autoComplete="nickname" maxLength={40} />
              {error('nombre')}
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block px-1 text-sm font-bold text-corteza">Usuario</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[17px] font-semibold text-corteza">@</span>
            <input
              className="campo pl-9"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="tu_usuario"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              maxLength={21}
            />
          </span>
          {error('usuario')}
          {modo === 'crear' && !errores.usuario && libre === false && <p className="mt-1.5 px-1 text-sm font-semibold text-cuero">Ese usuario ya existe.</p>}
          {modo === 'crear' && !errores.usuario && libre === true && <p className="mt-1.5 px-1 text-sm text-corteza">@{limpio} está libre ✓</p>}
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between px-1 text-sm font-bold text-corteza">
            Contraseña
            <button type="button" onClick={() => setVer((v) => !v)} className="text-cuero">{ver ? 'Ocultar' : 'Ver'}</button>
          </span>
          <input
            className="campo"
            type={ver ? 'text' : 'password'}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          />
          {error('contrasena')}
        </label>

        <Boton type="submit" cargando={cargando} className="mt-2 w-full">
          {modo === 'crear' ? 'Crear mi perfil' : 'Entrar'}
        </Boton>
      </form>

      {modo === 'crear' && (
        <p className="mt-3 px-2 text-center text-[13px] text-corteza">
          Apunta tu contraseña: no hay correo para recuperarla.
        </p>
      )}

      {!invitante && (
        <Boton variante="fantasma" onClick={pegarInvitacion} className="mx-auto mt-4">
          <Pegar className="h-5 w-5" /> Pegar una invitación
        </Boton>
      )}

      <ConsejoInstalar className="mt-6" />
      {servicio.modo === 'local' && <ModoPrueba />}
    </main>
  );
}
