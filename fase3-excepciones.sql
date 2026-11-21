-- =====================================================================
-- FASE 3 · Cambios manuales de turno, festivos, intensivas y colores
-- Ejecutar en Supabase > SQL Editor, de una sola vez (botón Run),
-- DESPUÉS de las del paso 1, 2 y 3 de la Fase 1.
-- Es aditivo y se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Cambios manuales: un turno puesto a mano para un empleado y un día.
--    Pisan al ciclo, a los festivos y a las intensivas.
create table if not exists public.excepciones (
    empleado_id uuid not null references public.empleados(id) on delete cascade,
    fecha       date not null,
    codigo      text not null,
    created_at  timestamptz not null default now(),
    primary key (empleado_id, fecha),
    constraint excepciones_codigo_valido
        check (codigo in ('M','T','N','F','P','I','S','V','E','J','LD')),
    constraint excepciones_fecha_valida
        check (fecha between date '2020-01-01' and date '2100-12-31')
);

-- 2) Festivos (los mismos para toda la plantilla): convierten una P o una I del ciclo en F.
create table if not exists public.festivos (
    fecha  date primary key,
    nombre text,
    constraint festivos_fecha_valida
        check (fecha between date '2020-01-01' and date '2100-12-31')
);

-- 3) Periodos de intensiva (de una fecha a otra, o un solo día con desde = hasta):
--    en esas fechas la P pasa a ser I.
create table if not exists public.intensivas (
    id         uuid primary key default gen_random_uuid(),
    desde      date not null,
    hasta      date not null,
    nota       text,
    created_at timestamptz not null default now(),
    constraint intensivas_orden check (hasta >= desde),
    constraint intensivas_fechas_validas
        check (desde >= date '2020-01-01' and hasta <= date '2100-12-31')
);

-- 4) Colores elegidos por cada usuario (código de turno -> color #rrggbb)
alter table public.perfiles add column if not exists colores jsonb not null default '{}'::jsonb;

-- 5) Permisos
alter table public.excepciones enable row level security;
alter table public.festivos    enable row level security;
alter table public.intensivas  enable row level security;

revoke all on public.excepciones, public.festivos, public.intensivas from anon, authenticated;
grant select, insert, update, delete on public.excepciones to authenticated;
grant select, insert, update, delete on public.festivos    to authenticated;
grant select, insert, update, delete on public.intensivas  to authenticated;

-- Cambios manuales: los ven todos (un familiar, solo los de su empleado);
-- cada persona solo escribe sobre su propio calendario (ni el administrador edita el de otros).
drop policy if exists excepciones_leer       on public.excepciones;
drop policy if exists excepciones_insertar   on public.excepciones;
drop policy if exists excepciones_actualizar on public.excepciones;
drop policy if exists excepciones_borrar     on public.excepciones;

create policy excepciones_leer on public.excepciones
    for select to authenticated using (
        public.mi_rol() is not null
        and (public.mi_rol() <> 'familiar' or empleado_id = public.mi_empleado())
    );
create policy excepciones_insertar on public.excepciones
    for insert to authenticated with check (
        empleado_id = public.mi_empleado()
        and public.mi_rol() in ('administrador','supervisor','empleado')
    );
create policy excepciones_actualizar on public.excepciones
    for update to authenticated
    using (
        empleado_id = public.mi_empleado()
        and public.mi_rol() in ('administrador','supervisor','empleado')
    )
    with check (
        empleado_id = public.mi_empleado()
        and public.mi_rol() in ('administrador','supervisor','empleado')
    );
create policy excepciones_borrar on public.excepciones
    for delete to authenticated using (
        empleado_id = public.mi_empleado()
        and public.mi_rol() in ('administrador','supervisor','empleado')
    );

-- Festivos e intensivas: los ve todo el mundo con acceso; solo los cambia el administrador.
drop policy if exists festivos_leer   on public.festivos;
drop policy if exists festivos_editar on public.festivos;
create policy festivos_leer on public.festivos
    for select to authenticated using (public.mi_rol() is not null);
create policy festivos_editar on public.festivos
    for all to authenticated
    using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

drop policy if exists intensivas_leer   on public.intensivas;
drop policy if exists intensivas_editar on public.intensivas;
create policy intensivas_leer on public.intensivas
    for select to authenticated using (public.mi_rol() is not null);
create policy intensivas_editar on public.intensivas
    for all to authenticated
    using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

-- 6) Guardar los colores propios (valida cada código y cada color en el servidor)
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
        if v_clave not in ('M','T','N','F','P','I','S','V','E','J','LD')
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

-- 7) Que la app reciba también los colores al entrar
create or replace function public.mi_perfil()
returns jsonb
language sql stable security definer
set search_path = public
as $$
    select jsonb_build_object(
        'iniciales',       p.iniciales,
        'nombre',          p.nombre,
        'rol',             p.rol,
        'empleadoId',      p.empleado_id,
        'empleadoNombre',  e.nombre,
        'debeCambiarPin',  p.debe_cambiar_pin,
        'colores',         p.colores
    )
    from public.perfiles p
    left join public.empleados e on e.id = p.empleado_id
    where p.id = auth.uid() and p.activo
$$;

revoke all on function public.mi_perfil() from public, anon;
grant execute on function public.mi_perfil() to authenticated;
