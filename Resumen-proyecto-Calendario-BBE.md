# Resumen del proyecto: Calendario BBE (estado tras la fase 19)

Texto para retomar el proyecto en una conversación nueva. Va junto con el **zip actual del repositorio** (lo más seguro es descargarlo de GitHub: rama `develop` o `main` → Code → Download ZIP). Dentro: `supabase/` con todos los SQL y su orden en `supabase/LEEME-orden.md` (ya llega hasta la fase 18), la función de Supabase en `supabase/functions/enviar-push/`, las guías `GOOGLE-CONFIGURAR.md` y `PUSH-CONFIGURAR.md`, y el banco de pruebas en `pruebas/`.

**Primer mensaje sugerido en el chat nuevo:** «Adjunto el zip y el resumen del proyecto. Léelo todo antes de contestar y dime qué entiendes que está pendiente.»

Fecha de este resumen: 24 de noviembre de 2026. Sustituye al resumen de la fase 17 y al `Resumen-proyecto-Calendario-BBE.md` que hay en el repositorio (ese se quedó en la fase 15).

## 1. Qué es y cómo trabajar con el usuario
- **App web de turnos** de una planta, con unos **55 empleados**. Personal a turnos: jefes de turno, operadores de control y de campo. Personal de jornada partida: correturnos y los subgrupos que cree el administrador.
- **El usuario es el administrador** y se llama **Javier Ares** (correo de contacto `Jares@bbe.es`). Tiene dos accesos con la misma clave: **JAM**, empleado normal (jefe de turno, con calendario), y **ADMIN**, administrador **sin ficha de empleado**. No es técnico: Mac y móvil **Android con Chrome**; también ha probado en iPhone con Safari. **En el ordenador del trabajo no puede instalar aplicaciones** (por eso no tiene Node.js ni nada parecido: todo se hace desde el navegador). Sube el código a GitHub desde la web (Add file → Upload files) y usa el editor del navegador (tecla `.` en el repositorio) para borrar o reorganizar. Infraestructura: GitHub, Vercel (ramas `main` y `develop`, con dirección fija por rama) y Supabase (base de datos, sesiones y la función de avisos). **El proyecto de Supabase se comparte con otra app de reservas** (tabla `reservas`): no tocar nada que no sea del calendario. Quiere mantener **todo en planes gratuitos**.
- Tecnología: HTML, CSS y JavaScript sin compilar, `supabase-js` desde CDN, PWA instalable.
- Cómo prefiere trabajar:
  - Responder **siempre en español**, en tono cercano, sin tecnicismos innecesarios.
  - Escribe con frases cortas y a veces con erratas (dictado): interpretar la intención y, si algo es ambiguo, preguntar con una **lista numerada** (él contesta por números, o «1 sí, 2 sí…» si está de acuerdo con lo propuesto).
  - Quiere que se le hagan las preguntas necesarias **antes** de empezar y que se entregue de una vez (plan gratuito de Claude con límite de uso).
  - Quiere **solo lo necesario**: un zip de parche con los archivos que cambian (respetando carpetas) y, si hace falta, el SQL. Si solo cambia un archivo, mandar solo ese. Un zip completo solo si lo pide. Cuando un parche sustituye a otro ya subido, decirle **exactamente qué archivos cambian respecto al anterior**. Decirle siempre qué SQL ejecutar y en qué orden, y qué hay que subir.
  - **No sobrescribir sus archivos personalizados**: `index.html` (lleva su etiqueta `google-site-verification`), `js/push.js` (lleva su clave pública de avisos y el nombre `rapid-service`) y `js/google.js` (lleva su ID de cliente de Google). Los parches no deben incluirlos salvo que cambien de verdad, y entonces hay que avisar y decirle qué línea conservar.
  - Explicar con claridad **qué no se ha podido probar** contra Supabase real, Google real o un móvil real (el entorno de Claude no tiene internet).
  - Le gusta que se le diga qué es seguro y qué no, y que se le recomiende una opción. Valora los avisos de límites (seguridad, privacidad, planes gratuitos).
  - Subir `VERSION` de `sw.js` en cada entrega que cambie archivos del caché (**ahora `bbe-v27`**).
  - Le gustan los detalles cuidados: ventanas bonitas, avisos claros, textos en español.
