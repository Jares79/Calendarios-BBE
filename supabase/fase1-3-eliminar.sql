-- =====================================================================
-- FASE 1 · PASO 3 · Eliminar empleados y accesos de familiar desde la app
-- Ejecutar en Supabase > SQL Editor (después de fase1-1-estructura.sql).
-- Es aditivo y se puede ejecutar más de una vez.
-- =====================================================================

-- Elimina a un empleado: su ficha y TODOS sus accesos (el suyo y el de familiar).
-- Es definitivo. Para que alguien deje de aparecer sin perder su ficha, usa la baja
-- (desmarcar "Activo" al editarlo). El administrador no puede eliminarse a sí mismo.
create or replace function public.admin_eliminar_empleado(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_ids uuid[];
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if not exists (select 1 from public.empleados where id = p_id) then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;
    if exists (select 1 from public.perfiles where empleado_id = p_id and id = auth.uid()) then
        return jsonb_build_object('ok', false, 'motivo', 'no_propio');
    end if;

    select coalesce(array_agg(id), '{}'::uuid[]) into v_ids
      from public.perfiles where empleado_id = p_id;

    delete from auth.users where id = any(v_ids);    -- borra también sus perfiles y sesiones
    delete from public.empleados where id = p_id;

    return jsonb_build_object('ok', true);
end;
$$;

-- Quita solo el acceso de familiar de un empleado (el empleado y su acceso no se tocan).
create or replace function public.admin_eliminar_familiar(p_empleado_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_id uuid;
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select id into v_id from public.perfiles
     where empleado_id = p_empleado_id and rol = 'familiar';
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    delete from auth.users where id = v_id;
    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_eliminar_empleado(uuid) from public, anon;
revoke all on function public.admin_eliminar_familiar(uuid) from public, anon;
grant execute on function public.admin_eliminar_empleado(uuid) to authenticated;
grant execute on function public.admin_eliminar_familiar(uuid) to authenticated;
