-- Deshace la Fase 5 (borra todas las solicitudes de cambio y sus mensajes).
drop function if exists public.limpiar_cambios();
drop function if exists public.marcar_visto_cambio(uuid);
drop function if exists public.cancelar_cambio(uuid);
drop function if exists public.responder_cambio(uuid, boolean);
drop function if exists public.enviar_mensaje_cambio(uuid, text);
drop function if exists public.crear_cambios(uuid, jsonb, text);
drop function if exists public.hoy_es();
drop table if exists public.cambios_mensajes;
drop table if exists public.cambios_dias;
drop table if exists public.cambios_solicitudes;
-- Si programaste la limpieza: select cron.unschedule('limpiar-cambios');
