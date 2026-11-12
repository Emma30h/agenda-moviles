-- =====================================================================
-- Agenda de Móviles · 0005 · Operación diaria: servicios, dotación, relevo,
-- fuera de servicio, reservados e historial.
--
-- Las tablas solo se LEEN desde la app. Todo cambio pasa por funciones que
-- hacen la operación completa en un paso (si algo falla, no queda nada a
-- medias), controlan permisos y reglas, y dejan registro en el historial.
--
-- Fin de turno (decidido 2026-11-12): un servicio nunca se cierra solo. Al
-- vencer queda "pendiente de relevo" hasta que alguien elige Relevar, Cerrar,
-- Reservar o Sigue ocupado. A los 30 minutos se reclama al cargador.
-- =====================================================================

-- ---------- Catálogos ----------
create table if not exists public.turno (
  id          text primary key,
  nombre      text not null,
  hora_inicio time not null,
  hora_fin    time not null,           -- si es menor que el inicio, termina al día siguiente
  unidad      text references public.unidad(id),  -- vacío = vale para todas
  activo      boolean not null default true,
  orden       int not null default 0
);
insert into public.turno (id, nombre, hora_inicio, hora_fin, orden) values
  ('T1', '1º turno', '07:00', '14:00', 1),
  ('T2', '2º turno', '14:00', '07:00', 2),
  ('T3', 'Turno largo', '07:00', '23:00', 3)
on conflict (id) do nothing;

create table if not exists public.motivo (
  id        text primary key,
  nombre    text not null,
  categoria text not null check (categoria in ('fuera_servicio','tarea')),
  gravedad  text check (gravedad in ('leve','grave')),
  orden     int not null default 0
);
insert into public.motivo (id, nombre, categoria, gravedad, orden) values
  ('F1','Choque','fuera_servicio','grave',1), ('F2','Falla mecánica','fuera_servicio','grave',2),
  ('F3','Batería','fuera_servicio','leve',3), ('F4','Cubierta / neumático','fuera_servicio','leve',4),
  ('F5','Service / mantenimiento','fuera_servicio','leve',5), ('F6','Falta de combustible','fuera_servicio','leve',6),
  ('F7','Equipo de comunicación','fuera_servicio','leve',7),
  ('P1','Entrega de procedimiento','tarea',null,11), ('P2','Traslado de detenido','tarea',null,12),
  ('P3','Comisión / custodia','tarea',null,13), ('P4','Otra tarea','tarea',null,14)
on conflict (id) do nothing;

-- ---------- Servicio: un móvil en una guardia ----------
create table if not exists public.servicio (
  id             uuid primary key default gen_random_uuid(),
  movil          uuid not null references public.movil(id),
  unidad         text not null references public.unidad(id),  -- quién lo usa
  fecha          date not null,                               -- fecha de la guardia
  turno          text not null references public.turno(id),
  designacion    text,                                        -- ej. «ALBERDI 20»
  inicio         timestamptz not null,
  fin_previsto   timestamptz not null,
  fin_real       timestamptz,                                 -- vacío = sigue abierto
  cierre         text check (cierre in ('cerrado','relevado','fuera_servicio','reservado')),
  ocupado_motivo text references public.motivo(id),          -- sigue ocupado por un procedimiento
  ocupado_obs    text,
  ocupado_desde  timestamptz,
  relevo_de      uuid references public.servicio(id),         -- servicio al que reemplazó
  creado_por     uuid references public.perfil(id),
  cerrado_por    uuid references public.perfil(id),
  creado_en      timestamptz not null default now(),
  check (fin_previsto > inicio)
);
create unique index if not exists servicio_un_abierto_por_movil on public.servicio (movil) where fin_real is null;
create index if not exists servicio_fecha_idx on public.servicio (fecha, turno);
create index if not exists servicio_unidad_idx on public.servicio (unidad) where fin_real is null;

create table if not exists public.dotacion (
  id          bigint generated always as identity primary key,
  servicio    uuid not null references public.servicio(id),
  dni         text not null references public.personal(dni) on update cascade,
  rol         text not null check (rol in ('jefe','chofer','acompanante')),
  desde       timestamptz not null default now(),
  hasta       timestamptz,
  cargado_por uuid references public.perfil(id)
);
create unique index if not exists dotacion_una_activa_por_persona on public.dotacion (dni) where hasta is null;
create index if not exists dotacion_servicio_idx on public.dotacion (servicio);

