-- =====================================================================
-- FASE 4 · Colectivos de ciclo semanal, semanas especiales (G, CT...)
-- Ejecutar en Supabase > SQL Editor, de una sola vez (botón Run),
-- DESPUÉS de los scripts de las fases 1 y 3.
-- Es aditivo y se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Qué marcas semanales admite cada colectivo (vacío = ninguna)
alter table public.colectivos add column if not exists marcas text[] not null default '{}';

alter table public.colectivos drop constraint if exists colectivos_marcas_validas;
alter table public.colectivos add constraint colectivos_marcas_validas
    check (marcas <@ array['G','CTD','CT1','CT2','CT3','CT4','CTY']);

-- 2) Los dos colectivos nuevos. Ciclo de 7 días, de lunes a domingo: P P P P I F F
--    (el "inicio" de cada empleado de estos colectivos debe ser un lunes).
insert into public.colectivos (codigo, nombre, icono, puesto, patron, dias_solape, orden) values
  ('correturnos', 'Correturnos',                '🔄', 'Correturno',
     array['P','P','P','P','I','F','F'], 0, 4),
  ('jornada',     'Personal de jornada partida', '🕘', 'Personal de jornada partida',
     array['P','P','P','P','I','F','F'], 0, 5)
on conflict (codigo) do nothing;

-- Marcas permitidas (solo si aún no se habían puesto)
update public.colectivos set marcas = array['CTD','CT1','CT2','CT3','CT4','CTY']
    where codigo = 'correturnos' and marcas = '{}';
update public.colectivos set marcas = array['G']
    where codigo = 'jornada' and marcas = '{}';

-- 3) Semanas especiales: una marca por persona y semana (la semana se identifica por su lunes)
create table if not exists public.semanas_especiales (
    empleado_id uuid not null references public.empleados(id) on delete cascade,
    semana      date not null,
    codigo      text not null,
    created_at  timestamptz not null default now(),
    primary key (empleado_id, semana),
    constraint semanas_codigo_valido
        check (codigo in ('G','CTD','CT1','CT2','CT3','CT4','CTY')),
    constraint semanas_es_lunes
        check (extract(isodow from semana) = 1),
    constraint semanas_fecha_valida
        check (semana between date '2020-01-01' and date '2100-12-31')
);

-- 4) Permisos
alter table public.semanas_especiales enable row level security;
revoke all on public.semanas_especiales from anon, authenticated;
grant select, insert, update, delete on public.semanas_especiales to authenticated;

drop policy if exists semanas_leer       on public.semanas_especiales;
drop policy if exists semanas_insertar   on public.semanas_especiales;
drop policy if exists semanas_actualizar on public.semanas_especiales;
drop policy if exists semanas_borrar     on public.semanas_especiales;

-- Las ven todos los que tienen acceso (un familiar, solo las de su empleado).
create policy semanas_leer on public.semanas_especiales
    for select to authenticated using (
        public.mi_rol() is not null
        and (public.mi_rol() <> 'familiar' or empleado_id = public.mi_empleado())
    );

-- Cada persona escribe las suyas; el administrador puede escribir las de cualquiera
-- (para crear un patrón).
create policy semanas_insertar on public.semanas_especiales
    for insert to authenticated with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy semanas_actualizar on public.semanas_especiales
    for update to authenticated
    using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    )
    with check (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );
create policy semanas_borrar on public.semanas_especiales
    for delete to authenticated using (
        public.mi_rol() = 'administrador'
        or (empleado_id = public.mi_empleado() and public.mi_rol() in ('supervisor','empleado'))
    );

-- 5) Los colores propios ahora admiten también las marcas de semana
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
                           'G','CTD','CT1','CT2','CT3','CT4','CTY')
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
