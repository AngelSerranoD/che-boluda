/**
 * Ché boluda — hojas inferiores: nueva sala, añadir amigos, editar perfil y
 * elegir amigos para una sala.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useEffect, useRef, useState } from 'react';
import { useApp, useSesion } from '../contexto.js';
import { AVATARES, Avatar, Boton, EMOJIS_SALA, Hoja, SelectorEmoji } from './Base.jsx';
import { Camara, Check, Compartir, Copiar, Mensaje, Pegar } from './Iconos.jsx';
import { cx } from '../lib/cx.js';
import { prepararFoto } from '../lib/foto.js';
import { enlaceInvitacion, enlaceWhatsApp, extraerCodigo, mensajeInvitacion } from '../lib/invitacion.js';
import { navegar } from '../lib/ruta.js';
import { errorNombre, errorNombreSala } from '../lib/validar.js';

/** Lista de amigos con casillas. */
export function ElegirAmigos({ amigos, elegidos, alCambiar }) {
  if (!amigos.length) {
    return <p className="tarjeta p-4 text-[15px] text-corteza">No hay amigos que añadir. Invítalos desde la pestaña Amigos.</p>;
  }
  const alternar = (id) => alCambiar(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  return (
    <ul className="tarjeta divide-y divide-lino overflow-hidden">
      {amigos.map((amigo) => {
        const marcado = elegidos.includes(amigo.id);
        return (
          <li key={amigo.id}>
            <button type="button" role="checkbox" aria-checked={marcado} onClick={() => alternar(amigo.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-arena">
              <Avatar perfil={amigo} tamano={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{amigo.nombre}</span>
                <span className="block truncate text-sm text-corteza">@{amigo.usuario}</span>
              </span>
              <span className={cx('grid h-7 w-7 place-items-center rounded-full border-2', marcado ? 'border-cuero bg-cuero text-blanco' : 'border-piedra')}>
                {marcado && <Check className="h-4 w-4" />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function NuevaSala({ abierta, alCerrar }) {
  const { servicio, avisar } = useApp();
  const { amigos, recargar } = useSesion();
  const [emoji, setEmoji] = useState(EMOJIS_SALA[0]);
  const [nombre, setNombre] = useState('');
  const [elegidos, setElegidos] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierta) {
      setNombre('');
      setElegidos([]);
      setEnviado(false);
    }
  }, [abierta]);

  async function crear() {
    setEnviado(true);
    if (errorNombreSala(nombre)) return;
    setCargando(true);
    try {
      const id = await servicio.crearSala({ nombre: nombre.trim(), emoji, miembros: elegidos });
      recargar();
      alCerrar();
      navegar(`/sala/${id}`);
    } catch (error) {
      avisar(error.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Nueva sala">
      <SelectorEmoji opciones={EMOJIS_SALA} valor={emoji} alCambiar={setEmoji} etiqueta="Emoji de la sala" />
      <label className="mt-4 block">
        <span className="mb-1.5 block px-1 text-sm font-bold text-corteza">Nombre</span>
        <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Las chicas, Viaje a Cádiz…" maxLength={40} enterKeyHint="done" />
        {enviado && errorNombreSala(nombre) && <p className="mt-1.5 px-1 text-sm font-semibold text-cuero">{errorNombreSala(nombre)}</p>}
      </label>
      <p className="mb-2 mt-5 px-1 text-sm font-bold text-corteza">¿Quién entra? {elegidos.length > 0 && `(${elegidos.length})`}</p>
      <ElegirAmigos amigos={amigos} elegidos={elegidos} alCambiar={setElegidos} />
      <Boton className="mt-5 w-full" onClick={crear} cargando={cargando}>Crear sala</Boton>
    </Hoja>
  );
}

/** WhatsApp, compartir y copiar el enlace propio. */
export function BotonesInvitar({ className }) {
  const { avisar } = useApp();
  const { perfil } = useSesion();
  const enlace = enlaceInvitacion(location.origin, perfil.codigo);
  const texto = mensajeInvitacion(perfil.nombre, enlace);

  async function compartir() {
    try {
      await navigator.share({ title: 'Ché boluda', text: texto });
    } catch (error) {
      if (error?.name !== 'AbortError') avisar('No se ha podido abrir el menú de compartir.');
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      avisar('Enlace copiado 📋');
    } catch {
      avisar(enlace);
    }
  }

  return (
    <div className={cx('flex flex-col gap-2.5', className)}>
      <a href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-cuero px-5 text-[17px] font-bold text-blanco shadow-[inset_0_1.5px_0_rgba(255,255,255,0.28),0_10px_20px_-10px_rgba(74,53,38,0.7)] active:scale-[0.98] active:bg-corteza">
        <Mensaje className="h-5 w-5" /> Invitar por WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2.5">
        {typeof navigator.share === 'function' && (
          <Boton variante="suave" onClick={compartir} className="text-[15px]">
            <Compartir className="h-5 w-5" /> Compartir
          </Boton>
        )}
        <Boton variante="suave" onClick={copiar} className={cx('text-[15px]', typeof navigator.share !== 'function' && 'col-span-2')}>
          <Copiar className="h-5 w-5" /> Copiar enlace
        </Boton>
      </div>
    </div>
  );
}

export function AnadirAmigo({ abierta, alCerrar }) {
  const { servicio, avisar } = useApp();
  const { recargar } = useSesion();
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const codigo = extraerCodigo(texto);

  useEffect(() => {
    if (abierta) setTexto('');
  }, [abierta]);

  async function pegar() {
    try {
      setTexto(await navigator.clipboard.readText());
    } catch {
      avisar('No se ha podido leer el portapapeles. Pégalo en la casilla.');
    }
  }

  async function anadir() {
    if (!codigo) return avisar('Eso no parece una invitación de Ché boluda.');
    setCargando(true);
    try {
      const amiga = await servicio.aceptarInvitacion(codigo);
      avisar(`Ya tienes a ${amiga.nombre} en tus amigos 🎉`);
      recargar();
      alCerrar();
    } catch (error) {
      avisar(error.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Añadir amigos">
      <p className="text-[15px] text-corteza">Mándales tu enlace. Cuando lo abran y creen su perfil, os tendréis agregados.</p>
      <BotonesInvitar className="mt-4" />

      <div className="my-6 flex items-center gap-3 text-sm font-bold text-corteza">
        <span className="h-px flex-1 bg-piedra" /> ¿Te han pasado una invitación? <span className="h-px flex-1 bg-piedra" />
      </div>
      <div className="flex gap-2">
        <input
          className="campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pega el enlace o el código"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="go"
          onKeyDown={(e) => e.key === 'Enter' && anadir()}
        />
        <button type="button" onClick={pegar} aria-label="Pegar" className="grid w-14 shrink-0 place-items-center rounded-2xl border border-lino bg-blanco text-cuero shadow-arcilla active:bg-arena">
          <Pegar />
        </button>
      </div>
      <Boton className="mt-3 w-full" onClick={anadir} cargando={cargando} disabled={!codigo}>
        Añadir
      </Boton>
    </Hoja>
  );
}

export function EditarPerfil({ abierta, alCerrar }) {
  const { servicio, avisar } = useApp();
  const { perfil, recargar } = useSesion();
  const [nombre, setNombre] = useState(perfil.nombre);
  const [avatar, setAvatar] = useState(perfil.avatar);
  const [foto, setFoto] = useState(perfil.foto);
  const [nuevaFoto, setNuevaFoto] = useState(null);
  const [cargando, setCargando] = useState(false);
  const entrada = useRef(null);

  useEffect(() => {
    if (!abierta) return;
    setNombre(perfil.nombre);
    setAvatar(perfil.avatar);
    setFoto(perfil.foto);
    setNuevaFoto(null);
  }, [abierta, perfil]);

  // Vista previa de la foto elegida.
  const [vista, setVista] = useState(null);
  useEffect(() => {
    if (!nuevaFoto) return setVista(null);
    const url = URL.createObjectURL(nuevaFoto);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [nuevaFoto]);

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      setNuevaFoto(await prepararFoto(archivo));
    } catch (error) {
      avisar(error.message);
    }
  }

  async function guardar() {
    const error = errorNombre(nombre);
    if (error) return avisar(error);
    setCargando(true);
    try {
      const url = nuevaFoto ? await servicio.subirFoto(nuevaFoto) : foto;
      await servicio.actualizarPerfil({ nombre: nombre.trim(), avatar, foto: url });
      recargar();
      alCerrar();
    } catch (err) {
      avisar(err.message);
    } finally {
      setCargando(false);
    }
  }

  const previa = { ...perfil, avatar, foto: vista ?? foto };

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Editar perfil">
      <div className="flex flex-col items-center">
        <Avatar perfil={previa} tamano={104} />
        <div className="mt-3 flex gap-2">
          <Boton variante="suave" className="min-h-[40px] px-4 text-[15px]" onClick={() => entrada.current?.click()}>
            <Camara className="h-5 w-5" /> {previa.foto ? 'Cambiar foto' : 'Poner foto'}
          </Boton>
          {previa.foto && (
            <Boton variante="fantasma" className="min-h-[40px] px-3 text-[15px]" onClick={() => { setFoto(null); setNuevaFoto(null); }}>
              Quitar
            </Boton>
          )}
        </div>
        <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
      </div>
      <p className="mb-2 mt-5 px-1 text-sm font-bold text-corteza">{previa.foto ? 'Emoji (se ve si quitas la foto)' : 'Emoji'}</p>
      <SelectorEmoji opciones={AVATARES} valor={avatar} alCambiar={setAvatar} etiqueta="Avatar" />
      <label className="mt-4 block">
        <span className="mb-1.5 block px-1 text-sm font-bold text-corteza">Nombre</span>
        <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} enterKeyHint="done" />
      </label>
      <Boton className="mt-5 w-full" onClick={guardar} cargando={cargando}>Guardar</Boton>
    </Hoja>
  );
}
