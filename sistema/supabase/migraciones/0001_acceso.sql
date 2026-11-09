-- =====================================================================
-- Agenda de Móviles · 0001 · Acceso, usuarios y auditoría
-- Se corre una sola vez en Supabase: SQL Editor → pegar → Run.
-- =====================================================================

-- ---------- Estructura orgánica (Dirección → Departamento → División) ----------
create table if not exists public.unidad (
  id      text primary key,
  nombre  text not null,
  tipo    text not null check (tipo in ('general','direccion','departamento','division')),
  padre   text references public.unidad(id),
  orden   int  not null default 0
);

insert into public.unidad (id, nombre, tipo, padre, orden) values
  ('G',   'Dirección General de Policía Territorial y Proximidad', 'general', null, 0),
  ('N',   'Dirección Prevención Ciudadana Norte', 'direccion', 'G', 1),
  ('S',   'Dirección Prevención Ciudadana Sur',   'direccion', 'G', 2),
  ('M',   'Dirección Monitoreo Cordobeses en Alerta', 'direccion', 'G', 3),
  ('N-Norte',  'Departamento Territorial Norte',  'departamento', 'N', 1),
  ('N-Este',   'Departamento Territorial Este',   'departamento', 'N', 2),
  ('S-Centro', 'Departamento Territorial Centro', 'departamento', 'S', 1),
  ('S-Oeste',  'Departamento Territorial Oeste',  'departamento', 'S', 2),
  ('S-Sur',    'Departamento Territorial Sur',    'departamento', 'S', 3),
  ('M-AC',     'Departamento Alerta Ciudadana',   'departamento', 'M', 1),
  ('D14','División Territorial 14','division','N-Norte',14),('D15','División Territorial 15','division','N-Norte',15),
  ('D23','División Territorial 23','division','N-Norte',23),('D24BIS','División Territorial 24 BIS','division','N-Norte',24),
  ('D6','División Territorial 6','division','N-Este',6),('D7','División Territorial 7','division','N-Este',7),
  ('D8','División Territorial 8','division','N-Este',8),('D9','División Territorial 9','division','N-Este',9),
  ('D13','División Territorial 13','division','N-Este',13),
  ('D2','División Territorial 2','division','S-Centro',2),('D3','División Territorial 3','division','S-Centro',3),
  ('D10','División Territorial 10','division','S-Oeste',10),('D19','División Territorial 19','division','S-Oeste',19),
  ('D20','División Territorial 20','division','S-Oeste',20),('D22','División Territorial 22','division','S-Oeste',22),
  ('D4','División Territorial 4','division','S-Sur',4),('D5','División Territorial 5','division','S-Sur',5),
  ('D11','División Territorial 11','division','S-Sur',11),('D12','División Territorial 12','division','S-Sur',12),
  ('DAC','División Alerta y Coordinación Vecinal','division','M-AC',1)
on conflict (id) do nothing;

-- ---------- Tipos ----------
do $$ begin
  create type public.rol_usuario as enum ('superadmin','general','cargador','supervisor','jefe_calle','monitoreo');
exception when duplicate_object then null; end $$;

do $$ begin
  -- verificando: falta confirmar el correo · en_revision: espera al Super Admin
  create type public.estado_cuenta as enum ('verificando','en_revision','activo','rechazado','suspendido');
exception when duplicate_object then null; end $$;

