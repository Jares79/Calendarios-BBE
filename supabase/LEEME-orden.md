# Scripts SQL de Supabase: orden y qué hace cada uno

Se ejecutan en Supabase > SQL Editor (botón Run), cada uno de una sola vez. Son aditivos y se pueden repetir,
**salvo que no hay que volver a ejecutar uno anterior después de uno posterior** (los posteriores redefinen funciones).
Orden en una base de datos nueva: 1 → 13. En la base de datos del administrador están ejecutados los de la fase 1 a la 9
y falta el 10 (`fase10-baja-resumen.sql`, que es el que deja el estado final).

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `fase1-1-estructura.sql` | Tablas del calendario (colectivos, empleados, perfiles, excepciones, festivos, intensivas), RLS, funciones de login y de administración (`admin_crear_empleado`, `admin_crear_acceso`, `mi_rol()`, `mi_empleado()`, `guardar_colores`...). |
| 2 | `fase1-2-migrar-usuarios.sql` | Migra los usuarios del login antiguo a Supabase Auth. |
| 3 | `fase1-3-eliminar.sql` | Funciones de eliminar empleado / acceso familiar. |
| 4 | `fase3-excepciones.sql` | Cambios manuales de turno (`excepciones`) y sus permisos. |
| 5 | `fase4-correturnos.sql` | Colectivos Correturnos y Personal de jornada partida (ciclo P P P P I F F), tabla `semanas_especiales`, columna `colectivos.marcas` (retirada en la fase 9). |
| 6 | `fase4b-marcas-dia.sql` | Tabla `marcas_dia`: marca de un día suelto ("-" = ese día sin marca). |
| 7 | `fase5-cambios.sql` | Solicitudes de cambio: tablas `cambios_solicitudes`, `cambios_dias`, `cambios_mensajes` y funciones `crear_cambios`, `enviar_mensaje_cambio`, `responder_cambio`, `cancelar_cambio`, `marcar_visto_cambio`, `limpiar_cambios`. |
| 8 | `fase5-limpieza.sql` | (Opcional) programa `limpiar_cambios()` cada 15 min con pg_cron (activar antes la extensión en Database > Extensions). |
| 9 | `fase6-horas.sql` | Tablas de horas (primera versión, sin año) y `crear_cambios` con los correturnos. La fase 9 las migra. |
| 10 | `fase7-permutas.sql` | Tabla `cambios_hechos` (cambios aceptados, 30 días) y `responder_cambio` ampliado: sirve para avisar si uno deshace por su cuenta un cambio de dos. |
| 11 | `fase8-horas-dia.sql` | Tabla `horas_dia`: ajuste manual de las horas de un día. |
| 12 | `fase9-reorganizacion.sql` | Tipo de colectivo (`colectivos.tipo`), marcas por persona (`empleados.marcas`, G pasa a D, función `admin_guardar_marcas`), `crear_cambios` por tipo de colectivo, y horas por año (`horas_turno`, `config_horas`, `horas_anuales` con año). |
| 13 | **`fase10-baja-resumen.sql`** | **Estado final.** Turno B (baja) en `excepciones` y en los colores, `config_horas.dias_ld`, `empleados.ver_horas` (+ `admin_guardar_ver_horas`), las horas anuales las escribe cada persona, y crea o repara `horas_dia`. |

Otros: `fase1-deshacer.sql`, `fase3-deshacer.sql`, `fase4-deshacer`... (`*-deshacer.sql`) deshacen cada fase; `historico/` y
`seguridad.sql`, `pin-cambio.sql`, `admin-resetear-pin.sql` son del login antiguo (ya no se usan).

## Resumen del modelo de datos final
- `colectivos`: codigo, nombre, icono, puesto, patron (ciclo), dias_solape, orden, **tipo** (turnos | correturnos | otro).
- `empleados`: id, iniciales, nombre, colectivo, inicio (inicio del ciclo), orden, activo, **marcas** (text[]: D, CTD, CT1..CT4, CTY).
- `perfiles`: una fila por cuenta (rol, empleado_id, debe_cambiar_pin, activo, colores jsonb).
- `excepciones`(empleado_id, fecha, codigo): cambios manuales de turno. `festivos`, `intensivas`.
- `semanas_especiales`(empleado_id, semana = lunes, codigo) y `marcas_dia`(empleado_id, fecha, codigo | "-"): marcas de arriba de la celda.
- `cambios_solicitudes`, `cambios_dias`, `cambios_mensajes`, `cambios_hechos`: cambios entre compañeros.
- `horas_turno`(anio, codigo, horas), `config_horas`(anio, horas_dia_exceso, dias_vacaciones), `horas_anuales`(empleado_id, anio, horas), `horas_dia`(empleado_id, fecha, horas). Desde la fase 10: `config_horas.dias_ld`, `empleados.ver_horas` y el código de turno `B`.
- Todas con RLS. Las escrituras delicadas van por funciones `security definer`.