- **Privacidad como criterio**: no quiere poder ver lo que sus compañeros guarden (por eso Google Calendar se lee en el navegador y no pasa por Supabase).

## 2. Ramas y versiones
- `develop` tiene lo último: fases 1 a 19 y los arreglos posteriores (botón Guardar por fila y editor de colores). Se vació y se volvió a subir desde un zip con la estructura limpia.
- `main` es la versión que ven los compañeros (`https://calendarios-bbe.vercel.app`). **El zip de `main` que se revisó ya traía la fase 18 y `bbe-v25`, con la raíz limpia, la etiqueta de Google, la clave de `js/push.js` y los enlaces legales (parece fundido); la web desplegada no se pudo comprobar. Confirmar con el usuario que Vercel sirve lo mismo. La fase 19 hay que subirla primero a `develop`.** (iba a hacerlo con un Pull request revisando «Files changed»). Tras fundir hay que comprobar: la raíz de `main` limpia, la etiqueta `google-site-verification` en `index.html` (Ctrl+U), la clave pública de `js/push.js` y que el aviso de prueba funciona.
- **Estructura correcta del repositorio** (lo que había se había «desestructurado» con subidas sueltas): en la raíz solo `index.html`, `sw.js`, `manifest.webmanifest`, `privacidad.html`, `terminos.html`, `README.md`, `GOOGLE-CONFIGURAR.md`, `PUSH-CONFIGURAR.md`, `Resumen-proyecto-Calendario-BBE.md` y las carpetas `css`, `img`, `js`, `pruebas`, `supabase`. Cualquier otro archivo en la raíz (copias de `app.js`, `.sql`, `t*.py`, `index.ts`, archivos con `(1)`, `(2)`…) es una copia suelta sobrante. No debe haber `pruebas/__pycache__`.
- Al subir un zip a GitHub: arrastrar el **contenido** de la carpeta, no la carpeta entera (si no, todo queda dentro de una subcarpeta y la app no carga).

## 3. Estado actual
- Hechas y probadas en el navegador simulado: fases 1 a 19 (la 19 está **entregada, pendiente de subir y de ejecutar su SQL**).
- **SQL ejecutado por el usuario en Supabase:** todos los de las fases 1 a 16, `fase17-push.sql` (con `pg_net` activado) y `fase18-ver-calendario.sql`. Además ejecutó a mano los `grant … to service_role` (ya incluidos en `fase17-push.sql` del repositorio). Todos se pueden repetir sin problema.
- **Avisos push (fase 17): funcionando.** El aviso de prueba llegó al móvil y al ordenador, y una solicitud de cambio real desde otro usuario también llegó. Con poca cobertura el móvil puede recibirlos con retraso (se probó).
- **Google Calendar (fase 16B):** funciona (probado en Android y iPhone). Pendiente la verificación de marca de Google (punto 8).
- **Fase 18 (ver el calendario de otra persona):** subida a `develop` con su SQL ejecutado; **falta confirmar con datos reales** que GMV ve a AOA como se espera (y que AOA tiene la marca D activada).
- **Arreglo del editor de colores:** subido y probado por el usuario.
- **Fase 19 (entregada, sin subir todavía):** datos al día entre compañeros (Realtime + lectura al volver a la app), guardado de turnos en una sola operación (`guardar_turnos`) y lectura fresca antes del aviso de deshacer. **SQL pendiente de ejecutar: `supabase/fase19-sincronizacion.sql`** (después, `schema-comprobar.sql`). Sin el SQL la app funciona igual que antes (guarda por partes y se actualiza al volver a abrirla). El SQL no se pudo ejecutar en el entorno de pruebas (no hay PostgreSQL): hay que verificarlo en Supabase.

