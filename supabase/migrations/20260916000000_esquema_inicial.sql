-- Ché boluda — esquema inicial de Supabase
-- Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
--
-- Modelo:
--   perfiles        uno por usuario de Auth (lo crea un trigger al registrarse)
--   codigos         código de invitación de cada perfil (solo lo ve su dueño)
--   amistades       pares de amigos, guardados con a < b
--   salas           'grupo' (con nombre) o 'directo' (chat entre dos amigos)
--   miembros        quién está en cada sala, hasta dónde ha escuchado y si la silencia
--   mensajes        cada transmisión guardada; el audio va al bucket 'audios'
--   suscripciones_push  dispositivos a los que avisar (Web Push)
--
-- La voz en directo no pasa por la base de datos: viaja por Realtime Broadcast
-- en canales privados 'sala:<id>', protegidos con las políticas del final.
-- Todo lo que crea filas en nombre de otros (amistades, salas, miembros) va por
-- funciones SECURITY DEFINER que comprueban las reglas; las tablas no aceptan
-- esos INSERT directos.

-- ═════════════════════════════ Utilidades ═════════════════════════════

-- 8 caracteres sin I, L, O, 0 ni 1. El azar sale de gen_random_uuid(), que usa
-- el generador criptográfico del servidor; se saltan los bytes 6 y 8 del UUID,
-- que llevan fijos la versión y la variante.
create or replace function public.nuevo_codigo()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes constant bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  posiciones constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9];
  codigo text := '';
  p int;
begin
  foreach p in array posiciones loop
    codigo := codigo || substr(alfabeto, 1 + get_byte(bytes, p) % 31, 1);
  end loop;
  return codigo;
end
$$;

-- ═════════════════════════════ Tablas ═════════════════════════════

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique
    check (usuario ~ '^[a-z0-9_.]{3,20}$' and usuario !~ '^\.|\.$|\.\.'),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  avatar text not null default '🧉' check (char_length(avatar) between 1 and 16),
  foto text check (foto is null or char_length(foto) <= 300),
  creado_en timestamptz not null default now()
);

create table public.codigos (
  perfil_id uuid primary key references public.perfiles (id) on delete cascade,
  codigo text not null unique default public.nuevo_codigo()
);

create table public.amistades (
  a uuid not null references public.perfiles (id) on delete cascade,
  b uuid not null references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index amistades_b on public.amistades (b);

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('grupo', 'directo')),
  nombre text check (nombre is null or char_length(btrim(nombre)) between 1 and 40),
  emoji text not null default '📻' check (char_length(emoji) between 1 and 16),
  clave_directo text unique,
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  ultima_actividad timestamptz not null default now(),
  check ((tipo = 'grupo') = (nombre is not null)),
  check ((tipo = 'directo') = (clave_directo is not null))
);

create table public.miembros (
  sala_id uuid not null references public.salas (id) on delete cascade,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  silenciada boolean not null default false,
  ultimo_leido timestamptz not null default now(),
  unido_en timestamptz not null default now(),
  primary key (sala_id, perfil_id)
);
create index miembros_perfil on public.miembros (perfil_id);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.salas (id) on delete cascade,
  autor_id uuid references public.perfiles (id) on delete set null,
  audio text not null,
  duracion_ms integer not null check (duracion_ms between 1 and 120000),
  onda smallint[] not null default '{}' check (cardinality(onda) <= 64),
  creado_en timestamptz not null default now()
);
create index mensajes_sala_fecha on public.mensajes (sala_id, creado_en desc);

create table public.suscripciones_push (
  endpoint text primary key check (endpoint like 'https://%'),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);
create index suscripciones_perfil on public.suscripciones_push (perfil_id);

-- ═════════════════════════════ Triggers ═════════════════════════════

-- Al registrarse con signUp({ options: { data: { usuario, nombre, avatar } } }).
-- Si falta el usuario (alta desde el panel de Supabase) se toma del email.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  datos constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_usuario constant text := lower(coalesce(datos ->> 'usuario', split_part(new.email, '@', 1)));
begin
  insert into public.perfiles (id, usuario, nombre, avatar)
  values (
    new.id,
    v_usuario,
    btrim(coalesce(nullif(btrim(datos ->> 'nombre'), ''), v_usuario)),
    coalesce(nullif(datos ->> 'avatar', ''), '🧉')
  );
  insert into public.codigos (perfil_id) values (new.id);
  return new;
end
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

create or replace function public.anotar_actividad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.salas set ultima_actividad = new.creado_en where id = new.sala_id;
  return new;
end
$$;

