# Resumen del proyecto: Calendario BBE (estado tras la fase 15)

Texto para retomar el proyecto en una conversación nueva. Va junto con el zip del código actual (`Calendarios-BBE-fase15-completo.zip`). Dentro: `supabase/` con todos los SQL y su orden en `supabase/LEEME-orden.md`, y el banco de pruebas en `pruebas/`.

**Primer mensaje sugerido en el chat nuevo:** «Adjunto el zip y el resumen del proyecto. Léelo todo antes de contestar y dime qué entiendes que está pendiente.»

## 1. Qué es y cómo trabajar con el usuario
- **App web de turnos** de una planta, con unos 21 empleados. Personal a turnos: jefes de turno, operadores de control y operadores de campo. Personal de jornada partida: correturnos y los subgrupos que cree el administrador.
- **El usuario es el administrador.** Tiene dos accesos con la misma clave: **JAM**, que es un empleado normal (jefe de turno, con calendario), y **ADMIN**, un administrador **sin ficha de empleado** (sin calendario ni colectivo: su pantalla de inicio es directamente el menú). No es técnico: Mac y móvil Android con Chrome. Sube el código a GitHub desde la web (Add file → Upload files). Infraestructura: GitHub, Vercel (ramas `main` y `develop`, con una dirección de prueba por rama) y Supabase (base de datos y sesiones). **El proyecto de Supabase se comparte con otra app de reservas** (tabla `reservas`): no tocar nada que no sea del calendario.
- Tecnología: HTML, CSS y JavaScript sin compilar, `supabase-js` desde CDN, PWA instalable.
- Cómo prefiere trabajar:
  - Responder **siempre en español**.
  - Escribe en frases cortas y a veces con erratas (dictado): interpretar la intención y, si algo es ambiguo, preguntar con una **lista numerada** (él contesta por números).
  - Quiere que se le hagan las preguntas necesarias **antes** de empezar y que se entregue de una vez (usa el plan gratuito de Claude, con límite de uso).
  - Quiere **solo lo necesario**: un zip de parche con los archivos que cambian (respetando carpetas) y, si hace falta, el SQL. No un zip completo cada vez, salvo que lo pida. Decirle siempre qué SQL ejecutar y en qué orden.
  - **Probar antes de entregar** con el banco de pruebas y avisar con claridad de lo que no se ha podido probar contra el Supabase real, que es **siempre el SQL**.
  - Subir `VERSION` de `sw.js` en cada entrega para que todos descarguen lo nuevo (ahora `bbe-v18`).
  - Le gustan los detalles cuidados: ventanas bonitas, avisos claros, textos en español.

## 2. Estado actual
- Hechas y probadas en el navegador simulado: fases 1 a 15 (ver historial en el punto 9).
- **SQL: hay que preguntar al usuario qué ha ejecutado.** Lo último confirmado es que había ejecutado hasta la fase 9. Orden de lo que puede faltar: `fase10-baja-resumen.sql` → `fase12-grupos-solapes.sql` → `admin-sin-ficha.sql` (solo si aún no desvinculó a ADMIN) → `fase15-anual-visibilidad.sql`. La fase 11, 13 y 14 no tuvieron SQL propio más que `admin-sin-ficha.sql`. Todos se pueden repetir sin problema.
- El usuario está probando en su Supabase real. Si al guardar horas de un día falla, la fase 10 recrea `horas_dia` y el aviso de error ya muestra el código técnico: pedírselo.
- Pendiente también fundir las ramas en `main` (mientras tanto los compañeros ven la versión antigua).

## 3. Estructura de personal
- Dos categorías, deducidas del **tipo** del colectivo (`colectivos.tipo`):
  - **Personal a turnos** (tipo `turnos`): jefes, control y campo. No habrá más colectivos a turnos.
  - **Personal de jornada partida** (todo lo demás): `correturnos` (tipo `correturnos`), `jornada` (tipo `otro`, ahora llamado «Sin subgrupo») y los subgrupos nuevos (tipo `otro`).
- Ciclo de jornada partida y correturnos: semanal `P P P P I F F` (lunes a domingo; el inicio de cada empleado debe ser lunes). Los subgrupos nuevos heredan ese ciclo.
- El administrador crea, renombra y borra subgrupos (solo los de tipo `otro` distintos de `jornada`, y solo si no tienen empleados) desde Empleados y accesos, y asigna empleados con el desplegable de colectivo de la ficha.
- Roles de cuenta: `administrador`, `supervisor` (sin función), `empleado` y `familiar` (solo lectura del calendario de un empleado; iniciales acabadas en `_F`).
- Un **administrador sin ficha** (`perfiles.empleado_id` nulo) no tiene calendario: inicio directo en el menú (siempre abierto), sin «Mi año» ni «Editar calendario». Su acceso no sale en Empleados y accesos, así que **su PIN no se puede resetear desde la app**.