## 4. Estructura de personal
- Dos categorías, deducidas del **tipo** del colectivo (`colectivos.tipo`):
  - **Personal a turnos** (tipo `turnos`): jefes, control y campo.
  - **Personal de jornada partida** (todo lo demás): `correturnos`, `jornada` (tipo `otro`, llamado «Sin subgrupo») y los subgrupos nuevos (tipo `otro`).
- Ciclo de jornada partida y correturnos: semanal `P P P P I F F` (lunes a domingo; el inicio de cada empleado debe ser lunes). Los subgrupos nuevos heredan ese ciclo.
- El administrador crea, renombra y borra subgrupos (solo los de tipo `otro` distintos de `jornada`, y solo si no tienen empleados) y asigna empleados con el desplegable de colectivo de la ficha.
- **Correturnos**: la empresa prevé contratar 6; hoy hay 2. Tienen preparadas las marcas CTD, CT1, CT2, CT3, CT4 y CTY.
- Roles de cuenta: `administrador`, `supervisor` (sin función), `empleado` y `familiar` (solo lectura del calendario de un empleado; iniciales acabadas en `_F`).
- Un **administrador sin ficha** no tiene calendario: inicio directo en el menú. Su PIN no se puede resetear desde la app.

## 5. Qué hace la app
- **Acceso**: iniciales y PIN (6 a 10 números). Sesión de Supabase Auth (correo ficticio `iniciales@calendario-bbe.app`). En la pantalla de acceso hay enlaces a **«Política de privacidad»** y **«Términos y condiciones»** (los pinta `js/app.js`) y, además, **los mismos enlaces fijos en el HTML** (pie de `index.html`, visible dentro de la app) para que Google los vea sin ejecutar JavaScript.
- **Salir** pide confirmación. Al cerrar sesión, ese móvil deja de recibir avisos push de la cuenta. El gesto o botón atrás del móvil cierra lo último abierto.
- **Pantalla principal**: bloque «Hoy» (con «Resumen del año ▾» y el botón de sincronizar Google si hay Google vinculado) y el mes, que cabe entero en el móvil.
- **Celdas del mes**: estrella ★ (eventos de Google ese día), icono ⇄ (turno cambiado a mano). Celda **partida** cuando la mitad de arriba tiene una marca (D, CT…) **o lo de otra persona** (fase 18).
- **Ficha del día**: turno, compañeros, eventos de Google, botones de cambio/edición y, si el administrador te deja ver a otra persona, una línea con su nombre y lo que se pinta (turno o D).
- **Menú**: Buscar un día; Calendario anual; Mi año; Editar calendario; Editar colores; Cambios; Horas; Ajustes (apariencia, Mis horas anuales, Google Calendar, Avisos en el móvil, Información legal).
- **Administración**: Empleados y accesos, **Disponibilidades y CT** (marcas D/CT y «Ver a:», con un botón Guardar por persona), Festivos, Intensivas, Horas y convenio.

## 6. Reglas de negocio
- **Turnos**: M, T, N, F, P, I, S (pueden salir del ciclo) y V, E, J, LD y B (baja), que solo se ponen a mano. **Prioridad de cálculo**: lo editado a mano por esa persona; el festivo convierte P/I del ciclo en F; la intensiva convierte P en I; si no, el ciclo del colectivo desde la fecha de inicio de cada empleado.
- **Horas por turno**: las define el administrador por año en «Horas y convenio», junto con horas por día de exceso, días de vacaciones (23) y de LD (2).
- **B, LD, J y el solape puesto a mano no tienen horas propias**: suman las horas previstas ese día.
- **Horas anuales de convenio**: las escribe cada persona en Ajustes, solo si se le enseñan (los colectivos de turnos siempre; el resto si el administrador activa `empleados.ver_horas`). **Excesos pendientes** = horas computables del año − horas anuales.
- **Solapes**: `colectivos.dias_solape` = solapes al año por persona (0 = desactivado).
- **Marcas de la mitad de arriba**: D y CTD, CT1, CT2, CT3, CT4, CTY (`empleados.marcas`), por día o semana; no cambian el turno de abajo.
- **Cambios de turno entre compañeros**: permuta de uno o varios días, con hilo de mensajes; solo desde mañana; lo cerrado se borra a las 24 h. Quién puede pedir a quién: dentro del mismo colectivo de turnos; un correturno a cualquiera de los tres; los tres a un correturno que tenga M, T o N ese día; la jornada partida no usa cambios.
- **Deshacer cambios**: si un turno viene de un cambio aceptado (`cambios_hechos`, 30 días) y uno lo cambia a mano, la app avisa y sugiere pedir deshacerlo. Quien tiene B no genera avisos de cobertura.

