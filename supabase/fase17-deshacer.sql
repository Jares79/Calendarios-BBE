-- Deshace la fase 17 (avisos push): borra triggers, funciones y tablas de avisos.
drop trigger if exists push_solicitud on public.cambios_solicitudes;
drop trigger if exists push_mensaje   on public.cambios_mensajes;
drop function if exists public.tg_push_solicitud();
drop function if exists public.tg_push_mensaje();
drop function if exists public.push_avisar(text, uuid);
drop function if exists public.push_guardar(text, text, text);
drop function if exists public.push_preferencias(text, boolean, boolean);
drop function if exists public.push_borrar(text);
drop table if exists public.push_suscripciones;
drop table if exists public.push_config;
