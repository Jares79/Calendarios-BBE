-- Fase 19 · Guardado de turnos en una sola operación + avisos en tiempo real
-- Se ejecuta una vez en Supabase → SQL Editor (botón Run). Se puede repetir sin problema.
-- Va DESPUÉS de todas las anteriores (la 18 incluida).
--
-- 1) guardar_turnos: sube turnos puestos a mano, borra los que vuelven al ciclo y ajusta las horas
--    del día, todo en una única transacción (o se guarda todo o no se guarda nada). Antes la app
--    hacía hasta cuatro llamadas seguidas y, si una fallaba a medias, quedaba a medias.
--    Solo escribe sobre el calendario de quien hace la petición, igual que las políticas de las tablas.
-- 2) Realtime: para que los cambios de un compañero lleguen a los demás sin recargar.
--    Si esta parte no se ejecuta, la app sigue funcionando (se actualiza al volver a abrirla).

-- 1) Guardar turnos ------------------------------------------------------------------------------
create or replace function public.guardar_turnos(
    p_subir        jsonb,   -- [{"fecha":"2026-11-20","codigo":"V"}, ...]  turnos a poner a mano
    p_borrar       jsonb,   -- ["2026-11-21", ...]                         días que vuelven al ciclo
    p_horas_borrar jsonb,   -- ["2026-11-21", ...]                         ajustes de horas a quitar
    p_horas_poner  jsonb    -- [{"fecha":"2026-11-20","horas":7.5}, ...]   ajustes de horas a dejar
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_emp   uuid := public.mi_empleado();
    v_rol   text := public.mi_rol();
    v_tipo  text;
    v_subir  jsonb := coalesce(p_subir, '[]'::jsonb);
    v_borrar jsonb := coalesce(p_borrar, '[]'::jsonb);
    v_hborr  jsonb := coalesce(p_horas_borrar, '[]'::jsonb);
    v_hpon   jsonb := coalesce(p_horas_poner, '[]'::jsonb);
    v_x      jsonb;
    v_fecha  date;
    v_codigo text;
    v_horas  numeric;
begin
    if v_emp is null or v_rol is null or v_rol not in ('administrador', 'supervisor', 'empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    if jsonb_typeof(v_subir) <> 'array' or jsonb_typeof(v_borrar) <> 'array'
       or jsonb_typeof(v_hborr) <> 'array' or jsonb_typeof(v_hpon) <> 'array'
       or jsonb_array_length(v_subir) > 800 or jsonb_array_length(v_borrar) > 800
       or jsonb_array_length(v_hborr) > 800 or jsonb_array_length(v_hpon) > 800 then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    -- Los de jornada partida (tipo 'otro') no usan M, T, N ni solape (S), igual que el editor de la app
    select c.tipo into v_tipo
      from public.empleados e join public.colectivos c on c.codigo = e.colectivo
     where e.id = v_emp;

    -- Primero se comprueba TODO (sin escribir nada); si algo está mal, no se toca la base de datos
    begin
        for v_x in select * from jsonb_array_elements(v_subir) loop
            v_fecha  := (v_x ->> 'fecha')::date;
            v_codigo := v_x ->> 'codigo';
            if v_fecha is null or v_codigo is null
               or v_codigo not in ('M','T','N','F','P','I','S','V','E','J','LD','B')
               or (v_tipo = 'otro' and v_codigo in ('M','T','N','S')) then
                return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
            end if;
        end loop;
        for v_x in select * from jsonb_array_elements(v_borrar) loop
            if (v_x #>> '{}')::date is null then
                return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
            end if;
        end loop;
        for v_x in select * from jsonb_array_elements(v_hborr) loop
            if (v_x #>> '{}')::date is null then
                return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
            end if;
        end loop;
        for v_x in select * from jsonb_array_elements(v_hpon) loop
            v_fecha := (v_x ->> 'fecha')::date;
            v_horas := (v_x ->> 'horas')::numeric;
            if v_fecha is null or v_horas is null or v_horas < 0 or v_horas > 24 then
                return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
            end if;
        end loop;
    exception
        when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
             or numeric_value_out_of_range then
            return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end;

    -- Después se escribe todo. Si algo fallara aquí, la transacción entera se deshace
    for v_x in select * from jsonb_array_elements(v_subir) loop
        insert into public.excepciones (empleado_id, fecha, codigo)
        values (v_emp, (v_x ->> 'fecha')::date, v_x ->> 'codigo')
        on conflict (empleado_id, fecha) do update set codigo = excluded.codigo;
    end loop;

    for v_x in select * from jsonb_array_elements(v_borrar) loop
        delete from public.excepciones
         where empleado_id = v_emp and fecha = (v_x #>> '{}')::date;
    end loop;

    for v_x in select * from jsonb_array_elements(v_hborr) loop
        delete from public.horas_dia
         where empleado_id = v_emp and fecha = (v_x #>> '{}')::date;
    end loop;

    for v_x in select * from jsonb_array_elements(v_hpon) loop
        insert into public.horas_dia (empleado_id, fecha, horas)
        values (v_emp, (v_x ->> 'fecha')::date, (v_x ->> 'horas')::numeric)
        on conflict (empleado_id, fecha) do update set horas = excluded.horas;
    end loop;

    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.guardar_turnos(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_turnos(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- 2) Avisos en tiempo real -----------------------------------------------------------------------
-- Añade a la publicación de Realtime las tablas cuyos cambios deben llegar a los demás al instante.
-- (Las políticas de seguridad de cada tabla siguen mandando: cada persona solo recibe lo que puede leer.)
do $$
declare
    t text;
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        foreach t in array array['excepciones', 'semanas_especiales', 'marcas_dia',
                                 'empleados', 'colectivos', 'festivos', 'intensivas'] loop
            if to_regclass('public.' || t) is not null
               and not exists (select 1 from pg_publication_tables
                                where pubname = 'supabase_realtime'
                                  and schemaname = 'public' and tablename = t) then
                execute format('alter publication supabase_realtime add table public.%I', t);
            end if;
        end loop;
    end if;
end $$;
