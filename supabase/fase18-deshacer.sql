-- Deshace la fase 18: quita "ver el calendario de otra persona" y devuelve admin_guardar_marcas a como estaba.
drop function if exists public.admin_guardar_ver_calendario(uuid, uuid);
alter table public.empleados drop constraint if exists empleados_ver_calendario_valido;
alter table public.empleados drop column if exists ver_calendario_de;

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