## 7. Google Calendar (fase 16B)
- Cada persona vincula su cuenta en Ajustes y ve sus calendarios en la app. **Solo lectura**, **nada pasa por Supabase** (el administrador no ve nada). Archivo `js/google.js`, flujo de token en el navegador (Google Identity Services). Permisos: `calendar.calendarlist.readonly` y `calendar.events.readonly` (**permisos «sensibles»**, que son los que exigen verificación de Google).
- El permiso de Google dura 1 hora: **botón de sincronizar** en «Hoy». Copia local en `localStorage` (`bbe-google-<idEmpleado>` y `…-ev`).
- No aparece para el administrador sin ficha ni para familiares.
- **Verificación de marca en Google Cloud (en curso):** al pasar la pantalla de consentimiento a producción, Google respondió que la página principal `https://calendarios-bbe.vercel.app` «no está registrada a su nombre». Lo que se hizo: verificar la propiedad en **Search Console** (propiedad «Prefijo de URL» con la etiqueta HTML `<meta name="google-site-verification" …>` en `index.html`, ya **verificada**; **no debe borrarse**). Pasos siguientes: en Google Cloud → Branding, página principal `https://calendarios-bbe.vercel.app`, privacidad `…/privacidad.html`, términos `…/terminos.html`, dominio autorizado `calendarios-bbe.vercel.app`; **quitar el origen de `develop`** de los «Orígenes autorizados de JavaScript» (así Google Calendar deja de funcionar en `develop`, solo ahí; el resto de la app no depende de Google); esperar 24 horas y pulsar «Corregí los problemas».
- **Riesgos ya explicados al usuario:** otros desarrolladores con direcciones `vercel.app` han seguido recibiendo el mismo error aunque la propiedad figure verificada. Si ocurre: comprar un dominio propio (unos 10 €/año; cambiaría la dirección de la app) o dejar Google Calendar en modo «Pruebas» (hasta 100 cuentas añadidas a mano, con aviso de app no verificada). Google también podría exigir que la página principal explique para qué sirve la app (la suya muestra el acceso): si lo pide, añadir un texto breve visible en la pantalla de entrada.

## 8. Páginas legales y avisos push (fase 17)
### Páginas legales
- `privacidad.html` y `terminos.html`: estáticas, claro/oscuro. Responsable: **Javier Ares, a título particular**; contacto `Jares@bbe.es`. Datos en Supabase, región Unión Europea. La empresa conoce la app pero **no es oficial**. Incluyen la cláusula de «uso limitado» de los datos de Google y la exclusión de responsabilidad. Se le avisó de que un texto no elimina obligaciones de protección de datos y de que conviene pedir a la empresa un correo confirmando que la conoce y acepta.

