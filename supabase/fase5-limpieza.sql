-- =====================================================================
-- FASE 5 · Limpieza programada de solicitudes de cambio (opcional pero recomendada)
-- Antes: en Supabase > Database > Extensions, activar "pg_cron".
-- Después: ejecutar esto en SQL Editor. Repite la limpieza cada 15 minutos.
-- Aunque no se programe, la app también llama a la limpieza al abrir y cada pocos minutos.
-- =====================================================================
select cron.schedule('limpiar-cambios', '*/15 * * * *', $$select public.limpiar_cambios()$$);

-- Para quitar la tarea programada más adelante:
-- select cron.unschedule('limpiar-cambios');