create table if not exists public.fuera_servicio (
  id          bigint generated always as identity primary key,
  movil       uuid not null references public.movil(id),
  motivo      text not null references public.motivo(id),
  obs         text,
  desde       timestamptz not null default now(),
  hasta       timestamptz,
  cargado_por uuid references public.perfil(id),
  cerrado_por uuid references public.perfil(id)
);
create unique index if not exists fuera_servicio_uno_abierto on public.fuera_servicio (movil) where hasta is null;

-- Reservado: no sale en esa guardia sin tener novedad. No cuenta como sin agendar.
create table if not exists public.reserva (
  id         bigint generated always as identity primary key,
  movil      uuid not null references public.movil(id),
  fecha      date not null,
  turno      text not null references public.turno(id),
  motivo     text not null,
  obs        text,
  por        uuid references public.perfil(id),
  creado_en  timestamptz not null default now(),
  anulada    boolean not null default false
);
create unique index if not exists reserva_una_por_guardia on public.reserva (movil, fecha, turno) where not anulada;

-- Historial de la operación (quién hizo qué y cuándo)
create table if not exists public.historial (
  id        bigint generated always as identity primary key,
  tipo      text not null,
  movil     uuid references public.movil(id),
  servicio  uuid references public.servicio(id),
  dni       text,
  unidad    text references public.unidad(id),
  detalle   text,
  usuario   uuid references public.perfil(id),
  creado_en timestamptz not null default now()
);
create index if not exists historial_fecha_idx on public.historial (creado_en desc);
create index if not exists historial_movil_idx on public.historial (movil, creado_en desc);

-- ---------- Lectura para toda cuenta activa; escritura solo por funciones ----------
alter table public.turno          enable row level security;
alter table public.motivo         enable row level security;
alter table public.servicio       enable row level security;
alter table public.dotacion       enable row level security;
alter table public.fuera_servicio enable row level security;
alter table public.reserva        enable row level security;
alter table public.historial      enable row level security;

do $$ declare t text; begin
  foreach t in array array['turno','motivo','servicio','dotacion','fuera_servicio','reserva','historial'] loop
    execute format('drop policy if exists "leer" on public.%I', t);
    execute format('create policy "leer" on public.%I for select to authenticated using (public.cuenta_activa())', t);
  end loop;
end $$;

-- ---------- Ayudas ----------
create or replace function public.rango_turno(p_fecha date, p_turno text, out inicio timestamptz, out fin timestamptz)
language sql stable set search_path = '' as $$
  select (p_fecha + t.hora_inicio) at time zone 'America/Argentina/Cordoba',
         (p_fecha + t.hora_fin + case when t.hora_fin <= t.hora_inicio then interval '1 day' else interval '0' end) at time zone 'America/Argentina/Cordoba'
    from public.turno t where t.id = p_turno;
$$;

-- Motivo por el que una persona no puede ir en un móvil en esa fecha (null = apta)
create or replace function public.no_apto(p_dni text, p_fecha date)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select 'No figura en el personal' where not exists (select 1 from public.personal where dni = p_dni)),
    (select 'Dado de baja: ' || coalesce(baja_motivo, '') from public.personal where dni = p_dni and not activo),
    (select s.tipo || coalesce(' hasta el ' || to_char(s.hasta, 'DD/MM'), '')
       from public.situacion_personal s
      where s.dni = p_dni and s.desde <= p_fecha and (s.hasta is null or s.hasta >= p_fecha)
      order by s.desde desc limit 1),
    (select 'No es personal de calle' from public.personal where dni = p_dni and not calle)
  );
$$;

create or replace function public.anotar(p_tipo text, p_movil uuid, p_servicio uuid, p_dni text, p_unidad text, p_detalle text)
returns void language sql security definer set search_path = '' as $$
  insert into public.historial (tipo, movil, servicio, dni, unidad, detalle, usuario)
  values (p_tipo, p_movil, p_servicio, p_dni, p_unidad, p_detalle, auth.uid());
$$;

