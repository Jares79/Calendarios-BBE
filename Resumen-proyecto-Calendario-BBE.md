# Resumen del proyecto: Calendario BBE (estado tras la fase 13)

Texto para retomar el proyecto en una conversación nueva. Va junto con el zip del código actual (carpeta `supabase/` con todos los SQL y su orden en `supabase/LEEME-orden.md`; banco de pruebas en `pruebas/`).

## 1. Qué es y cómo trabajar con el usuario
- **App web de turnos** de una planta con 21 empleados en tres colectivos de turnos (jefes de turno, operadores de control y operadores de campo), más dos colectivos nuevos: **Correturnos** y **Personal de jornada partida**.
- **El usuario es el administrador** (iniciales `JAM`). No es técnico: Mac y móvil Android con Chrome; sube el código a GitHub desde la web (Add file → Upload files). Infraestructura: GitHub, Vercel (ramas `main` y `develop`, y una dirección de prueba por rama) y Supabase (base de datos y sesiones). **El proyecto de Supabase se comparte con otra app de reservas** (tabla `reservas`): no tocar nada que no sea del calendario.
- Tecnología: HTML, CSS y JavaScript sin compilar, `supabase-js` desde CDN, PWA instalable.
- Cómo prefiere trabajar: responder en español; hacerle las preguntas necesarias antes de empezar y entregar de una vez (usa el plan gratuito de Claude, con límite de uso); guiarle paso a paso; darle un zip o solo los archivos que cambian; **probar el código antes de entregarlo** (banco de pruebas en `pruebas/`) y avisar con claridad de lo que no se ha podido probar contra el Supabase real, que es **siempre el SQL**. Cuando entrega archivos sueltos, dice a qué carpeta va cada uno. Subir `VERSION` de `sw.js` en cada entrega para que todos descarguen lo nuevo (ahora `bbe-v16`).

## 2. Estado actual
- Hechas y probadas en el navegador simulado: fases 1 a 10. **Pendiente de que el usuario las pruebe con su Supabase real: todo desde la fase 4**, y ejecutar `fase10-baja-resumen.sql` (ya ejecutó hasta la fase 9; aún no había aplicado las fases 10 y 11 cuando pidió la 12, y hay que ejecutar `fase10-baja-resumen.sql` y después `fase12-grupos-solapes.sql`). Al guardar horas de un día le salía un error: la fase 10 recrea `horas_dia` por si la fase 8 no se había ejecutado bien, y el aviso de error ya muestra el código técnico (si sigue fallando, pedirle ese código). Pendiente también fundir las ramas en `main` (mientras tanto los compañeros ven la versión antigua).
- Todo lo anterior a la fase 4 (login, calendario mensual, editor, colores, festivos e intensivas, administración) estaba ya probado por el usuario.

