-- =====================================================================
-- Agenda de Móviles · 0011 · Anular un reclamo o un reporte cargado por error
--
-- · No se borra: se cierra marcado como «anulado», con quién y cuándo, y
--   aparece aparte de los resueltos de verdad.
-- · Reclamos: los anula el General o el Super Admin (son quienes reclaman).
-- · Reportes de frecuencia: el General, el Super Admin, Monitoreo o quien lo cargó.
-- =====================================================================

alter table public.reclamo add column if not exists anulado boolean not null default false;
alter table public.reporte_frecuencia add column if not exists anulado boolean not null default false;

create or replace function public.anular_reclamo(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_general() then raise exception 'Solo el General anula reclamos.'; end if;
  update public.reclamo set resuelto_en = now(), resuelto_por = auth.uid(), anulado = true, automatico = false
   where id = p_id and resuelto_en is null;
  if not found then raise exception 'Ese reclamo ya no está abierto.'; end if;
end $$;

create or replace function public.anular_reporte(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reporte_frecuencia;
begin
  select * into r from public.reporte_frecuencia where id = p_id and resuelto_en is null for update;
  if not found then raise exception 'Ese reporte ya no está abierto.'; end if;
  if not (public.mi_rol() in ('superadmin','general','monitoreo') or r.creado_por = auth.uid()) then
    raise exception 'No tenés permiso para anular ese reporte.';
  end if;
  update public.reporte_frecuencia set resuelto_en = now(), resuelto_por = auth.uid(), anulado = true, automatico = false where id = p_id;
  if r.movil is not null then
    perform public.anotar('Reporte de frecuencia anulado', r.movil, null, null, null, 'Se había cargado por error: «' || r.texto || '»');
  end if;
end $$;

do $$ declare f text; begin
  foreach f in array array['public.anular_reclamo(bigint)', 'public.anular_reporte(bigint)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
