-- =====================================================================
-- Agenda de Móviles · 0006 · Altas, ediciones, bajas, pases y situaciones
--
-- · Toda edición guarda cómo estaba antes (tabla cambio) y se deshace de a un
--   paso, de la más nueva a la más vieja.
-- · Nada se borra: las bajas guardan motivo, fecha y usuario y se revierten.
-- · DNI, interno y patente exactos bloquean (también contra dados de baja).
-- · Una situación vigente (TNO, licencia, suspensión) saca a la persona del
--   móvil en que esté y queda registrado.
-- · La observación de una situación la ve solo quien puede editar a esa persona.
-- =====================================================================

create table if not exists public.cambio (
  id        bigint generated always as identity primary key,
  tabla     text not null check (tabla in ('movil','personal')),
  registro  text not null,                 -- id del móvil o DNI
  accion    text not null,                 -- Alta, Datos modificados, Pase, Cambio de división, Baja, Reincorporación, Deshecho
  antes     jsonb not null default '{}',
  despues   jsonb not null default '{}',
  usuario   uuid references public.perfil(id),
  creado_en timestamptz not null default now(),
  deshecho  boolean not null default false, -- se volvió atrás
  revierte  bigint references public.cambio(id)  -- este cambio es el «deshacer» de otro
);
create index if not exists cambio_registro_idx on public.cambio (tabla, registro, id desc);

alter table public.situacion_personal add column if not exists anulada boolean not null default false;
alter table public.situacion_personal add column if not exists anulada_por uuid references public.perfil(id);

-- Observación aparte, para poder limitar quién la lee
create table if not exists public.situacion_nota (
  situacion bigint primary key references public.situacion_personal(id),
  obs       text not null
);

alter table public.cambio         enable row level security;
alter table public.situacion_nota enable row level security;
drop policy if exists "leer" on public.cambio;
create policy "leer" on public.cambio for select to authenticated using (public.cuenta_activa());
drop policy if exists "leer si edita" on public.situacion_nota;
create policy "leer si edita" on public.situacion_nota for select to authenticated using (
  exists (select 1 from public.situacion_personal s join public.personal p on p.dni = s.dni
           where s.id = situacion_nota.situacion and public.puede_cargar(p.unidad)));

-- Las escrituras directas que dejó la 0003 pasan a hacerse solo por funciones
drop policy if exists "alta movil" on public.movil;
drop policy if exists "editar movil" on public.movil;
drop policy if exists "alta personal" on public.personal;
drop policy if exists "editar personal" on public.personal;
drop policy if exists "cargar situacion" on public.situacion_personal;
drop policy if exists "editar situacion" on public.situacion_personal;

-- La aptitud ya no cuenta las situaciones anuladas
create or replace function public.no_apto(p_dni text, p_fecha date)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select 'No figura en el personal' where not exists (select 1 from public.personal where dni = p_dni)),
    (select 'Dado de baja: ' || coalesce(baja_motivo, '') from public.personal where dni = p_dni and not activo),
    (select s.tipo || coalesce(' hasta el ' || to_char(s.hasta, 'DD/MM'), '')
       from public.situacion_personal s
      where s.dni = p_dni and not s.anulada and s.desde <= p_fecha and (s.hasta is null or s.hasta >= p_fecha)
      order by s.desde desc limit 1),
    (select 'No es personal de calle' from public.personal where dni = p_dni and not calle));
$$;

-- ---------- Ayudas ----------
create or replace function public.texto_persona(p_dni text)
returns text language sql stable security definer set search_path = '' as $$
  select trim(coalesce(jerarquia || ' ', '') || apellido || coalesce(', ' || nullif(nombre, ''), '')) from public.personal where dni = p_dni;
$$;

-- Diferencia entre dos jsonb: solo las claves que cambian
create or replace function public.solo_cambios(a jsonb, b jsonb, out antes jsonb, out despues jsonb)
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, a->k), '{}'), coalesce(jsonb_object_agg(k, b->k), '{}')
    from jsonb_object_keys(b) k where (a->k) is distinct from (b->k);
$$;