## 4. Qué hace la app
- **Acceso**: iniciales y PIN (6 a 10 números, con recordatorio bajo el campo). Sesión de Supabase Auth (correo ficticio `iniciales@calendario-bbe.app`). Primer acceso o reseteo: obliga a elegir un PIN.
- **Salir** pide confirmación con una ventana centrada. El **gesto o botón atrás del móvil** cierra lo último abierto (ventana, hoja de un día, menú, modo cambio o edición, pantalla de resultados) en lugar de salir de la app; con el calendario principal a la vista, atrás sale de la app (`js/atras.js`).
- **Pantalla principal**: bloque «Hoy» con una pastilla **«Resumen del año ▾»** que despliega el resumen (cerrado por defecto, recordado en el dispositivo): vacaciones y libre disposición (LD), solapes (si el colectivo tiene) y, a quien corresponda, horas anuales y excesos, siempre como *utilizados / disponibles*. Debajo, el mes (cabe entero en el móvil: JavaScript ajusta la altura).
- **Menú** (desplegable de la cabecera):
  - Buscar un día.
  - Calendario anual: cada persona ve el de su colectivo y los grupos o subgrupos que el administrador le dé en su ficha (`anual_ver`); el administrador ve todos.
  - Mi año: 12 meses; en pantallas anchas muestra la letra del turno en cada día.
  - Editar calendario: un día o rango; las celdas del editor son todas iguales; el selector ofrece solo los turnos que esa persona puede poner (la jornada partida no usa M, T, N ni S); permite ajustar a mano las horas de un día.
  - Editar colores, Cambios, Horas, Ajustes (modo claro/oscuro/según el sistema, y **Mis horas anuales**).
- **Leyenda** (solo escritorio): solo los turnos y marcas que cada persona puede poner.
- **Administración**: Empleados y accesos (por categorías y subgrupos desplegables: alta, edición, baja, eliminar, resetear PIN, acceso familiar, ciclos, solapes por colectivo, casilla para enseñar el resumen de horas a quien no es de turnos y bloque de calendarios anuales visibles), Disponibilidades y CT (también desplegable), Festivos, Intensivas, Horas y convenio.

## 5. Reglas de negocio
- **Turnos**: M, T, N, F, P, I, S (pueden salir del ciclo) y V, E, J, LD y B (baja), que solo se ponen a mano. **Prioridad de cálculo**: lo editado a mano por esa persona; el festivo convierte P/I del ciclo en F; la intensiva convierte P en I; si no, el ciclo del colectivo desde la fecha de inicio de cada empleado.
- **Horas por turno**: el administrador las define por año en «Horas y convenio» (M, T, N, P, I, S, V, E), junto con horas por día de exceso, días de vacaciones (23) y de LD (2); hay botón de copiar del año anterior.
- **B, LD, J y el solape puesto a mano no tienen horas propias**: suman las horas previstas ese día (ajuste manual del día si lo hay y, si no, las del turno del ciclo, intensiva o festivo). Si el día traía un turno puesto a mano con otras horas, esas horas se conservan como ajuste. Cambiar el turno a otro (que no sea B/LD/J/S) borra el ajuste. Un solape que sale del ciclo sí tiene las horas que fija el administrador.
- **Horas anuales de convenio**: las escribe cada persona en Ajustes (solo el total del año), solo si se le enseñan las horas. Los colectivos de turnos siempre las ven; el resto solo si el administrador activa la casilla de su ficha (`empleados.ver_horas`). **Excesos pendientes** = horas computables del año − horas anuales (los E ya puestos ya restan horas); en días, dividiendo por las horas de un día de exceso.
- **Solapes**: `colectivos.dias_solape` = solapes al año por persona de ese colectivo de turnos (0 = desactivado); con más de 0 el resumen muestra los días S utilizados y disponibles del año en curso.
- **Marcas de la mitad de arriba de la celda**: D (Disponible) y CTD, CT1, CT2, CT3, CT4, CTY (semanas de correturno). El administrador decide persona a persona quién las usa (`empleados.marcas`). Se ponen por día suelto o por toda la semana. No cambian el turno de abajo. CT1 a CT4 comparten color por defecto (siguen a CT1 hasta que el usuario les dé uno propio).
- **Cambios de turno entre compañeros** (menú Cambios): permuta de uno o varios días, con hilo de mensajes; el destinatario acepta o rechaza; el solicitante puede cancelar. Solo desde mañana; caduca el día del primer cambio; lo cerrado se borra a las 24 h. Quién puede pedir a quién: dentro del mismo colectivo de turnos; un correturno a cualquiera de los tres; los tres a un correturno que tenga M, T o N ese día; la jornada partida no usa cambios. Avisos sin bloquear: cambio corto (noche→tarde, tarde→mañana) y noche seguida de mañana.
- **Deshacer cambios**: si un turno viene de un cambio aceptado (`cambios_hechos`, 30 días) y uno lo cambia a mano por su cuenta, la app avisa y sugiere pedir deshacerlo. **Quien tiene B no genera avisos de cobertura a los demás.** Al poner a mano M, T o N avisa si ya está cubierto más allá de lo habitual por el ciclo (para un correturno, si nadie falta en ese turno).

