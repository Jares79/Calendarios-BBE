-- =====================================================================
-- FASE 6 · Horas y convenio, y cambios de los correturnos con los colectivos de turnos
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez,
-- DESPUÉS de los scripts de las fases 1, 3, 4 y 5.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Horas que cuenta cada turno (las pone el administrador; 0 = no suma horas)
create table if not exists public.horas_turno (
    codigo text primary key,
    horas  numeric(5,2) not null default 0,
    constraint horas_turno_codigo check (codigo in ('M','T','N','P','I','S','V','E','J','LD')),
    constraint horas_turno_rango  check (horas >= 0 and horas <= 24)
);
insert into public.horas_turno (codigo) values ('M'),('T'),('N'),('P'),('I'),('S'),('V'),('E'),('J'),('LD')
on conflict (codigo) do nothing;

-- 2) Ajustes generales: horas que equivale un día de excesos y días de vacaciones al año
create table if not exists public.config_horas (
    id               int primary key default 1,
    horas_dia_exceso numeric(5,2) not null default 8,
    dias_vacaciones  int not null default 23,
    constraint config_horas_unica check (id = 1),
    constraint config_horas_exceso check (horas_dia_exceso > 0 and horas_dia_exceso <= 24),
    constraint config_horas_vacaciones check (dias_vacaciones between 0 and 365)
);
insert into public.config_horas (id) values (1) on conflict (id) do nothing;

-- 3) Horas anuales de cada empleado (cada uno ve solo las suyas; el administrador, todas)
create table if not exists public.horas_anuales (
    empleado_id uuid primary key references public.empleados(id) on delete cascade,
    horas       numeric(7,2) not null,
    constraint horas_anuales_rango check (horas >= 0 and horas <= 9999)
);

-- 4) Permisos
alter table public.horas_turno    enable row level security;
alter table public.config_horas   enable row level security;
alter table public.horas_anuales  enable row level security;

revoke all on public.horas_turno, public.config_horas, public.horas_anuales from anon, authenticated;
grant select, insert, update, delete on public.horas_turno, public.config_horas, public.horas_anuales to authenticated;

drop policy if exists horas_turno_leer   on public.horas_turno;
drop policy if exists horas_turno_ins    on public.horas_turno;
drop policy if exists horas_turno_upd    on public.horas_turno;
drop policy if exists config_horas_leer  on public.config_horas;
drop policy if exists config_horas_ins   on public.config_horas;
drop policy if exists config_horas_upd   on public.config_horas;
drop policy if exists horas_anuales_leer on public.horas_anuales;
drop policy if exists horas_anuales_ins  on public.horas_anuales;
drop policy if exists horas_anuales_upd  on public.horas_anuales;
drop policy if exists horas_anuales_del  on public.horas_anuales;

create policy horas_turno_leer on public.horas_turno
    for select to authenticated using (public.mi_rol() is not null);
create policy horas_turno_ins on public.horas_turno
    for insert to authenticated with check (public.mi_rol() = 'administrador');
create policy horas_turno_upd on public.horas_turno
    for update to authenticated using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

create policy config_horas_leer on public.config_horas
    for select to authenticated using (public.mi_rol() is not null);
create policy config_horas_ins on public.config_horas
    for insert to authenticated with check (public.mi_rol() = 'administrador');
create policy config_horas_upd on public.config_horas
    for update to authenticated using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

create policy horas_anuales_leer on public.horas_anuales
    for select to authenticated using (
        public.mi_rol() = 'administrador'
        or (public.mi_rol() is not null and empleado_id = public.mi_empleado())
    );
create policy horas_anuales_ins on public.horas_anuales
    for insert to authenticated with check (public.mi_rol() = 'administrador');
create policy horas_anuales_upd on public.horas_anuales
    for update to authenticated using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');
create policy horas_anuales_del on public.horas_anuales
    for delete to authenticated using (public.mi_rol() = 'administrador');

-- 5) Cambios de turno: un correturno puede pedir cambios a los tres colectivos de turnos, y estos a un
--    correturno que esté sustituyendo (turno M, T o N ese día). El resto del sistema no cambia.
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
    v_yo_turnos  boolean;
    v_des_turnos boolean;
begin
    if v_yo is null or v_rol is null or v_rol = 'familiar' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select colectivo into v_col_yo  from public.empleados where id = v_yo           and activo;
    select colectivo into v_col_des from public.empleados where id = p_destinatario and activo;
    if v_col_yo is null or v_col_des is null or p_destinatario = v_yo then
        return jsonb_build_object('ok', false, 'motivo', 'destinatario_invalido');
    end if;

    -- "Colectivo de turnos" = jefes de turno, operadores de control y de campo (sin semanas especiales)
    v_yo_turnos  := not exists (select 1 from public.colectivos where codigo = v_col_yo  and cardinality(marcas) > 0);
    v_des_turnos := not exists (select 1 from public.colectivos where codigo = v_col_des and cardinality(marcas) > 0);

    -- Entre compañeros del mismo colectivo de turnos, o de un correturno a cualquiera de los tres
    if v_yo_turnos and v_col_yo = v_col_des then
        null;
    elsif v_col_yo = 'correturnos' and v_des_turnos then
        null;
    elsif v_yo_turnos and v_col_des = 'correturnos' then
        null;   -- a un correturno que está sustituyendo (se comprueba el turno día a día más abajo)
    elsif not v_yo_turnos and v_col_yo <> 'correturnos' then
        return jsonb_build_object('ok', false, 'motivo', 'colectivo_no_permitido');
    else
        return jsonb_build_object('ok', false, 'motivo', 'destinatario_invalido');
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
        -- Un colectivo de turnos solo puede pedir a un correturno los días en que tiene un turno M, T o N
        if v_yo_turnos and v_col_des = 'correturnos'
           and coalesce((v_dia ->> 'codigo_destinatario') = any (array['M','T','N']), false) = false then
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

revoke all on function public.crear_cambios(uuid, jsonb, text) from public, anon;
grant execute on function public.crear_cambios(uuid, jsonb, text) to authenticated;
