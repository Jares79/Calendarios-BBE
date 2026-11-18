-- Deshace la fase 10 (solo si hiciera falta). No toca horas_dia.
-- Antes de ejecutarlo hay que quitar a mano los días con baja (B) del calendario.
delete from public.excepciones where codigo = 'B';
alter table public.excepciones drop constraint if exists excepciones_codigo_valido;
alter table public.excepciones add constraint excepciones_codigo_valido
    check (codigo in ('M','T','N','F','P','I','S','V','E','J','LD'));
drop function if exists public.admin_guardar_ver_horas(uuid, boolean);
alter table public.empleados drop column if exists ver_horas;
alter table public.config_horas drop constraint if exists config_horas_ld;
alter table public.config_horas drop column if exists dias_ld;
-- (guardar_colores admite B y las políticas de horas_anuales dejan escribir a cada uno: vuelven a la versión de la fase 9 ejecutando de nuevo fase9-reorganizacion.sql)
