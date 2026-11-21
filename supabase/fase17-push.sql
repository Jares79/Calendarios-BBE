-- =====================================================================
-- FASE 17 · Avisos (notificaciones push) de solicitudes de cambio y mensajes
-- Ejecutar en Supabase > SQL Editor (botón Run). Se puede repetir sin problema.
-- Antes: Database > Extensions > activar "pg_net" (si no lo está).
-- Después de ejecutar, leer PUSH-CONFIGURAR.md (claves, función y el UPDATE de push_config).
-- =====================================================================
create extension if not exists pg_net with schema extensions;

-- 1) Dispositivos que quieren avisos (uno por navegador/móvil) ---------
create table if not exists public.push_suscripciones (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    empleado_id     uuid not null references public.empleados(id) on delete cascade,
    endpoint        text not null unique,
    p256dh          text not null,
    auth            text not null,
    avisar_cambios  boolean not null default true,
    avisar_mensajes boolean not null default true,
    creada_en       timestamptz not null default now()
);
create index if not exists push_suscripciones_empleado on public.push_suscripciones (empleado_id);
create index if not exists push_suscripciones_usuario  on public.push_suscripciones (user_id);

alter table public.push_suscripciones enable row level security;
revoke all on public.push_suscripciones from anon, authenticated;
grant select on public.push_suscripciones to authenticated;
drop policy if exists push_suscripciones_leer on public.push_suscripciones;
create policy push_suscripciones_leer on public.push_suscripciones
    for select to authenticated using (user_id = auth.uid());

-- La función de envío (enviar-push) usa el rol service_role y necesita permiso expreso sobre estas tablas
grant select, insert, update, delete on public.push_suscripciones to service_role;
grant select on public.empleados, public.cambios_solicitudes, public.cambios_mensajes to service_role;

-- 2) Dónde está la función que envía (se rellena con un UPDATE; nadie desde la app puede leerlo)
create table if not exists public.push_config (
    id      int primary key default 1 check (id = 1),
    url     text,
    secreto text
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- 3) Funciones que usa la app ------------------------------------------
create or replace function public.push_guardar(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_emp  uuid := public.mi_empleado();
begin
    if v_user is null or v_emp is null or public.mi_rol() not in ('administrador','supervisor','empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
       or length(coalesce(p_p256dh, '')) < 10 or length(coalesce(p_auth, '')) < 4 then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    insert into public.push_suscripciones (user_id, empleado_id, endpoint, p256dh, auth)
    values (v_user, v_emp, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update
        set user_id = excluded.user_id, empleado_id = excluded.empleado_id,
            p256dh = excluded.p256dh, auth = excluded.auth;

    -- Máximo 5 dispositivos por persona: se conservan los más recientes
    delete from public.push_suscripciones
     where user_id = v_user
       and id not in (select id from public.push_suscripciones where user_id = v_user order by creada_en desc limit 5);

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.push_preferencias(p_endpoint text, p_cambios boolean, p_mensajes boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
    update public.push_suscripciones
       set avisar_cambios = coalesce(p_cambios, avisar_cambios), avisar_mensajes = coalesce(p_mensajes, avisar_mensajes)
     where endpoint = p_endpoint and user_id = auth.uid();
    return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.push_borrar(p_endpoint text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
    delete from public.push_suscripciones where endpoint = p_endpoint and user_id = auth.uid();
    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.push_guardar(text, text, text)          from public, anon;
revoke all on function public.push_preferencias(text, boolean, boolean) from public, anon;
revoke all on function public.push_borrar(text)                       from public, anon;
grant execute on function public.push_guardar(text, text, text)          to authenticated;
grant execute on function public.push_preferencias(text, boolean, boolean) to authenticated;
grant execute on function public.push_borrar(text)                       to authenticated;

-- 4) Avisar a la función de envío cuando pasa algo ----------------------
-- Un fallo al avisar NUNCA debe impedir un cambio de turno: cualquier error se ignora.
create or replace function public.push_avisar(p_tipo text, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_url text;
    v_sec text;
begin
    select url, secreto into v_url, v_sec from public.push_config where id = 1;
    if coalesce(v_url, '') = '' or coalesce(v_sec, '') = '' then return; end if;
    perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-secret', v_sec),
        body    := jsonb_build_object('tipo', p_tipo, 'id', p_id)
    );
exception when others then
    null;
end;
$$;
revoke all on function public.push_avisar(text, uuid) from public, anon, authenticated;

create or replace function public.tg_push_solicitud()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if new.estado = 'pendiente' then perform public.push_avisar('solicitud_nueva', new.id); end if;
    elsif old.estado = 'pendiente' and new.estado <> old.estado then
        if new.estado in ('aceptada', 'rechazada') then perform public.push_avisar('solicitud_resuelta', new.id);
        elsif new.estado = 'cancelada'              then perform public.push_avisar('solicitud_cancelada', new.id);
        end if;
    end if;
    return null;
end;
$$;

create or replace function public.tg_push_mensaje()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    perform public.push_avisar('mensaje', new.id);
    return null;
end;
$$;

drop trigger if exists push_solicitud on public.cambios_solicitudes;
create trigger push_solicitud after insert or update of estado on public.cambios_solicitudes
    for each row execute function public.tg_push_solicitud();

drop trigger if exists push_mensaje on public.cambios_mensajes;
create trigger push_mensaje after insert on public.cambios_mensajes
    for each row execute function public.tg_push_mensaje();
