-- =====================================================================
-- FASE 5 · Solicitudes de cambio de turno entre compañeros
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez,
-- DESPUÉS de los scripts de las fases 1, 3 y 4.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Una solicitud = un intercambio de turnos entre dos compañeros del mismo colectivo,
-- de uno o varios días. Al aceptarla, el cambio se aplica a los dos calendarios.
-- Nada se escribe directamente en estas tablas: todo pasa por las funciones de abajo.
-- =====================================================================

-- 1) Tablas -------------------------------------------------------------
create table if not exists public.cambios_solicitudes (
    id                  uuid primary key default gen_random_uuid(),
    solicitante_id      uuid not null references public.empleados(id) on delete cascade,
    destinatario_id     uuid not null references public.empleados(id) on delete cascade,
    estado              text not null default 'pendiente',
    primer_dia          date not null,
    visto_solicitante   boolean not null default true,
    visto_destinatario  boolean not null default false,
    creada_en           timestamptz not null default now(),
    cerrada_en          timestamptz,
    constraint cambios_estado_valido
        check (estado in ('pendiente','aceptada','rechazada','cancelada','caducada')),
    constraint cambios_personas_distintas check (solicitante_id <> destinatario_id)
);

create table if not exists public.cambios_dias (
    solicitud_id         uuid not null references public.cambios_solicitudes(id) on delete cascade,
    fecha                date not null,
    codigo_solicitante   text not null,   -- turno del solicitante ese día (pasará al destinatario)
    codigo_destinatario  text not null,   -- turno del destinatario ese día (pasará al solicitante)
    primary key (solicitud_id, fecha),
    constraint cambios_dias_codigos_validos
        check (codigo_solicitante  in ('M','T','N','P','I','S','F')
           and codigo_destinatario in ('M','T','N','P','I','S','F'))
);

create table if not exists public.cambios_mensajes (
    id           uuid primary key default gen_random_uuid(),
    solicitud_id uuid not null references public.cambios_solicitudes(id) on delete cascade,
    autor_id     uuid not null references public.empleados(id) on delete cascade,
    texto        text not null,
    creado_en    timestamptz not null default now(),
    constraint cambios_mensajes_texto check (char_length(texto) between 1 and 500)
);

create index if not exists cambios_solicitudes_solicitante  on public.cambios_solicitudes (solicitante_id);
create index if not exists cambios_solicitudes_destinatario on public.cambios_solicitudes (destinatario_id);
create index if not exists cambios_solicitudes_cierre       on public.cambios_solicitudes (cerrada_en);
create index if not exists cambios_mensajes_solicitud       on public.cambios_mensajes (solicitud_id);

-- 2) Permisos: solo lectura de lo propio; las escrituras van por funciones -------------
alter table public.cambios_solicitudes enable row level security;
alter table public.cambios_dias        enable row level security;
alter table public.cambios_mensajes    enable row level security;

revoke all on public.cambios_solicitudes, public.cambios_dias, public.cambios_mensajes from anon, authenticated;
grant select on public.cambios_solicitudes, public.cambios_dias, public.cambios_mensajes to authenticated;

drop policy if exists cambios_solicitudes_leer on public.cambios_solicitudes;
drop policy if exists cambios_dias_leer        on public.cambios_dias;
drop policy if exists cambios_mensajes_leer    on public.cambios_mensajes;

create policy cambios_solicitudes_leer on public.cambios_solicitudes
    for select to authenticated using (
        public.mi_rol() in ('administrador','supervisor','empleado')
        and (solicitante_id = public.mi_empleado() or destinatario_id = public.mi_empleado())
    );
create policy cambios_dias_leer on public.cambios_dias
    for select to authenticated using (
        exists (select 1 from public.cambios_solicitudes s
                where s.id = solicitud_id
                  and public.mi_rol() in ('administrador','supervisor','empleado')
                  and (s.solicitante_id = public.mi_empleado() or s.destinatario_id = public.mi_empleado()))
    );
create policy cambios_mensajes_leer on public.cambios_mensajes
    for select to authenticated using (
        exists (select 1 from public.cambios_solicitudes s
                where s.id = solicitud_id
                  and public.mi_rol() in ('administrador','supervisor','empleado')
                  and (s.solicitante_id = public.mi_empleado() or s.destinatario_id = public.mi_empleado()))
    );

-- 3) Funciones ------------------------------------------------------------