### Avisos push
- Ajustes → **Avisos en el móvil**: interruptor por dispositivo, casillas «Solicitudes de cambio» y «Mensajes» y botón «Enviar aviso de prueba». Avisa de solicitud nueva, aceptada, rechazada, cancelada y mensajes nuevos. Al tocar el aviso se abre la app en Cambios.
- Cliente: `js/push.js` (`PUSH_VAPID_PUBLICA`; el botón de prueba llama a `supabaseClient.functions.invoke("rapid-service", …)`) y `sw.js` (manejadores `push` y `notificationclick`). iPhone: solo iOS 16.4+ con la app instalada desde Safari.
- Servidor: `supabase/fase17-push.sql` (tablas `push_suscripciones` y `push_config`; funciones `push_guardar`, `push_preferencias`, `push_borrar`, `push_avisar`; disparadores con `pg_net`; **incluye los `grant` a `service_role`**, sin los cuales la función no podía leer las tablas: error «permission denied for table push_suscripciones») y `supabase/functions/enviar-push/index.ts` (Deno + `npm:web-push`).
- **En el proyecto real la función se llama `rapid-service`** (el editor web de Supabase le puso ese nombre automático y no deja cambiarlo): dirección `https://ackvysmudvkywgxosvoc.supabase.co/functions/v1/rapid-service`, con «Verify JWT» **desactivado**. `push_config` apunta a esa dirección y al `WEBHOOK_SECRET`. El archivo del repositorio sigue en `supabase/functions/enviar-push/index.ts` (la carpeta es solo organización).
- `index.ts` lleva **cabeceras CORS** (sin ellas el botón de prueba del navegador fallaba: solo salían peticiones `OPTIONS` en los logs) y escribe en los Logs líneas de diagnóstico («Prueba: dispositivos encontrados…», «avisos enviados…», «No se pudo enviar un aviso…», «Dispositivo caducado…»).
- **Claves VAPID sin Node.js**: se generaron con una página local `generar-claves-push.html` (WebCrypto, en el navegador, sin enviar nada). **Esa página no está en el repositorio**; si se necesitan claves nuevas, volver a generarla. Secretos de Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `WEBHOOK_SECRET` (la privada no se puede volver a ver en Supabase una vez guardada).
- Lecciones del diagnóstico: los registros de avisos son **por dirección** (un dispositivo registrado desde `develop` no cuenta para `main` y puede haber filas duplicadas en `push_suscripciones`); el aviso de prueba usa siempre la misma etiqueta, así que uno nuevo **sustituye en silencio** a otro de prueba que siga en el centro de notificaciones; «Aviso de prueba enviado» sale si **al menos un** dispositivo lo aceptó; con poca cobertura el aviso llega con retraso.

## 9. Fase 18: ver el calendario de otra persona
- **Qué es:** a petición del usuario, para una pareja que trabaja en la planta (GMV y AOA). El administrador asigna a un empleado «Ver a: otra persona»; en el **mes** de ese empleado, cada celda se parte: **abajo su turno de siempre**, tenga la letra que tenga; **arriba el de la otra persona** con sus colores, y si ese día ella tiene la marca **D**, se ve la D (gana al turno); si no, su turno. Apagado por defecto. Sirve para cualquier otra pareja o persona en el futuro.
- **Dónde se configura:** Administración → **Disponibilidades y CT**: en cada fila, junto a las casillas D/CT, un selector «Ver a: nadie / Nombre (iniciales)» y su **propio botón Guardar** (solo se activa si esa fila cambió; pasa a «Guardado ✓»). **Es incompatible con las marcas D/CT** (usan la misma mitad de la celda): al elegir a alguien se desactivan las casillas, y al marcar una casilla se desactiva el selector. La base de datos lo impide también.
- **Ficha del día:** al pulsar un día de su propio calendario, una línea con el **nombre de la otra persona** y lo que se pinta («D · Disponible», «Mañana»…).
- **Técnica:** columna `empleados.ver_calendario_de` (uuid, `on delete set null`) con restricción `empleados_ver_calendario_valido` (no a sí mismo y sin marcas); función `admin_guardar_ver_calendario(p_empleado, p_otro)`; `admin_guardar_marcas` ahora devuelve `incompatible` si la persona ya ve a otro. En JavaScript: `datos.js` (`verCalendarioDe`), `turnos.js` (`otraPersonaDe`, `infoOtraPersona`, `htmlMitadesOtra`), `CalendarioMensual.js` (pinta el mes), `calendario.js` (ficha), `semanas.js` (pantalla de administrador y `rpcVerCalendario`). No hizo falta CSS para la celda (la mitad de arriba reutiliza los colores de turnos y marcas); sí tres reglas para el botón por fila (`.fila-marcas-pie`, `.fila-marcas-guardar`). Un empleado ya puede leer los turnos de sus compañeros (RLS), así que no se tocaron permisos. Si la otra persona se da de baja, la celda vuelve a ser normal.
- `supabase/fase18-ver-calendario.sql` y `fase18-deshacer.sql`; prueba `pruebas/t19.py` (el simulador `fake-supabase.js` ya incluye el RPC nuevo).
- Solo afecta a la **vista mensual del propio calendario**; no cambia Mi año, el calendario anual ni lo que ven los demás.

