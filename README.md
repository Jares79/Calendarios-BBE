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
| F | Fiesta | V | Vacaciones |
| E | Excesos | J | Permiso justificado |
| LD | Libre disposición | | |

M, T, N, F, P, I y S pueden salir del ciclo. V, E, J y LD solo se ponen a mano.

### Qué turno aparece cada día (de más a menos prioridad)

1. **Un cambio puesto a mano** por esa persona (siempre gana).
2. **Festivo**: convierte en F una P o una I que salga del ciclo (M, T y N no cambian).
3. **Intensiva**: convierte en I cualquier P dentro de los periodos marcados.
4. **El ciclo** de su colectivo, desde su fecha de inicio.

## Para todos los usuarios (menú desplegable)

- **Editar calendario**: cada uno edita solo el suyo; los demás ven sus cambios. Toca un día para elegir el turno, o "Varios días" para un rango de fechas. "Volver al ciclo" deshace un cambio. Los días cambiados llevan un puntito.
- **Editar colores**: paleta amplia (y selector libre) para cada turno. Los colores se guardan en la cuenta de cada persona y solo los ve ella.
- **Buscar un día** y **Calendario anual**.

## Tareas del administrador

- **Festivos**: añade o quita festivos del año (nombre opcional). Valen para toda la plantilla.
- **Intensivas**: añade periodos (de una fecha a otra, o un solo día dejando "Hasta" vacío). El botón "Poner 15/06 – 15/09" rellena el verano.

## Tareas habituales (menú de administrador → "👥 Empleados y accesos")

- **Añadir un empleado**: botón "➕ Añadir empleado". La app muestra un PIN provisional que hay que dárselo en persona.
- **Cambiar nombre, iniciales, colectivo o fecha de inicio**: botón "✏️ Editar". Desmarcar "Activo" lo da de baja (no sale en los calendarios y no puede entrar) sin borrar nada.
- **Eliminar un empleado**: botón "🗑️ Eliminar" (definitivo: borra su ficha y todos sus accesos). Para que alguien deje de aparecer sin perder su ficha, mejor la baja. No puedes eliminarte a ti mismo.
- **PIN olvidado**: botón "🔑 PIN" genera uno provisional.
- **Acceso familiar**: botón "👪 Crear familiar". Crea las iniciales con `_F` al final (por ejemplo `JAM_F`) y un PIN propio. "🗑️ Quitar familiar" elimina solo ese acceso.
- **Cambiar un ciclo o los días de solape**: al final de la misma pantalla.

## Fase 4: Mi año y colectivos con semanas

- **Mi año** (menú): los 12 meses a la vez, un cuadradito por día con el color de su turno, selector de año con flechas y recuento de días por turno. Tocar un cuadradito abre el detalle del día.
- **Colectivos nuevos** (se crean con `supabase/fase4-correturnos.sql`): *Correturnos* y *Personal de jornada partida*, ciclo de 7 días `P P P P I F F` de lunes a domingo. El día de inicio de cada empleado tiene que ser un **lunes** (la app lo comprueba al dar de alta o editar). Se añaden con "Empleados y accesos" como el resto.
- **Marcas de la mitad de arriba de la celda** (D, CTD, CT1... CTY): ver "Fase 9" (se asignan persona a persona). Tablas: `semanas_especiales` (marca de una semana entera, por su lunes) y `marcas_dia` (marca de un día suelto, o "-" = ese día sin marca). Archivos nuevos: `js/semanas.js` y `js/anio.js`.

## Fase 5: solicitudes de cambio entre compañeros

