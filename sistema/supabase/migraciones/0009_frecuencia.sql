-- =====================================================================
-- Agenda de Móviles · 0009 · Móvil escuchado en frecuencia
--
-- · Monitoreo (o cualquier cuenta activa) consulta lo que escucha en la
--   frecuencia: designación, interno o patente. Si el móvil no está agendado
--   queda un reporte para la Dirección que lo usa.
-- · El reporte se cierra solo cuando ese móvil se agenda, o a mano.
-- · Un servicio puede cambiar de designación (ej. URCA 10 pasa a CENTENO 20):
--   se guardan las anteriores para poder ubicarlo por cualquiera de ellas.
-- =====================================================================

alter table public.servicio add column if not exists designaciones_previas text[] not null default '{}';

create table if not exists public.reporte_frecuencia (
  id           bigint generated always as identity primary key,
  texto        text not null,                         -- lo que se escuchó
  movil        uuid references public.movil(id),      -- vacío = no figura en la flota
  direccion    text references public.unidad(id),     -- Dirección que usa el móvil
  creado_por   uuid references public.perfil(id),
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz,
  resuelto_por uuid references public.perfil(id),
  automatico   boolean not null default false
);
create index if not exists reporte_abiertos_idx on public.reporte_frecuencia (direccion) where resuelto_en is null;

alter table public.reporte_frecuencia enable row level security;
drop policy if exists "leer" on public.reporte_frecuencia;
create policy "leer" on public.reporte_frecuencia for select to authenticated using (public.cuenta_activa());

create or replace function public.reportar_frecuencia(p_texto text, p_movil uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_txt text := upper(trim(p_texto)); v_dir text;
begin
  if not public.cuenta_activa() then raise exception 'Tu cuenta no está activa.'; end if;
  if v_txt = '' then raise exception 'Escribí lo que se escuchó.'; end if;
  if p_movil is not null and exists (select 1 from public.servicio where movil = p_movil and fin_real is null) then
    raise exception 'Ese móvil está agendado: no hace falta el reporte.';
  end if;
  select id into v_id from public.reporte_frecuencia
   where resuelto_en is null and ((p_movil is not null and movil = p_movil) or (p_movil is null and movil is null and texto = v_txt));
  if found then return v_id; end if;   -- ya había uno abierto
  if p_movil is not null then v_dir := public.direccion_de(public.unidad_que_usa(p_movil)); end if;
  insert into public.reporte_frecuencia (texto, movil, direccion, creado_por) values (v_txt, p_movil, v_dir, auth.uid()) returning id into v_id;
  perform public.anotar('Reporte de frecuencia', p_movil, null, null, case when p_movil is null then null else public.unidad_que_usa(p_movil) end,
    case when p_movil is null then '«' || v_txt || '» salió por frecuencia y no figura en la flota'
         else public.texto_movil(p_movil) || ' salió por frecuencia sin estar agendado (se escuchó «' || v_txt || '»)' end);
  return v_id;
end $$;

create or replace function public.resolver_reporte(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reporte_frecuencia;
begin
  select * into r from public.reporte_frecuencia where id = p_id and resuelto_en is null;
  if not found then raise exception 'Ese reporte ya está resuelto.'; end if;
  if not (public.mi_rol() in ('superadmin','general','monitoreo') or (r.direccion is not null and public.puede_cargar(r.direccion))) then
    raise exception 'No tenés permiso sobre ese reporte.';
  end if;
  update public.reporte_frecuencia set resuelto_en = now(), resuelto_por = auth.uid() where id = p_id;
end $$;

-- Los reportes de móviles que ya se agendaron se cierran solos (junto con los reclamos)
create or replace function public.revisar_reclamos()
returns int language plpgsql security definer set search_path = '' as $$
declare r public.reclamo; n int := 0;
begin
  if not public.cuenta_activa() then return 0; end if;
  for r in select * from public.reclamo where resuelto_en is null for update loop
    if (r.movil is not null and (
          exists (select 1 from public.servicio s where s.movil = r.movil and s.fin_real is null)
          or exists (select 1 from public.reserva x where x.movil = r.movil and x.fecha = r.fecha and x.turno = r.turno and not x.anulada)
          or not (select activo from public.movil where id = r.movil)))
       or (r.movil is null and not exists (select 1 from public.sin_agendar(r.direccion, r.fecha, r.turno))) then
      update public.reclamo set resuelto_en = now(), automatico = true where id = r.id;
      n := n + 1;
    end if;
  end loop;
  update public.reporte_frecuencia f set resuelto_en = now(), automatico = true
   where f.resuelto_en is null and f.movil is not null
     and exists (select 1 from public.servicio s where s.movil = f.movil and s.fin_real is null);
  return n;
end $$;

-- Cambio de designación durante el servicio
create or replace function public.cambiar_designacion(p_servicio uuid, p_designacion text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.servicio; v_nueva text := nullif(upper(trim(p_designacion)), '');
begin
  select * into s from public.servicio where id = p_servicio for update;
  if not found or s.fin_real is not null then raise exception 'Ese servicio ya no está abierto.'; end if;
  if not public.puede_cargar(s.unidad) then raise exception 'No tenés permiso sobre ese móvil.'; end if;
  if v_nueva is null then raise exception 'Escribí la nueva designación.'; end if;
  if v_nueva = s.designacion then raise exception 'Es la misma designación.'; end if;
  update public.servicio set designacion = v_nueva,
    designaciones_previas = case when s.designacion is null then designaciones_previas else array_append(designaciones_previas, s.designacion) end
   where id = s.id;
  perform public.anotar('Cambio de designación', s.movil, s.id, null, s.unidad,
    public.texto_movil(s.movil) || ' · ' || coalesce(s.designacion, 'sin designación') || ' → ' || v_nueva);
end $$;

do $$ declare f text; begin
  foreach f in array array['public.reportar_frecuencia(text,uuid)', 'public.resolver_reporte(bigint)', 'public.cambiar_designacion(uuid,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reporte_frecuencia') then
    alter publication supabase_realtime add table public.reporte_frecuencia;
  end if;
end $$;