## 3. Qué hace la app
- **Login** con iniciales y PIN (6 a 10 números), sesión de Supabase Auth (correo ficticio `iniciales@calendario-bbe.app`). Primer acceso o reseteo: obliga a elegir un PIN. Roles: `administrador`, `supervisor` (sin función), `empleado` y `familiar` (solo lectura del calendario de un empleado; iniciales acabadas en `_F`).
- **Turnos**: M, T, N, F, P, I, S (pueden salir del ciclo) y V, E, J, LD y **B (baja)** (solo a mano). B, LD, J y el solape puesto a mano suman las horas previstas (ajuste manual del día o, si no, las del turno del ciclo, intensiva o festivo) y no genera avisos de cobertura a otros. Prioridad: lo editado a mano por esa persona; el festivo convierte P/I del ciclo en F; la intensiva convierte P en I; si no, el ciclo del colectivo desde la fecha de inicio de cada empleado. Los colectivos Correturnos y Jornada partida tienen ciclo semanal `P P P P I F F` (de lunes a domingo; el inicio de cada empleado debe ser lunes).
- **Marcas de la mitad de arriba de la celda**: **D** (Disponible, antes "G"/guardia) y **CTD, CT1, CT2, CT3, CT4, CTY** (semanas de correturno). El administrador decide **persona a persona** quién puede usarlas (Empleados y accesos → Disponibilidades y CT, columna `empleados.marcas`). Solo a esas personas se les parte la celda en dos y se les ofrecen en el editor, por **día suelto** o por **toda la semana** (de lunes a domingo), con opción de quitar solo un día o toda la semana. La marca no cambia el turno de abajo. Colores y textos de las marcas editables en "Editar colores"; CT1 a CT4 comparten color por defecto (siguen a CT1 hasta que el usuario les dé uno propio).
- **Para todos (menú)**: Mi calendario (mes, bloque "Hoy", búsqueda por día, calendario anual del colectivo, detalle del día con su origen), **Mi año** (12 meses; tocar un mes lo abre con botón para volver al año), Editar calendario (un día o rango; el selector muestra las horas que computa cada turno y permite ajustar a mano las horas de un día, p. ej. una baja que computa como el turno que tocaba; cambiar el turno borra el ajuste), Editar colores (paleta de 56 más selector libre), **Cambios**, **Horas**, Ajustes (modo claro/oscuro/según el sistema, guardado en el dispositivo, y Mis horas anuales). La ficha del día tiene botones "Editar este día", "Solicitar cambio" y "Cambio de varios días".
- **Cambios de turno entre compañeros** (menú Cambios, con globo de avisos): permuta (cada uno se queda con el turno del otro ese día) de uno o varios días, con hilo de mensajes por solicitud; el destinatario acepta (se cambian los dos calendarios) o rechaza; el solicitante puede cancelar. Solo desde mañana; caduca el día del primer cambio; lo cerrado se borra a las 24 h. Quién puede pedir a quién: dentro del mismo colectivo de turnos (`colectivos.tipo = 'turnos'`); un correturno a cualquiera de los tres; los tres a un correturno que tenga puesto M, T o N ese día; la jornada partida no usa cambios. Avisos (sin bloquear): cambio corto (noche→tarde, tarde→mañana) y noche seguida de mañana. Si un turno viene de un cambio aceptado y uno lo cambia a mano por su cuenta, la app avisa y sugiere pedir deshacerlo (`cambios_hechos`). Al poner a mano M, T o N avisa si ya está cubierto más allá de lo habitual por el ciclo (para un correturno, si nadie falta en ese turno).
- **Horas (por año)**: el administrador define en "Horas y convenio" las horas de cada turno, horas por día de exceso, días de vacaciones (23) y de libre disposición LD (2) (con botón de copiar del año anterior). **Las horas anuales de convenio las escribe cada persona** en Ajustes → Mis horas anuales (solo el total del año; las ven ella y el administrador).
- **Resumen bajo "Hoy"** (sustituye a los próximos días): vacaciones y LD apuntados/disponibles del año en curso y, a los colectivos de turnos (y a quien el administrador active con la casilla de su ficha, `empleados.ver_horas`), horas anuales, excesos puestos (días) y excesos disponibles (días y horas). Es un desplegable de la barra de Hoy (pastilla "Resumen del año ▾"), cerrado por defecto y recordado en el dispositivo. La sección **Horas** muestra por persona: horas por mes, V usadas/restantes, E, S, J, LD y los **excesos pendientes de pedir** = horas computables del año − horas anuales (los E ya puestos ya restan horas). El administrador ve a todos. Cada empleado solo ve sus horas anuales.
- **Administración**: empleados y accesos (alta, edición, baja, eliminar, resetear PIN, acceso familiar, ciclos y días de solape), festivos e intensivas, Horas y convenio, Disponibilidades y CT.
- **Diseño**: colores según la luz del día (Mañana amarillo, Tarde naranja, Noche índigo, Fiesta gris suave), modo oscuro, tipografías Barlow, el mes cabe entero en el móvil (JavaScript ajusta la altura), leyenda solo en escritorio.

## 4. Archivos
```
index.html, manifest.webmanifest, sw.js, README.md, img/
css/styles.css       Todos los estilos (variables al principio; claro y oscuro)
js/usuarios.js       Cliente de Supabase y sesión
js/permisos.js       Qué puede hacer cada rol (solo interfaz)
js/datos.js          Carga de colectivos, empleados, festivos, intensivas, cambios manuales y marcas de día; utilidades esc() y el(); reemplazarHijos()
js/turnos.js         Cálculo de turnos (fechas "AAAA-MM-DD"), prioridades, TURNOS y MARCAS, infoTurno()
js/semanas.js        Marcas (guardar por semana y por día, hoja de edición) y pantalla de administrador "Disponibilidades y CT"
js/calendario.js     Búsqueda, detalle de un día (con botones de editar y de cambios), calendario anual
js/CalendarioMensual.js  Mi calendario, menú, bloque Hoy, ajuste a la pantalla del móvil, leyenda
js/anio.js           Mi año (y abrir un mes desde el año)
js/edicion.js        Editor (un día o rango), guardado, avisos previos, horas por turno y ajuste de horas
js/colores.js        Editor de colores
js/cambios.js        Solicitudes de cambio, selección de varios días, avisos de cobertura y de deshacer
js/horas.js          Horas y convenio (admin), sección Horas, ajuste de horas por día
js/tema.js           Modo claro/oscuro/sistema y pantalla de Ajustes (se carga en la cabecera)
js/admin.js, js/admin-fechas.js   Empleados y accesos; festivos e intensivas (y helpers: mostrarVistaAdmin, selectorAnio)
js/app.js            Arranque y pantallas de acceso
supabase/            Todos los SQL y su orden (LEEME-orden.md)
pruebas/             Banco de pruebas con Supabase simulado (ver pruebas/LEEME.md)
```
El orden de carga de los scripts está en `index.html`; si se añade un archivo nuevo, hay que añadirlo también a la lista de `sw.js` y subir `VERSION`.

