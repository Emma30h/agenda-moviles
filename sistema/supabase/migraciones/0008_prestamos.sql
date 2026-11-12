-- =====================================================================
-- Agenda de Móviles · 0008 · Préstamos de móviles y de personal
--
-- · Un móvil prestado lo usa (y lo agenda) la unidad que lo recibe hasta que
--   se devuelve; su dueña no lo agenda mientras tanto. Al devolverlo vuelve
--   a la dueña. No se presta ni se devuelve con un servicio abierto.
-- · Una persona se presta por una guardia (fecha y turno): en esa guardia no
--   se la puede agendar fuera de la Dirección que la recibe.
-- · Dentro de una misma Dirección presta el cargador; hacia otra Dirección,
--   solo el General (o el Super Admin).
-- =====================================================================

create table if not exists public.prestamo (
  id             bigint generated always as identity primary key,
  movil          uuid not null references public.movil(id),
  origen         text not null references public.unidad(id),
  destino        text not null references public.unidad(id),
  con_dotacion   boolean not null default false,
  obs            text,
  desde          timestamptz not null default now(),
  hasta          timestamptz,
  autorizado_por uuid references public.perfil(id),
  cerrado_por    uuid references public.perfil(id),
  check (origen <> destino)
);
create unique index if not exists prestamo_uno_abierto on public.prestamo (movil) where hasta is null;

create table if not exists public.prestamo_personal (
  id             bigint generated always as identity primary key,
  dni            text not null references public.personal(dni) on update cascade,
  origen         text not null references public.unidad(id),
  destino        text not null references public.unidad(id),
  fecha          date not null,
  turno          text not null references public.turno(id),
  obs            text,
  autorizado_por uuid references public.perfil(id),
  creado_en      timestamptz not null default now(),
  anulado        boolean not null default false,
  anulado_por    uuid references public.perfil(id)
);
create unique index if not exists prestamo_personal_uno_por_guardia on public.prestamo_personal (dni, fecha, turno) where not anulado;

alter table public.prestamo enable row level security;
alter table public.prestamo_personal enable row level security;
drop policy if exists "leer" on public.prestamo;
create policy "leer" on public.prestamo for select to authenticated using (public.cuenta_activa());
drop policy if exists "leer" on public.prestamo_personal;
create policy "leer" on public.prestamo_personal for select to authenticated using (public.cuenta_activa());

-- ---------- Ayudas ----------
create or replace function public.unidad_que_usa(p_movil uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select destino from public.prestamo where movil = p_movil and hasta is null),
                  (select unidad from public.movil where id = p_movil));
$$;

create or replace function public.puede_prestar(p_origen text, p_destino text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.mi_rol() in ('superadmin','general')
      or (public.mi_rol() = 'cargador' and public.puede_cargar(p_origen) and public.puede_cargar(p_destino)
          and public.direccion_de(p_origen) = public.direccion_de(p_destino));
$$;

-- Un móvil prestado no cambia de división ni se da de baja hasta devolverlo
create or replace function public.movil_prestado_guarda()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.prestamo where movil = new.id and hasta is null)
     and (new.unidad is distinct from old.unidad or (old.activo and not new.activo)) then
    raise exception 'Está prestado: devolvelo antes de cambiarlo de división o darlo de baja.';
  end if;
  return new;
end $$;
drop trigger if exists movil_prestado_guarda on public.movil;
create trigger movil_prestado_guarda before update on public.movil for each row execute function public.movil_prestado_guarda();