- Solo en los colectivos de turnos (jefes de turno, operadores de control y de campo), entre compañeros del mismo colectivo.
- Es una **permuta**: cada uno se queda con el turno del otro ese día. Se pide un día desde su ficha ("Solicitar cambio") o varios con "Cambio de varios días" (se eligen en el calendario, cambiando de mes si hace falta). En la ventana se elige a quién se pide cada día y se puede añadir un mensaje.
- Solo se ofrecen compañeros con turno M, T, N, P, I, S o F ese día. Avisa (sin bloquear) de noche → tarde, tarde → mañana y noche → mañana.
- Menú **Cambios**: pestañas *Recibidas* y *Mis solicitudes*, con el hilo de mensajes de cada solicitud. El destinatario acepta (se cambian los dos calendarios) o rechaza; el solicitante puede cancelar. Globo de avisos en el menú y junto al nombre.
- La solicitud caduca el día del primer cambio. Lo aceptado, rechazado, cancelado o caducado se borra a las 24 horas.
- SQL: `supabase/fase5-cambios.sql` (obligatorio) y `supabase/fase5-limpieza.sql` (limpieza programada con pg_cron, opcional: la app también limpia al abrir y cada minuto).

## Fase 6 y 8: horas, resumen del año y ajuste por día

- **Horas y convenio** (menú de administrador, **por año**): horas que cuenta cada turno, horas que equivale un día de excesos, días de vacaciones y horas anuales de cada empleado (cada uno solo ve las suyas). Hay un botón para copiar los valores del año anterior.
- **Horas** (menú, para todos): horas por mes, vacaciones (usadas y restantes), excesos, solapes, permisos justificados y libre disposición, y las **horas y días de excesos que quedan por pedir** (horas computables del año − horas anuales). El administrador elige a cualquiera y tiene la pestaña "Todos".
- **Editor de calendario**: cada turno muestra las horas que computa y, en un día, se puede **ajustar a mano** cuántas horas computa (p. ej. una baja que computa como el turno que tocaba). Cambiar el turno de ese día borra el ajuste. Tabla `horas_dia`.
- Los **correturnos** pueden pedir cambios a los tres colectivos de turnos, y estos a un correturno que esté sustituyendo (turno M, T o N ese día).

## Fase 7: avisos al tocar tu calendario

- **Deshacer un cambio de dos personas**: si cambias a mano un turno que te llegó por un cambio aceptado, la app avisa de que afecta a la otra persona y sugiere pedirle que lo deshaga (se envía como una solicitud nueva). También deja "cambiar solo el mío". Para esto cada cambio aceptado se anota en `cambios_hechos` (se conserva 30 días tras la fecha).
- **Turno ya cubierto**: al poner M, T o N a mano, avisa si alguien de tu colectivo ya tiene ese turno ese día más allá de lo habitual (lo habitual sale del ciclo, así que cubrir a alguien de vacaciones no avisa). Un correturno recibe el aviso cuando nadie falta en ese turno en los colectivos de turnos.
- Los colectivos de turnos pueden pedir cambio a un correturno que esté sustituyendo (turno M, T o N ese día).
- SQL: `supabase/fase7-permutas.sql` (después de las fases 5 y 6; no vuelvas a ejecutar `fase5-cambios.sql` después, porque sustituiría `responder_cambio`).

## Instalar en el móvil

La web es una app instalable (PWA):

- **Android (Chrome):** menú ⋮ → "Instalar aplicación" o "Añadir a pantalla de inicio".
- **iPhone (Safari):** botón Compartir → "Añadir a pantalla de inicio".

Se abre a pantalla completa con su icono. Los datos siempre se piden a Supabase, así que hace falta conexión para ver los turnos.

## Diseño

- Los colores siguen la luz del día: Mañana (amarillo), Tarde (naranja), Noche (índigo). La Fiesta es un gris suave para que el ritmo de trabajo destaque.
- Modo oscuro automático según el sistema del móvil o del ordenador.
- Todos los colores y tipografías están como variables al principio de `css/styles.css`.
- Tipografías: Barlow y Barlow Condensed, cargadas desde Google Fonts.

## Estructura del proyecto