create or replace function public.texto_movil(p_movil uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce('Interno ' || interno || ' · ', '') || dominio from public.movil where id = p_movil;
$$;

-- Carga la dotación de un servicio controlando aptitud y que nadie esté en dos móviles
create or replace function public.cargar_dotacion(p_servicio uuid, p_fecha date, p_dotacion jsonb, p_desde timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare x jsonb; v_dni text; v_mot text; v_otro uuid;
begin
  if p_dotacion is null or jsonb_array_length(p_dotacion) = 0 then
    raise exception 'Cargá al menos un integrante.';
  end if;
  for x in select * from jsonb_array_elements(p_dotacion) loop
    v_dni := regexp_replace(x->>'dni', '\D', '', 'g');
    v_mot := public.no_apto(v_dni, p_fecha);
    if v_mot is not null then
      raise exception 'DNI % no puede ir en el móvil: %.', v_dni, v_mot;
    end if;
    select d.servicio into v_otro from public.dotacion d where d.dni = v_dni and d.hasta is null;
    if v_otro is not null then
      raise exception 'DNI % ya está en otro móvil (%). Sacalo de ahí primero.', v_dni,
        (select public.texto_movil(s.movil) from public.servicio s where s.id = v_otro);
    end if;
    insert into public.dotacion (servicio, dni, rol, desde, cargado_por)
    values (p_servicio, v_dni, coalesce(x->>'rol', 'acompanante'), p_desde, auth.uid());
  end loop;
end $$;

-- ---------- Operaciones ----------
create or replace function public.agendar(
  p_movil uuid, p_fecha date, p_turno text, p_designacion text, p_dotacion jsonb,
  p_inicio timestamptz default null, p_fin timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.movil; r record; v_id uuid; v_ini timestamptz; v_fin timestamptz;
begin
  select * into m from public.movil where id = p_movil;
  if not found then raise exception 'El móvil no existe.'; end if;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso para agendar móviles de esa unidad.'; end if;
  if not m.activo then raise exception 'El móvil está dado de baja.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then
    raise exception 'El móvil está fuera de servicio. Volvelo a servicio primero.';
  end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then
    raise exception 'El móvil ya está agendado. Usá «Relevar» para cambiar la dotación.';
  end if;
  select * into r from public.rango_turno(p_fecha, p_turno);
  if r.inicio is null then raise exception 'Elegí un turno válido.'; end if;
  v_ini := coalesce(p_inicio, r.inicio); v_fin := coalesce(p_fin, r.fin);

  -- Si estaba reservado para esa guardia, la reserva queda sin efecto
  update public.reserva set anulada = true where movil = p_movil and fecha = p_fecha and turno = p_turno and not anulada;

  insert into public.servicio (movil, unidad, fecha, turno, designacion, inicio, fin_previsto, creado_por)
  values (p_movil, m.unidad, p_fecha, p_turno, nullif(upper(trim(p_designacion)), ''), v_ini, v_fin, auth.uid())
  returning id into v_id;
  perform public.cargar_dotacion(v_id, p_fecha, p_dotacion, greatest(now(), v_ini));
  perform public.anotar('Agendado', p_movil, v_id, null, m.unidad,
    public.texto_movil(p_movil) || coalesce(' · ' || nullif(upper(trim(p_designacion)), ''), '') || ' · ' || to_char(v_ini at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI') || ' a ' || to_char(v_fin at time zone 'America/Argentina/Cordoba', 'HH24:MI') || ' Hs');
  return v_id;
end $$;

-- Relevo: cierra la dotación saliente y abre el servicio entrante en un paso
create or replace function public.relevar(
  p_servicio uuid, p_fecha date, p_turno text, p_designacion text, p_dotacion jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.servicio; r record; v_id uuid; v_ahora timestamptz := now();
begin
  select * into s from public.servicio where id = p_servicio for update;
  if not found or s.fin_real is not null then raise exception 'Ese servicio ya no está abierto.'; end if;
  if not public.puede_cargar(s.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  select * into r from public.rango_turno(p_fecha, p_turno);
  if r.inicio is null then raise exception 'Elegí el turno entrante.'; end if;

  update public.dotacion set hasta = v_ahora where servicio = s.id and hasta is null;
  update public.servicio set fin_real = v_ahora, cierre = 'relevado', cerrado_por = auth.uid() where id = s.id;

  insert into public.servicio (movil, unidad, fecha, turno, designacion, inicio, fin_previsto, relevo_de, creado_por)
  values (s.movil, s.unidad, p_fecha, p_turno, coalesce(nullif(upper(trim(p_designacion)), ''), s.designacion),
          least(v_ahora, r.inicio), greatest(r.fin, v_ahora + interval '1 hour'), s.id, auth.uid())
  returning id into v_id;
  perform public.cargar_dotacion(v_id, p_fecha, p_dotacion, v_ahora);
  perform public.anotar('Relevo', s.movil, v_id, null, s.unidad,
    public.texto_movil(s.movil) || ' · entra el ' || (select nombre from public.turno where id = p_turno) || ' del ' || to_char(p_fecha, 'DD/MM'));
  return v_id;
end $$;

-- Cierre: el móvil vuelve a disponible (o queda reservado para la guardia que se indique)
create or replace function public.cerrar_servicio(
  p_servicio uuid, p_reserva_fecha date default null, p_reserva_turno text default null,
  p_reserva_motivo text default null, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.servicio; v_ahora timestamptz := now();
begin
  select * into s from public.servicio where id = p_servicio for update;
  if not found or s.fin_real is not null then raise exception 'Ese servicio ya no está abierto.'; end if;
  if not public.puede_cargar(s.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.dotacion set hasta = v_ahora where servicio = s.id and hasta is null;
  update public.servicio set fin_real = v_ahora, cierre = case when p_reserva_turno is null then 'cerrado' else 'reservado' end,
         cerrado_por = auth.uid() where id = s.id;
  if p_reserva_turno is not null then
    insert into public.reserva (movil, fecha, turno, motivo, obs, por)
    values (s.movil, p_reserva_fecha, p_reserva_turno, coalesce(p_reserva_motivo, 'Sin novedad'), p_obs, auth.uid())
    on conflict do nothing;
  end if;
  perform public.anotar(case when p_reserva_turno is null then 'Servicio cerrado' else 'Cerrado y reservado' end,
    s.movil, s.id, null, s.unidad,
    public.texto_movil(s.movil) || case when s.ocupado_motivo is not null then ' · liberado tras ' || (select nombre from public.motivo where id = s.ocupado_motivo) else '' end
      || coalesce(' · ' || p_reserva_motivo, '') || coalesce(' · ' || nullif(trim(p_obs), ''), ''));
end $$;

-- Sigue ocupado por un procedimiento: justifica que pase el horario
create or replace function public.marcar_ocupado(p_servicio uuid, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.servicio;
begin
  select * into s from public.servicio where id = p_servicio for update;
  if not found or s.fin_real is not null then raise exception 'Ese servicio ya no está abierto.'; end if;
  if not public.puede_cargar(s.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if not exists (select 1 from public.motivo where id = p_motivo and categoria = 'tarea') then raise exception 'Elegí el motivo.'; end if;
  update public.servicio set ocupado_motivo = p_motivo, ocupado_obs = nullif(trim(p_obs), ''), ocupado_desde = now() where id = s.id;
  perform public.anotar('Sigue ocupado', s.movil, s.id, null, s.unidad,
    public.texto_movil(s.movil) || ' · ' || (select nombre from public.motivo where id = p_motivo) || coalesce(' · ' || nullif(trim(p_obs), ''), ''));
end $$;

create or replace function public.cambiar_fin(p_servicio uuid, p_fin timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.servicio;
begin
  select * into s from public.servicio where id = p_servicio for update;
  if not found or s.fin_real is not null then raise exception 'Ese servicio ya no está abierto.'; end if;
  if not public.puede_cargar(s.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if p_fin <= s.inicio then raise exception 'El fin tiene que ser después del inicio.'; end if;
  update public.servicio set fin_previsto = p_fin where id = s.id;
  perform public.anotar('Horario cambiado', s.movil, s.id, null, s.unidad,
    public.texto_movil(s.movil) || ' · fin ' || to_char(s.fin_previsto at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI')
      || ' → ' || to_char(p_fin at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI') || ' Hs');
end $$;

create or replace function public.poner_fuera_servicio(p_movil uuid, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil; v_serv uuid; v_ahora timestamptz := now();
begin
  select * into m from public.movil where id = p_movil;
  if not found then raise exception 'El móvil no existe.'; end if;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if not exists (select 1 from public.motivo where id = p_motivo and categoria = 'fuera_servicio') then raise exception 'Elegí el motivo.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then raise exception 'Ya está fuera de servicio.'; end if;
  select id into v_serv from public.servicio where movil = p_movil and fin_real is null;
  if v_serv is not null then
    update public.dotacion set hasta = v_ahora where servicio = v_serv and hasta is null;
    update public.servicio set fin_real = v_ahora, cierre = 'fuera_servicio', cerrado_por = auth.uid() where id = v_serv;
  end if;
  insert into public.fuera_servicio (movil, motivo, obs, cargado_por) values (p_movil, p_motivo, nullif(trim(p_obs), ''), auth.uid());
  perform public.anotar('Fuera de servicio', p_movil, v_serv, null, m.unidad,
    public.texto_movil(p_movil) || ' · ' || (select nombre || ' (' || gravedad || ')' from public.motivo where id = p_motivo) || coalesce(' · ' || nullif(trim(p_obs), ''), ''));
end $$;

create or replace function public.volver_a_servicio(p_movil uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil;
begin
  select * into m from public.movil where id = p_movil;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.fuera_servicio set hasta = now(), cerrado_por = auth.uid() where movil = p_movil and hasta is null;
  if not found then raise exception 'El móvil no estaba fuera de servicio.'; end if;
  perform public.anotar('Vuelve a servicio', p_movil, null, null, m.unidad, public.texto_movil(p_movil));
end $$;

create or replace function public.reservar(p_movil uuid, p_fecha date, p_turno text, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil;
begin
  select * into m from public.movil where id = p_movil;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then raise exception 'El móvil está en servicio: cerralo o relevalo.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then raise exception 'El móvil está fuera de servicio.'; end if;
  begin
    insert into public.reserva (movil, fecha, turno, motivo, obs, por) values (p_movil, p_fecha, p_turno, p_motivo, nullif(trim(p_obs), ''), auth.uid());
  exception when unique_violation then raise exception 'Ya está reservado para esa guardia.';
  end;
  perform public.anotar('Reservado', p_movil, null, null, m.unidad,
    public.texto_movil(p_movil) || ' · ' || (select nombre from public.turno where id = p_turno) || ' del ' || to_char(p_fecha, 'DD/MM') || ' · ' || p_motivo);
end $$;

create or replace function public.quitar_reserva(p_reserva bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reserva; m public.movil;
begin
  select * into r from public.reserva where id = p_reserva and not anulada;
  if not found then raise exception 'La reserva ya no está vigente.'; end if;
  select * into m from public.movil where id = r.movil;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.reserva set anulada = true where id = p_reserva;
  perform public.anotar('Reserva quitada', r.movil, null, null, m.unidad, public.texto_movil(r.movil));
end $$;

-- ---------- Permisos de ejecución: solo cuentas con sesión ----------
do $$ declare f text; begin
  foreach f in array array[
    'public.rango_turno(date,text)', 'public.no_apto(text,date)', 'public.anotar(text,uuid,uuid,text,text,text)',
    'public.texto_movil(uuid)', 'public.cargar_dotacion(uuid,date,jsonb,timestamptz)',
    'public.agendar(uuid,date,text,text,jsonb,timestamptz,timestamptz)', 'public.relevar(uuid,date,text,text,jsonb)',
    'public.cerrar_servicio(uuid,date,text,text,text)', 'public.marcar_ocupado(uuid,text,text)', 'public.cambiar_fin(uuid,timestamptz)',
    'public.poner_fuera_servicio(uuid,text,text)', 'public.volver_a_servicio(uuid)',
    'public.reservar(uuid,date,text,text,text)', 'public.quitar_reserva(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
-- Las internas no se llaman desde la app
revoke execute on function public.anotar(text,uuid,uuid,text,text,text) from authenticated;
revoke execute on function public.cargar_dotacion(uuid,date,jsonb,timestamptz) from authenticated;
grant execute on function
  public.rango_turno(date,text), public.no_apto(text,date), public.texto_movil(uuid),
  public.agendar(uuid,date,text,text,jsonb,timestamptz,timestamptz), public.relevar(uuid,date,text,text,jsonb),
  public.cerrar_servicio(uuid,date,text,text,text), public.marcar_ocupado(uuid,text,text), public.cambiar_fin(uuid,timestamptz),
  public.poner_fuera_servicio(uuid,text,text), public.volver_a_servicio(uuid),
  public.reservar(uuid,date,text,text,text), public.quitar_reserva(bigint)
to authenticated;

-- ---------- Tiempo real: la pantalla se actualiza sola cuando otro carga algo ----------
do $$ declare t text; begin
  foreach t in array array['servicio','dotacion','fuera_servicio','reserva'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
