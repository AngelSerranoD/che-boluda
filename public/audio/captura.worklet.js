/* Ché boluda · captura del micrófono en el hilo de audio
   Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.

   Solo junta muestras en trozos de 2048 (unos 43 ms a 48 kHz) y los pasa al
   hilo principal, que los diezma a 16 kHz y los codifica. Así el diezmador y
   el códec se prueban con node --test y aquí no hay lógica que se pueda romper. */

const TAMANO = 2048;

class CapturaCheBoluda extends AudioWorkletProcessor {
  constructor() {
    super();
    this.trozo = new Float32Array(TAMANO);
    this.lleno = 0;
    this.vivo = true;
    this.port.onmessage = (evento) => {
      if (evento.data !== 'fin') return;
      if (this.lleno) this.port.postMessage(this.trozo.slice(0, this.lleno));
      this.port.postMessage('fin');
      this.vivo = false;
    };
  }

  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (canal && this.vivo) {
      for (let i = 0; i < canal.length; i++) {
        this.trozo[this.lleno++] = canal[i];
        if (this.lleno === TAMANO) {
          this.port.postMessage(this.trozo, [this.trozo.buffer]);
          this.trozo = new Float32Array(TAMANO);
          this.lleno = 0;
        }
      }
    }
    return this.vivo;
  }
}

registerProcessor('captura-cheboluda', CapturaCheBoluda);
