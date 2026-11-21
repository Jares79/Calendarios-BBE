-- =====================================================================
-- FASE 9 · Reorganización
--   · Las marcas de arriba de la celda (D = Disponible, CTD, CT1... CTY) pasan a asignarse
--     PERSONA A PERSONA (empleados.marcas) en vez de por colectivo. G (guardia) pasa a ser D.
--   · Cada colectivo tiene un tipo: 'turnos' (jefes, control, campo), 'correturnos' u 'otro'.
--   · Las horas de convenio, las horas de cada turno y los ajustes (horas por turno, horas de un
--     día de excesos, días de vacaciones) pasan a guardarse POR AÑO.
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez, DESPUÉS de las fases 1 a 8.
-- Se puede ejecutar más de una vez sin romper nada. No vuelvas a ejecutar fases anteriores después.
-- =====================================================================

-- 1) Tipo de colectivo -----------------------------------------------------
alter table public.colectivos add column if not exists tipo text not null default 'turnos';
alter table public.colectivos drop constraint if exists colectivos_tipo_valido;
alter table public.colectivos add constraint colectivos_tipo_valido check (tipo in ('turnos','correturnos','otro'));
update public.colectivos set tipo = 'correturnos' where codigo = 'correturnos';
update public.colectivos set tipo = 'otro'        where codigo = 'jornada';

-- 2) Marcas permitidas por empleado -----------------------------------------
alter table public.empleados add column if not exists marcas text[] not null default '{}';

-- Quien no tenga ninguna hereda las que tenía su colectivo (G pasa a D), para no perder nada
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'colectivos' and column_name = 'marcas') then
        update public.empleados e
           set marcas = coalesce((
                select array(select case when m = 'G' then 'D' else m end from unnest(c.marcas) m)
                from public.colectivos c where c.codigo = e.colectivo), '{}')
         where cardinality(e.marcas) = 0;
    end if;
end $$;

alter table public.empleados drop constraint if exists empleados_marcas_validas;
alter table public.empleados add constraint empleados_marcas_validas
    check (marcas <@ array['D','CTD','CT1','CT2','CT3','CT4','CTY']);

-- 3) G (guardia) pasa a D (disponible) en lo ya guardado
do $$
begin
    if to_regclass('public.semanas_especiales') is not null then
        alter table public.semanas_especiales drop constraint if exists semanas_codigo_valido;
        update public.semanas_especiales set codigo = 'D' where codigo = 'G';
        alter table public.semanas_especiales add constraint semanas_codigo_valido
            check (codigo in ('D','CTD','CT1','CT2','CT3','CT4','CTY'));
    end if;
    if to_regclass('public.marcas_dia') is not null then
        alter table public.marcas_dia drop constraint if exists marcas_dia_codigo_valido;
        update public.marcas_dia set codigo = 'D' where codigo = 'G';
        alter table public.marcas_dia add constraint marcas_dia_codigo_valido
            check (codigo in ('-','D','CTD','CT1','CT2','CT3','CT4','CTY'));
    end if;
end $$;

-- Colores propios que ya tuvieran guardados para G
update public.perfiles
   set colores = (colores - 'G') || jsonb_build_object('D', colores -> 'G')
 where colores ? 'G';

