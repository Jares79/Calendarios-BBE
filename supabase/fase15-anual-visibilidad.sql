-- =====================================================================
-- FASE 15 · Qué calendarios anuales puede ver cada persona
--   · empleados.anual_ver: grupos completos ('g:turnos', 'g:jornada') y/o subgrupos (códigos de colectivo)
--     que esa persona puede ver en el Calendario anual, además de su propio colectivo.
--     Vacío = solo su colectivo. El administrador ve siempre todos.
--   · admin_guardar_anual_ver(empleado, lista): lo guarda desde la ficha del empleado.
-- IMPORTANTE: esto controla lo que se le ofrece en la app, no es una barrera de privacidad en la base de datos
-- (los turnos de todos siguen siendo legibles para cualquier usuario con sesión).
-- Ejecutar en Supabase > SQL Editor (Run), de una sola vez, DESPUÉS de la fase 12. Se puede repetir.
-- =====================================================================
alter table public.empleados add column if not exists anual_ver text[] not null default '{}';

create or replace function public.admin_guardar_anual_ver(p_empleado uuid, p_ver text[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_item text;
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if p_ver is null then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    foreach v_item in array p_ver loop
        if v_item not in ('g:turnos', 'g:jornada')
           and not exists (select 1 from public.colectivos where codigo = v_item) then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
        end if;
    end loop;
    update public.empleados set anual_ver = p_ver where id = p_empleado;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.admin_guardar_anual_ver(uuid, text[]) from public, anon;
grant execute on function public.admin_guardar_anual_ver(uuid, text[]) to authenticated;
