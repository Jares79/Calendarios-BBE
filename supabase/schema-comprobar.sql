-- Comprobar que la base de datos tiene todo lo que necesita la app (SOLO LEE, no cambia nada)
-- Se ejecuta en Supabase → SQL Editor → Run. Se puede repetir las veces que haga falta.
--
-- Si todo está bien devuelve una sola fila: "Todo en orden". Si falta algo, devuelve una fila por cada
-- cosa que falta (tabla, función, columna, política de seguridad o aviso en tiempo real).
-- La lista de lo esperado sale de los SQL de la carpeta (fases 1 a 19).
-- Sirve también para comprobar un proyecto nuevo de Supabase después de ejecutar los SQL en orden.

with
esp_tablas(n) as (values
        ('cambios_dias'),
        ('cambios_hechos'),
        ('cambios_mensajes'),
        ('cambios_solicitudes'),
        ('colectivos'),
        ('config_horas'),
        ('empleados'),
        ('excepciones'),
        ('festivos'),
        ('horas_anuales'),
        ('horas_dia'),
        ('horas_turno'),
        ('intensivas'),
        ('marcas_dia'),
        ('perfiles'),
        ('push_config'),
        ('push_suscripciones'),
        ('semanas_especiales')),
esp_funciones(n) as (values
        ('_crear_acceso'),
        ('_crear_auth_usuario'),
        ('_pin_aleatorio'),
        ('admin_borrar_subgrupo'),
        ('admin_crear_acceso'),
        ('admin_crear_empleado'),
        ('admin_crear_subgrupo'),
        ('admin_editar_empleado'),
        ('admin_eliminar_empleado'),
        ('admin_eliminar_familiar'),
        ('admin_guardar_anual_ver'),
        ('admin_guardar_marcas'),
        ('admin_guardar_ver_calendario'),
        ('admin_guardar_ver_horas'),
        ('admin_renombrar_subgrupo'),
        ('admin_resetear_acceso'),
        ('cancelar_cambio'),
        ('crear_cambios'),
        ('enviar_mensaje_cambio'),
        ('guardar_colores'),
        ('guardar_turnos'),
        ('hoy_es'),
        ('limpiar_cambios'),
        ('marcar_visto_cambio'),
        ('mi_empleado'),
        ('mi_perfil'),
        ('mi_rol'),
        ('pin_cambiado'),
        ('push_avisar'),
        ('push_borrar'),
        ('push_guardar'),
        ('push_preferencias'),
        ('responder_cambio'),
        ('tg_push_mensaje'),
        ('tg_push_solicitud')),
esp_columnas(t, c) as (values
        ('cambios_dias','codigo_destinatario'),
        ('cambios_dias','codigo_solicitante'),
        ('cambios_dias','fecha'),
        ('cambios_dias','solicitud_id'),
        ('cambios_hechos','codigo_cedido'),
        ('cambios_hechos','codigo_recibido'),
        ('cambios_hechos','con_empleado_id'),
        ('cambios_hechos','empleado_id'),
        ('cambios_hechos','fecha'),
        ('cambios_hechos','hecho_en'),
        ('cambios_mensajes','autor_id'),
        ('cambios_mensajes','creado_en'),
        ('cambios_mensajes','id'),
        ('cambios_mensajes','solicitud_id'),
        ('cambios_mensajes','texto'),
        ('cambios_solicitudes','cerrada_en'),
        ('cambios_solicitudes','creada_en'),
        ('cambios_solicitudes','destinatario_id'),
        ('cambios_solicitudes','estado'),
        ('cambios_solicitudes','id'),
        ('cambios_solicitudes','primer_dia'),
        ('cambios_solicitudes','solicitante_id'),
        ('cambios_solicitudes','visto_destinatario'),
        ('cambios_solicitudes','visto_solicitante'),
        ('colectivos','codigo'),
        ('colectivos','dias_solape'),
        ('colectivos','icono'),
        ('colectivos','nombre'),
        ('colectivos','orden'),
        ('colectivos','patron'),
        ('colectivos','puesto'),
        ('colectivos','tipo'),
        ('config_horas','anio'),
        ('config_horas','dias_ld'),
        ('config_horas','dias_vacaciones'),
        ('config_horas','horas_dia_exceso'),
        ('empleados','activo'),
        ('empleados','anual_ver'),
        ('empleados','colectivo'),
        ('empleados','created_at'),
        ('empleados','id'),
        ('empleados','iniciales'),
        ('empleados','inicio'),
        ('empleados','marcas'),
        ('empleados','nombre'),
        ('empleados','orden'),
        ('empleados','ver_calendario_de'),
        ('empleados','ver_horas'),
        ('excepciones','codigo'),
        ('excepciones','created_at'),
        ('excepciones','empleado_id'),
        ('excepciones','fecha'),
        ('festivos','fecha'),
        ('festivos','nombre'),
        ('horas_anuales','anio'),
        ('horas_anuales','empleado_id'),
        ('horas_anuales','horas'),
        ('horas_dia','empleado_id'),
        ('horas_dia','fecha'),
        ('horas_dia','horas'),
        ('horas_turno','anio'),
        ('horas_turno','codigo'),
        ('horas_turno','horas'),
        ('intensivas','created_at'),
        ('intensivas','desde'),
        ('intensivas','hasta'),
        ('intensivas','id'),
        ('intensivas','nota'),
        ('marcas_dia','codigo'),
        ('marcas_dia','created_at'),
        ('marcas_dia','empleado_id'),
        ('marcas_dia','fecha'),
        ('perfiles','activo'),
        ('perfiles','colores'),
        ('perfiles','debe_cambiar_pin'),
        ('perfiles','empleado_id'),
        ('perfiles','id'),
        ('perfiles','iniciales'),
        ('perfiles','nombre'),
        ('perfiles','rol'),
        ('push_config','id'),
        ('push_config','secreto'),
        ('push_config','url'),
        ('push_suscripciones','auth'),
        ('push_suscripciones','avisar_cambios'),
        ('push_suscripciones','avisar_mensajes'),
        ('push_suscripciones','creada_en'),
        ('push_suscripciones','empleado_id'),
        ('push_suscripciones','endpoint'),
        ('push_suscripciones','id'),
        ('push_suscripciones','p256dh'),
        ('push_suscripciones','user_id'),
        ('semanas_especiales','codigo'),
        ('semanas_especiales','created_at'),
        ('semanas_especiales','empleado_id'),
        ('semanas_especiales','semana')),
