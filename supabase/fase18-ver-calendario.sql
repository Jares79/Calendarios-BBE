-- Fase 18 · Ver el calendario de otra persona
-- El administrador elige, para un empleado, a quién ve en la mitad de arriba de su mes
-- (apagado por defecto). Es incompatible con las marcas D / CT de ese mismo empleado.
-- Se ejecuta una vez en Supabase → SQL Editor. Se puede repetir sin problema.

alter table public.empleados
    add column if not exists ver_calendario_de uuid references public.empleados(id) on delete set null;

alter table public.empleados drop constraint if exists empleados_ver_calendario_valido;
alter table public.empleados add constraint empleados_ver_calendario_valido
    check (ver_calendario_de is null or (ver_calendario_de <> id and cardinality(marcas) = 0));

create or replace function public.admin_guardar_ver_calendario(p_empleado uuid, p_otro uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_otro is not null then
        if p_otro = p_empleado
           or not exists (select 1 from public.empleados where id = p_otro and activo) then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
        end if;
        if exists (select 1 from public.empleados where id = p_empleado and cardinality(marcas) > 0) then
            return jsonb_build_object('ok', false, 'motivo', 'incompatible');
        end if;
    end if;
    update public.empleados set ver_calendario_de = p_otro where id = p_empleado;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.admin_guardar_ver_calendario(uuid, uuid) from public, anon;
grant execute on function public.admin_guardar_ver_calendario(uuid, uuid) to authenticated;

-- Las marcas no se pueden activar a quien ya ve a otra persona (primero hay que quitárselo)
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
    if cardinality(p_marcas) > 0
       and exists (select 1 from public.empleados where id = p_empleado and ver_calendario_de is not null) then
        return jsonb_build_object('ok', false, 'motivo', 'incompatible');
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
