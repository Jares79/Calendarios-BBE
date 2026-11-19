-- =====================================================================
-- FASE 12 · Subgrupos de jornada partida y solapes de cada colectivo
--   · "Personal a turnos" (jefes, operadores de control y de campo) y "Personal de jornada partida"
--     (correturnos y los subgrupos que crees). La agrupación se deduce del tipo del colectivo.
--   · El administrador puede crear, renombrar y borrar subgrupos de jornada partida.
--   · El colectivo antiguo "Personal de jornada partida" pasa a llamarse "Sin subgrupo".
--   · Los solapes (colectivos.dias_solape) se editan desde Empleados y accesos: límite 0 a 366.
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez, DESPUÉS de la fase 10.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) El colectivo "jornada" será el de quienes aún no tienen subgrupo
update public.colectivos set nombre = 'Sin subgrupo'
 where codigo = 'jornada' and nombre = 'Personal de jornada partida';

-- 2) Solapes al año de cada colectivo: de 0 a 366
alter table public.colectivos drop constraint if exists colectivos_dias_solape_rango;
alter table public.colectivos add constraint colectivos_dias_solape_rango check (dias_solape between 0 and 366);

-- 3) Crear un subgrupo de jornada partida (hereda el ciclo del colectivo "jornada": P P P P I F F)
create or replace function public.admin_crear_subgrupo(p_nombre text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_nombre text := btrim(coalesce(p_nombre, ''));
    v_codigo text;
    v_base   public.colectivos%rowtype;
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_nombre = '' or length(v_nombre) > 40 then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    if exists (select 1 from public.colectivos where lower(nombre) = lower(v_nombre)) then
        return jsonb_build_object('ok', false, 'motivo', 'nombre_repetido');
    end if;

    select * into v_base from public.colectivos where codigo = 'jornada';
    v_codigo := 'sg' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.colectivos (codigo, nombre, icono, puesto, patron, dias_solape, orden, tipo)
    values (v_codigo, v_nombre, '👥', v_nombre,
            coalesce(v_base.patron, array['P','P','P','P','I','F','F']), 0,
            coalesce((select max(orden) from public.colectivos), 0) + 1, 'otro');

    return jsonb_build_object('ok', true, 'codigo', v_codigo);
end;
$$;

-- 4) Renombrar un colectivo que no sea de turnos
create or replace function public.admin_renombrar_subgrupo(p_codigo text, p_nombre text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_nombre text := btrim(coalesce(p_nombre, ''));
    v_c      public.colectivos%rowtype;
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    select * into v_c from public.colectivos where codigo = p_codigo;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    if v_c.tipo = 'turnos' then
        return jsonb_build_object('ok', false, 'motivo', 'no_permitido');
    end if;
    if v_nombre = '' or length(v_nombre) > 40 then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    if exists (select 1 from public.colectivos where lower(nombre) = lower(v_nombre) and codigo <> p_codigo) then
        return jsonb_build_object('ok', false, 'motivo', 'nombre_repetido');
    end if;

    update public.colectivos
       set nombre = v_nombre,
           puesto = case when puesto = nombre then v_nombre else puesto end
     where codigo = p_codigo;
    return jsonb_build_object('ok', true);
end;
$$;

-- 5) Borrar un subgrupo creado por el administrador (solo si no tiene empleados)
create or replace function public.admin_borrar_subgrupo(p_codigo text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_c public.colectivos%rowtype;
begin
    if public.mi_rol() is distinct from 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    select * into v_c from public.colectivos where codigo = p_codigo;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
    end if;
    if v_c.tipo <> 'otro' or v_c.codigo = 'jornada' then
        return jsonb_build_object('ok', false, 'motivo', 'no_permitido');
    end if;
    if exists (select 1 from public.empleados where colectivo = p_codigo) then
        return jsonb_build_object('ok', false, 'motivo', 'tiene_empleados');
    end if;
    begin
        delete from public.colectivos where codigo = p_codigo;
    exception when foreign_key_violation then
        return jsonb_build_object('ok', false, 'motivo', 'en_uso');
    end;
    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_crear_subgrupo(text)             from public, anon;
revoke all on function public.admin_renombrar_subgrupo(text, text)  from public, anon;
revoke all on function public.admin_borrar_subgrupo(text)           from public, anon;
grant execute on function public.admin_crear_subgrupo(text)            to authenticated;
grant execute on function public.admin_renombrar_subgrupo(text, text)  to authenticated;
grant execute on function public.admin_borrar_subgrupo(text)           to authenticated;
