-- =====================================================================
-- FASE 1 · DESHACER
-- Solo si quieres volver al estado anterior a la Fase 1. Borra las tablas
-- nuevas y los usuarios de Supabase Auth creados para la app.
-- NO toca la tabla "usuarios" ni las funciones antiguas.
-- =====================================================================

delete from auth.users where email like '%@calendario-bbe.app';   -- borra también sus perfiles

drop function if exists public.admin_crear_empleado(text, text, text, date, text);
drop function if exists public.admin_editar_empleado(uuid, text, text, text, date, boolean, text);
drop function if exists public.admin_crear_acceso(uuid, text);
drop function if exists public.admin_resetear_acceso(text);
drop function if exists public.admin_eliminar_empleado(uuid);
drop function if exists public.admin_eliminar_familiar(uuid);
drop function if exists public._crear_acceso(uuid, text);
drop function if exists public._crear_auth_usuario(text, text);
drop function if exists public._pin_aleatorio();
drop function if exists public.mi_perfil();
drop function if exists public.pin_cambiado();

drop table if exists public.perfiles;
drop table if exists public.empleados;
drop table if exists public.colectivos;

drop function if exists public.mi_rol();
drop function if exists public.mi_empleado();