esp_politicas(t, p) as (values
        ('cambios_dias','cambios_dias_leer'),
        ('cambios_hechos','cambios_hechos_leer'),
        ('cambios_mensajes','cambios_mensajes_leer'),
        ('cambios_solicitudes','cambios_solicitudes_leer'),
        ('colectivos','colectivos_editar'),
        ('colectivos','colectivos_leer'),
        ('config_horas','config_horas_ins'),
        ('config_horas','config_horas_leer'),
        ('config_horas','config_horas_upd'),
        ('empleados','empleados_editar'),
        ('empleados','empleados_leer'),
        ('excepciones','excepciones_actualizar'),
        ('excepciones','excepciones_borrar'),
        ('excepciones','excepciones_insertar'),
        ('excepciones','excepciones_leer'),
        ('festivos','festivos_editar'),
        ('festivos','festivos_leer'),
        ('horas_anuales','horas_anuales_del'),
        ('horas_anuales','horas_anuales_ins'),
        ('horas_anuales','horas_anuales_leer'),
        ('horas_anuales','horas_anuales_upd'),
        ('horas_dia','horas_dia_del'),
        ('horas_dia','horas_dia_ins'),
        ('horas_dia','horas_dia_leer'),
        ('horas_dia','horas_dia_upd'),
        ('horas_turno','horas_turno_ins'),
        ('horas_turno','horas_turno_leer'),
        ('horas_turno','horas_turno_upd'),
        ('intensivas','intensivas_editar'),
        ('intensivas','intensivas_leer'),
        ('marcas_dia','marcasdia_actualizar'),
        ('marcas_dia','marcasdia_borrar'),
        ('marcas_dia','marcasdia_insertar'),
        ('marcas_dia','marcasdia_leer'),
        ('perfiles','perfiles_leer'),
        ('push_suscripciones','push_suscripciones_leer'),
        ('semanas_especiales','semanas_actualizar'),
        ('semanas_especiales','semanas_borrar'),
        ('semanas_especiales','semanas_insertar'),
        ('semanas_especiales','semanas_leer')),
esp_realtime(n) as (values
        ('excepciones'),
        ('semanas_especiales'),
        ('marcas_dia'),
        ('empleados'),
        ('colectivos'),
        ('festivos'),
        ('intensivas')),
problemas as (
    select 'tabla' as tipo, n as nombre, 'FALTA' as estado
      from esp_tablas where to_regclass('public.' || n) is null
    union all
    select 'tabla', c.relname::text, 'SIN SEGURIDAD POR FILAS (RLS)'
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
       and c.relname in (select n from esp_tablas) and not c.relrowsecurity
    union all
    select 'función', n, 'FALTA'
      from esp_funciones f
     where not exists (select 1 from pg_proc p
                        where p.pronamespace = 'public'::regnamespace and p.proname = f.n)
    union all
    select 'función', p.proname::text, 'LA APP NO PUEDE EJECUTARLA (falta permiso para authenticated)'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('guardar_turnos', 'guardar_colores', 'crear_cambios', 'push_guardar')
       and not has_function_privilege('authenticated', p.oid, 'execute')
    union all
    select 'columna', t || '.' || c, 'FALTA'
      from esp_columnas e
     where to_regclass('public.' || e.t) is not null
       and not exists (select 1 from information_schema.columns k
                        where k.table_schema = 'public' and k.table_name = e.t and k.column_name = e.c)
    union all
    select 'política', t || ' · ' || p, 'FALTA'
      from esp_politicas e
     where to_regclass('public.' || e.t) is not null
       and not exists (select 1 from pg_policies x
                        where x.schemaname = 'public' and x.tablename = e.t and x.policyname = e.p)
    union all
    select 'tiempo real', n, 'FALTA (ejecuta fase19-sincronizacion.sql)'
      from esp_realtime r
     where to_regclass('public.' || r.n) is not null
       and not exists (select 1 from pg_publication_tables x
                        where x.pubname = 'supabase_realtime' and x.schemaname = 'public' and x.tablename = r.n)
)
select tipo, nombre, estado from problemas
union all
select 'resumen',
       'Todo en orden: 18 tablas, 35 funciones, 96 columnas, 40 políticas y tiempo real',
       'OK'
 where not exists (select 1 from problemas)
order by 1, 2;
