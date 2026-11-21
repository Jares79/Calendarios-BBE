-- Deshace la parte de horas de la Fase 6 (borra las horas configuradas).
-- Para volver al comportamiento anterior de los cambios, vuelve a ejecutar fase5-cambios.sql.
drop table if exists public.horas_anuales;
drop table if exists public.config_horas;
drop table if exists public.horas_turno;