## 6. Archivos
```
index.html, manifest.webmanifest, sw.js, README.md, img/
css/styles.css         Todos los estilos (variables al principio; claro y oscuro)
js/usuarios.js         Cliente de Supabase y sesión
js/permisos.js         Qué puede hacer cada rol (solo interfaz)
js/datos.js            Carga de datos; GRUPOS, grupoDeColectivo(), colectivosVisiblesAnual(); utilidades esc(), el(), reemplazarHijos()
js/turnos.js           Cálculo de turnos (fechas "AAAA-MM-DD"), TURNOS, MARCAS, infoTurno(), turnosPermitidosDe()
js/semanas.js          Marcas (por semana y por día) y pantalla «Disponibilidades y CT»
js/calendario.js       Búsqueda, detalle de un día, calendario anual
js/CalendarioMensual.js  Mi calendario, menú, bloque Hoy y resumen desplegable, ajuste a la pantalla, leyenda, sinCalendario()
js/anio.js             Mi año
js/edicion.js          Editor (un día o rango), guardado, avisos previos, conservación de horas
js/colores.js          Editor de colores
js/cambios.js          Solicitudes de cambio, varios días, avisos de cobertura y de deshacer, abrirModal/cerrarModal
js/horas.js            Horas y convenio, sección Horas, horas de B/LD/J/S, resumen principal, horas anuales en Ajustes
js/tema.js             Modo claro/oscuro/sistema y Ajustes (se carga en la cabecera)
js/admin.js, js/admin-fechas.js   Empleados y accesos (grupos y subgrupos, solapes, ficha); festivos e intensivas; helpers
js/atras.js            Historial: gesto atrás cierra capas
js/app.js              Arranque, pantallas de acceso, confirmación de salir
supabase/              Todos los SQL y su orden (LEEME-orden.md)
pruebas/               Banco de pruebas con Supabase simulado (ver pruebas/LEEME.md)
```
El orden de carga de los scripts está en `index.html`; si se añade un archivo nuevo, hay que añadirlo también a la lista de `sw.js` y subir `VERSION`.

## 7. Base de datos
Ver `supabase/LEEME-orden.md` (orden de los scripts y modelo de datos final). Puntos clave:
- Todo con RLS; las escrituras delicadas van por funciones `security definer`.
- Cada uno solo escribe en `excepciones` de su propio empleado; festivos e intensivas solo los cambia el administrador; un familiar solo ve a su empleado.
- Columnas y tablas recientes: `colectivos.dias_solape`, `config_horas.dias_ld`, `empleados.ver_horas`, `empleados.anual_ver`, tabla `horas_dia`, código de turno `B`. Funciones: `admin_crear_subgrupo`, `admin_renombrar_subgrupo`, `admin_borrar_subgrupo`, `admin_guardar_ver_horas`, `admin_guardar_anual_ver`, `admin_guardar_marcas`.
- **Los calendarios anuales visibles por persona son un control de la interfaz, no privacidad real**: los turnos de todos siguen siendo legibles para cualquier usuario con sesión.
- Las tablas del login antiguo (`usuarios`, `login_intentos`) ya no se usan y se pueden borrar cuando `main` use el login nuevo.

