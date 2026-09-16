/**
 * Ché boluda — el botón de pulsar para hablar.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Con pointer capture el dedo puede salirse del botón sin cortar la emisión;
 * se corta al levantarlo, al cancelar el gesto el sistema o al perder la captura.
 * Con teclado: mantener Espacio o Intro.
 */
import { useRef } from 'react';
import { useApp, useRadio, useSesion, useTic } from '../contexto.js';
import { Rejilla } from './Iconos.jsx';
import { cx } from '../lib/cx.js';
import { duracion } from '../lib/tiempo.js';
import { DURACION_MAXIMA_MS } from '../lib/radio.js';

export default function BotonHablar({ sala, ocupado }) {
  const { avisar } = useApp();
  const { radio } = useSesion();
  const estado = useRadio();
  const pulsado = useRef(false);
  const emision = estado.emision?.sala === sala ? estado.emision : null;
  const otraSala = estado.emision && !emision;
  const hablando = emision?.estado === 'hablando';
  useTic(hablando, 200);

  async function empezar(e) {
    e.preventDefault();
    if (pulsado.current) return;
    if (ocupado) {
      avisar(`Espera: ${ocupado} está hablando`);
      return;
    }
    pulsado.current = true;
    try {
      if (e.pointerId !== undefined) e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* puntero ya liberado: se sigue sin captura */
    }
    try {
      await radio.hablar(sala);
    } catch (error) {
      pulsado.current = false;
      avisar(error.message);
    }
  }

  async function terminar() {
    if (!pulsado.current) return;
    pulsado.current = false;
    const resultado = await radio.soltar();
    if (resultado?.corto) avisar('Mantén pulsado mientras hablas 🎙️');
  }

  const ms = hablando ? Date.now() - emision.inicio : 0;
  const escala = hablando ? 1 + Math.min(1, emision.nivel) * 0.18 : 1;

  let texto = 'Mantén pulsado para hablar';
  if (emision?.estado === 'abriendo') texto = 'Abriendo el micro…';
  else if (hablando) texto = `${duracion(ms)} · suelta para enviar`;
  else if (emision?.estado === 'enviando') texto = 'Enviando…';
  else if (ocupado) texto = `${ocupado} está hablando…`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid h-[196px] w-[196px] place-items-center">
        {hablando && (
          <>
            <span className="absolute inset-3 rounded-[60px] bg-cuero/15 transition-transform duration-75" style={{ transform: `scale(${escala})` }} />
            <span className="absolute inset-3 animate-onda rounded-[60px] border-2 border-cuero/60" />
          </>
        )}
        <button
          type="button"
          aria-label="Mantén pulsado para hablar"
          aria-pressed={Boolean(emision)}
          disabled={Boolean(otraSala)}
          onPointerDown={empezar}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onLostPointerCapture={terminar}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && empezar(e)}
          onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && terminar()}
          onContextMenu={(e) => e.preventDefault()}
          className={cx(
            'sin-seleccion relative grid h-[168px] w-[168px] touch-none place-items-center rounded-[52px] border-2 transition-all duration-150',
            emision
              ? 'scale-[0.95] border-cuero bg-lino shadow-hundido'
              : 'border-piedra bg-hueso shadow-[inset_0_3px_0_rgba(255,255,255,0.95),0_2px_0_rgba(140,100,68,0.25),0_18px_30px_-12px_rgba(110,84,64,0.45)]',
            ocupado && !emision && 'opacity-60'
          )}
        >
          <span className={cx('grid h-[112px] w-[112px] place-items-center rounded-[36px] border', emision ? 'border-cuero/40 bg-piedra' : 'border-lino bg-arena shadow-hundido')}>
            <Rejilla className={cx('h-16 w-16', emision ? 'text-tinta' : 'text-cuero')} />
          </span>
        </button>
      </div>
      <p className={cx('mt-1 h-6 text-[15px] font-bold tabular-nums', hablando ? 'text-tinta' : 'text-corteza')} aria-live="polite">
        {texto}
      </p>
      {hablando && ms > DURACION_MAXIMA_MS - 10_000 && (
        <p className="text-xs text-cuero">Se corta sola al minuto</p>
      )}
    </div>
  );
}