create trigger anotar_actividad_al_hablar
  after insert on public.mensajes
  for each row execute function public.anotar_actividad();

-- ═════════════════════════════ Comprobaciones para RLS ═════════════════════════════
-- SECURITY DEFINER para que las políticas no se llamen a sí mismas en bucle.

create or replace function public.es_miembro(p_sala uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros where sala_id = p_sala and perfil_id = auth.uid()
  )
$$;

-- Variante para rutas de Storage y temas de Realtime, que llegan como texto.
-- Compara como texto: un valor que no sea UUID da false en vez de un error.
create or replace function public.es_miembro_texto(p_sala text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros where sala_id::text = p_sala and perfil_id = auth.uid()
  )
$$;

create or replace function public.son_amigos(p_uno uuid, p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amistades
    where a = least(p_uno, p_otro) and b = greatest(p_uno, p_otro)
  )
$$;

create or replace function public.comparte_sala(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros yo
    join public.miembros otro on otro.sala_id = yo.sala_id
    where yo.perfil_id = auth.uid() and otro.perfil_id = p_otro
  )
$$;

-- ═════════════════════════════ Políticas (RLS) ═════════════════════════════

alter table public.perfiles enable row level security;
alter table public.codigos enable row level security;
alter table public.amistades enable row level security;
alter table public.salas enable row level security;
alter table public.miembros enable row level security;
alter table public.mensajes enable row level security;
alter table public.suscripciones_push enable row level security;

-- Se ve tu perfil, el de tus amigos y el de quien comparte sala contigo.
create policy "perfiles: ver conocidos" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.son_amigos(auth.uid(), id) or public.comparte_sala(id));

create policy "perfiles: editar el propio" on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "codigos: ver el propio" on public.codigos
  for select to authenticated
  using (perfil_id = auth.uid());

create policy "amistades: ver las propias" on public.amistades
  for select to authenticated
  using (auth.uid() in (a, b));

create policy "amistades: borrar las propias" on public.amistades
  for delete to authenticated
  using (auth.uid() in (a, b));

create policy "salas: ver si eres miembro" on public.salas
  for select to authenticated
  using (public.es_miembro(id));

create policy "salas: renombrar grupos donde estás" on public.salas
  for update to authenticated
  using (tipo = 'grupo' and public.es_miembro(id))
  with check (tipo = 'grupo' and public.es_miembro(id));

create policy "miembros: ver los de tus salas" on public.miembros
  for select to authenticated
  using (public.es_miembro(sala_id));

create policy "miembros: tocar tu propia fila" on public.miembros
  for update to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

-- Salir de un grupo. De un chat directo no se sale: se borra la amistad.
create policy "miembros: salir de un grupo" on public.miembros
  for delete to authenticated
  using (
    perfil_id = auth.uid()
    and exists (select 1 from public.salas s where s.id = sala_id and s.tipo = 'grupo')
  );

create policy "mensajes: oír los de tus salas" on public.mensajes
  for select to authenticated
  using (public.es_miembro(sala_id));

create policy "mensajes: hablar en tus salas" on public.mensajes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.es_miembro(sala_id)
    and audio like sala_id::text || '/%'
  );

create policy "mensajes: borrar los tuyos" on public.mensajes
  for delete to authenticated
  using (autor_id = auth.uid());

create policy "push: ver las propias" on public.suscripciones_push
  for select to authenticated
  using (perfil_id = auth.uid());

create policy "push: borrar las propias" on public.suscripciones_push
  for delete to authenticated
  using (perfil_id = auth.uid());

-- ═════════════════════════════ Permisos por columna ═════════════════════════════
-- Supabase da todo a anon y authenticated por defecto. Se recorta a lo justo:
-- el usuario, el código y las claves no se tocan desde el cliente.

revoke all on public.perfiles, public.codigos, public.amistades, public.salas,
  public.miembros, public.mensajes, public.suscripciones_push from anon, authenticated;

grant select on public.perfiles to authenticated;
grant update (nombre, avatar, foto) on public.perfiles to authenticated;
grant select on public.codigos to authenticated;
grant select, delete on public.amistades to authenticated;
grant select on public.salas to authenticated;
grant update (nombre, emoji) on public.salas to authenticated;
grant select, delete on public.miembros to authenticated;
grant update (silenciada) on public.miembros to authenticated;
grant select, insert, delete on public.mensajes to authenticated;
grant select, delete on public.suscripciones_push to authenticated;

-- ═════════════════════════════ Funciones para la app ═════════════════════════════

create or replace function public.usuario_disponible(p_usuario text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.perfiles where usuario = lower(btrim(p_usuario)))
$$;

