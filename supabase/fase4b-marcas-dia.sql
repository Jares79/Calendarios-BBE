-- =====================================================================
-- FASE 4b · Marcas (G, CT...) en días sueltos
-- Ejecutar en Supabase > SQL Editor (botón Run), después de fase4-correturnos.sql.
-- Se puede ejecutar más de una vez sin romper nada.
-- Una fila = la marca de UN día. Sustituye a la de su semana; el código '-' significa
-- "ese día sin marca" (para quitar un solo día de una semana marcada).
-- =====================================================================
create table if not exists public.marcas_dia (
    empleado_id uuid not null references public.empleados(id) on delete cascade,
    fecha       date not null,
    codigo      text not null,
    created_at  timestamptz not null default now(),
    primary key (empleado_id, fecha),
    constraint marcas_dia_codigo_valido
        check (codigo in ('-','G','CTD','CT1','CT2','CT3','CT4','CTY')),
    constraint marcas_dia_fecha_valida
        check (fecha between date '2020-01-01' and date '2100-12-31')
);

alter table public.marcas_dia enable row level security;
revoke all on public.marcas_dia from anon, authenticated;
grant select, insert, update, delete on public.marcas_dia to authenticated;

drop policy if exists marcasdia_leer       on public.marcas_dia;
drop policy if exists marcasdia_insertar   on public.marcas_dia;
drop policy if exists marcasdia_actualizar on public.marcas_dia;
drop policy if exists marcasdia_borrar     on public.marcas_dia;

create policy marcasdia_leer on public.marcas_dia
    for select to authenticated using (
        public.mi_rol() is not null
        and (public.mi_rol() <> 'familiar' or empleado_id = public.mi_empleado())
    );
create policy marcasdia_insertar on public.marcas_dia
    for insert to authenticated with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy marcasdia_actualizar on public.marcas_dia
    for update to authenticated
    using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    )
    with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy marcasdia_borrar on public.marcas_dia
    for delete to authenticated using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
