-- =====================================================================
-- FASE 8 · Ajuste manual de las horas de un día (por ejemplo, una baja que computa
-- como el turno que tocaba, o libre disposición). Sustituye las horas que daría el turno.
-- Ejecutar en Supabase > SQL Editor (botón Run), después de fase6-horas.sql.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================
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

-- Cada uno ve y escribe las suyas; el administrador puede verlas todas (resumen "Todos")
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