## 10. Archivos
```
index.html, manifest.webmanifest, sw.js, README.md, img/
privacidad.html, terminos.html            Páginas legales
GOOGLE-CONFIGURAR.md, PUSH-CONFIGURAR.md  Guías de puesta en marcha
Resumen-proyecto-Calendario-BBE.md        Resumen (sustituir por este)
css/styles.css         Todos los estilos (variables al principio; claro y oscuro)
js/usuarios.js         Cliente de Supabase y sesión
js/permisos.js         Qué puede hacer cada rol (solo interfaz)
js/datos.js            Carga de datos y sincronización (Realtime, refresco); GRUPOS; esc(), el(), reemplazarHijos()
js/turnos.js           Cálculo de turnos, TURNOS, MARCAS, infoTurno(), otraPersonaDe()…
js/semanas.js          Marcas por semana y día; pantalla «Disponibilidades y CT» (marcas + «Ver a:»)
js/google.js           Google Calendar
js/push.js             Avisos push
js/calendario.js       Búsqueda, ficha del día, calendario anual
js/CalendarioMensual.js  Mi calendario, menú, bloque Hoy, resumen, leyenda
js/anio.js, js/edicion.js, js/colores.js, js/cambios.js, js/horas.js
js/tema.js             Claro/oscuro y Ajustes
js/admin.js, js/admin-fechas.js, js/atras.js, js/app.js
supabase/              SQL, su orden (LEEME-orden.md), schema-comprobar.sql, schema-exportar.sql y functions/enviar-push/index.ts
pruebas/               Banco de pruebas con Supabase simulado (t6 a t20)
```
El orden de carga de scripts está en `index.html`; si se añade un archivo nuevo, añadirlo también a la lista de `sw.js` y subir `VERSION`.

## 11. Base de datos
Ver `supabase/LEEME-orden.md`. Puntos clave:
- Todo con RLS; las escrituras delicadas van por funciones `security definer`. La función de avisos usa el rol `service_role`, que necesita permisos expresos (`grant`) sobre las tablas que lee.
- Cada uno solo escribe en `excepciones` de su propio empleado; festivos e intensivas solo el administrador; un familiar solo ve a su empleado.
- Tablas, columnas y funciones recientes: `colectivos.dias_solape`, `config_horas.dias_ld`, `empleados.ver_horas`, `empleados.anual_ver`, `empleados.ver_calendario_de`, `horas_dia`, código `B`; `admin_crear_subgrupo`, `admin_renombrar_subgrupo`, `admin_borrar_subgrupo`, `admin_guardar_ver_horas`, `admin_guardar_anual_ver`, `admin_guardar_marcas`, `admin_guardar_ver_calendario`; y `push_suscripciones`, `push_config`, `push_guardar`, `push_preferencias`, `push_borrar`, `push_avisar`.
- **Los calendarios anuales visibles por persona y lo de «Ver a:» son controles de la interfaz, no privacidad real**: los turnos de todos siguen siendo legibles para cualquier usuario con sesión (salvo familiares).
- Las tablas del login antiguo (`usuarios`, `login_intentos`) ya no se usan y se pueden borrar.