create or replace function public.guardar_colores(p_colores jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_clave text;
    v_valor text;
begin
    if auth.uid() is null or public.mi_rol() is null then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_colores is null or jsonb_typeof(p_colores) <> 'object' then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    for v_clave, v_valor in select key, value #>> '{}' from jsonb_each(p_colores) loop
        if v_clave not in ('M','T','N','F','P','I','S','V','E','J','LD',
                           'D','CTD','CT1','CT2','CT3','CT4','CTY')
           or v_valor is null or v_valor !~ '^#[0-9a-fA-F]{6}$' then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
        end if;
    end loop;
    update public.perfiles set colores = p_colores where id = auth.uid();
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.guardar_colores(jsonb) from public, anon;
grant execute on function public.guardar_colores(jsonb) to authenticated;

-- 4) El administrador decide quién puede usar cada marca
create or replace function public.admin_guardar_marcas(p_empleado uuid, p_marcas text[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_marcas is null or not (p_marcas <@ array['D','CTD','CT1','CT2','CT3','CT4','CTY']) then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    update public.empleados
       set marcas = coalesce((select array_agg(distinct m order by m) from unnest(p_marcas) m), '{}')
     where id = p_empleado;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.admin_guardar_marcas(uuid, text[]) from public, anon;
grant execute on function public.admin_guardar_marcas(uuid, text[]) to authenticated;

-- 5) Solicitudes de cambio: ahora según el tipo de colectivo (ya no según las marcas)
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
    v_tipo_yo  text;
    v_tipo_des text;
begin
    if v_yo is null or v_rol is null or v_rol = 'familiar' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select colectivo into v_col_yo  from public.empleados where id = v_yo           and activo;
    select colectivo into v_col_des from public.empleados where id = p_destinatario and activo;
    if v_col_yo is null or v_col_des is null or p_destinatario = v_yo then
        return jsonb_build_object('ok', false, 'motivo', 'destinatario_invalido');
    end if;

    select tipo into v_tipo_yo  from public.colectivos where codigo = v_col_yo;
    select tipo into v_tipo_des from public.colectivos where codigo = v_col_des;

    -- tipo 'turnos' = jefes de turno, operadores de control y de campo; 'correturnos'; 'otro' = sin cambios.
    -- Se puede pedir: entre compañeros del mismo colectivo de turnos; de un correturno a cualquiera de los
    -- colectivos de turnos; y de un colectivo de turnos a un correturno (los días en que este tiene un M, T o N).
    if v_tipo_yo = 'turnos' and v_col_yo = v_col_des then
        null;
    elsif v_tipo_yo = 'correturnos' and v_tipo_des = 'turnos' then
        null;
    elsif v_tipo_yo = 'turnos' and v_tipo_des = 'correturnos' then
        null;
    elsif v_tipo_yo = 'otro' then
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
        if v_tipo_yo = 'turnos' and v_tipo_des = 'correturnos'
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

-- Las marcas ya no dependen del colectivo
alter table public.colectivos drop constraint if exists colectivos_marcas_validas;
alter table public.colectivos drop column if exists marcas;

-- 6) Horas POR AÑO -----------------------------------------------------------
-- Horas que cuenta cada turno (las pone el administrador; 0 = no suma)
do $$
begin
    if to_regclass('public.horas_turno') is null then
        create table public.horas_turno (
            anio   int not null,
            codigo text not null,
            horas  numeric(5,2) not null default 0,
            primary key (anio, codigo),
            constraint horas_turno_codigo check (codigo in ('M','T','N','P','I','S','V','E','J','LD')),
            constraint horas_turno_rango  check (horas >= 0 and horas <= 24)
        );
    elsif not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'horas_turno' and column_name = 'anio') then
        alter table public.horas_turno add column anio int not null default (extract(year from now())::int);
        alter table public.horas_turno drop constraint if exists horas_turno_pkey;
        alter table public.horas_turno add primary key (anio, codigo);
        alter table public.horas_turno alter column anio drop default;
    end if;
end $$;

-- Horas que equivale un día de excesos y días de vacaciones, por año
do $$
begin
    if to_regclass('public.config_horas') is null then
        create table public.config_horas (
            anio             int primary key,
            horas_dia_exceso numeric(5,2) not null default 8,
            dias_vacaciones  int not null default 23,
            constraint config_horas_exceso check (horas_dia_exceso > 0 and horas_dia_exceso <= 24),
            constraint config_horas_vacaciones check (dias_vacaciones between 0 and 365)
        );
    elsif not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'config_horas' and column_name = 'anio') then
        alter table public.config_horas drop constraint if exists config_horas_unica;
        alter table public.config_horas add column anio int not null default (extract(year from now())::int);
        alter table public.config_horas drop column id;      -- también quita su clave primaria
        alter table public.config_horas add primary key (anio);
        alter table public.config_horas alter column anio drop default;
    end if;
end $$;

-- Horas anuales de convenio de cada empleado, por año
do $$
begin
    if to_regclass('public.horas_anuales') is null then
        create table public.horas_anuales (
            empleado_id uuid not null references public.empleados(id) on delete cascade,
            anio        int not null,
            horas       numeric(7,2) not null,
            primary key (empleado_id, anio),
            constraint horas_anuales_rango check (horas >= 0 and horas <= 9999)
        );
    elsif not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'horas_anuales' and column_name = 'anio') then
        alter table public.horas_anuales add column anio int not null default (extract(year from now())::int);
        alter table public.horas_anuales drop constraint if exists horas_anuales_pkey;
        alter table public.horas_anuales add primary key (empleado_id, anio);
        alter table public.horas_anuales alter column anio drop default;
    end if;
end $$;

-- Permisos (los mismos de antes)
alter table public.horas_turno   enable row level security;
alter table public.config_horas  enable row level security;
alter table public.horas_anuales enable row level security;
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
