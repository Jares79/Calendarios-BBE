-- Deshace la Fase 4 (solo si no hay empleados en los colectivos nuevos).
-- Borra las semanas especiales y los dos colectivos nuevos.
drop table if exists public.semanas_especiales;
delete from public.colectivos where codigo in ('correturnos','jornada')
    and not exists (select 1 from public.empleados e where e.colectivo in ('correturnos','jornada'));
alter table public.colectivos drop constraint if exists colectivos_marcas_validas;
alter table public.colectivos drop column if exists marcas;