## 8. Cosas técnicas a recordar
- Fechas siempre como texto `AAAA-MM-DD`; el cálculo del ciclo no depende de la zona horaria.
- Los textos de la base de datos nunca se meten como HTML: `esc()` o `el()`.
- `replaceChildren()` no admite arrays ni `null` (pinta «null»): usar spread o `reemplazarHijos()`. `el()` aplana solo un nivel de arrays.
- El cierre al tocar fuera de la hoja usa `composedPath()`; al abrir una hoja desde otra, abrirla con `setTimeout(..., 0)` o se cierra con el mismo clic.
- Los años de datos se cargan bajo demanda (`asegurarAnio`); si falta una tabla o columna nueva (SQL sin ejecutar) las cargas opcionales no rompen la app.
- El service worker prueba primero la red y solo guarda archivos de la propia web, nunca datos.
- El entorno de Claude no tiene internet: no se ven las tipografías de Google Fonts ni se prueba el SQL real.
- `atras.js` mantiene una entrada de historial por capa abierta; las capas se detectan por el DOM y por las variables `modoEdicion` y `modoCambio`.
- **Banco de pruebas**: Playwright con Chromium. Desde `pruebas/`: `python3 t16.py`, etc. Se ejecutan todos los `t*.py` antes de cada entrega. Un fallo típico es que un test espere un desplegable abierto: hay que abrirlo antes.

## 9. Historial de fases
| Fase | Qué se hizo |
|---|---|
| 1 | Login con Supabase Auth, estructura (colectivos, empleados, perfiles), administración |
| 3 | Cambios manuales de turno (`excepciones`) |
| 4 | Correturnos, jornada partida, marcas de la mitad de arriba |
| 5 a 7 | Cambios de turno entre compañeros, horas, permutas y aviso de deshacer |
| 8 | Ajuste manual de las horas de un día |
| 9 | Tipo de colectivo, marcas por persona, horas por año |
| 10 | Turno B (baja), LD, resumen bajo «Hoy», horas anuales por persona, casilla de horas para quien no es de turnos |
| 11 | (sin SQL) Resumen desplegable, LD/J/S con horas previstas, empleados por colectivo |
| 12 | Categorías y subgrupos, solapes, recordatorio del PIN, textos «utilizados» |
| 13 | Confirmación al salir y gesto atrás |
| 14 | Administrador sin ficha |
| 15 | Editor de turnos uniforme, letras en Mi año, leyenda por persona, calendario anual por persona, Disponibilidades y CT desplegable, login sin casillas |

## 10. Pendientes y decisiones abiertas
- **Inconsistencia en correturnos**: el usuario dice que a un correturno que edita un turno que había intercambiado no le sale la sugerencia de pedir deshacer el cambio, y a la gente de turnos sí. **No se ha reproducido** en el banco de pruebas (sale el aviso y el botón en los dos casos, al editar un día, al volver al ciclo y en rango). Dijo que volvería a probar y daría el caso completo: quién cambió con quién, qué día y turno, qué hizo exactamente y si no sale ningún aviso o solo falta el botón. Ojo: el botón solo se ofrece para días futuros.
- **Gesto atrás**: probado solo simulando el botón atrás del navegador; falta probarlo en un móvil real (Android con Chrome y la app instalada en iPhone). Desde una pantalla de administrador, atrás vuelve al calendario, no a la pantalla anterior.
- **Suposición pendiente de confirmar**: la jornada partida no usa M, T, N ni S en el editor ni en la leyenda (`turnosPermitidosDe`). Si quiere otra regla, es una línea.
- Pantalla propia para gestionar las semanas CT de otra manera (el usuario eliminó la pantalla «Semanas» y dijo que lo hará más adelante).
- Ideas: notas por día; enlace de calendario suscribible o Google Calendar; notificaciones push; exportar/imprimir; botón «Editar» para festivos e intensivas; dar uso al rol `supervisor`; borrar el login antiguo; permitir crear subgrupos dentro del formulario de añadir empleado (hoy se crean desde el listado).

## 11. Avisos pendientes de revisar con el usuario
- Supabase Auth limita intentos por IP, pero no bloquea cuentas individuales: conviene PIN de 8 o más números.
- El plan gratuito de Supabase pausa proyectos inactivos y el de Vercel es de uso no comercial: que revise las condiciones.
- La app guarda nombres y turnos de personas: conviene que la empresa lo sepa. Repositorio de GitHub recomendado privado.
- El cálculo de excesos depende de que las horas por turno (incluidas V y E) y las horas anuales estén bien definidas: validar con un ejemplo real. Hasta que cada persona ponga sus horas anuales, los excesos disponibles salen vacíos.
