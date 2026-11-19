-- Deshace la fase 12 (solo si hiciera falta). Antes hay que vaciar y borrar a mano los subgrupos nuevos.
drop function if exists public.admin_crear_subgrupo(text);
drop function if exists public.admin_renombrar_subgrupo(text, text);
drop function if exists public.admin_borrar_subgrupo(text);
alter table public.colectivos drop constraint if exists colectivos_dias_solape_rango;
update public.colectivos set nombre = 'Personal de jornada partida' where codigo = 'jornada' and nombre = 'Sin subgrupo';