-- Sacar a una persona del móvil en que esté (por baja o situación vigente)
create or replace function public.sacar_de_movil(p_dni text, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  for d in select dt.id, s.id as servicio, s.movil, s.unidad from public.dotacion dt join public.servicio s on s.id = dt.servicio
            where dt.dni = p_dni and dt.hasta is null loop
    update public.dotacion set hasta = now() where id = d.id;
    perform public.anotar('Sale del móvil', d.movil, d.servicio, p_dni, d.unidad,
      public.texto_persona(p_dni) || ' sale de ' || public.texto_movil(d.movil) || ' · ' || p_motivo);
  end loop;
end $$;

-- ---------- Móviles ----------
create or replace function public.guardar_movil(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.movil; nuevo jsonb; viejo jsonb; c record; v_id uuid; v_dom text; v_int int; otro public.movil;
begin
  v_dom := upper(regexp_replace(coalesce(p->>'dominio', ''), '[^A-Za-z0-9]', '', 'g'));
  v_int := nullif(regexp_replace(coalesce(p->>'interno', ''), '\D', '', 'g'), '')::int;
  if v_dom !~ '^[A-Z0-9]{6,7}$' then raise exception 'Revisá la patente: AB123CD o ABC123.'; end if;
  if coalesce(p->>'unidad', '') = '' then raise exception 'Elegí la división.'; end if;
  if not public.puede_cargar(p->>'unidad') then raise exception 'No tenés permiso para cargar móviles en esa división.'; end if;
  select * into otro from public.movil where dominio = v_dom and id is distinct from p_id;
  if found then raise exception 'La patente % ya está cargada: %.', v_dom, public.texto_movil(otro.id) || case when otro.activo then '' else ' (dado de baja: reincorporalo)' end; end if;
  if v_int is not null then
    select * into otro from public.movil where interno = v_int and id is distinct from p_id;
    if found then raise exception 'El interno % ya es de %.', v_int, public.texto_movil(otro.id) || case when otro.activo then '' else ' (dado de baja)' end; end if;
  end if;
  nuevo := jsonb_build_object('interno', v_int, 'dominio', v_dom, 'programa', p->>'programa', 'tipo', nullif(trim(p->>'tipo'), ''),
    'marca', nullif(upper(trim(p->>'marca')), ''), 'modelo', nullif(trim(p->>'modelo'), ''), 'unidad', p->>'unidad');

  if p_id is null then
    insert into public.movil (interno, dominio, programa, tipo, marca, modelo, unidad)
    values (v_int, v_dom, nuevo->>'programa', nuevo->>'tipo', nuevo->>'marca', nuevo->>'modelo', nuevo->>'unidad') returning id into v_id;
    insert into public.cambio (tabla, registro, accion, despues, usuario) values ('movil', v_id::text, 'Alta', nuevo, auth.uid());
    return v_id;
  end if;

  select * into m from public.movil where id = p_id for update;
  if not found then raise exception 'El móvil no existe.'; end if;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  viejo := jsonb_build_object('interno', m.interno, 'dominio', m.dominio, 'programa', m.programa, 'tipo', m.tipo,
    'marca', m.marca, 'modelo', m.modelo, 'unidad', m.unidad);
  select * into c from public.solo_cambios(viejo, nuevo);
  if c.despues = '{}' then raise exception 'No hay cambios para guardar.'; end if;
  if c.despues ? 'unidad' and exists (select 1 from public.servicio where movil = p_id and fin_real is null) then
    raise exception 'No se puede cambiar de división mientras está en servicio. Cerralo primero.';
  end if;
  update public.movil set interno = v_int, dominio = v_dom, programa = nuevo->>'programa', tipo = nuevo->>'tipo',
    marca = nuevo->>'marca', modelo = nuevo->>'modelo', unidad = nuevo->>'unidad', actualizado_en = now(),
    revisar = case when v_int is not null and revisar like 'El interno%' then null else revisar end
   where id = p_id;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('movil', p_id::text, case when c.despues - 'unidad' = '{}' then 'Cambio de división' else 'Datos modificados' end, c.antes, c.despues, auth.uid());
  return p_id;
end $$;

create or replace function public.baja_movil(p_id uuid, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil;
begin
  select * into m from public.movil where id = p_id for update;
  if not found or not m.activo then raise exception 'El móvil no existe o ya está dado de baja.'; end if;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if exists (select 1 from public.servicio where movil = p_id and fin_real is null) then raise exception 'Está en servicio: cerralo antes de darlo de baja.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Elegí el motivo de la baja.'; end if;
  update public.fuera_servicio set hasta = now(), cerrado_por = auth.uid() where movil = p_id and hasta is null;
  update public.movil set activo = false, baja_motivo = p_motivo, baja_fecha = now(), baja_obs = nullif(trim(p_obs), ''), baja_por = auth.uid(), actualizado_en = now() where id = p_id;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('movil', p_id::text, 'Baja', jsonb_build_object('activo', true, 'baja_motivo', null, 'baja_obs', null),
          jsonb_build_object('activo', false, 'baja_motivo', p_motivo, 'baja_obs', nullif(trim(p_obs), '')), auth.uid());
end $$;

create or replace function public.reincorporar_movil(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.movil;
begin
  select * into m from public.movil where id = p_id for update;
  if not found or m.activo then raise exception 'El móvil no está dado de baja.'; end if;
  if not public.puede_cargar(m.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  update public.movil set activo = true, baja_motivo = null, baja_fecha = null, baja_obs = null, baja_por = null, actualizado_en = now() where id = p_id;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('movil', p_id::text, 'Reincorporación', jsonb_build_object('activo', false, 'baja_motivo', m.baja_motivo, 'baja_obs', m.baja_obs),
          jsonb_build_object('activo', true, 'baja_motivo', null, 'baja_obs', null), auth.uid());
end $$;

-- ---------- Personal ----------
create or replace function public.guardar_persona(p_dni text, p jsonb, p_alta boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare x public.personal; nuevo jsonb; viejo jsonb; c record; v_dni text; v_tipo text; v_jer text;
begin
  v_dni := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
  if v_dni !~ '^[0-9]{7,8}$' then raise exception 'El DNI tiene que tener 7 u 8 números.'; end if;
  if coalesce(trim(p->>'apellido'), '') = '' then raise exception 'Falta el apellido.'; end if;
  if coalesce(p->>'unidad', '') = '' then raise exception 'Elegí la división.'; end if;
  if not public.puede_cargar(p->>'unidad') then raise exception 'No tenés permiso para cargar personal en esa división.'; end if;
  v_tipo := p->>'tipo_personal';
  if v_tipo is null or v_tipo not in ('seguridad','tecnico','civil_policial','civil_becario') then raise exception 'Elegí el tipo de personal.'; end if;
  v_jer := case when v_tipo in ('seguridad','tecnico') then nullif(p->>'jerarquia', '') end;
  if v_tipo in ('seguridad','tecnico') and v_jer is null then raise exception 'Elegí la jerarquía.'; end if;
  nuevo := jsonb_build_object('apellido', upper(trim(p->>'apellido')), 'nombre', trim(coalesce(p->>'nombre', '')),
    'tipo_personal', v_tipo, 'jerarquia', v_jer, 'unidad', p->>'unidad', 'funcion', nullif(trim(p->>'funcion'), ''),
    'calle', coalesce((p->>'calle')::boolean, false), 'guardia', nullif(trim(p->>'guardia'), ''), 'horario', nullif(trim(p->>'horario'), ''));

  if p_alta then
    select * into x from public.personal where dni = v_dni;
    if found then raise exception 'El DNI % ya está cargado: %.', v_dni, public.texto_persona(v_dni) || case when x.activo then '' else ' (dado de baja: reincorporalo)' end; end if;
    insert into public.personal (dni, apellido, nombre, tipo_personal, jerarquia, unidad, funcion, calle, guardia, horario)
    values (v_dni, nuevo->>'apellido', nuevo->>'nombre', v_tipo, v_jer, nuevo->>'unidad', nuevo->>'funcion', (nuevo->>'calle')::boolean, nuevo->>'guardia', nuevo->>'horario');
    insert into public.cambio (tabla, registro, accion, despues, usuario) values ('personal', v_dni, 'Alta', nuevo, auth.uid());
    return v_dni;
  end if;

  select * into x from public.personal where dni = v_dni for update;
  if not found then raise exception 'La persona no existe.'; end if;
  if not public.puede_cargar(x.unidad) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  viejo := jsonb_build_object('apellido', x.apellido, 'nombre', x.nombre, 'tipo_personal', x.tipo_personal, 'jerarquia', x.jerarquia,
    'unidad', x.unidad, 'funcion', x.funcion, 'calle', x.calle, 'guardia', x.guardia, 'horario', x.horario);
  select * into c from public.solo_cambios(viejo, nuevo);
  if c.despues = '{}' then raise exception 'No hay cambios para guardar.'; end if;
  update public.personal set apellido = nuevo->>'apellido', nombre = nuevo->>'nombre', tipo_personal = v_tipo, jerarquia = v_jer,
    unidad = nuevo->>'unidad', funcion = nuevo->>'funcion', calle = (nuevo->>'calle')::boolean, guardia = nuevo->>'guardia',
    horario = nuevo->>'horario', actualizado_en = now() where dni = v_dni;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('personal', v_dni, case when c.despues - 'unidad' = '{}' then 'Pase' else 'Datos modificados' end, c.antes, c.despues, auth.uid());
  return v_dni;
end $$;

create or replace function public.baja_persona(p_dni text, p_motivo text, p_obs text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare x public.personal;
begin
  select * into x from public.personal where dni = p_dni for update;
  if not found or not x.activo then raise exception 'La persona no existe o ya está dada de baja.'; end if;
  if not public.puede_cargar(x.unidad) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Elegí el motivo de la baja.'; end if;
  perform public.sacar_de_movil(p_dni, 'baja: ' || p_motivo);
  update public.personal set activo = false, baja_motivo = p_motivo, baja_fecha = now(), baja_obs = nullif(trim(p_obs), ''), baja_por = auth.uid(), actualizado_en = now() where dni = p_dni;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('personal', p_dni, 'Baja', jsonb_build_object('activo', true, 'baja_motivo', null, 'baja_obs', null),
          jsonb_build_object('activo', false, 'baja_motivo', p_motivo, 'baja_obs', nullif(trim(p_obs), '')), auth.uid());
end $$;

create or replace function public.reincorporar_persona(p_dni text)
returns void language plpgsql security definer set search_path = '' as $$
declare x public.personal;
begin
  select * into x from public.personal where dni = p_dni for update;
  if not found or x.activo then raise exception 'La persona no está dada de baja.'; end if;
  if not public.puede_cargar(x.unidad) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  update public.personal set activo = true, baja_motivo = null, baja_fecha = null, baja_obs = null, baja_por = null, actualizado_en = now() where dni = p_dni;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario)
  values ('personal', p_dni, 'Reincorporación', jsonb_build_object('activo', false, 'baja_motivo', x.baja_motivo, 'baja_obs', x.baja_obs),
          jsonb_build_object('activo', true, 'baja_motivo', null, 'baja_obs', null), auth.uid());
end $$;

-- ---------- Deshacer: vuelve atrás el último cambio vigente de un móvil o una persona ----------
create or replace function public.deshacer(p_cambio bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cambio; ultimo bigint; actual jsonb; k text; v_unidad text;
begin
  select * into c from public.cambio where id = p_cambio for update;
  if not found or c.deshecho or c.revierte is not null then raise exception 'Ese cambio ya no se puede deshacer.'; end if;
  if c.accion = 'Alta' then raise exception 'Un alta no se deshace: dalo de baja con el motivo «Cargado por error».'; end if;
  select max(id) into ultimo from public.cambio where tabla = c.tabla and registro = c.registro and not deshecho and revierte is null;
  if ultimo <> c.id then raise exception 'Primero deshacé los cambios más nuevos de este registro.'; end if;

  if c.tabla = 'movil' then
    select to_jsonb(m) into actual from public.movil m where id = c.registro::uuid;
  else
    select to_jsonb(x) into actual from public.personal x where dni = c.registro;
  end if;
  for k in select jsonb_object_keys(c.despues) loop
    if (actual->k) is distinct from (c.despues->k) then
      raise exception 'Los datos cambiaron por otro lado desde entonces: revisalos y editalos a mano.';
    end if;
  end loop;
  v_unidad := actual->>'unidad';
  if not public.puede_cargar(v_unidad) or (c.antes ? 'unidad' and not public.puede_cargar(c.antes->>'unidad')) then
    raise exception 'No tenés permiso para deshacer ese cambio.';
  end if;

  if c.tabla = 'movil' then
    if c.antes ? 'unidad' and exists (select 1 from public.servicio where movil = c.registro::uuid and fin_real is null) then
      raise exception 'Está en servicio: cerralo antes de devolverlo a la otra división.';
    end if;
    if c.antes ? 'interno' and (c.antes->>'interno') is not null and exists (select 1 from public.movil where interno = (c.antes->>'interno')::int and id <> c.registro::uuid) then
      raise exception 'El interno anterior ahora es de otro móvil.';
    end if;
    if c.antes ? 'dominio' and exists (select 1 from public.movil where dominio = c.antes->>'dominio' and id <> c.registro::uuid) then
      raise exception 'La patente anterior ahora es de otro móvil.';
    end if;
    update public.movil m set
      interno  = case when c.antes ? 'interno'  then (c.antes->>'interno')::int else m.interno end,
      dominio  = case when c.antes ? 'dominio'  then c.antes->>'dominio' else m.dominio end,
      programa = case when c.antes ? 'programa' then c.antes->>'programa' else m.programa end,
      tipo     = case when c.antes ? 'tipo'     then c.antes->>'tipo' else m.tipo end,
      marca    = case when c.antes ? 'marca'    then c.antes->>'marca' else m.marca end,
      modelo   = case when c.antes ? 'modelo'   then c.antes->>'modelo' else m.modelo end,
      unidad   = case when c.antes ? 'unidad'   then c.antes->>'unidad' else m.unidad end,
      activo   = case when c.antes ? 'activo'   then (c.antes->>'activo')::boolean else m.activo end,
      baja_motivo = case when c.antes ? 'baja_motivo' then c.antes->>'baja_motivo' else m.baja_motivo end,
      baja_obs = case when c.antes ? 'baja_obs' then c.antes->>'baja_obs' else m.baja_obs end,
      baja_fecha = case when c.antes ? 'activo' and (c.antes->>'activo')::boolean then null else m.baja_fecha end,
      actualizado_en = now()
     where id = c.registro::uuid;
  else
    if c.antes ? 'activo' and not (c.antes->>'activo')::boolean then
      perform public.sacar_de_movil(c.registro, 'vuelve a quedar de baja');
    end if;
    update public.personal x set
      apellido = case when c.antes ? 'apellido' then c.antes->>'apellido' else x.apellido end,
      nombre   = case when c.antes ? 'nombre'   then c.antes->>'nombre' else x.nombre end,
      tipo_personal = case when c.antes ? 'tipo_personal' then c.antes->>'tipo_personal' else x.tipo_personal end,
      jerarquia = case when c.antes ? 'jerarquia' then c.antes->>'jerarquia' else x.jerarquia end,
      unidad   = case when c.antes ? 'unidad'   then c.antes->>'unidad' else x.unidad end,
      funcion  = case when c.antes ? 'funcion'  then c.antes->>'funcion' else x.funcion end,
      calle    = case when c.antes ? 'calle'    then (c.antes->>'calle')::boolean else x.calle end,
      guardia  = case when c.antes ? 'guardia'  then c.antes->>'guardia' else x.guardia end,
      horario  = case when c.antes ? 'horario'  then c.antes->>'horario' else x.horario end,
      activo   = case when c.antes ? 'activo'   then (c.antes->>'activo')::boolean else x.activo end,
      baja_motivo = case when c.antes ? 'baja_motivo' then c.antes->>'baja_motivo' else x.baja_motivo end,
      baja_obs = case when c.antes ? 'baja_obs' then c.antes->>'baja_obs' else x.baja_obs end,
      baja_fecha = case when c.antes ? 'activo' and (c.antes->>'activo')::boolean then null else x.baja_fecha end,
      actualizado_en = now()
     where dni = c.registro;
  end if;
  update public.cambio set deshecho = true where id = c.id;
  insert into public.cambio (tabla, registro, accion, antes, despues, usuario, revierte)
  values (c.tabla, c.registro, 'Deshecho: ' || c.accion, c.despues, c.antes, auth.uid(), c.id);
end $$;

-- ---------- Situaciones ----------
create or replace function public.cargar_situacion(p_dni text, p_tipo text, p_detalle text, p_desde date, p_hasta date, p_obs text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare x public.personal; v_id bigint; hoy date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  select * into x from public.personal where dni = p_dni;
  if not found then raise exception 'La persona no existe.'; end if;
  if not public.puede_cargar(x.unidad) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  if p_desde is null then raise exception 'Falta la fecha de inicio.'; end if;
  if p_hasta is not null and p_hasta < p_desde then raise exception 'La fecha de fin es anterior a la de inicio.'; end if;
  insert into public.situacion_personal (dni, tipo, detalle, desde, hasta, origen, cargado_por)
  values (p_dni, p_tipo, nullif(trim(p_detalle), ''), p_desde, p_hasta, 'app', auth.uid()) returning id into v_id;
  if nullif(trim(p_obs), '') is not null then insert into public.situacion_nota values (v_id, trim(p_obs)); end if;
  if p_desde <= hoy and (p_hasta is null or p_hasta >= hoy) then
    perform public.sacar_de_movil(p_dni, p_tipo);
  end if;
  return v_id;
end $$;

create or replace function public.terminar_situacion(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.situacion_personal; hoy date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  select * into s from public.situacion_personal where id = p_id and not anulada;
  if not found then raise exception 'La situación ya no está vigente.'; end if;
  if not public.puede_cargar((select unidad from public.personal where dni = s.dni)) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  if s.desde > hoy then raise exception 'Todavía no empezó: usá «Quitar».'; end if;
  -- Termina hoy: desde hoy ya está apta. Si empezó hoy mismo, se anula.
  if s.desde >= hoy then
    update public.situacion_personal set anulada = true, anulada_por = auth.uid() where id = p_id;
  else
    update public.situacion_personal set hasta = hoy - 1 where id = p_id;
  end if;
end $$;

create or replace function public.quitar_situacion(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.situacion_personal;
begin
  select * into s from public.situacion_personal where id = p_id and not anulada;
  if not found then raise exception 'La situación ya no está cargada.'; end if;
  if not public.puede_cargar((select unidad from public.personal where dni = s.dni)) then raise exception 'No tenés permiso sobre esa persona.'; end if;
  update public.situacion_personal set anulada = true, anulada_por = auth.uid() where id = p_id;
end $$;

-- ---------- Permisos de ejecución ----------
do $$ declare f text; begin
  foreach f in array array[
    'public.texto_persona(text)', 'public.solo_cambios(jsonb,jsonb)', 'public.sacar_de_movil(text,text)',
    'public.guardar_movil(uuid,jsonb)', 'public.baja_movil(uuid,text,text)', 'public.reincorporar_movil(uuid)',
    'public.guardar_persona(text,jsonb,boolean)', 'public.baja_persona(text,text,text)', 'public.reincorporar_persona(text)',
    'public.deshacer(bigint)', 'public.cargar_situacion(text,text,text,date,date,text)',
    'public.terminar_situacion(bigint)', 'public.quitar_situacion(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.sacar_de_movil(text,text) from authenticated;
grant execute on function
  public.texto_persona(text), public.guardar_movil(uuid,jsonb), public.baja_movil(uuid,text,text), public.reincorporar_movil(uuid),
  public.guardar_persona(text,jsonb,boolean), public.baja_persona(text,text,text), public.reincorporar_persona(text),
  public.deshacer(bigint), public.cargar_situacion(text,text,text,date,date,text),
  public.terminar_situacion(bigint), public.quitar_situacion(bigint)
to authenticated;
