-- =====================================================================
-- FASE 1 · PASO 2 de 2 · Pasar los usuarios actuales al nuevo sistema
-- Ejecutar DESPUÉS de fase1-1-estructura.sql.
--
-- Copia cada fila de la tabla "usuarios" a Supabase Auth conservando su
-- PIN actual (se copia el hash, nunca se ve el PIN) y su marca de
-- "debe cambiar el PIN". Los accesos de familiar (JAM_F) ya NO comparten
-- el PIN del empleado: se crean aparte desde el menú de administrador.
-- Se puede ejecutar más de una vez: lo ya migrado se salta.
-- =====================================================================

do $$
declare
    u          record;
    v_email    text;
    v_id       uuid;
    v_emp      uuid;
    v_rol      text;
    v_migrados int := 0;
    v_saltados int := 0;
begin
    for u in select * from public.usuarios loop
        v_email := regexp_replace(lower(trim(u.iniciales)), '[^a-z0-9_]', '', 'g') || '@calendario-bbe.app';

        if u.pin_hash is null then
            raise notice 'SALTADO % (no tiene pin_hash)', u.iniciales;
            v_saltados := v_saltados + 1;
            continue;
        end if;

        if exists (select 1 from auth.users where email = v_email)
           or exists (select 1 from public.perfiles where upper(iniciales) = upper(trim(u.iniciales))) then
            v_saltados := v_saltados + 1;
            continue;
        end if;

        v_rol := case when u.rol in ('administrador','supervisor','empleado') then u.rol else 'empleado' end;
        if v_rol <> u.rol then
            raise notice 'AVISO: % tenía el rol "%": se ha migrado como empleado', u.iniciales, u.rol;
        end if;

        -- Misma lógica que usaba la app para encontrar la ficha del empleado
        select e.id into v_emp
          from public.empleados e
         where upper(e.iniciales) = upper(trim(u.iniciales))
            or upper(e.iniciales) = upper(trim(coalesce(u.empleado_asociado, '')))
            or lower(e.nombre)    = lower(trim(coalesce(u.nombre, '')))
            or lower(e.nombre)    = lower(trim(coalesce(u.iniciales, '')))
            or lower(e.nombre)    = lower(trim(coalesce(u.empleado_asociado, '')))
         order by (upper(e.iniciales) = upper(trim(u.iniciales))) desc
         limit 1;

        v_id := public._crear_auth_usuario(v_email, u.pin_hash);

        insert into public.perfiles (id, iniciales, nombre, rol, empleado_id, debe_cambiar_pin)
        values (v_id, upper(trim(u.iniciales)), u.nombre, v_rol, v_emp,
                coalesce(u.debe_cambiar_pin, true));

        v_migrados := v_migrados + 1;
    end loop;

    raise notice 'Migrados: %  ·  Saltados: %', v_migrados, v_saltados;
end;
$$;

-- Comprobación: debería salir una fila por usuario. Revisa que "empleado" no
-- esté vacío en quien tenga calendario (los de prueba, como demo, pueden no tenerlo).
select p.iniciales, p.nombre, p.rol, e.nombre as empleado, e.colectivo, p.debe_cambiar_pin
  from public.perfiles p
  left join public.empleados e on e.id = p.empleado_id
 order by p.rol, p.iniciales;

-- Empleados que todavía no tienen acceso (se les crea desde el menú de administrador):
select e.iniciales, e.nombre, e.colectivo
  from public.empleados e
 where not exists (select 1 from public.perfiles p where p.empleado_id = e.id and p.rol <> 'familiar')
 order by e.colectivo, e.orden;
