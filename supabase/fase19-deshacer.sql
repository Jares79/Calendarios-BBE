-- Deshacer la fase 19: quita la función de guardado en una sola operación y los avisos en tiempo real.
-- La app sigue funcionando: guarda por partes, como antes, y se actualiza al volver a abrirla.
drop function if exists public.guardar_turnos(jsonb, jsonb, jsonb, jsonb);

do $$
declare
    t text;
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        foreach t in array array['excepciones', 'semanas_especiales', 'marcas_dia',
                                 'empleados', 'colectivos', 'festivos', 'intensivas'] loop
            if exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
                execute format('alter publication supabase_realtime drop table public.%I', t);
            end if;
        end loop;
    end if;
end $$;
