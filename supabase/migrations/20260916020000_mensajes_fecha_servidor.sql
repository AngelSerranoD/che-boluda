-- Ché boluda — la fecha de los mensajes la pone siempre el servidor
-- Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
--
-- Con `grant insert` sobre la tabla entera, un cliente podía mandar su propio
-- creado_en: un mensaje fechado en 2099 dejaba la sala la primera de la lista
-- y pendiente para siempre en los móviles de los demás. Se permite insertar
-- solo las columnas que manda la app; creado_en toma siempre now().

revoke insert on public.mensajes from authenticated;
grant insert (id, sala_id, autor_id, audio, duracion_ms, onda) on public.mensajes to authenticated;
