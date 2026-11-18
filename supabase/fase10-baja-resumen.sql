-- =====================================================================
-- FASE 10 · Baja (B), días de libre disposición, horas anuales de cada persona y resumen
--   · Nuevo turno B (baja): se puede poner en el calendario.
--   · Días de libre disposición (LD) al año, editables por el administrador (config_horas.dias_ld).
--   · Las horas anuales las edita cada persona (solo las suyas); el administrador también puede.
--   · El administrador puede activar el resumen de horas a quien no sea de un colectivo de turnos
--     (empleados.ver_horas).
--   · Repara horas_dia (ajuste de las horas de un día), por si el script de la fase 8 no llegó a
--     ejecutarse bien: es la tabla que usa el botón "Ajustar" del editor de un día.
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez, DESPUÉS de la fase 9.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Turno B en los cambios manuales y en los colores guardados ---------------
alter table public.excepciones drop constraint if exists excepciones_codigo_valido;
alter table public.excepciones add constraint excepciones_codigo_valido
    check (codigo in ('M','T','N','F','P','I','S','V','E','J','LD','B'));

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
        if v_clave not in ('M','T','N','F','P','I','S','V','E','J','LD','B',
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

-- 2) Días de libre disposición al año (LD) -------------------------------------
alter table public.config_horas add column if not exists dias_ld int not null default 2;
alter table public.config_horas drop constraint if exists config_horas_ld;
alter table public.config_horas add constraint config_horas_ld check (dias_ld between 0 and 365);

-- 3) Horas anuales: las edita cada persona (y el administrador) ----------------
drop policy if exists horas_anuales_ins on public.horas_anuales;
drop policy if exists horas_anuales_upd on public.horas_anuales;
drop policy if exists horas_anuales_del on public.horas_anuales;

create policy horas_anuales_ins on public.horas_anuales
    for insert to authenticated with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy horas_anuales_upd on public.horas_anuales
    for update to authenticated
    using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    )
    with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy horas_anuales_del on public.horas_anuales
    for delete to authenticated using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );

-- 4) Resumen de horas para quien no es de un colectivo de turnos --------------
alter table public.empleados add column if not exists ver_horas boolean not null default false;

create or replace function public.admin_guardar_ver_horas(p_empleado uuid, p_ver boolean)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_ver is null then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    update public.empleados set ver_horas = p_ver where id = p_empleado;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.admin_guardar_ver_horas(uuid, boolean) from public, anon;
grant execute on function public.admin_guardar_ver_horas(uuid, boolean) to authenticated;

-- 5) Ajuste de las horas de un día (tabla de la fase 8): se crea o se repara -----
create table if not exists public.horas_dia (
    empleado_id uuid not null references public.empleados(id) on delete cascade,
    fecha       date not null,
    horas       numeric(5,2) not null,
    primary key (empleado_id, fecha),
    constraint horas_dia_rango check (horas >= 0 and horas <= 24),
    constraint horas_dia_fecha check (fecha between date '2020-01-01' and date '2100-12-31')
);

alter table public.horas_dia enable row level security;
revoke all on public.horas_dia from anon, authenticated;
grant select, insert, update, delete on public.horas_dia to authenticated;

drop policy if exists horas_dia_leer on public.horas_dia;
drop policy if exists horas_dia_ins  on public.horas_dia;
drop policy if exists horas_dia_upd  on public.horas_dia;
drop policy if exists horas_dia_del  on public.horas_dia;

create policy horas_dia_leer on public.horas_dia
    for select to authenticated using (
        public.mi_rol() = 'administrador'
        or (public.mi_rol() is not null and empleado_id = public.mi_empleado())
    );
create policy horas_dia_ins on public.horas_dia
    for insert to authenticated with check (
        empleado_id = public.mi_empleado() and public.mi_rol() in ('administrador','supervisor','empleado')
    );
create policy horas_dia_upd on public.horas_dia
    for update to authenticated
    using      (empleado_id = public.mi_empleado() and public.mi_rol() in ('administrador','supervisor','empleado'))
    with check (empleado_id = public.mi_empleado() and public.mi_rol() in ('administrador','supervisor','empleado'));
create policy horas_dia_del on public.horas_dia
    for delete to authenticated using (
        empleado_id = public.mi_empleado() and public.mi_rol() in ('administrador','supervisor','empleado')
    );
