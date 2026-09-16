/**
 * Ché boluda — cabecera grande de las pestañas.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

export function Cabecera({ titulo, accion }) {
  return (
    <header className="sticky top-0 z-20 bg-hueso/90 px-5 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur-md">
      <div className="flex h-10 items-center justify-between">
        <span className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[10px] border border-lino" />
          <span className="text-[15px] font-bold text-cuero">ché boluda</span>
        </span>
        {accion}
      </div>
      <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight">{titulo}</h1>
    </header>
  );
}