## 5. Base de datos
Ver `supabase/LEEME-orden.md` (orden de los scripts y modelo de datos final). Puntos clave: todo con RLS; las escrituras delicadas por funciones `security definer`; cada uno solo escribe en `excepciones` de su propio empleado; festivos e intensivas solo los cambia el administrador; un familiar solo ve a su empleado; las tablas del login antiguo (`usuarios`, `login_intentos`) y sus funciones ya no se usan y se pueden borrar cuando `main` use el login nuevo.

## 6. Cosas técnicas a recordar
- Fechas siempre como texto `AAAA-MM-DD`; el cálculo del ciclo no depende de la zona horaria.
- Los textos de la base de datos nunca se meten como HTML: `esc()` o `el()`.
- `replaceChildren()` no admite arrays ni `null` (pinta "null"): usar spread o `reemplazarHijos()`.
- El cierre al tocar fuera de la hoja usa `composedPath()`; al abrir una hoja desde otra, abrirla con `setTimeout(..., 0)` o se cierra con el mismo clic.
- Los años de datos se cargan bajo demanda (`asegurarAnio`); si falta una tabla nueva (SQL sin ejecutar) las cargas opcionales no rompen la app.
- El service worker prueba primero la red y solo guarda archivos de la propia web, nunca datos.
- El entorno de Claude no tiene internet: no se ven las tipografías de Google Fonts ni se prueba el SQL real.
- `colectivos.marcas` ya no existe: las marcas son por empleado y el tipo de colectivo está en `colectivos.tipo`.

## 7. Posibles siguientes pasos
- Pantalla propia para gestionar las semanas CT de otra manera (el usuario eliminó la pantalla "Semanas" y dijo que lo hará más adelante de otra forma).
- Notas por día; enlace de calendario suscribible o sincronización con Google Calendar; notificaciones push (Android con la app instalada; iPhone con iOS 16.4+ y app en pantalla de inicio); exportar/imprimir.
- Menores: botón "Editar" para festivos e intensivas; que las celdas del mes crezcan en móviles altos; borrar tablas y funciones del login antiguo; dar uso al rol `supervisor`.

## 8. Avisos pendientes de revisar con el usuario
- Supabase Auth limita intentos por IP, pero no bloquea cuentas individuales: conviene PIN de 8 o más números.
- El plan gratuito de Supabase pausa proyectos inactivos y el de Vercel es de uso no comercial: que revise las condiciones.
- La app guarda nombres y turnos de personas: conviene que la empresa lo sepa. Repositorio de GitHub recomendado privado.
- El cálculo de excesos depende de que las horas por turno (incluidas V, J, LD y E) estén bien definidas: validar con un ejemplo real.


## Estructura de personal (fase 12)
- Dos categorías, deducidas del tipo del colectivo: **Personal a turnos** (tipo `turnos`: jefes, control, campo; no habrá más) y **Personal de jornada partida** (todo lo demás: `correturnos`, `jornada` = "Sin subgrupo" y los subgrupos nuevos de tipo `otro`, que heredan el ciclo P P P P I F F).
- El administrador crea/renombra/borra subgrupos desde Empleados y accesos (RPC `admin_crear_subgrupo`, `admin_renombrar_subgrupo`, `admin_borrar_subgrupo`) y asigna empleados con el desplegable de colectivo de la ficha.
- Solapes: `colectivos.dias_solape` al año por persona (solo turnos); si es > 0 el resumen muestra utilizados / disponibles (días S del año en curso).

## Salir y atrás (fase 13)
- El botón Salir abre una ventana de confirmación (`confirmarCerrarSesion` en `app.js`, usa `abrirModal` de `cambios.js`).
- `js/atras.js` sincroniza el historial del navegador con las capas abiertas (modal, hoja del día, menú, modo cambio/edición, vista de resultados) para que el gesto atrás de Android/iPhone cierre la capa en vez de salir. Probado simulando el botón atrás del navegador (`pruebas/t14.py`); falta probarlo en un móvil real (sobre todo la app instalada en iPhone).
