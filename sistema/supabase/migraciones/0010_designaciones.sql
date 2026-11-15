-- =====================================================================
-- Agenda de Móviles · 0010 · Catálogo de designaciones y excepciones
--
-- · Si se agenda (o se cambia) con una designación cuyo nombre no está en
--   el catálogo del SAE ni entre sus formas de escribirla, queda registrada
--   como excepción pendiente. Nunca bloquea al cargador.
-- · El General (o el Super Admin) decide: agregarla como nueva, tomarla como
--   otra forma de escribir una existente, o descartarla.
-- · El General también edita el catálogo (agregar, formas de escribir,
--   activar o desactivar).
-- =====================================================================

-- Nombre de una designación sin el número ni signos: «Gral. Paz 21» → GRALPAZ
create or replace function public.nombre_designacion(p text)
returns text language sql immutable set search_path = '' as $$
  -- Las tildes y la Ñ pasan a la letra base (como hace la búsqueda de la app): «Halcón» → HALCON
  select nullif(regexp_replace(translate(upper(regexp_replace(coalesce(p, ''), '\s*\d+\s*$', '')), 'ÁÉÍÓÚÜÀÈÌÒÙÑ', 'AEIOUUAEIOUN'), '[^A-Z]', '', 'g'), '');
$$;

-- ¿Ese nombre está en el catálogo (como nombre o forma de escribirlo)?
create or replace function public.designacion_conocida(p_nombre text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_nombre is null or exists (
    select 1 from public.designacion d
     where public.nombre_designacion(d.nombre) = p_nombre
        or exists (select 1 from unnest(d.alias) a where public.nombre_designacion(a) = p_nombre));
$$;

create table if not exists public.designacion_excepcion (
  id           bigint generated always as identity primary key,
  nombre       text not null,                         -- nombre normalizado (sin número)
  ejemplo      text not null,                         -- cómo se escribió la primera vez (con número)
  usos         int not null default 1,
  ultima_vez   timestamptz not null default now(),
  movil        uuid references public.movil(id),      -- último móvil que la usó
  unidad       text references public.unidad(id),
  cargado_por  uuid references public.perfil(id),
  creado_en    timestamptz not null default now(),
  estado       text not null default 'pendiente' check (estado in ('pendiente','agregada','alias','descartada')),
  resuelta_como text,                                 -- designación del catálogo con la que se resolvió
  resuelto_por uuid references public.perfil(id),
  resuelto_en  timestamptz
);
create unique index if not exists designacion_excepcion_pendiente on public.designacion_excepcion (nombre) where estado = 'pendiente';

alter table public.designacion_excepcion enable row level security;
drop policy if exists "leer" on public.designacion_excepcion;
create policy "leer" on public.designacion_excepcion for select to authenticated using (public.cuenta_activa());

-- Al guardar un servicio con designación desconocida, se anota (o se suma un uso)
create or replace function public.anotar_excepcion_designacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nombre text := public.nombre_designacion(new.designacion);
begin
  if v_nombre is null or public.designacion_conocida(v_nombre) then return new; end if;
  if tg_op = 'UPDATE' and new.designacion is not distinct from old.designacion then return new; end if;
  insert into public.designacion_excepcion (nombre, ejemplo, movil, unidad, cargado_por)
  values (v_nombre, upper(trim(new.designacion)), new.movil, new.unidad, auth.uid())
  on conflict (nombre) where estado = 'pendiente'
  do update set usos = public.designacion_excepcion.usos + 1, ultima_vez = now(), movil = excluded.movil, unidad = excluded.unidad;
  return new;
end $$;
drop trigger if exists servicio_designacion_excepcion on public.servicio;
create trigger servicio_designacion_excepcion after insert or update of designacion on public.servicio
  for each row execute function public.anotar_excepcion_designacion();

-- ---------- Decisiones del General ----------
create or replace function public.es_general()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.mi_rol() in ('superadmin','general'), false);
$$;