## 12. Cosas técnicas a recordar
- Fechas siempre como texto `AAAA-MM-DD`; el cálculo del ciclo no depende de la zona horaria.
- Los textos de la base de datos y de Google nunca se meten como HTML: `esc()` o `el()`.
- `replaceChildren()` no admite arrays ni `null`: usar spread o `reemplazarHijos()`. `el()` aplana solo un nivel de arrays.
- El cierre al tocar fuera de la hoja usa `composedPath()`; al abrir una hoja desde otra, `setTimeout(..., 0)`.
- Las vistas de resultados que muestran a otras personas (búsqueda por día, anual de un grupo, «Mi año») se registran con `registrarVista(fn)` en `calendario.js` para poder repintarse solas (`repintarPantalla()` en `datos.js`); cualquier vista nueva de ese tipo debe registrarse igual. La hoja de consulta de un día lleva `data-fecha` y `data-emp` para poder reconstruirse. Primera versión de la fase 19: solo repintaba el mes propio, así que lo que cambiaba un compañero no se veía en la hoja de un día ni en las vistas abiertas hasta cambiar de pantalla (corregido).
- Los años de datos se cargan bajo demanda (`asegurarAnio`). Desde la fase 19 se pueden releer (`refrescarDatos`) y los cambios de otros llegan por Realtime; cualquier escritura propia que cambie `excepciones`, `semanas` o `marcasDia` debe ir envuelta en `conEscrituraLocal()` para que una lectura del servidor no la pise.
- `guardar_turnos` (SQL) valida todo antes de escribir y escribe todo en una transacción; el cliente cae al guardado por partes si la función no existe (`PGRST202`) o hay más de 800 días.
- En las pruebas, `page.clock.install` acelera los temporizadores del navegador respecto al tiempo real de `wait_for_timeout`: para probar esperas, usar `wait_for_function` en lugar de dormir.
- El service worker prueba primero la red y solo guarda archivos de la propia web; también muestra los avisos push.
- **Fallo corregido en el editor de colores (fase 18):** empezaba siempre por el turno «M»; la jornada partida y los subgrupos no pueden usar M, T, N ni S, así que el editor fallaba con «Cannot read properties of undefined» y dejaba el calendario oculto. Ahora empieza por el primer turno que la persona sí tenga (`turnosPermitidosDe`).
- `turnosPermitidosDe`: la jornada partida (tipo `otro`) no usa M, T, N ni S en el editor, la leyenda ni los colores.
- **Banco de pruebas**: Playwright con Chromium. Desde `pruebas/`: `python3 t20.py`, etc. Se ejecutan todos los `t*.py` antes de cada entrega (`t17.py` es de la alternativa de notas, que no está en la rama actual). Las imágenes `.png` de `pruebas/` son capturas viejas y se pueden borrar.

## 13. Historial de fases
| Fase | Qué se hizo |
|---|---|
| 1 | Login con Supabase Auth, estructura (colectivos, empleados, perfiles), administración |
| 3 | Cambios manuales de turno (`excepciones`) |
| 4 | Correturnos, jornada partida, marcas de la mitad de arriba |
| 5 a 7 | Cambios de turno entre compañeros, horas, permutas y aviso de deshacer |
| 8 | Ajuste manual de las horas de un día |
| 9 | Tipo de colectivo, marcas por persona, horas por año |
| 10 | Turno B (baja), LD, resumen bajo «Hoy», horas anuales por persona |
| 11 | Resumen desplegable, LD/J/S con horas previstas |
| 12 | Categorías y subgrupos, solapes, recordatorio del PIN |
| 13 | Confirmación al salir y gesto atrás |
| 14 | Administrador sin ficha |
| 15 | Editor de turnos uniforme, letras en Mi año, leyenda por persona, calendario anual por persona |
| 16 (A, descartada) | Notas por día privadas |
| 16 (B) | Google Calendar de solo lectura, estrella en las celdas, botón de sincronizar |
| 17 | Páginas de privacidad y términos, avisos push; puesta en marcha real (función `rapid-service`, CORS, permisos de `service_role`) |
| 17b | Enlaces legales fijos en el HTML, limpieza de la estructura del repositorio |
| 18 | «Ver a otra persona» en el mes, botón Guardar por fila en Disponibilidades y CT, arreglo del editor de colores |
| 19 | Datos al día entre compañeros (Realtime + refresco al volver), guardado atómico `guardar_turnos`, lectura fresca antes del aviso de deshacer, `schema-comprobar.sql` y `schema-exportar.sql` |

