-- Ché boluda — lo mínimo de Supabase para probar la migración en PGlite.
-- Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
--
-- Imita lo que la migración usa: roles, auth.uid(), auth.users, storage
-- (buckets, objects con RLS, foldername) y realtime (messages con RLS, topic).
-- El sujeto del JWT y el tema de Realtime se fijan con set_config.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema storage;
create schema realtime;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner_id text default auth.uid()::text
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  payload jsonb
);
alter table realtime.messages enable row level security;

create function realtime.topic() returns text
language sql stable
as $$ select current_setting('realtime.topic', true) $$;

create publication supabase_realtime;

grant usage on schema public, auth, storage, realtime to anon, authenticated, service_role;
grant execute on function auth.uid(), storage.foldername(text), realtime.topic() to anon, authenticated;
grant select, insert, update, delete on storage.objects, realtime.messages to anon, authenticated;
grant usage on all sequences in schema realtime to anon, authenticated;

-- Lo que hace Supabase de serie en public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