create or replace function public.guardar_designacion(p_nombre text, p_zona text, p_unidad text, p_alias text[], p_activa boolean, p_original text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nombre text := upper(trim(p_nombre)); v_alias text[];
begin
  if not public.es_general() then raise exception 'Solo el General edita el catálogo.'; end if;
  if v_nombre is null or v_nombre = '' or v_nombre ~ '\d' then raise exception 'Escribí el nombre, sin número (ej. ALBERDI).'; end if;
  select coalesce(array_agg(distinct upper(trim(a))) filter (where trim(a) <> '' and upper(trim(a)) <> v_nombre), '{}') into v_alias from unnest(coalesce(p_alias, '{}')) a;
  if p_original is null then
    if exists (select 1 from public.designacion where nombre = v_nombre) then raise exception 'Esa designación ya está en el catálogo.'; end if;
    insert into public.designacion (nombre, zona, unidad, alias, activa, origen)
    values (v_nombre, nullif(trim(p_zona), ''), nullif(p_unidad, ''), v_alias, coalesce(p_activa, true), 'app');
  else
    if v_nombre <> p_original and exists (select 1 from public.designacion where nombre = v_nombre) then raise exception 'Ya hay otra designación con ese nombre.'; end if;
    update public.designacion set nombre = v_nombre, zona = nullif(trim(p_zona), ''), unidad = nullif(p_unidad, ''), alias = v_alias, activa = coalesce(p_activa, true)
     where nombre = p_original;
    if not found then raise exception 'La designación no existe.'; end if;
  end if;
  -- Las excepciones pendientes que ahora se reconocen se cierran solas
  update public.designacion_excepcion set estado = 'alias', resuelta_como = v_nombre, resuelto_por = auth.uid(), resuelto_en = now()
   where estado = 'pendiente' and (nombre = public.nombre_designacion(v_nombre) or nombre in (select public.nombre_designacion(a) from unnest(v_alias) a));
end $$;

create or replace function public.resolver_excepcion(p_id bigint, p_accion text, p_designacion text default null, p_zona text default null, p_unidad text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.designacion_excepcion; v_nombre text;
begin
  if not public.es_general() then raise exception 'Solo el General resuelve las excepciones.'; end if;
  select * into e from public.designacion_excepcion where id = p_id and estado = 'pendiente' for update;
  if not found then raise exception 'Esa excepción ya se resolvió.'; end if;
  if p_accion = 'agregar' then
    v_nombre := upper(trim(coalesce(nullif(p_designacion, ''), regexp_replace(e.ejemplo, '\s*\d+\s*$', ''))));
    if exists (select 1 from public.designacion where nombre = v_nombre) then raise exception 'Ya existe: usá «Es otra forma de escribir».'; end if;
    insert into public.designacion (nombre, zona, unidad, alias, activa, origen)
    values (v_nombre, nullif(trim(p_zona), ''), coalesce(nullif(p_unidad, ''), (select id from public.unidad where id = e.unidad and tipo = 'division')),
            case when public.nombre_designacion(v_nombre) <> e.nombre then array[e.nombre] else '{}' end, true, 'app');
    update public.designacion_excepcion set estado = 'agregada', resuelta_como = v_nombre, resuelto_por = auth.uid(), resuelto_en = now() where id = p_id;
  elsif p_accion = 'alias' then
    if not exists (select 1 from public.designacion where nombre = p_designacion) then raise exception 'Elegí la designación del catálogo.'; end if;
    update public.designacion set alias = (select array_agg(distinct x) from unnest(alias || array[e.nombre]) x) where nombre = p_designacion;
    update public.designacion_excepcion set estado = 'alias', resuelta_como = p_designacion, resuelto_por = auth.uid(), resuelto_en = now() where id = p_id;
  elsif p_accion = 'descartar' then
    update public.designacion_excepcion set estado = 'descartada', resuelto_por = auth.uid(), resuelto_en = now() where id = p_id;
  else
    raise exception 'Acción desconocida.';
  end if;
end $$;

-- El catálogo ahora se edita solo por estas funciones
drop policy if exists "administrar designaciones" on public.designacion;

do $$ declare f text; begin
  foreach f in array array['public.nombre_designacion(text)', 'public.designacion_conocida(text)', 'public.anotar_excepcion_designacion()',
    'public.es_general()', 'public.guardar_designacion(text,text,text,text[],boolean,text)', 'public.resolver_excepcion(bigint,text,text,text,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.anotar_excepcion_designacion() from authenticated;
grant execute on function public.nombre_designacion(text), public.designacion_conocida(text), public.es_general(),
  public.guardar_designacion(text,text,text,text[],boolean,text), public.resolver_excepcion(bigint,text,text,text,text) to authenticated;
