# Ché boluda

Walkie-talkie para hablar con amigos: salas y chats donde lo que dices suena al momento en los móviles de los demás. PWA para iPhone.

© 2026 Ángel Serrano Domínguez. Todos los derechos reservados. Ver [LICENSE](LICENSE).

## Qué hace

- **Perfil propio**: nombre, @usuario, avatar con emoji o foto. Se entra con usuario y contraseña (sin correo).
- **Amigos por enlace de WhatsApp**: cada perfil tiene un enlace `/i/<código>`. Quien lo abre y crea su cuenta queda agregado. También se puede pegar el enlace o el código dentro de la app.
- **Salas**: se crean con nombre y emoji y se mete a los amigos. Mantienes pulsado, hablas y todos los que tengan la app abierta te oyen **en directo**.
- **Chats individuales** con cada amigo, con el mismo botón de walkie.
- **Nada se pierde**: cada transmisión se guarda. Quien no estaba recibe un **aviso push** y la oye después («Escuchar nuevos»).
- Presencia («con la app abierta»), aviso flotante de quién está hablando en otra sala, silenciar salas, número de pendientes en el icono.
- Sonidos de walkie sintetizados: pitido al abrir canal y «chsss» de squelch al soltar.

## Cómo funciona la voz

```
micro ─► AudioWorklet ─► diezmado a 16 kHz ─► IMA ADPCM (8 kB/s) ─► bloques de 300 ms
                                                                       │
          Supabase Realtime Broadcast, canal privado 'sala:<id>' ◄─────┤ (solo si hay alguien)
                                                                       │
          al soltar: archivo .cba en Storage + fila en `mensajes` ◄────┘ ─► /api/avisar ─► Web Push
```

El protocolo, la decisión de no emitir sin oyentes y el manejo del audio en iOS están comentados en `src/lib/radio.js` y `src/lib/audio/motor.js`.

## Puesta en marcha (una vez)

### 1. Supabase

Proyecto actual: `che-boluda` (ref `hqxjxbzpfmjhxxgrnmsp`, región eu-west-3), con las tres migraciones ya aplicadas.

1. Crear un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. **Authentication → Sign In / Providers → Email**: desactivar **Confirm email**. La app usa usuario y contraseña y no manda correos.
3. Aplicar **en orden** los archivos de `supabase/migrations/` (SQL Editor, `supabase db push` o el MCP de Supabase).
4. **Project Settings → API Keys**: copiar la URL, la clave publicable y la secreta (`service_role`).

### 2. Claves de avisos

```bash
npm run vapid
```

### 3. Variables

- `.env.local` (desarrollo): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- Vercel (Settings → Environment Variables): las tres anteriores **más** `SUPABASE_SERVICE_ROLE_KEY` y `VAPID_PRIVATE_KEY`.

Ver `.env.example`.

## Desarrollo

```bash
npm install
npm run dev          # sin .env.local arranca en «modo de prueba» local
npm test             # códec, utilidades, aviso push y la migración SQL sobre PGlite
npm run build
npm run preview      # la build con las mismas cabeceras que Vercel (CSP incluida)
npm run iconos       # regenera public/icons desde assets/icono-original.png (Pillow)
```

**Modo de prueba**: sin Supabase, los datos van a `localStorage` y cada pestaña del navegador es una persona distinta (la sesión va en `sessionStorage`). Con dos pestañas se prueban invitaciones, salas y voz en directo. Para emitir sin micrófono, en desarrollo: `localStorage.setItem('cheboluda:micro-falso', '1')` o `?micro=falso`.

## Estructura

```
src/
  lib/audio/          adpcm, contenedor (bloques y archivo), señal, micrófono, motor (iOS + sonidos)
  lib/radio.js        sintoniza todas las salas, emite y reproduce en directo
  lib/reproductor.js  mensajes guardados, en cola
  lib/servicio/       supabase.js y local.js con la misma interfaz
  lib/push.js         Web Push, insignia, detección de app instalada
  pantallas/          Acceso, Invitacion, Sesion, Inicio, Salas, Amigos, Perfil, Canal, DetallesSala
  componentes/        BotonHablar, Burbuja, EnElAire, Hojas, Base, Iconos
servidor/avisar.js    lógica del aviso push (probada sin red)
api/avisar.js         función de Vercel
supabase/migrations/  tablas, RLS, funciones, Storage y políticas de Realtime
public/sw.js          caché offline de la interfaz y recepción de avisos
public/audio/         worklet de captura
```

## Instalar en el iPhone

Abrir la web en Safari → Compartir → **Añadir a pantalla de inicio**. Los avisos solo funcionan así (iOS 16.4 o posterior).

## Límites conocidos

- iOS congela las PWA en segundo plano: la voz **en directo** solo suena con la app abierta. Con la app cerrada llega el aviso y el mensaje queda guardado.
- El plan gratuito de Supabase da 1 GB de Storage (unas 35 horas de voz) y 2 millones de mensajes de Realtime al mes.
- Sin correo no hay «he olvidado mi contraseña»: se cambia desde el panel de Supabase (Authentication → Users).
