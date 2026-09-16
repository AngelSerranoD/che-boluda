-- Ché boluda — las funciones auxiliares de la RLS salen de la API pública
-- Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
--
-- es_miembro, es_miembro_texto, son_amigos y comparte_sala son SECURITY DEFINER
-- y estaban en `public`, así que PostgREST las publicaba como /rest/v1/rpc/…
-- (aviso 0029 del linter de Supabase). Con son_amigos(a, b) cualquiera con
-- sesión podía preguntar si dos personas cualesquiera son amigas.
--
-- Se mueven a `privado`, que no está expuesto en la API. Las políticas las
-- referencian por OID y siguen funcionando; authenticated conserva USAGE y
-- EXECUTE porque las políticas se evalúan con su rol. Las funciones plpgsql
-- que llamaban a public.son_amigos por nombre se recrean apuntando a privado.

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

alter function public.es_miembro(uuid) set schema privado;
alter function public.es_miembro_texto(text) set schema privado;
alter function public.son_amigos(uuid, uuid) set schema privado;
alter function public.comparte_sala(uuid) set schema privado;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated;

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
  if not privado.son_amigos(v_yo, p_amigo) then
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
    where m <> v_yo and not privado.son_amigos(v_yo, m)
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
    where m <> v_yo and not privado.son_amigos(v_yo, m)
  ) then
    raise exception 'Solo puedes añadir a tus amigos' using errcode = '42501';
  end if;
  insert into public.miembros (sala_id, perfil_id)
  select distinct p_sala, m from unnest(p_miembros) m where m <> v_yo
  on conflict do nothing;
end
$$;