-- ---------- Perfil de cada usuario (la contraseña la guarda Supabase cifrada) ----------
create table if not exists public.perfil (
  id                  uuid primary key references auth.users(id) on delete cascade,
  dni                 text not null unique check (dni ~ '^[0-9]{7,8}$'),
  apellido            text not null check (char_length(apellido) between 2 and 80),
  nombre              text not null check (char_length(nombre) between 2 and 80),
  jerarquia           text not null,
  telefono            text,
  correo              text not null unique,
  dependencia         text not null references public.unidad(id),
  rol_pedido          public.rol_usuario not null check (rol_pedido <> 'superadmin'),
  jurisdiccion_pedida text references public.unidad(id),
  rol                 public.rol_usuario,
  jurisdiccion        text references public.unidad(id),
  estado              public.estado_cuenta not null default 'verificando',
  motivo              text,
  revisado_por        uuid references public.perfil(id),
  revisado_en         timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index if not exists perfil_estado_idx on public.perfil (estado);

-- ---------- Auditoría de accesos ----------
create table if not exists public.auditoria_acceso (
  id            bigint generated always as identity primary key,
  usuario       uuid references public.perfil(id) on delete set null,
  identificador text,          -- lo que se escribió para ingresar (correo o DNI)
  evento        text not null, -- ingreso, ingreso_fallido, bloqueo, solicitud, correo_verificado, aprobacion, rechazo, suspension, reactivacion, cambio_rol, recuperacion, cambio_contrasena, salida
  detalle       text,
  actor         uuid references public.perfil(id) on delete set null, -- quién hizo la acción (Super Admin)
  ip            text,
  navegador     text,
  creado_en     timestamptz not null default now()
);
create index if not exists auditoria_fecha_idx on public.auditoria_acceso (creado_en desc);

-- ---------- Intentos fallidos (bloqueo temporal) ----------
create table if not exists public.intento_ingreso (
  id            bigint generated always as identity primary key,
  identificador text not null,
  ip            text,
  creado_en     timestamptz not null default now()
);
create index if not exists intento_ident_idx on public.intento_ingreso (identificador, creado_en desc);

-- ---------- Al registrarse, se crea el perfil con los datos del formulario ----------
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := new.raw_user_meta_data;
begin
  insert into public.perfil (id, dni, apellido, nombre, jerarquia, telefono, correo, dependencia, rol_pedido, jurisdiccion_pedida)
  values (
    new.id,
    d->>'dni', d->>'apellido', d->>'nombre', d->>'jerarquia', nullif(d->>'telefono',''),
    lower(new.email), d->>'dependencia',
    (d->>'rol_pedido')::public.rol_usuario,
    nullif(d->>'jurisdiccion_pedida','')
  );
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- Al confirmar el correo, la solicitud pasa a revisión ----------
create or replace function public.correo_confirmado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.perfil set estado = 'en_revision', actualizado_en = now()
      where id = new.id and estado = 'verificando';
    insert into public.auditoria_acceso (usuario, identificador, evento)
      values (new.id, lower(new.email), 'correo_verificado');
  end if;
  return new;
end $$;

drop trigger if exists al_confirmar_correo on auth.users;
create trigger al_confirmar_correo after update of email_confirmed_at on auth.users
  for each row execute function public.correo_confirmado();

-- ---------- Funciones de permisos (las usan las reglas de seguridad) ----------
create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfil where id = auth.uid() and rol = 'superadmin' and estado = 'activo');
$$;

create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select rol from public.perfil where id = auth.uid() and estado = 'activo';
$$;

create or replace function public.mi_jurisdiccion()
returns text language sql stable security definer set search_path = '' as $$
  select jurisdiccion from public.perfil where id = auth.uid() and estado = 'activo';
$$;

-- ¿La unidad u está dentro de la unidad raiz? (sirve para limitar por jurisdicción)
create or replace function public.unidad_dentro_de(u text, raiz text)
returns boolean language sql stable set search_path = '' as $$
  with recursive arriba as (
    select id, padre from public.unidad where id = u
    union all
    select x.id, x.padre from public.unidad x join arriba a on x.id = a.padre
  )
  select raiz is not null and exists (select 1 from arriba where id = raiz);
$$;

-- ---------- Reglas de seguridad (RLS): sin una regla, nadie puede leer ni escribir ----------
alter table public.unidad           enable row level security;
alter table public.perfil           enable row level security;
alter table public.auditoria_acceso enable row level security;
alter table public.intento_ingreso  enable row level security;

drop policy if exists "unidades visibles" on public.unidad;
create policy "unidades visibles" on public.unidad for select to anon, authenticated using (true);

drop policy if exists "ver mi perfil" on public.perfil;
create policy "ver mi perfil" on public.perfil for select to authenticated using (id = auth.uid());

drop policy if exists "superadmin ve perfiles" on public.perfil;
create policy "superadmin ve perfiles" on public.perfil for select to authenticated using (public.es_superadmin());

drop policy if exists "superadmin ve auditoria" on public.auditoria_acceso;
create policy "superadmin ve auditoria" on public.auditoria_acceso for select to authenticated using (public.es_superadmin());
-- intento_ingreso no tiene reglas: solo lo usa el servidor.
-- Las escrituras de perfil y auditoría las hace el servidor después de verificar permisos.

-- ---------- Limpieza de intentos viejos ----------
create or replace function public.limpiar_intentos()
returns void language sql security definer set search_path = '' as $$
  delete from public.intento_ingreso where creado_en < now() - interval '1 day';
$$;

-- =====================================================================
-- PRIMER SUPER ADMIN (correr aparte, una sola vez, después de crear tu
-- cuenta desde "Solicitar cuenta" y confirmar el correo):
--
--   update public.perfil
--      set rol = 'superadmin', jurisdiccion = 'G', estado = 'activo', revisado_en = now()
--    where correo = 'TU_CORREO_AQUI';
-- =====================================================================