-- Para la página de invitación, que puede abrirse sin sesión.
create or replace function public.ver_invitacion(p_codigo text)
returns table (usuario text, nombre text, avatar text, foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.usuario, p.nombre, p.avatar, p.foto
  from public.codigos c
  join public.perfiles p on p.id = c.perfil_id
  where c.codigo = upper(btrim(p_codigo))
$$;

create or replace function public.aceptar_invitacion(p_codigo text)
returns table (id uuid, usuario text, nombre text, avatar text, foto text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_yo constant uuid := auth.uid();
  v_otro uuid;
begin
  if v_yo is null then
    raise exception 'Hay que iniciar sesión' using errcode = '28000';
  end if;
  select c.perfil_id into v_otro from public.codigos c where c.codigo = upper(btrim(p_codigo));
  if v_otro is null then
    raise exception 'Invitación no válida' using errcode = 'P0002';
  end if;
  if v_otro = v_yo then
    raise exception 'Es tu propia invitación' using errcode = '22023';
  end if;
  insert into public.amistades (a, b)
  values (least(v_yo, v_otro), greatest(v_yo, v_otro))
  on conflict do nothing;
  return query
    select p.id, p.usuario, p.nombre, p.avatar, p.foto from public.perfiles p where p.id = v_otro;
end
$$;

create or replace function public.regenerar_codigo()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  update public.codigos set codigo = public.nuevo_codigo()
  where perfil_id = auth.uid()
  returning codigo into v_codigo;
  return v_codigo;
end
$$;

-- Devuelve la sala del chat directo con un amigo, creándola la primera vez.
create or replace function public.abrir_directo(p_amigo uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_yo constant uuid := auth.uid();
  v_clave text;
  v_sala uuid;
begin
  if v_yo is null then
    raise exception 'Hay que iniciar sesión' using errcode = '28000';
  end if;
  if not public.son_amigos(v_yo, p_amigo) then
    raise exception 'Solo puedes hablar con tus amigos' using errcode = '42501';
  end if;
  v_clave := least(v_yo, p_amigo)::text || ':' || greatest(v_yo, p_amigo)::text;

  insert into public.salas (tipo, clave_directo, creado_por)
  values ('directo', v_clave, v_yo)
  on conflict (clave_directo) do nothing
  returning id into v_sala;
  if v_sala is null then
    select s.id into v_sala from public.salas s where s.clave_directo = v_clave;
  end if;

  insert into public.miembros (sala_id, perfil_id)
  values (v_sala, v_yo), (v_sala, p_amigo)
  on conflict do nothing;
  return v_sala;
end
$$;

create or replace function public.crear_sala(p_nombre text, p_emoji text, p_miembros uuid[])
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_yo constant uuid := auth.uid();
  v_sala uuid;
begin
  if v_yo is null then
    raise exception 'Hay que iniciar sesión' using errcode = '28000';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_miembros, '{}')) m
    where m <> v_yo and not public.son_amigos(v_yo, m)
  ) then
    raise exception 'Solo puedes añadir a tus amigos' using errcode = '42501';
  end if;

  insert into public.salas (tipo, nombre, emoji, creado_por)
  values ('grupo', btrim(p_nombre), coalesce(nullif(btrim(p_emoji), ''), '📻'), v_yo)
  returning id into v_sala;

  insert into public.miembros (sala_id, perfil_id, rol) values (v_sala, v_yo, 'admin');
  insert into public.miembros (sala_id, perfil_id)
  select distinct v_sala, m from unnest(coalesce(p_miembros, '{}')) m where m <> v_yo
  on conflict do nothing;
  return v_sala;
end
$$;

-- Cualquiera que esté en un grupo puede meter a SUS amigos.
create or replace function public.anadir_miembros(p_sala uuid, p_miembros uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_yo constant uuid := auth.uid();
begin
  if not exists (
    select 1 from public.salas s
    join public.miembros m on m.sala_id = s.id and m.perfil_id = v_yo
    where s.id = p_sala and s.tipo = 'grupo'
  ) then
    raise exception 'No estás en esa sala' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_miembros, '{}')) m
    where m <> v_yo and not public.son_amigos(v_yo, m)
  ) then
    raise exception 'Solo puedes añadir a tus amigos' using errcode = '42501';
  end if;
  insert into public.miembros (sala_id, perfil_id)
  select distinct p_sala, m from unnest(p_miembros) m where m <> v_yo
  on conflict do nothing;
end
$$;

