-- Exportar el esquema REAL de tu base de datos, tal como está ahora (SOLO LEE, no cambia nada)
-- Supabase → SQL Editor → pegar → Run. Devuelve una fila por cada tabla, política, función, etc.
-- Para guardarlo: botón de descargar los resultados en CSV (o seleccionar la columna "texto" y copiar).
-- Ese texto es la fotografía fiel de la base; guardado como supabase/schema-actual.sql sirve de referencia
-- y de copia de seguridad de la ESTRUCTURA (no de los datos).
-- Solo recoge las tablas y funciones de esta app (el proyecto comparte base de datos con otras).
-- Es documentación, no un instalador: para un proyecto nuevo se siguen ejecutando los SQL en el orden
-- de LEEME-orden.md y se comprueba con schema-comprobar.sql.

with tablas as (
    select c.oid, c.relname, c.relrowsecurity
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
       and c.relname in ('cambios_dias', 'cambios_hechos', 'cambios_mensajes', 'cambios_solicitudes', 'colectivos', 'config_horas', 'empleados', 'excepciones', 'festivos', 'horas_anuales', 'horas_dia', 'horas_turno', 'intensivas', 'marcas_dia', 'perfiles', 'push_config', 'push_suscripciones', 'semanas_especiales')
)
select 10 as orden, t.relname::text as objeto,
       format(E'create table if not exists public.%I (\n%s\n);', t.relname,
              concat_ws(E',\n',
                  (select string_agg(format('    %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                                            case when a.attnotnull then ' not null' else '' end,
                                            coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')),
                                     E',\n' order by a.attnum)
                     from pg_attribute a
                     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                    where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped),
                  (select string_agg(format('    constraint %I %s', k.conname, pg_get_constraintdef(k.oid)),
                                     E',\n' order by k.conname)
                     from pg_constraint k
                    where k.conrelid = t.oid and k.contype in ('p', 'u', 'c')))) as texto
  from tablas t
union all
select 11, t.relname::text, format('alter table public.%I enable row level security;', t.relname)
  from tablas t where t.relrowsecurity
union all
select 20, t.relname::text || ' · ' || k.conname,
       format('alter table public.%I add constraint %I %s;', t.relname, k.conname, pg_get_constraintdef(k.oid))
  from tablas t join pg_constraint k on k.conrelid = t.oid and k.contype = 'f'
union all
select 30, i.indexname::text, i.indexdef || ';'
  from pg_indexes i
 where i.schemaname = 'public' and i.tablename in (select relname from tablas)
   and not exists (select 1 from pg_constraint k where k.conname = i.indexname)
union all
select 40, x.tablename::text || ' · ' || x.policyname,
       format('create policy %I on public.%I as %s for %s to %s%s%s;', x.policyname, x.tablename,
              lower(x.permissive), lower(x.cmd), array_to_string(x.roles, ', '),
              case when x.qual is not null then E'\n    using (' || x.qual || ')' else '' end,
              case when x.with_check is not null then E'\n    with check (' || x.with_check || ')' else '' end)
  from pg_policies x
 where x.schemaname = 'public' and x.tablename in (select relname from tablas)
union all
select 50, p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       pg_get_functiondef(p.oid) || ';' || E'\n-- permisos: authenticated='
       || case when has_function_privilege('authenticated', p.oid, 'execute') then 'SÍ' else 'NO' end
       || ', anon=' || case when has_function_privilege('anon', p.oid, 'execute') then 'SÍ' else 'NO' end
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
   and p.proname in ('_crear_acceso', '_crear_auth_usuario', '_pin_aleatorio', 'admin_borrar_subgrupo', 'admin_crear_acceso', 'admin_crear_empleado', 'admin_crear_subgrupo', 'admin_editar_empleado', 'admin_eliminar_empleado', 'admin_eliminar_familiar', 'admin_guardar_anual_ver', 'admin_guardar_marcas', 'admin_guardar_ver_calendario', 'admin_guardar_ver_horas', 'admin_renombrar_subgrupo', 'admin_resetear_acceso', 'cancelar_cambio', 'crear_cambios', 'enviar_mensaje_cambio', 'guardar_colores', 'guardar_turnos', 'hoy_es', 'limpiar_cambios', 'marcar_visto_cambio', 'mi_empleado', 'mi_perfil', 'mi_rol', 'pin_cambiado', 'push_avisar', 'push_borrar', 'push_guardar', 'push_preferencias', 'responder_cambio', 'tg_push_mensaje', 'tg_push_solicitud')
union all
select 60, tg.tgname::text, pg_get_triggerdef(tg.oid) || ';'
  from pg_trigger tg join tablas t on t.oid = tg.tgrelid
 where not tg.tgisinternal
union all
select 70, x.tablename::text, '-- en Realtime: ' || x.tablename
  from pg_publication_tables x
 where x.pubname = 'supabase_realtime' and x.schemaname = 'public'
order by orden, objeto;
