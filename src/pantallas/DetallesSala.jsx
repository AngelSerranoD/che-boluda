/**
 * Ché boluda — detalles de una sala o de un chat directo.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react';
import { otraPersona, useApp, useRadio, useSesion } from '../contexto.js';
import { Avatar, Boton, EMOJIS_SALA, Hoja, Interruptor, Seccion, SelectorEmoji } from '../componentes/Base.jsx';
import { Atras, Mas } from '../componentes/Iconos.jsx';
import { ElegirAmigos } from '../componentes/Hojas.jsx';
import { atras, navegar } from '../lib/ruta.js';
import { errorNombreSala } from '../lib/validar.js';

export default function DetallesSala({ salaId }) {
  const { servicio, avisar } = useApp();
  const { yo, salas, amigos, recargar } = useSesion();
  const radio = useRadio();
  const sala = salas.find((s) => s.id === salaId);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(sala?.nombre ?? '');
  const [emoji, setEmoji] = useState(sala?.emoji ?? '📻');
  const [anadiendo, setAnadiendo] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!sala) navegar('/', { reemplazar: true });
  }, [sala]);
  if (!sala) return null;

  const directo = sala.tipo === 'directo';
  const otro = directo ? otraPersona(sala, yo) : null;
  const presentes = radio.presentes[salaId] ?? [];
  const ids = new Set(sala.miembros.map((m) => m.id));
  const fuera = amigos.filter((a) => !ids.has(a.id));

  async function hacer(accion, exito) {
    setOcupado(true);
    try {
      await accion();
      recargar();
      if (exito) exito();
    } catch (error) {
      avisar(error.message);
    } finally {
      setOcupado(false);
    }
  }

  const guardarNombre = () => {
    const error = errorNombreSala(nombre);
    if (error) return avisar(error);
    hacer(() => servicio.editarSala(salaId, { nombre: nombre.trim(), emoji }), () => setEditando(false));
  };

  const salir = () => {
    if (!window.confirm(`¿Salir de ${sala.nombre}? Dejarás de oír lo que hablen.`)) return;
    hacer(() => servicio.salirDeSala(salaId), () => navegar('/', { reemplazar: true }));
  };

  const eliminarAmigo = () => {
    if (!window.confirm(`¿Quitar a ${otro.nombre} de tus amigos?`)) return;
    hacer(() => servicio.eliminarAmigo(otro.id), () => navegar('/amigos', { reemplazar: true }));
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(env(safe-area-inset-bottom)+32px)]">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-hueso/95 px-2 pb-2 pt-[max(env(safe-area-inset-top),8px)] backdrop-blur-md">
        <button type="button" onClick={() => atras(`/sala/${salaId}`)} aria-label="Atrás" className="grid h-11 w-11 place-items-center rounded-full text-cuero active:bg-arena">
          <Atras className="h-7 w-7" />
        </button>
        <h1 className="text-[18px] font-black">{directo ? 'Chat' : 'Sala'}</h1>
      </header>

      <div className="px-4">
        <div className="tarjeta flex flex-col items-center px-5 py-6 text-center">
          {directo ? (
            <>
              <Avatar perfil={otro} tamano={104} presente={presentes.includes(otro?.id)} />
              <h2 className="mt-4 text-[26px] font-black leading-tight">{otro?.nombre}</h2>
              <p className="text-corteza">@{otro?.usuario}</p>
            </>
          ) : editando ? (
            <div className="w-full text-left">
              <SelectorEmoji opciones={EMOJIS_SALA} valor={emoji} alCambiar={setEmoji} etiqueta="Emoji de la sala" />
              <input className="campo mt-3" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
              <div className="mt-3 flex gap-2">
                <Boton className="flex-1" onClick={guardarNombre} cargando={ocupado}>Guardar</Boton>
                <Boton variante="fantasma" onClick={() => setEditando(false)}>Cancelar</Boton>
              </div>
            </div>
          ) : (
            <>
              <span className="grid h-24 w-24 place-items-center rounded-[30px] border border-lino bg-arena text-5xl shadow-hundido">{sala.emoji}</span>
              <h2 className="mt-4 text-[26px] font-black leading-tight">{sala.nombre}</h2>
              <Boton variante="suave" className="mt-3 min-h-[40px] px-4 text-[15px]" onClick={() => { setNombre(sala.nombre); setEmoji(sala.emoji); setEditando(true); }}>
                Cambiar nombre o emoji
              </Boton>
            </>
          )}
        </div>

        <Seccion>
          <div className="tarjeta overflow-hidden">
            <Interruptor
              etiqueta="Silenciar"
              descripcion="No sonará en directo ni te llegarán avisos. Los mensajes se siguen guardando."
              activo={sala.silenciada}
              disabled={ocupado}
              alCambiar={(valor) => hacer(() => servicio.silenciarSala(salaId, valor))}
            />
          </div>
        </Seccion>

        {!directo && (
          <Seccion titulo={`Personas (${sala.miembros.length})`}>
            <ul className="tarjeta divide-y divide-lino overflow-hidden">
              {sala.miembros.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar perfil={m} tamano={42} presente={m.id !== yo && presentes.includes(m.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{m.id === yo ? `${m.nombre} (tú)` : m.nombre}</span>
                    <span className="block truncate text-sm text-corteza">@{m.usuario}{m.rol === 'admin' ? ' · creó la sala' : ''}</span>
                  </span>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => { setElegidos([]); setAnadiendo(true); }} className="flex w-full items-center gap-3 px-3 py-3 text-left font-bold text-cuero active:bg-arena">
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-full border-2 border-dashed border-cuero/50"><Mas className="h-5 w-5" /></span>
                  Añadir amigos
                </button>
              </li>
            </ul>
          </Seccion>
        )}

        <Seccion>
          <Boton variante="suave" className="w-full" onClick={directo ? eliminarAmigo : salir} disabled={ocupado}>
            {directo ? 'Quitar de amigos' : 'Salir de la sala'}
          </Boton>
        </Seccion>
      </div>

      <Hoja abierta={anadiendo} alCerrar={() => setAnadiendo(false)} titulo="Añadir a la sala">
        <ElegirAmigos amigos={fuera} elegidos={elegidos} alCambiar={setElegidos} />
        {fuera.length > 0 && (
          <Boton
            className="mt-5 w-full"
            disabled={!elegidos.length}
            cargando={ocupado}
            onClick={() => hacer(() => servicio.anadirMiembros(salaId, elegidos), () => setAnadiendo(false))}
          >
            Añadir {elegidos.length > 0 && `(${elegidos.length})`}
          </Boton>
        )}
      </Hoja>
    </div>
  );
}
