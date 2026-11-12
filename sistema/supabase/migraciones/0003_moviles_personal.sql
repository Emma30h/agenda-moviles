-- =====================================================================
-- Agenda de Móviles · 0003 · Móviles, personal, situaciones y designaciones
-- Pegar en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Permisos (RLS):
--   · Leer: cualquier cuenta activa (la agenda permite sumar personal de
--     otra división o Dirección, así que hay que poder buscarlo).
--   · Cargar y editar: Super Admin y General en todo; Cargador solo dentro
--     de su jurisdicción. Nadie borra: las bajas son lógicas y reversibles.
-- Solo campos operativos: sin domicilio, teléfono, armamento, chaleco ni
-- datos médicos (de una licencia se guarda el tipo y las fechas).
-- =====================================================================

-- ---------- Unidades que aparecen en la flota y en las nóminas ----------
insert into public.unidad (id, nombre, tipo, padre, orden) values
  ('SUB',     'Subdirección General de Prevención Ciudadana', 'direccion', 'G', 4),
  ('SUB-LOG', 'Departamento Logística',                       'departamento', 'SUB', 1),
  ('DPL',     'División Personal y Logística',                'division', 'SUB-LOG', 1),
  ('M-SOC',   'Departamento Socioeducativo',                  'departamento', 'M', 2),
  ('DSOC',    'División Socioeducativa',                      'division', 'M-SOC', 1),
  ('DAY',     'División Ayudantía',                           'division', 'M', 3),
  ('EPAT',    'División EPAT 360',                            'division', 'G', 5),
  ('DAE',     'División Análisis Estratégico',                'division', 'G', 6)
on conflict (id) do nothing;

-- ---------- ¿La cuenta activa puede cargar en esa unidad? ----------
create or replace function public.puede_cargar(u text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.rol in ('superadmin','general')
         or (p.rol = 'cargador' and public.unidad_dentro_de(u, p.jurisdiccion))
       from public.perfil p where p.id = auth.uid() and p.estado = 'activo'),
    false);
$$;

create or replace function public.cuenta_activa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfil where id = auth.uid() and estado = 'activo' and rol is not null);
$$;

-- ---------- Móviles ----------
create table if not exists public.movil (
  id             uuid primary key default gen_random_uuid(),
  interno        int unique,                       -- matrícula interna; vacío = falta corregir
  dominio        text not null unique check (dominio ~ '^[A-Z0-9]{6,7}$'),
  programa       text not null check (programa in ('ojos_en_alerta','policial')),
  tipo           text,
  marca          text,
  modelo         text,
  unidad         text not null references public.unidad(id),  -- dueña
  activo         boolean not null default true,
  baja_motivo    text,
  baja_fecha     timestamptz,
  baja_obs       text,
  baja_por       uuid references public.perfil(id),
  revisar        text,                             -- dato a corregir detectado al importar
  origen         text not null default 'app' check (origen in ('app','importacion')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists movil_unidad_idx on public.movil (unidad);

-- ---------- Personal ----------
create table if not exists public.personal (
  dni            text primary key check (dni ~ '^[0-9]{7,8}$'),
  apellido       text not null,
  nombre         text not null default '',
  tipo_personal  text not null check (tipo_personal in ('seguridad','tecnico','civil_policial','civil_becario')),
  jerarquia      text,
  unidad         text not null references public.unidad(id),  -- donde revista
  funcion        text,
  calle          boolean not null default false,   -- personal de calle
  guardia        text,
  horario        text,
  revista        text,                             -- Servicio efectivo, Pasiva, Disponibilidad
  activo         boolean not null default true,
  baja_motivo    text,
  baja_fecha     timestamptz,
  baja_obs       text,
  baja_por       uuid references public.perfil(id),
  origen         text not null default 'app' check (origen in ('app','importacion')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint personal_jerarquia_chk check ((tipo_personal in ('seguridad','tecnico')) = (jerarquia is not null))
);
create index if not exists personal_unidad_idx on public.personal (unidad);
create index if not exists personal_apellido_idx on public.personal (lower(apellido));

-- ---------- Situaciones (TNO, licencias, suspensiones) ----------
create table if not exists public.situacion_personal (
  id          bigint generated always as identity primary key,
  dni         text not null references public.personal(dni) on update cascade,
  tipo        text not null check (tipo in ('TNO','Licencia médica','Licencia anual','Licencia especial','Suspensión preventiva','Otra')),
  detalle     text,                                -- categoría administrativa, nunca diagnóstico
  desde       date not null,
  hasta       date,                                -- vacío = sin fecha de fin
  origen      text not null default 'app' check (origen in ('app','importacion')),
  cargado_por uuid references public.perfil(id),
  creado_en   timestamptz not null default now(),
  check (hasta is null or hasta >= desde)
);
create index if not exists situacion_dni_idx on public.situacion_personal (dni);

-- ---------- Designaciones radiales (catálogo relevado del SAE) ----------
create table if not exists public.designacion (
  nombre    text primary key,
  tipo      text,
  zona      text,
  unidad    text references public.unidad(id),     -- división principal
  distritos text,
  alias     text[] not null default '{}',
  usos      int not null default 0,                -- sucesos en el SAE
  activa    boolean not null default true,
  origen    text not null default 'sae' check (origen in ('sae','app'))
);

-- ---------- Reglas de seguridad ----------
alter table public.movil              enable row level security;
alter table public.personal           enable row level security;
alter table public.situacion_personal enable row level security;
alter table public.designacion        enable row level security;

drop policy if exists "leer moviles" on public.movil;
create policy "leer moviles" on public.movil for select to authenticated using (public.cuenta_activa());
drop policy if exists "alta movil" on public.movil;
create policy "alta movil" on public.movil for insert to authenticated with check (public.puede_cargar(unidad));
drop policy if exists "editar movil" on public.movil;
create policy "editar movil" on public.movil for update to authenticated using (public.puede_cargar(unidad)) with check (public.puede_cargar(unidad));

drop policy if exists "leer personal" on public.personal;
create policy "leer personal" on public.personal for select to authenticated using (public.cuenta_activa());
drop policy if exists "alta personal" on public.personal;
create policy "alta personal" on public.personal for insert to authenticated with check (public.puede_cargar(unidad));
drop policy if exists "editar personal" on public.personal;
create policy "editar personal" on public.personal for update to authenticated using (public.puede_cargar(unidad)) with check (public.puede_cargar(unidad));

drop policy if exists "leer situaciones" on public.situacion_personal;
create policy "leer situaciones" on public.situacion_personal for select to authenticated using (public.cuenta_activa());
drop policy if exists "cargar situacion" on public.situacion_personal;
create policy "cargar situacion" on public.situacion_personal for insert to authenticated
  with check (exists (select 1 from public.personal p where p.dni = situacion_personal.dni and public.puede_cargar(p.unidad)));
drop policy if exists "editar situacion" on public.situacion_personal;
create policy "editar situacion" on public.situacion_personal for update to authenticated
  using (exists (select 1 from public.personal p where p.dni = situacion_personal.dni and public.puede_cargar(p.unidad)));

drop policy if exists "leer designaciones" on public.designacion;
create policy "leer designaciones" on public.designacion for select to authenticated using (public.cuenta_activa());
drop policy if exists "administrar designaciones" on public.designacion;
create policy "administrar designaciones" on public.designacion for all to authenticated
  using (public.mi_rol() in ('superadmin','general')) with check (public.mi_rol() in ('superadmin','general'));