-- Con la hora del servidor: el reloj del móvil puede ir desfasado.
create or replace function public.marcar_leido(p_sala uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.miembros set ultimo_leido = now()
  where sala_id = p_sala and perfil_id = auth.uid()
$$;

-- El mismo iPhone puede cambiar de cuenta: la suscripción pasa a la nueva.
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión' using errcode = '28000';
  end if;
  insert into public.suscripciones_push (endpoint, perfil_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set perfil_id = excluded.perfil_id, p256dh = excluded.p256dh, auth = excluded.auth, creado_en = now();
end
$$;

-- Todo lo que pinta la lista de salas en una sola consulta (con RLS del que llama).
create or replace function public.listar_salas()
returns table (
  id uuid,
  tipo text,
  nombre text,
  emoji text,
  ultima_actividad timestamptz,
  silenciada boolean,
  ultimo_leido timestamptz,
  no_leidos integer,
  ultimo jsonb,
  miembros jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id, s.tipo, s.nombre, s.emoji, s.ultima_actividad, yo.silenciada, yo.ultimo_leido,
    (
      select count(*)::integer from (
        select 1 from public.mensajes m
        where m.sala_id = s.id and m.creado_en > yo.ultimo_leido
          and m.autor_id is distinct from auth.uid()
        limit 99
      ) pendientes
    ),
    (
      select jsonb_build_object('autor_id', m.autor_id, 'duracion_ms', m.duracion_ms, 'creado_en', m.creado_en)
      from public.mensajes m where m.sala_id = s.id
      order by m.creado_en desc limit 1
    ),
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'usuario', p.usuario, 'nombre', p.nombre,
        'avatar', p.avatar, 'foto', p.foto, 'rol', mm.rol
      ) order by mm.unido_en), '[]'::jsonb)
      from public.miembros mm
      join public.perfiles p on p.id = mm.perfil_id
      where mm.sala_id = s.id
    )
  from public.salas s
  join public.miembros yo on yo.sala_id = s.id and yo.perfil_id = auth.uid()
  order by s.ultima_actividad desc
$$;

-- Para el servidor de avisos (service_role): el número del icono de cada destinatario.
create or replace function public.no_leidos_de(p_perfiles uuid[])
returns table (perfil_id uuid, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select mb.perfil_id, count(m.id)::integer
  from public.miembros mb
  join public.mensajes m
    on m.sala_id = mb.sala_id
   and m.creado_en > mb.ultimo_leido
   and m.autor_id is distinct from mb.perfil_id
  where mb.perfil_id = any(p_perfiles)
  group by mb.perfil_id
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.no_leidos_de(uuid[]) to service_role;
grant execute on function
  public.es_miembro(uuid), public.es_miembro_texto(text), public.son_amigos(uuid, uuid),
  public.comparte_sala(uuid), public.aceptar_invitacion(text), public.regenerar_codigo(),
  public.abrir_directo(uuid), public.crear_sala(text, text, uuid[]),
  public.anadir_miembros(uuid, uuid[]), public.marcar_leido(uuid),
  public.guardar_suscripcion(text, text, text), public.listar_salas()
  to authenticated;
grant execute on function public.usuario_disponible(text), public.ver_invitacion(text)
  to anon, authenticated;

-- ═════════════════════════════ Storage ═════════════════════════════
-- audios/<sala>/<mensaje>.cba   privado, solo miembros de la sala
-- avatares/<perfil>/<marca>.jpg público (se ven en la página de invitación)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audios', 'audios', false, 1048576, array['application/octet-stream']),
  ('avatares', 'avatares', true, 262144, array['image/jpeg'])
on conflict (id) do nothing;

create policy "audios: oír los de tus salas" on storage.objects
  for select to authenticated
  using (bucket_id = 'audios' and public.es_miembro_texto((storage.foldername(name))[1]));

create policy "audios: subir a tus salas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audios' and public.es_miembro_texto((storage.foldername(name))[1]));

create policy "audios: borrar los tuyos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audios' and owner_id = auth.uid()::text);

create policy "avatares: ver la carpeta propia" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatares: subir a la carpeta propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatares: borrar de la carpeta propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═════════════════════════════ Realtime ═════════════════════════════
-- Canales privados 'sala:<id>' para la voz (broadcast) y quién está (presence).

create policy "voz: escuchar tus salas" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'sala:%'
    and public.es_miembro_texto(substr(realtime.topic(), 6))
  );

create policy "voz: hablar en tus salas" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'sala:%'
    and public.es_miembro_texto(substr(realtime.topic(), 6))
  );

-- Cambios de tablas para refrescar listas (respetan la RLS de cada cliente).
alter publication supabase_realtime add table public.mensajes, public.miembros, public.amistades;