-- Fecha de hoy en España
create or replace function public.hoy_es()
returns date
language sql stable
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- Crea una solicitud de intercambio con un compañero.
-- p_dias: [{"fecha":"2026-12-01","codigo_solicitante":"M","codigo_destinatario":"T"}, ...]
create or replace function public.crear_cambios(p_destinatario uuid, p_dias jsonb, p_mensaje text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo      uuid := public.mi_empleado();
    v_rol     text := public.mi_rol();
    v_col_yo  text;
    v_col_des text;
    v_dia     jsonb;
    v_fecha   date;
    v_primer  date;
    v_id      uuid;
    v_validos text[] := array['M','T','N','P','I','S','F'];
begin
    if v_yo is null or v_rol is null or v_rol = 'familiar' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select colectivo into v_col_yo  from public.empleados where id = v_yo          and activo;
    select colectivo into v_col_des from public.empleados where id = p_destinatario and activo;
    if v_col_yo is null or v_col_des is null or p_destinatario = v_yo or v_col_yo <> v_col_des then
        return jsonb_build_object('ok', false, 'motivo', 'destinatario_invalido');
    end if;
    -- Solo los colectivos de turnos (los de semanas especiales no usan este sistema)
    if exists (select 1 from public.colectivos where codigo = v_col_yo and cardinality(marcas) > 0) then
        return jsonb_build_object('ok', false, 'motivo', 'colectivo_no_permitido');
    end if;

    if p_dias is null or jsonb_typeof(p_dias) <> 'array'
       or jsonb_array_length(p_dias) < 1 or jsonb_array_length(p_dias) > 31 then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    for v_dia in select value from jsonb_array_elements(p_dias) loop
        begin
            v_fecha := (v_dia ->> 'fecha')::date;
        exception when others then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
        end;
        if v_fecha is null
           or coalesce((v_dia ->> 'codigo_solicitante')  = any (v_validos), false) = false
           or coalesce((v_dia ->> 'codigo_destinatario') = any (v_validos), false) = false then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
        end if;
        -- Solo desde mañana: la solicitud caduca el propio día del cambio
        if v_fecha <= public.hoy_es() then
            return jsonb_build_object('ok', false, 'motivo', 'fecha_pasada');
        end if;
        -- Un mismo día no puede estar en dos solicitudes abiertas de las mismas personas
        if exists (
            select 1 from public.cambios_dias d
            join public.cambios_solicitudes s on s.id = d.solicitud_id
            where s.estado = 'pendiente' and d.fecha = v_fecha
              and (s.solicitante_id in (v_yo, p_destinatario) or s.destinatario_id in (v_yo, p_destinatario))
        ) then
            return jsonb_build_object('ok', false, 'motivo', 'ya_hay_solicitud');
        end if;
    end loop;

    if (select count(distinct x ->> 'fecha') from jsonb_array_elements(p_dias) x) <> jsonb_array_length(p_dias) then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    select min((x ->> 'fecha')::date) into v_primer from jsonb_array_elements(p_dias) x;

    insert into public.cambios_solicitudes (solicitante_id, destinatario_id, primer_dia)
    values (v_yo, p_destinatario, v_primer)
    returning id into v_id;

    insert into public.cambios_dias (solicitud_id, fecha, codigo_solicitante, codigo_destinatario)
    select v_id, (x ->> 'fecha')::date, x ->> 'codigo_solicitante', x ->> 'codigo_destinatario'
    from jsonb_array_elements(p_dias) x;

    if p_mensaje is not null and btrim(p_mensaje) <> '' then
        insert into public.cambios_mensajes (solicitud_id, autor_id, texto)
        values (v_id, v_yo, left(btrim(p_mensaje), 500));
    end if;

    return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Mensaje dentro de una solicitud abierta (lo pueden escribir las dos personas)
create or replace function public.enviar_mensaje_cambio(p_solicitud uuid, p_texto text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo uuid := public.mi_empleado();
    v_s  public.cambios_solicitudes%rowtype;
    v_texto text := left(btrim(coalesce(p_texto, '')), 500);
begin
    select * into v_s from public.cambios_solicitudes where id = p_solicitud;
    if not found or v_yo is null or v_yo not in (v_s.solicitante_id, v_s.destinatario_id)
       or public.mi_rol() not in ('administrador','supervisor','empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_s.estado <> 'pendiente' or v_s.primer_dia <= public.hoy_es() then
        return jsonb_build_object('ok', false, 'motivo', 'ya_cerrada');
    end if;
    if v_texto = '' then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    insert into public.cambios_mensajes (solicitud_id, autor_id, texto) values (p_solicitud, v_yo, v_texto);
    if v_yo = v_s.solicitante_id then
        update public.cambios_solicitudes set visto_destinatario = false where id = p_solicitud;
    else
        update public.cambios_solicitudes set visto_solicitante = false where id = p_solicitud;
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

-- El destinatario acepta o rechaza. Al aceptar, cada uno recibe el turno del otro (cambio manual).
create or replace function public.responder_cambio(p_solicitud uuid, p_aceptar boolean)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo uuid := public.mi_empleado();
    v_s  public.cambios_solicitudes%rowtype;
    v_d  record;
begin
    select * into v_s from public.cambios_solicitudes where id = p_solicitud for update;
    if not found or v_yo is null or v_s.destinatario_id <> v_yo
       or public.mi_rol() not in ('administrador','supervisor','empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_s.estado <> 'pendiente' then
        return jsonb_build_object('ok', false, 'motivo', 'ya_cerrada');
    end if;
    if v_s.primer_dia <= public.hoy_es() then
        update public.cambios_solicitudes
           set estado = 'caducada', cerrada_en = now(), visto_solicitante = false, visto_destinatario = false
         where id = p_solicitud;
        return jsonb_build_object('ok', false, 'motivo', 'caducada');
    end if;

    if p_aceptar then
        for v_d in select * from public.cambios_dias where solicitud_id = p_solicitud loop
            insert into public.excepciones (empleado_id, fecha, codigo)
            values (v_s.solicitante_id, v_d.fecha, v_d.codigo_destinatario)
            on conflict (empleado_id, fecha) do update set codigo = excluded.codigo;

            insert into public.excepciones (empleado_id, fecha, codigo)
            values (v_s.destinatario_id, v_d.fecha, v_d.codigo_solicitante)
            on conflict (empleado_id, fecha) do update set codigo = excluded.codigo;
        end loop;
    end if;

    update public.cambios_solicitudes
       set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
           cerrada_en = now(), visto_solicitante = false, visto_destinatario = true
     where id = p_solicitud;
    return jsonb_build_object('ok', true);
end;
$$;

-- El solicitante cancela una solicitud que sigue pendiente
create or replace function public.cancelar_cambio(p_solicitud uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo uuid := public.mi_empleado();
    v_s  public.cambios_solicitudes%rowtype;
begin
    select * into v_s from public.cambios_solicitudes where id = p_solicitud for update;
    if not found or v_yo is null or v_s.solicitante_id <> v_yo
       or public.mi_rol() not in ('administrador','supervisor','empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_s.estado <> 'pendiente' then
        return jsonb_build_object('ok', false, 'motivo', 'ya_cerrada');
    end if;
    update public.cambios_solicitudes
       set estado = 'cancelada', cerrada_en = now(), visto_solicitante = true, visto_destinatario = false
     where id = p_solicitud;
    return jsonb_build_object('ok', true);
end;
$$;

-- Marca como vista una solicitud (quita el globo de esa solicitud para quien la abre)
create or replace function public.marcar_visto_cambio(p_solicitud uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo uuid := public.mi_empleado();
begin
    if v_yo is null then return; end if;
    update public.cambios_solicitudes set visto_solicitante  = true where id = p_solicitud and solicitante_id  = v_yo;
    update public.cambios_solicitudes set visto_destinatario = true where id = p_solicitud and destinatario_id = v_yo;
end;
$$;

-- Limpieza: las pendientes caducan el día del cambio y lo cerrado se borra a las 24 horas.
-- La app la llama al abrir y cada pocos minutos; además se puede programar (fase5-limpieza.sql).
create or replace function public.limpiar_cambios()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
    update public.cambios_solicitudes
       set estado = 'caducada', cerrada_en = now(), visto_solicitante = false, visto_destinatario = false
     where estado = 'pendiente' and primer_dia <= public.hoy_es();

    delete from public.cambios_solicitudes
     where cerrada_en is not null and cerrada_en < now() - interval '24 hours';
end;
$$;

-- 4) Quién puede llamar a las funciones
revoke all on function public.hoy_es()                                    from public, anon;
revoke all on function public.crear_cambios(uuid, jsonb, text)            from public, anon;
revoke all on function public.enviar_mensaje_cambio(uuid, text)           from public, anon;
revoke all on function public.responder_cambio(uuid, boolean)             from public, anon;
revoke all on function public.cancelar_cambio(uuid)                       from public, anon;
revoke all on function public.marcar_visto_cambio(uuid)                   from public, anon;
revoke all on function public.limpiar_cambios()                           from public, anon;

grant execute on function public.hoy_es()                                 to authenticated;
grant execute on function public.crear_cambios(uuid, jsonb, text)         to authenticated;
grant execute on function public.enviar_mensaje_cambio(uuid, text)        to authenticated;
grant execute on function public.responder_cambio(uuid, boolean)          to authenticated;
grant execute on function public.cancelar_cambio(uuid)                    to authenticated;
grant execute on function public.marcar_visto_cambio(uuid)                to authenticated;
grant execute on function public.limpiar_cambios()                        to authenticated;
