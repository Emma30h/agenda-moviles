-- =====================================================================
-- Agenda de Móviles · 0004 · Cerrar el acceso público a las funciones internas
-- Por defecto Postgres deja que cualquiera ejecute una función, y Supabase las
-- publica en /rest/v1/rpc. Acá se quita ese permiso:
--   · Visitantes sin sesión (anon): ninguna función nuestra.
--   · Cuentas con sesión: solo las que usan las reglas de seguridad (RLS).
--   · Disparadores y limpieza: solo la base y el servidor (service_role).
-- No toca datos. Se puede correr más de una vez.
-- =====================================================================

-- Disparadores y mantenimiento: nadie desde la API
revoke execute on function public.crear_perfil()      from public, anon, authenticated;
revoke execute on function public.correo_confirmado() from public, anon, authenticated;
revoke execute on function public.limpiar_intentos()  from public, anon, authenticated;
grant  execute on function public.limpiar_intentos()  to service_role;

-- Funciones que usan las reglas de seguridad: solo cuentas con sesión
revoke execute on function public.es_superadmin()            from public, anon;
revoke execute on function public.mi_rol()                   from public, anon;
revoke execute on function public.mi_jurisdiccion()          from public, anon;
revoke execute on function public.cuenta_activa()            from public, anon;
revoke execute on function public.puede_cargar(text)         from public, anon;
revoke execute on function public.unidad_dentro_de(text, text) from public, anon;
grant  execute on function public.es_superadmin(), public.mi_rol(), public.mi_jurisdiccion(),
                           public.cuenta_activa(), public.puede_cargar(text),
                           public.unidad_dentro_de(text, text)
  to authenticated, service_role;

-- Las funciones nuevas que se creen en public no quedan abiertas por defecto
alter default privileges in schema public revoke execute on functions from public, anon;