-- ---------- Préstamo de móviles ----------
create or replace function public.prestar_movil(p_movil uuid, p_destino text, p_con_dotacion boolean, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare m public.movil; v_id bigint;
begin
  select * into m from public.movil where id = p_movil for update;
  if not found or not m.activo then raise exception 'El móvil no existe o está dado de baja.'; end if;
  if exists (select 1 from public.prestamo where movil = p_movil and hasta is null) then raise exception 'Ya está prestado: devolvelo primero.'; end if;
  if p_destino is null or p_destino = m.unidad then raise exception 'Elegí la unidad que lo recibe.'; end if;
  if not public.puede_prestar(m.unidad, p_destino) then
    raise exception 'Hacia otra Dirección solo presta el General.';
  end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then raise exception 'Está en servicio: cerralo antes de prestarlo.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then raise exception 'Está fuera de servicio.'; end if;
  insert into public.prestamo (movil, origen, destino, con_dotacion, obs, autorizado_por)
  values (p_movil, m.unidad, p_destino, coalesce(p_con_dotacion, false), nullif(trim(p_obs), ''), auth.uid()) returning id into v_id;
  perform public.anotar('Préstamo', p_movil, null, null, p_destino,
    public.texto_movil(p_movil) || ' · de ' || (select nombre from public.unidad where id = m.unidad) || ' a ' || (select nombre from public.unidad where id = p_destino)
      || case when p_con_dotacion then ' · con dotación' else '' end || coalesce(' · ' || nullif(trim(p_obs), ''), ''));
  return v_id;
end $$;

create or replace function public.devolver_movil(p_movil uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.prestamo;
begin
  select * into p from public.prestamo where movil = p_movil and hasta is null for update;
  if not found then raise exception 'El móvil no está prestado.'; end if;
  if not (public.mi_rol() in ('superadmin','general') or public.puede_cargar(p.origen) or public.puede_cargar(p.destino)) then
    raise exception 'No tenés permiso sobre ese préstamo.';
  end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then raise exception 'Está en servicio: cerralo antes de devolverlo.'; end if;
  update public.reserva set anulada = true where movil = p_movil and not anulada and fecha >= (now() at time zone 'America/Argentina/Cordoba')::date;
  update public.prestamo set hasta = now(), cerrado_por = auth.uid() where id = p.id;
  perform public.anotar('Devolución', p_movil, null, null, p.origen,
    public.texto_movil(p_movil) || ' · vuelve a ' || (select nombre from public.unidad where id = p.origen));
end $$;

-- ---------- Préstamo de personal (por guardia) ----------
create or replace function public.prestar_persona(p_dni text, p_destino text, p_fecha date, p_turno text, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare x public.personal; v_id bigint;
begin
  select * into x from public.personal where dni = p_dni;
  if not found or not x.activo then raise exception 'La persona no existe o está dada de baja.'; end if;
  if p_destino is null or p_destino = x.unidad then raise exception 'Elegí la unidad que la recibe.'; end if;
  if not public.puede_prestar(x.unidad, p_destino) then raise exception 'Hacia otra Dirección solo presta el General.'; end if;
  if not exists (select 1 from public.turno where id = p_turno) then raise exception 'Elegí el turno.'; end if;
  begin
    insert into public.prestamo_personal (dni, origen, destino, fecha, turno, obs, autorizado_por)
    values (p_dni, x.unidad, p_destino, p_fecha, p_turno, nullif(trim(p_obs), ''), auth.uid()) returning id into v_id;
  exception when unique_violation then raise exception 'Ya está prestada en esa guardia.';
  end;
  perform public.anotar('Préstamo de personal', null, null, p_dni, p_destino,
    public.texto_persona(p_dni) || ' · a ' || (select nombre from public.unidad where id = p_destino) || ' · '
      || (select nombre from public.turno where id = p_turno) || ' del ' || to_char(p_fecha, 'DD/MM'));
  return v_id;
end $$;

create or replace function public.quitar_prestamo_persona(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.prestamo_personal;
begin
  select * into q from public.prestamo_personal where id = p_id and not anulado;
  if not found then raise exception 'Ese préstamo ya no está vigente.'; end if;
  if not public.puede_prestar(q.origen, q.destino) then raise exception 'No tenés permiso sobre ese préstamo.'; end if;
  update public.prestamo_personal set anulado = true, anulado_por = auth.uid() where id = p_id;
  perform public.anotar('Préstamo de personal anulado', null, null, q.dni, q.origen, public.texto_persona(q.dni));
end $$;

-- ---------- Las operaciones usan la unidad que USA el móvil ----------
create or replace function public.cargar_dotacion(p_servicio uuid, p_fecha date, p_dotacion jsonb, p_desde timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare x jsonb; v_dni text; v_mot text; v_otro uuid; s public.servicio; q public.prestamo_personal;
begin
  if p_dotacion is null or jsonb_array_length(p_dotacion) = 0 then raise exception 'Cargá al menos un integrante.'; end if;
  select * into s from public.servicio where id = p_servicio;
  for x in select * from jsonb_array_elements(p_dotacion) loop
    v_dni := regexp_replace(x->>'dni', '\D', '', 'g');
    v_mot := public.no_apto(v_dni, p_fecha);
    if v_mot is not null then raise exception 'DNI % no puede ir en el móvil: %.', v_dni, v_mot; end if;
    select d.servicio into v_otro from public.dotacion d where d.dni = v_dni and d.hasta is null;
    if v_otro is not null then
      raise exception 'DNI % ya está en otro móvil (%). Sacalo de ahí primero.', v_dni,
        (select public.texto_movil(z.movil) from public.servicio z where z.id = v_otro);
    end if;
    select * into q from public.prestamo_personal where dni = v_dni and fecha = s.fecha and turno = s.turno and not anulado;
    if found and public.direccion_de(q.destino) <> public.direccion_de(s.unidad) then
      raise exception 'DNI % está prestado a % en esa guardia.', v_dni, (select nombre from public.unidad where id = q.destino);
    end if;
    insert into public.dotacion (servicio, dni, rol, desde, cargado_por)
    values (p_servicio, v_dni, coalesce(x->>'rol', 'acompanante'), p_desde, auth.uid());
  end loop;
end $$;

create or replace function public.agendar(
  p_movil uuid, p_fecha date, p_turno text, p_designacion text, p_dotacion jsonb,
  p_inicio timestamptz default null, p_fin timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.movil; r record; v_id uuid; v_ini timestamptz; v_fin timestamptz; v_usa text;
begin
  select * into m from public.movil where id = p_movil;
  if not found then raise exception 'El móvil no existe.'; end if;
  v_usa := public.unidad_que_usa(p_movil);
  if not public.puede_cargar(v_usa) then
    if v_usa <> m.unidad then raise exception 'Está prestado a %: lo agenda esa unidad.', (select nombre from public.unidad where id = v_usa); end if;
    raise exception 'No tenés permiso para agendar móviles de esa unidad.';
  end if;
  if not m.activo then raise exception 'El móvil está dado de baja.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then
    raise exception 'El móvil está fuera de servicio. Volvelo a servicio primero.'; end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then
    raise exception 'El móvil ya está agendado. Usá «Relevar» para cambiar la dotación.'; end if;
  select * into r from public.rango_turno(p_fecha, p_turno);
  if r.inicio is null then raise exception 'Elegí un turno válido.'; end if;
  v_ini := coalesce(p_inicio, r.inicio); v_fin := coalesce(p_fin, r.fin);
  update public.reserva set anulada = true where movil = p_movil and fecha = p_fecha and turno = p_turno and not anulada;
  insert into public.servicio (movil, unidad, fecha, turno, designacion, inicio, fin_previsto, creado_por)
  values (p_movil, v_usa, p_fecha, p_turno, nullif(upper(trim(p_designacion)), ''), v_ini, v_fin, auth.uid())
  returning id into v_id;
  perform public.cargar_dotacion(v_id, p_fecha, p_dotacion, greatest(now(), v_ini));
  perform public.anotar('Agendado', p_movil, v_id, null, v_usa,
    public.texto_movil(p_movil) || coalesce(' · ' || nullif(upper(trim(p_designacion)), ''), '') || ' · '
      || to_char(v_ini at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI') || ' a '
      || to_char(v_fin at time zone 'America/Argentina/Cordoba', 'HH24:MI') || ' Hs');
  return v_id;
end $$;

create or replace function public.poner_fuera_servicio(p_movil uuid, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil; v_serv uuid; v_ahora timestamptz := now(); v_usa text;
begin
  select * into m from public.movil where id = p_movil;
  if not found then raise exception 'El móvil no existe.'; end if;
  v_usa := public.unidad_que_usa(p_movil);
  if not public.puede_cargar(v_usa) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if not exists (select 1 from public.motivo where id = p_motivo and categoria = 'fuera_servicio') then raise exception 'Elegí el motivo.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then raise exception 'Ya está fuera de servicio.'; end if;
  select id into v_serv from public.servicio where movil = p_movil and fin_real is null;
  if v_serv is not null then
    update public.dotacion set hasta = v_ahora where servicio = v_serv and hasta is null;
    update public.servicio set fin_real = v_ahora, cierre = 'fuera_servicio', cerrado_por = auth.uid() where id = v_serv;
  end if;
  insert into public.fuera_servicio (movil, motivo, obs, cargado_por) values (p_movil, p_motivo, nullif(trim(p_obs), ''), auth.uid());
  perform public.anotar('Fuera de servicio', p_movil, v_serv, null, v_usa,
    public.texto_movil(p_movil) || ' · ' || (select nombre || ' (' || gravedad || ')' from public.motivo where id = p_motivo) || coalesce(' · ' || nullif(trim(p_obs), ''), ''));
end $$;

create or replace function public.volver_a_servicio(p_movil uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_usa text;
begin
  v_usa := public.unidad_que_usa(p_movil);
  if not public.puede_cargar(v_usa) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.fuera_servicio set hasta = now(), cerrado_por = auth.uid() where movil = p_movil and hasta is null;
  if not found then raise exception 'El móvil no estaba fuera de servicio.'; end if;
  perform public.anotar('Vuelve a servicio', p_movil, null, null, v_usa, public.texto_movil(p_movil));
end $$;

create or replace function public.reservar(p_movil uuid, p_fecha date, p_turno text, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_usa text;
begin
  v_usa := public.unidad_que_usa(p_movil);
  if not public.puede_cargar(v_usa) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then raise exception 'El móvil está en servicio: cerralo o relevalo.'; end if;
  if exists (select 1 from public.fuera_servicio where movil = p_movil and hasta is null) then raise exception 'El móvil está fuera de servicio.'; end if;
  begin
    insert into public.reserva (movil, fecha, turno, motivo, obs, por) values (p_movil, p_fecha, p_turno, p_motivo, nullif(trim(p_obs), ''), auth.uid());
  exception when unique_violation then raise exception 'Ya está reservado para esa guardia.';
  end;
  perform public.anotar('Reservado', p_movil, null, null, v_usa,
    public.texto_movil(p_movil) || ' · ' || (select nombre from public.turno where id = p_turno) || ' del ' || to_char(p_fecha, 'DD/MM') || ' · ' || p_motivo);
end $$;

create or replace function public.quitar_reserva(p_reserva bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reserva; v_usa text;
begin
  select * into r from public.reserva where id = p_reserva and not anulada;
  if not found then raise exception 'La reserva ya no está vigente.'; end if;
  v_usa := public.unidad_que_usa(r.movil);
  if not public.puede_cargar(v_usa) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.reserva set anulada = true where id = p_reserva;
  perform public.anotar('Reserva quitada', r.movil, null, null, v_usa, public.texto_movil(r.movil));
end $$;

-- Los sin agendar cuentan para la Dirección que usa el móvil
create or replace function public.sin_agendar(p_dir text, p_fecha date, p_turno text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.movil m
   where m.activo and public.direccion_de(public.unidad_que_usa(m.id)) = p_dir
     and not exists (select 1 from public.servicio s where s.movil = m.id and s.fin_real is null)
     and not exists (select 1 from public.fuera_servicio f where f.movil = m.id and f.hasta is null)
     and not exists (select 1 from public.reserva r where r.movil = m.id and r.fecha = p_fecha and r.turno = p_turno and not r.anulada);
$$;

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array['public.unidad_que_usa(uuid)', 'public.puede_prestar(text,text)', 'public.movil_prestado_guarda()',
    'public.prestar_movil(uuid,text,boolean,text)', 'public.devolver_movil(uuid)', 'public.prestar_persona(text,text,date,text,text)',
    'public.quitar_prestamo_persona(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.movil_prestado_guarda() from authenticated;
grant execute on function public.unidad_que_usa(uuid), public.puede_prestar(text,text), public.prestar_movil(uuid,text,boolean,text),
  public.devolver_movil(uuid), public.prestar_persona(text,text,date,text,text), public.quitar_prestamo_persona(bigint) to authenticated;

do $$ declare t text; begin
  foreach t in array array['prestamo','prestamo_personal'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
