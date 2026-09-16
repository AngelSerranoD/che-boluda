/**
 * Ché boluda — piezas pequeñas de interfaz: botón, avatar, insignia, hoja,
 * interruptor y selector de emoji.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { useEffect } from 'react';
import { cx } from '../lib/cx.js';
import { useAlturaTeclado } from '../hooks/useTeclado.js';
import { Cerrar, Girando } from './Iconos.jsx';

const VARIANTES = {
  principal:
    'bg-cuero text-blanco shadow-[inset_0_1.5px_0_rgba(255,255,255,0.28),0_10px_20px_-10px_rgba(74,53,38,0.7)] active:bg-corteza disabled:bg-piedra disabled:text-corteza disabled:shadow-none',
  suave: 'border border-lino bg-blanco text-tinta shadow-arcilla active:bg-arena disabled:opacity-50',
  plano: 'bg-arena text-tinta active:bg-lino disabled:opacity-50',
  fantasma: 'text-cuero active:bg-arena disabled:opacity-50',
};

export function Boton({ variante = 'principal', cargando = false, className, children, disabled, ...resto }) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || cargando}
      className={cx(
        'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-bold transition-transform active:scale-[0.98]',
        VARIANTES[variante],
        className
      )}
    >
      {cargando ? <Girando /> : children}
    </button>
  );
}

const FONDOS = ['bg-arena', 'bg-lino', 'bg-piedra', 'bg-blanco'];

function numeroDe(texto = '') {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ perfil, tamano = 44, presente = false, hablando = false, className }) {
  return (
    <span
      className={cx('relative inline-grid shrink-0 place-items-center rounded-full border border-lino shadow-arcilla', FONDOS[numeroDe(perfil?.id) % FONDOS.length], className)}
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.52) }}
    >
      {perfil?.foto ? (
        <img src={perfil.foto} alt="" className="h-full w-full rounded-full object-cover" draggable="false" />
      ) : (
        <span aria-hidden="true" className="leading-none">{perfil?.avatar ?? '🙂'}</span>
      )}
      {hablando && <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-cuero animate-onda" />}
      {presente && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-hueso bg-cuero"
          style={{ width: Math.max(10, tamano * 0.28), height: Math.max(10, tamano * 0.28) }}
          title="Con la app abierta"
        />
      )}
    </span>
  );
}

export function Insignia({ numero }) {
  if (!numero) return null;
  return (
    <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-cuero px-1.5 text-xs font-bold tabular-nums text-blanco">
      {numero > 99 ? '99+' : numero}
    </span>
  );
}

export function Hoja({ abierta, alCerrar, titulo, children }) {
  const teclado = useAlturaTeclado(abierta);

  useEffect(() => {
    if (!abierta) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierta, alCerrar]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 animate-fundido bg-tinta/35" onClick={alCerrar} />
      <div
        className="relative mx-auto flex max-h-[90dvh] w-full max-w-md animate-subir flex-col rounded-t-[32px] border-t border-blanco bg-hueso shadow-2xl"
        style={{ marginBottom: teclado }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-piedra" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[22px] font-black tracking-tight">{titulo}</h2>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-arena text-corteza active:bg-lino">
            <Cerrar className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-1">{children}</div>
      </div>
    </div>
  );
}

export function Interruptor({ activo, alCambiar, etiqueta, descripcion, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => alCambiar(!activo)}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-sm text-corteza">{descripcion}</span>}
      </span>
      <span className={cx('relative h-8 w-[52px] shrink-0 rounded-full border transition-colors', activo ? 'border-cuero bg-cuero' : 'border-piedra bg-lino')}>
        <span className={cx('absolute top-[3px] h-6 w-6 rounded-full bg-blanco shadow transition-transform', activo ? 'translate-x-[22px]' : 'translate-x-[3px]')} />
      </span>
    </button>
  );
}

export const AVATARES = ['🧉', '🦙', '🐱', '🐶', '🦊', '🐼', '🐸', '🦋', '🌸', '🌻', '🍓', '🍑', '🥑', '🍉', '⭐', '🌈', '🎧', '💅', '👽', '🦄'];
export const EMOJIS_SALA = ['📻', '🧉', '💅', '🎉', '🔥', '💬', '🏖️', '📚', '🍕', '⚽', '🎮', '🌙', '🎤', '🦄', '💃', '🚗'];

export function SelectorEmoji({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="sin-barra -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
      {opciones.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="radio"
          aria-checked={valor === emoji}
          onClick={() => alCambiar(emoji)}
          className={cx(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl transition-transform active:scale-95',
            valor === emoji ? 'border-cuero bg-lino shadow-hundido' : 'border-lino bg-blanco shadow-arcilla'
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function Seccion({ titulo, children, className }) {
  return (
    <section className={cx('mt-6', className)}>
      {titulo && <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wider text-corteza">{titulo}</h2>}
      {children}
    </section>
  );
}

export function ModoPrueba() {
  return (
    <p className="mx-auto mt-4 w-fit rounded-full border border-dashed border-cuero/60 px-3 py-1 text-xs font-semibold text-cuero">
      Modo de prueba · sin Supabase
    </p>
  );
}
