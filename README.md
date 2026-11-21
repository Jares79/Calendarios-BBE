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

## Fase 10: baja (B), resumen de la pantalla principal y horas anuales por persona

- **Baja (B)**: turno nuevo que se pone a mano (un día o un rango). Se ve en el calendario y **sigue sumando las horas previstas** (desde la fase 11 también LD, J y el solape a mano): las del ajuste manual de ese día si lo hay y, si no, las del turno que tocaba por ciclo, intensiva o festivo. Si al pasar a B el día traía un turno puesto a mano con otras horas, esas horas se conservan como ajuste. Quien tiene B no genera avisos de cobertura a los demás. Color editable (por defecto rosa).
- **Colores CT1 a CT4**: por defecto comparten el color de CT1; cada usuario puede darle uno propio a cada uno en "Editar colores". CTD y CTY mantienen el suyo.
- **Resumen bajo "Hoy"** (sustituye a los próximos días): vacaciones y libre disposición (LD) *apuntados / disponibles* del año en curso y, para los colectivos de turnos (y para quien el administrador active), horas anuales, excesos puestos (días) y excesos disponibles (días y horas). (En la fase 11 pasó a ser un desplegable; ver abajo.)
- **Horas anuales**: ya no las pone el administrador; cada persona escribe las suyas (solo el total del año) en **Ajustes → Mis horas anuales**. El administrador las ve en Horas → Todos.
- **Administrador**: "Horas y convenio" tiene ahora los días de LD al año (por defecto 2) junto a los de vacaciones; en la ficha de un empleado de un colectivo que no es de turnos hay una casilla para enseñarle el resumen de horas.
- SQL: `supabase/fase10-baja-resumen.sql` (añade B a los turnos y colores permitidos, `config_horas.dias_ld`, `empleados.ver_horas`, permisos de horas anuales por persona y repara `horas_dia`). Los avisos de error al guardar horas ahora incluyen el código técnico.

## Fase 11: resumen desplegable, horas previstas en LD/J/S y empleados por colectivo

- **Resumen desplegable**: la barra de "Hoy" lleva una pastilla "Resumen del año ▾" (en todos los dispositivos). Al tocarla se despliega el resumen debajo; cerrado por defecto y se recuerda en el dispositivo. Con el resumen abierto el mes ya no se ajusta a la pantalla (la página baja). Se ha quitado el nivel de compactación que ocultaba el bloque "Hoy" entero en móviles muy bajos.
- **LD, J y solape (S) a mano** funcionan como la baja: se pintan, pero no tienen horas propias y suman las que había previstas ese día (ajuste manual de horas si lo hay y, si no, las del turno del ciclo). Si el día traía un turno puesto a mano con otras horas, se conservan como ajuste. Las horas de LD y J desaparecen de "Horas y convenio" (el solape que sale del ciclo conserva las suyas). Los LD/J ya guardados pasan a sumar las horas previstas del día.
- **Empleados y accesos**: un desplegable por colectivo (cerrados al entrar, con el número de empleados); se recuerda cuáles has abierto mientras trabajas.
- **Jornada partida**: la casilla "Enseñarle su resumen de horas…" de la ficha ya sirve para cualquier colectivo que no sea de turnos (correturnos y jornada partida). No hay SQL nuevo en esta fase.

## Fase 12: categorías y subgrupos, solapes en el resumen y recordatorio del PIN

- **Dos categorías** en Empleados y accesos: *Personal a turnos* (jefes de turno, operadores de control y de campo) y *Personal de jornada partida* (correturnos y los subgrupos que crees). La categoría se deduce del tipo del colectivo (`turnos` va a turnos; el resto a jornada partida). Cada categoría y cada subgrupo es un desplegable.
- **Subgrupos de jornada partida**: el administrador los crea, renombra y borra (solo si no tienen empleados) desde el desplegable de jornada partida. Heredan el ciclo del colectivo `jornada` (P P P P I F F), son de tipo `otro` (sin turnos) y aparecen en el desplegable de colectivo de la ficha del empleado. El colectivo `jornada` pasa a llamarse *Sin subgrupo*. Los correturnos siguen siendo de tipo `correturnos`, ahora dentro de jornada partida.
- **Solapes**: en cada colectivo de turnos hay un campo "Solapes al año de cada persona" (`colectivos.dias_solape`; 0 = desactivado). Con más de 0, el resumen de cada persona del colectivo muestra *Solapes: utilizados / disponibles* (días S marcados en el año / los que quedan). También se sigue pudiendo editar en el editor de ciclos.
- **Resumen**: "apuntados" pasa a "utilizados" y "Excesos puestos" a "Excesos utilizados".
- **Pantalla de acceso**: el campo PIN recuerda que tiene de 6 a 10 dígitos.
- SQL: `supabase/fase12-grupos-solapes.sql` (después de `fase10-baja-resumen.sql`; la fase 11 no tuvo SQL). Deshacer: `fase12-deshacer.sql`.

## Fase 13: confirmar al salir y botón/gesto atrás

- **Salir** pide confirmación con una ventana centrada ("¿Cerrar sesión?", con "Cerrar sesión" y "Cancelar"; Cancelar tiene el foco y Esc también cierra). El botón está junto al menú de usuario y se podía pulsar sin querer.
- **Gesto o botón atrás del móvil** (`js/atras.js`): en lugar de salir de la app, cierra lo último abierto: ventana, hoja de un día, menú de usuario, modo cambio o edición, o pantalla de resultados (Horas, Ajustes, administrador…). Con el calendario principal a la vista, atrás sigue saliendo de la app. Se mantiene una entrada de historial por capa abierta y se quitan al cerrar con los botones de la app. Desde una pantalla de resultados, atrás vuelve al calendario (no a la pantalla anterior dentro de administrador).
- Sin SQL nuevo. Versión del service worker `bbe-v16`.

