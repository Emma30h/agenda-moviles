-- 0002 · Tipo de personal (Seguridad, Técnico, Civil Policial, Civil Becario)
-- Los civiles no tienen jerarquía; los técnicos usan las de suboficial.
-- Pegar en Supabase → SQL Editor → Run. Se puede correr más de una vez.

alter table public.perfil add column if not exists tipo_personal text;
update public.perfil set tipo_personal = 'seguridad' where tipo_personal is null;
alter table public.perfil alter column tipo_personal set not null;
do $$ begin
  alter table public.perfil add constraint perfil_tipo_personal_chk
    check (tipo_personal in ('seguridad','tecnico','civil_policial','civil_becario'));
exception when duplicate_object then null; end $$;

alter table public.perfil alter column jerarquia drop not null;
update public.perfil set jerarquia = null where jerarquia = '' or jerarquia = 'Personal Civil';
do $$ begin
  alter table public.perfil add constraint perfil_jerarquia_chk
    check ((tipo_personal in ('seguridad','tecnico')) = (jerarquia is not null));
exception when duplicate_object then null; end $$;

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := new.raw_user_meta_data;
begin
  insert into public.perfil (id, dni, apellido, nombre, tipo_personal, jerarquia, telefono, correo, dependencia, rol_pedido, jurisdiccion_pedida)
  values (
    new.id,
    d->>'dni', d->>'apellido', d->>'nombre',
    coalesce(nullif(d->>'tipo_personal',''), 'seguridad'),
    nullif(d->>'jerarquia',''),
    nullif(d->>'telefono',''),
    lower(new.email), d->>'dependencia',
    (d->>'rol_pedido')::public.rol_usuario,
    nullif(d->>'jurisdiccion_pedida','')
  );
  return new;
end $$;
