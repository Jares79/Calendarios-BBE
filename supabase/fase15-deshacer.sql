drop function if exists public.admin_guardar_anual_ver(uuid, text[]);
alter table public.empleados drop column if exists anual_ver;
