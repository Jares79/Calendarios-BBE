# Calendario BBE

Web app para consultar los turnos de la plantilla (jefes de turno, operadores de control y operadores de campo). Funciona en el móvil y en el ordenador, y está publicada en Vercel con los datos en Supabase.

## Cómo funciona

- **Cada persona entra con sus iniciales y un PIN** (6 a 10 números). En el primer acceso, o después de que el administrador le resetee el PIN, la app le obliga a elegir uno nuevo.
- **Los turnos se calculan a partir de un ciclo.** Cada colectivo tiene un ciclo de días (una letra por día). Cada empleado empieza ese ciclo en su fecha de inicio y lo repite sin fin. Con eso la app dibuja el calendario mensual, la búsqueda por día y el calendario anual.
- **Quién puede hacer qué** lo decide la base de datos, no el navegador:
  - `administrador`: gestiona empleados, accesos, PIN y ciclos.
  - `supervisor`: reservado para aprobar solicitudes (próximas fases).
  - `empleado`: ve su calendario y el de la plantilla.
  - `familiar`: acceso de solo lectura al calendario de un empleado, con su propio PIN.

### Letras de los turnos

| Letra | Turno | Letra | Turno |
|-------|-------|-------|-------|
| M | Mañana | P | Partida |
| T | Tarde | I | Intensiva |
| N | Noche | S | Solape |
| F | Fiesta | | |

## Tareas habituales (menú de administrador → "👥 Empleados y accesos")

- **Añadir un empleado**: botón "➕ Añadir empleado". La app muestra un PIN provisional que hay que dárselo en persona.
- **Cambiar nombre, iniciales, colectivo o fecha de inicio**: botón "✏️ Editar". Desmarcar "Activo" lo da de baja (no sale en los calendarios y no puede entrar) sin borrar nada.
- **Eliminar un empleado**: botón "🗑️ Eliminar" (definitivo: borra su ficha y todos sus accesos). Para que alguien deje de aparecer sin perder su ficha, mejor la baja. No puedes eliminarte a ti mismo.
- **PIN olvidado**: botón "🔑 PIN" genera uno provisional.
- **Acceso familiar**: botón "👪 Crear familiar". Crea las iniciales con `_F` al final (por ejemplo `JAM_F`) y un PIN propio. "🗑️ Quitar familiar" elimina solo ese acceso.
- **Cambiar un ciclo o los días de solape**: al final de la misma pantalla.

## Estructura del proyecto

```
index.html          Página principal
css/styles.css      Estilos
js/usuarios.js      Sesión (Supabase Auth): login, cambio de PIN, cierre de sesión
js/datos.js         Carga de colectivos y empleados; utilidades para pintar texto de forma segura
js/turnos.js        Cálculo de turnos (fechas en texto AAAA-MM-DD, sin zonas horarias)
js/calendario.js    Búsqueda por día, detalle de un día y calendario anual
js/CalendarioMensual.js  Mi calendario, menú de usuario
js/admin.js         Menú de administrador
js/permisos.js      Qué puede hacer cada rol (solo interfaz; el servidor vuelve a comprobarlo)
js/app.js           Arranque de la app
supabase/           SQL de la base de datos (ver abajo)
```

## Base de datos (Supabase)

Ejecutar en Supabase → SQL Editor, en este orden:

1. `supabase/fase1-1-estructura.sql`: tablas `colectivos`, `empleados` y `perfiles`, permisos por filas (RLS) y funciones del administrador.
2. `supabase/fase1-2-migrar-usuarios.sql`: pasa los usuarios de la tabla antigua `usuarios` al sistema de sesiones, conservando sus PIN.
3. `supabase/fase1-3-eliminar.sql`: funciones para eliminar empleados y accesos de familiar.

`supabase/fase1-deshacer.sql` vuelve atrás la Fase 1 (no toca la tabla `usuarios`). La carpeta `supabase/historico/` guarda los scripts del login anterior.

### Ajustes de Supabase Auth (una sola vez)

En el panel de Supabase, dentro de Authentication, comprueba:

- **Registro de usuarios nuevos desactivado** ("Allow new users to sign up"). Los accesos solo los crea el administrador desde la app.
- **Longitud mínima de contraseña igual o menor que 6**, porque el PIN mínimo son 6 números.

Los nombres exactos de los menús pueden cambiar con las versiones del panel.

## Seguridad

- La clave `sb_publishable_...` de `js/usuarios.js` puede estar en el código: está pensada para eso. Lo que protege los datos son las sesiones y los permisos por filas (RLS).
- Los nombres de empleados nunca se insertan como HTML (se pintan con `esc()` o `textContent`).
- Supabase Auth limita los intentos de acceso por dirección IP, pero ya no bloquea cuentas individuales como hacía el login anterior. Por eso conviene elegir PIN de 8 o más números.