```
index.html          Página principal
manifest.webmanifest  Datos de la app instalable
sw.js               Service worker (guarda los archivos de la web; si cambias archivos, sube el número VERSION)
css/styles.css      Estilos
js/usuarios.js      Sesión (Supabase Auth): login, cambio de PIN, cierre de sesión
js/datos.js         Carga de colectivos y empleados; utilidades para pintar texto de forma segura
js/turnos.js        Cálculo de turnos (fechas en texto AAAA-MM-DD, sin zonas horarias)
js/calendario.js    Búsqueda por día, detalle de un día y calendario anual
js/CalendarioMensual.js  Mi calendario, menú de usuario, ajuste del mes a la pantalla del móvil
js/edicion.js       Editor de tu calendario (un día o un rango)
js/colores.js       Editor de colores de los turnos
js/admin.js         Menú de administrador: empleados y accesos
js/admin-fechas.js  Menú de administrador: festivos e intensivas
js/permisos.js      Qué puede hacer cada rol (solo interfaz; el servidor vuelve a comprobarlo)
js/app.js           Arranque de la app
supabase/           SQL de la base de datos (ver abajo)
```

## Tablas de la base de datos

- `empleados`: la ficha de trabajo de cada persona (nombre, colectivo, inicio de su ciclo).
- `perfiles`: el acceso a la app (una fila por cuenta, por ejemplo `JAM` y `JAM_F`), con su rol y sus colores. Va unido a Supabase Auth, donde está el PIN cifrado.
- `colectivos`: el ciclo de turnos de cada colectivo.
- `excepciones`: turnos cambiados a mano (empleado, fecha, turno).
- `festivos` e `intensivas`: los que mete el administrador.
- `usuarios` y `login_intentos`: del login antiguo; ya no se usan.

## Base de datos (Supabase)

Ejecutar en Supabase → SQL Editor, en este orden:

1. `supabase/fase1-1-estructura.sql`: tablas `colectivos`, `empleados` y `perfiles`, permisos por filas (RLS) y funciones del administrador.
2. `supabase/fase1-2-migrar-usuarios.sql`: pasa los usuarios de la tabla antigua `usuarios` al sistema de sesiones, conservando sus PIN.
3. `supabase/fase1-3-eliminar.sql`: funciones para eliminar empleados y accesos de familiar.
4. `supabase/fase3-excepciones.sql`: tablas `excepciones` (cambios manuales), `festivos` e `intensivas`, y los colores de cada usuario.

`supabase/fase3-deshacer.sql` borra lo de la Fase 3 y `supabase/fase1-deshacer.sql` vuelve atrás la Fase 1 (no toca la tabla `usuarios`). La carpeta `supabase/historico/` guarda los scripts del login anterior.

### Ajustes de Supabase Auth (una sola vez)

En el panel de Supabase, dentro de Authentication, comprueba:

- **Registro de usuarios nuevos desactivado** ("Allow new users to sign up"). Los accesos solo los crea el administrador desde la app.
- **Longitud mínima de contraseña igual o menor que 6**, porque el PIN mínimo son 6 números.

Los nombres exactos de los menús pueden cambiar con las versiones del panel.

## Seguridad

- La clave `sb_publishable_...` de `js/usuarios.js` puede estar en el código: está pensada para eso. Lo que protege los datos son las sesiones y los permisos por filas (RLS).
- Los nombres de empleados nunca se insertan como HTML (se pintan con `esc()` o `textContent`).
- Supabase Auth limita los intentos de acceso por dirección IP, pero ya no bloquea cuentas individuales como hacía el login anterior. Por eso conviene elegir PIN de 8 o más números.

## Fase 9: marcas por persona, tipos de colectivo y horas por año

- **Marcas por persona**: en "Empleados y accesos" → **Disponibilidades y CT**, el administrador marca quién puede usar **D** (Disponible; antes "G", guardia) y las semanas **CTD, CT1, CT2, CT3, CT4, CTY**. Solo a esas personas se les parte la celda en dos mitades y se les ofrecen esas marcas al editar (por semana o por día). Se guardan en `empleados.marcas`.
- **Tipo de colectivo** (`colectivos.tipo`): `turnos` (jefes de turno, operadores de control y de campo), `correturnos` u `otro`. Determina quién puede pedir cambios.
- Se eliminan la pantalla "Semanas" y las coincidencias con compañeros. La sección Horas pasa de Ajustes al menú.
- SQL: `supabase/fase9-reorganizacion.sql` (ver `supabase/LEEME-orden.md` para el orden de todos los scripts).