## 14. Pendientes y decisiones abiertas
1. **Verificación de marca de Google**: esperar la respuesta (24 h tras pulsar «Corregí los problemas»), con el origen de `develop` ya quitado. Si Google rechaza la dirección `vercel.app`: dominio propio o modo «Pruebas». Puede pedir un texto en la página principal que explique para qué sirve la app.
2. **Confirmar que Vercel sirve en `main` lo mismo que el zip revisado** (fase 18, `bbe-v25`) y, después, subir la fase 19 a `develop`, ejecutar `fase19-sincronizacion.sql` y `schema-comprobar.sql`, probar con dos móviles (un cambio de uno aparece en el otro sin recargar) y fundir en `main`.
3. **Probar la fase 18 con datos reales**: GMV ve a AOA en la mitad de arriba (AOA debe tener la marca D activada en Disponibilidades y CT), y la ficha muestra su nombre.
4. **Probar los avisos en un iPhone** (iOS 16.4+, app instalada desde Safari) si algún compañero lo usa; y limpiar duplicados de `push_suscripciones` si los hubiera.
5. **Inconsistencia en correturnos** (causa probable corregida en la fase 19, sin confirmar con datos reales): el aviso de deshacer comparaba con el turno que la pantalla tenía en memoria, que podía ir hasta un minuto por detrás si el compañero acababa de aceptar; ahora se lee del servidor antes de decidir (con la lectura desactivada, la prueba reproduce el fallo). Queda una limitación conocida: `cambios_hechos` guarda una sola fila por persona y día, así que dos cambios el mismo día se pisan. Si vuelve a ocurrir, pedir el caso completo. Descripción original: a un correturno que edita un turno intercambiado no le sale la sugerencia de pedir deshacer, y a la gente de turnos sí. Pedir el caso completo: quién cambió con quién, qué día y turno, qué hizo después y si falta el aviso o solo el botón (que solo se ofrece para días futuros).
6. Pantalla propia para las semanas CT cuando se contrate a los correturnos.
7. Posibles mejoras (el usuario **descartó por ahora** el PIN mínimo de 8 dígitos; la copia local de los eventos de Google se **deja como está**: cada móvil guarda solo los de su cuenta y el usuario no ve problema de privacidad; sin decidir: pruebas automáticas en GitHub Actions, mejoras de rendimiento del service worker y de `atras.js`, y los extras de exportar/imprimir/ICS, que se le explicaron):  botón «Editar» para festivos e intensivas; dar uso al rol `supervisor`; borrar el login antiguo; exportar/imprimir; añadir `generar-claves-push.html` a la documentación o actualizar `PUSH-CONFIGURAR.md` para decir que no hace falta Node.js; borrar las capturas viejas de `pruebas/`.

## 15. Avisos pendientes de revisar con el usuario
- Realtime en el plan gratuito de Supabase tiene límites de conexiones simultáneas y de mensajes (comprobarlos en el panel; la base se comparte con la app de reservas). Con 55 personas debería sobrar.
- Supabase Auth limita intentos por IP, pero no bloquea cuentas individuales.
- El plan gratuito de Supabase pausa proyectos tras una semana sin uso (con 55 personas no debería pasar) y el de Vercel es de uso no comercial: que revise las condiciones.
- La app guarda nombres y turnos de personas: la empresa lo sabe pero no es oficial. Repositorio de GitHub recomendado privado. Los textos legales no sustituyen asesoramiento jurídico.
- Los avisos push pueden enseñar en la pantalla bloqueada el nombre de un compañero y una fecha.
- «Ver a otra persona» es una comodidad de interfaz: cualquier empleado con sesión ya puede ver los turnos de sus compañeros por otras vías.
- El cálculo de excesos depende de que las horas por turno y las horas anuales estén bien definidas: validar con un ejemplo real.