## Fase 14: administrador sin ficha de empleado

- Un administrador sin ficha (`perfiles.empleado_id` nulo) no tiene calendario ni colectivo: la pantalla de inicio es directamente el menú, abierto y fijo (sin calendario, sin resumen de hoy, sin "Mi año" ni "Editar calendario"). Mantiene Buscar, Calendario anual, Horas (de todos), Ajustes, colores y todo el administrador. Desde cualquier pantalla, Volver devuelve al menú.
- `supabase/admin-sin-ficha.sql` desvincula a ADMIN de su ficha de empleado y la borra (el acceso, el PIN y el rol no cambian). Se ejecuta una vez.
- Atención: el acceso de este administrador deja de salir en Empleados y accesos (el listado es por empleados), así que su PIN no se puede resetear desde la app.
- Versión del service worker `bbe-v17`. Prueba: `pruebas/t15.py`.

## Fase 15: ajustes de uso (editor, Mi año, leyenda, calendario anual por persona)

- **Editor de turnos**: todas las celdas del mismo tamaño y sin las horas dentro (era lo que las agrandaba); la sección de horas del día queda a la vista.
- **Mi año**: en pantallas anchas (desde 768 px) cada día muestra la letra del turno (y el código de la marca arriba si la hay).
- **Acceso**: quitadas las casillas M T N F bajo el logo.
- **Leyenda y editor**: solo los turnos que cada persona puede poner (`turnosPermitidosDe`: jornada partida no usa M, T, N ni S) y solo sus marcas habilitadas. El editor de colores sigue la misma regla.
- **Calendario anual por persona**: en la ficha del empleado, el administrador marca qué grupos completos o subgrupos puede ver además del suyo (`empleados.anual_ver`, RPC `admin_guardar_anual_ver`). Sin nada marcado, solo ve su colectivo. El administrador ve todos. Es un control de lo que ofrece la app, no una barrera de privacidad en la base de datos.
- **Disponibilidades y CT**: desplegables por grupo y subgrupo, como Empleados y accesos.
- SQL: `supabase/fase15-anual-visibilidad.sql` (después de la fase 12). Versión del service worker `bbe-v18`. Pruebas: `pruebas/t16.py`.

## Fase 16 (alternativa B): Google Calendar

- Cada persona vincula su cuenta de Google en **Ajustes → Google Calendar** y elige qué calendarios ver (solo lectura: la app nunca crea, cambia ni borra nada en Google).
- **Dónde se ve:** las celdas de tu calendario con eventos llevan una estrellita abajo a la derecha, y la **ficha del día** muestra los eventos directamente (hora, título y calendario) con «Actualizado hace X».
- **Botón de sincronizar** (icono ⟳) en el recuadro «Hoy», arriba a la derecha: pide el permiso a Google (dura una hora), actualiza el mes que ves y los dos de al lado, y muestra «Google · hace X». Mientras el permiso siga vigente, al cambiar de mes se cargan solos. La ficha tiene también un pequeño «Actualizar».
- **Privacidad:** los eventos van de Google al navegador y **no pasan por Supabase**. En el dispositivo se guardan solo (localStorage, por persona) los calendarios elegidos y una copia de los últimos eventos para verlos al abrir la app sin conexión a Google. «Desvincular» borra ambas cosas.
- El script de Google se descarga por adelantado (solo si la función está en uso) para que el botón pida el permiso en el mismo toque y el navegador no bloquee la ventana.
- Mientras `GOOGLE_CLIENT_ID` (en `js/google.js`) esté vacío, la función no aparece. Pasos en `GOOGLE-CONFIGURAR.md`. No aparece para un administrador sin ficha ni para familiares.
- No hay SQL. Versión del service worker `bbe-v19`. Pruebas: `pruebas/t17g.py` (Google simulado; la conexión real hay que probarla con el ID de cliente).

## Fase 17: páginas legales y avisos push

- **Páginas legales:** `privacidad.html` y `terminos.html` (estáticas, con modo claro/oscuro). Enlazadas en la pantalla de acceso y en Ajustes → Información legal. El correo de contacto (`Jares@bbe.es`) y el nombre del responsable aparecen en ambas páginas: para cambiarlos, busca `Jares@bbe.es` en esos dos archivos (y en `supabase/functions/enviar-push/index.ts`, la línea del `VAPID_SUBJECT`, que es opcional).
- **Avisos push:** nueva sección **Ajustes → Avisos en el móvil** con interruptor (por dispositivo) y casillas «Solicitudes de cambio» y «Mensajes». Avisa de solicitud nueva (al destinatario), aceptada/rechazada (a quien la pidió), cancelada y mensajes nuevos. Tocar el aviso abre la app en Cambios. Al cerrar sesión el móvil deja de recibir avisos de esa cuenta.
- **Servidor:** `supabase/fase17-push.sql` (tablas, funciones y disparadores; un fallo de avisos nunca impide un cambio) y `supabase/functions/enviar-push/index.ts` (función de Supabase que envía). Pasos completos en `PUSH-CONFIGURAR.md`.
- Mientras `PUSH_VAPID_PUBLICA` (en `js/push.js`) esté vacía, la sección no aparece. En iPhone hace falta la app instalada (iOS 16.4+).
- Service worker `bbe-v20` (maneja los avisos y cachea las páginas legales). Pruebas: `pruebas/t18.py` (el navegador y los servicios de aviso se simulan; el envío real hay que probarlo con las claves).
