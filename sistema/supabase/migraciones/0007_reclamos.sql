-- =====================================================================
-- Agenda de Móviles · 0007 · Reclamos del General a los cargadores
--
-- · El General (o el Super Admin) reclama a una Dirección los móviles sin
--   agendar de una guardia, o un móvil puntual.
-- · El reclamo se cierra solo cuando lo pedido se cumple (el móvil se agendó,
--   se reservó o se dio de baja; o la Dirección ya no tiene sin agendar), o a
--   mano. Los resueltos quedan en el registro.
-- · Los servicios vencidos hace más de 30 minutos se muestran como reclamo
--   automático sin guardarse: se calculan en el momento.
-- =====================================================================

create table if not exists public.reclamo (
  id           bigint generated always as identity primary key,
  direccion    text not null references public.unidad(id),
  movil        uuid references public.movil(id),      -- vacío = reclamo por todos los sin agendar
  fecha        date not null,
  turno        text not null references public.turno(id),
  total        int,                                    -- cuántos faltaban al reclamar
  texto        text not null,
  creado_por   uuid references public.perfil(id),
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz,
  resuelto_por uuid references public.perfil(id),
  automatico   boolean not null default false          -- se cerró solo
);
create index if not exists reclamo_abiertos_idx on public.reclamo (direccion) where resuelto_en is null;

alter table public.reclamo enable row level security;
drop policy if exists "leer" on public.reclamo;
create policy "leer" on public.reclamo for select to authenticated using (public.cuenta_activa());

-- Dirección a la que pertenece una unidad
create or replace function public.direccion_de(u text)
returns text language sql stable set search_path = '' as $$
  with recursive arriba as (
    select id, padre, tipo, 0 as n from public.unidad where id = u
    union all
    select x.id, x.padre, x.tipo, a.n + 1 from public.unidad x join arriba a on x.id = a.padre
  )
  select coalesce((select id from arriba where tipo = 'direccion' order by n limit 1), 'G');
$$;

-- Móviles de una Dirección en condiciones de salir que no están agendados ni reservados en esa guardia
create or replace function public.sin_agendar(p_dir text, p_fecha date, p_turno text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.movil m
   where m.activo and public.direccion_de(m.unidad) = p_dir
     and not exists (select 1 from public.servicio s where s.movil = m.id and s.fin_real is null)
     and not exists (select 1 from public.fuera_servicio f where f.movil = m.id and f.hasta is null)
     and not exists (select 1 from public.reserva r where r.movil = m.id and r.fecha = p_fecha and r.turno = p_turno and not r.anulada);
$$;

create or replace function public.reclamar_direccion(p_dir text, p_fecha date, p_turno text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n int; v_id bigint; t text;
begin
  if public.mi_rol() not in ('superadmin','general') then raise exception 'Solo el General puede reclamar.'; end if;
  select count(*) into n from public.sin_agendar(p_dir, p_fecha, p_turno);
  if n = 0 then raise exception 'Esa Dirección no tiene móviles sin agendar.'; end if;
  if exists (select 1 from public.reclamo where direccion = p_dir and movil is null and fecha = p_fecha and turno = p_turno and resuelto_en is null) then
    raise exception 'Ya hay un reclamo abierto para esa Dirección en esta guardia.';
  end if;
  select nombre into t from public.turno where id = p_turno;
  insert into public.reclamo (direccion, fecha, turno, total, texto, creado_por)
  values (p_dir, p_fecha, p_turno, n, 'Faltan agendar ' || n || ' móviles en el ' || t || ' del ' || to_char(p_fecha, 'DD/MM'), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.reclamar_movil(p_movil uuid, p_fecha date, p_turno text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_dir text;
begin
  if public.mi_rol() not in ('superadmin','general') then raise exception 'Solo el General puede reclamar.'; end if;
  if exists (select 1 from public.reclamo where movil = p_movil and resuelto_en is null) then raise exception 'Ese móvil ya tiene un reclamo abierto.'; end if;
  select public.direccion_de(unidad) into v_dir from public.movil where id = p_movil;
  insert into public.reclamo (direccion, movil, fecha, turno, texto, creado_por)
  values (v_dir, p_movil, p_fecha, p_turno, 'Agendar ' || public.texto_movil(p_movil) || ' en el ' || (select nombre from public.turno where id = p_turno) || ' del ' || to_char(p_fecha, 'DD/MM'), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Cierra solos los reclamos ya cumplidos. Se llama al abrir el tablero o la agenda.
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
  return n;
end $$;

-- A mano: el General o un cargador de esa Dirección
create or replace function public.resolver_reclamo(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reclamo;
begin
  select * into r from public.reclamo where id = p_id and resuelto_en is null;
  if not found then raise exception 'Ese reclamo ya está resuelto.'; end if;
  if not public.puede_cargar(r.direccion) then raise exception 'No tenés permiso sobre ese reclamo.'; end if;
  update public.reclamo set resuelto_en = now(), resuelto_por = auth.uid() where id = p_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['public.direccion_de(text)', 'public.sin_agendar(text,date,text)', 'public.reclamar_direccion(text,date,text)',
    'public.reclamar_movil(uuid,date,text)', 'public.revisar_reclamos()', 'public.resolver_reclamo(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
grant execute on function public.direccion_de(text), public.sin_agendar(text,date,text), public.reclamar_direccion(text,date,text),
  public.reclamar_movil(uuid,date,text), public.revisar_reclamos(), public.resolver_reclamo(bigint) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reclamo') then
    alter publication supabase_realtime add table public.reclamo;
  end if;
end $$;
