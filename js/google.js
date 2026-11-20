// js/google.js
// Google Calendar (solo lectura). Cada persona vincula SU cuenta de Google desde Ajustes, elige qué calendarios
// quiere ver y la app le enseña sus eventos. La app solo hace de puente entre tu móvil y Google:
//   - los eventos van de Google a tu navegador (no se guardan nunca en Supabase),
//   - la lista de calendarios elegidos y una copia de los últimos eventos se guardan solo en este dispositivo (localStorage),
//   - el permiso de Google dura una hora y se renueva con el botón de sincronizar del recuadro "Hoy".
// Si GOOGLE_CLIENT_ID está vacío, la función no aparece en ninguna pantalla.

const GOOGLE_CLIENT_ID = "863198735502-g0dv9l7oqp84ak1k604gdcnllmma2i39.apps.googleusercontent.com";   // ← pega aquí el ID de cliente OAuth de Google Cloud (es público, no es una clave secreta)
const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",   // ver la lista de tus calendarios
    "https://www.googleapis.com/auth/calendar.events.readonly"          // ver sus eventos (nunca crear ni cambiar nada)
];
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

let googleToken = null;
let googleTokenCaduca = 0;
let googleClienteToken = null;
let googleRespuesta = null;
let googlePromesaScript = null;
const MAX_MESES_GUARDADOS = 8;
const mesesGoogle = new Map();          // "año-mes" (mes 0 a 11) -> { ts, items:[{ f, k, t, h, o, c }] }  (copia local + lo recién cargado)
const mesesGoogleFrescos = new Set();   // meses cargados de Google en esta sesión
const eventosGoogle = new Map();        // "AAAA-MM-DD" -> Map(clave -> { titulo, hora, calendario, orden }) (derivado de mesesGoogle)
let ultimaSyncGoogle = 0;
let sincronizandoGoogle = false;
let cacheGoogleDe = null;               // id de empleado cuya copia local está cargada en memoria

function googleClientId() {
    return GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID || "";
}

// Solo personas con calendario propio (no administrador sin ficha, no familiares)
function googleActivo() {
    return !!googleClientId() && !sinCalendario() && !esPerfilFamiliar() && !!obtenerEmpleadoActual();
}

function tokenGoogleValido() {
    return !!googleToken && Date.now() < googleTokenCaduca - 60000;
}

// --- Lo que se guarda en este dispositivo (solo qué calendarios has elegido) ---
function claveGoogleLocal() {
    const emp = obtenerEmpleadoActual();
    return emp ? "bbe-google-" + emp.id : null;
}
function leerGoogle() {
    try {
        const clave = claveGoogleLocal();
        const datos = clave ? JSON.parse(localStorage.getItem(clave) || "null") : null;
        return datos && Array.isArray(datos.calendarios) && datos.calendarios.length ? datos : null;
    } catch (e) { return null; }
}
function guardarGoogle(datos) {
    try { localStorage.setItem(claveGoogleLocal(), JSON.stringify(datos)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
}
function borrarGoogle() {
    try { localStorage.removeItem(claveGoogleLocal()); localStorage.removeItem(claveGoogleLocal() + "-ev"); } catch (e) { /* nada */ }
}

// Copia local de los últimos eventos (solo en este dispositivo): permite ver los eventos al abrir la app
function guardarCacheGoogle() {
    try {
        const meses = {};
        [...mesesGoogle.entries()].sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_MESES_GUARDADOS)
            .forEach(([k, v]) => { meses[k] = v; });
        localStorage.setItem(claveGoogleLocal() + "-ev", JSON.stringify({ ultima: ultimaSyncGoogle, meses }));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
}
function leerCacheGoogle() {
    const emp = obtenerEmpleadoActual();
    if (!emp || cacheGoogleDe === emp.id) return;
    cacheGoogleDe = emp.id;
    mesesGoogle.clear(); mesesGoogleFrescos.clear(); ultimaSyncGoogle = 0;
    try {
        const datos = JSON.parse(localStorage.getItem(claveGoogleLocal() + "-ev") || "null");
        if (datos && datos.meses) {
            ultimaSyncGoogle = Number(datos.ultima) || 0;
            Object.entries(datos.meses).forEach(([k, v]) => { if (v && Array.isArray(v.items)) mesesGoogle.set(k, v); });
        }
    } catch (e) { /* copia dañada: se ignora */ }
    reconstruirEventosGoogle();
}
function reconstruirEventosGoogle() {
    eventosGoogle.clear();
    mesesGoogle.forEach(mes => mes.items.forEach(it => {
        if (!eventosGoogle.has(it.f)) eventosGoogle.set(it.f, new Map());
        eventosGoogle.get(it.f).set(it.k, { titulo: it.t, hora: it.h, orden: it.o, calendario: it.c });
    }));
}
function textoHaceGoogle(ts) {
    if (!ts) return "";
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return "hace " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "hace " + h + " h";
    const d = Math.floor(h / 24);
    return d === 1 ? "ayer" : "hace " + d + " d";
}

// --- Conexión con Google ---
function cargarScriptGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (!googlePromesaScript) {
        googlePromesaScript = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => { googlePromesaScript = null; reject(new Error("sin_conexion")); };
            document.head.append(s);
        });
    }
    return googlePromesaScript;
}

function scriptGoogleListo() {
    return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
}
// Descarga el script de Google por adelantado (si la función está en uso), para que el botón pida el permiso al instante
function precargarScriptGoogle() {
    if (googleActivo() && !scriptGoogleListo()) cargarScriptGoogle().catch(() => {});
}

// Pide (o reutiliza) el permiso temporal. Debe llamarse desde un toque del usuario, sin esperas antes.
function pedirTokenGoogle(prompt) {
    if (tokenGoogleValido()) return Promise.resolve(googleToken);
    const solicitar = () => new Promise((resolve, reject) => {
        const oauth = window.google.accounts.oauth2;
        if (!googleClienteToken) {
            googleClienteToken = oauth.initTokenClient({
                client_id: googleClientId(),
                scope: GOOGLE_SCOPES.join(" "),
                callback: (r) => { if (googleRespuesta) googleRespuesta.ok(r); },
                error_callback: (e) => { if (googleRespuesta) googleRespuesta.fallo(e); }
            });
        }
        googleRespuesta = {
            ok: (r) => {
                if (!r || r.error || !r.access_token) return reject(new Error((r && r.error) || "sin_token"));
                if (!oauth.hasGrantedAllScopes(r, ...GOOGLE_SCOPES)) return reject(new Error("permisos_incompletos"));
                googleToken = r.access_token;
                googleTokenCaduca = Date.now() + (Number(r.expires_in) || 3600) * 1000;
                resolve(googleToken);
            },
            fallo: (e) => reject(new Error((e && e.type) || "cancelado"))
        };
        googleClienteToken.requestAccessToken({ prompt: prompt || "" });
    });
    // Con el script ya cargado, la ventana se pide en el mismo toque (sin esperas que el navegador pueda bloquear)
    return scriptGoogleListo() ? solicitar() : cargarScriptGoogle().then(solicitar);
}

function textoErrorGoogle(e) {
    const m = (e && e.message) || "";
    if (m === "permisos_incompletos") return "Faltan permisos: al vincular, deja marcadas las casillas de Google Calendar.";
    if (m === "sin_conexion") return "No se pudo conectar con Google. Revisa tu conexión.";
    if (m === "caducado") return "El permiso de Google ha caducado. Vuelve a tocar el botón.";
    if (m === "popup_closed" || m === "cancelado" || m === "access_denied") return "Has cancelado la conexión con Google.";
    if (m === "popup_failed_to_open") return "El navegador bloqueó la ventana de Google. Permítela e inténtalo de nuevo.";
    return "No se pudo hablar con Google Calendar.";
}

async function llamarGoogle(ruta, params) {
    const url = GOOGLE_API + ruta + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { headers: { Authorization: "Bearer " + googleToken } });
    if (r.status === 401) { googleToken = null; throw new Error("caducado"); }
    if (!r.ok) throw new Error("http_" + r.status);
    return r.json();
}

async function listarCalendariosGoogle() {
    const datos = await llamarGoogle("/users/me/calendarList", {
        minAccessRole: "reader", maxResults: "250", fields: "items(id,summary,summaryOverride,primary)"
    });
    return (datos.items || []).map(c => ({ id: c.id, nombre: c.summaryOverride || c.summary || c.id, principal: !!c.primary }));
}

// --- Eventos del mes (solo en memoria) ---
function fechaDeISOGoogle(texto) {
    const [a, m, d] = texto.split("-").map(Number);
    return new Date(a, m - 1, d);
}
function horaCorta(fecha) {
    return fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Días que cubre un evento, con el texto de hora de cada día
function diasDeEventoGoogle(ev) {
    const res = [];
    if (ev.start && ev.start.date) {
        let d = fechaDeISOGoogle(ev.start.date);
        let fin = fechaDeISOGoogle((ev.end && ev.end.date) || ev.start.date);
        if (fin <= d) fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        for (; d < fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            res.push({ fecha: aISO(d), hora: "Todo el día", orden: "00:00" });
        }
    } else if (ev.start && ev.start.dateTime) {
        const ini = new Date(ev.start.dateTime);
        const fin = new Date((ev.end && ev.end.dateTime) || ev.start.dateTime);
        // Si termina justo a las 00:00, ese último día no cuenta
        const ultimo = (fin > ini && fin.getHours() === 0 && fin.getMinutes() === 0 && fin.getSeconds() === 0)
            ? new Date(fin.getTime() - 1) : fin;
        const iniISO = aISO(ini), ultISO = aISO(ultimo);
        for (let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()); aISO(d) <= ultISO; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            const iso = aISO(d);
            const hora = iso === iniISO && iso === ultISO ? `${horaCorta(ini)}–${horaCorta(fin)}`
                : iso === iniISO ? `desde ${horaCorta(ini)}`
                : iso === ultISO ? `hasta ${horaCorta(fin)}`
                : "Todo el día";
            res.push({ fecha: iso, hora, orden: iso === iniISO ? horaCorta(ini) : "00:00" });
        }
    }
    return res;
}

async function eventosDeCalendarioGoogle(cal, desde, hasta) {
    const salida = [];
    let pagina = "";
    for (let i = 0; i < 4; i++) {
        const params = {
            singleEvents: "true", orderBy: "startTime", maxResults: "250",
            timeMin: desde.toISOString(), timeMax: hasta.toISOString(),
            fields: "nextPageToken,items(id,summary,status,start,end)"
        };
        if (pagina) params.pageToken = pagina;
        const datos = await llamarGoogle("/calendars/" + encodeURIComponent(cal.id) + "/events", params);
        (datos.items || []).filter(ev => ev.status !== "cancelled").forEach(ev => salida.push(ev));
        pagina = datos.nextPageToken;
        if (!pagina) break;
    }
    return salida;
}

// Carga los eventos de un mes desde Google (solo con permiso vigente). Devuelve true si el mes queda actualizado.
async function cargarEventosGoogleMes(anio, mes, forzar) {
    const cfg = leerGoogle();
    if (!googleActivo() || !cfg) return false;
    leerCacheGoogle();
    const clave = anio + "-" + mes;
    if (!forzar && mesesGoogleFrescos.has(clave)) return true;
    if (!tokenGoogleValido()) return false;
    const desde = new Date(anio, mes, 1), hasta = new Date(anio, mes + 1, 1);
    try {
        const listas = await Promise.all(cfg.calendarios.map(c => eventosDeCalendarioGoogle(c, desde, hasta).then(evs => [c, evs])));
        const items = [];
        listas.forEach(([cal, evs]) => evs.forEach(ev => {
            diasDeEventoGoogle(ev).forEach(d => items.push({ f: d.fecha, k: cal.id + "|" + ev.id, t: ev.summary || "(sin título)", h: d.hora, o: d.orden, c: cal.nombre }));
        }));
        mesesGoogle.set(clave, { ts: Date.now(), items });
        mesesGoogleFrescos.add(clave);
        reconstruirEventosGoogle();
        guardarCacheGoogle();
        return true;
    } catch (e) {
        console.warn("No se pudieron cargar los eventos de Google:", e.message);
        return false;
    }
}

function eventosDelDiaGoogle(fechaISO) {
    const dia = eventosGoogle.get(fechaISO);
    if (!dia) return [];
    return [...dia.values()].sort((a, b) => a.orden.localeCompare(b.orden) || a.titulo.localeCompare(b.titulo));
}

function olvidarEventosGoogle() {
    mesesGoogle.clear();
    mesesGoogleFrescos.clear();
    eventosGoogle.clear();
    ultimaSyncGoogle = 0;
}

// Estrellita en las celdas de tu calendario con algún evento de Google
function actualizarMarcasGoogle() {
    const emp = obtenerEmpleadoActual();
    if (!emp) return;
    document.querySelectorAll(`.dia-calendario[data-emp="${emp.id}"]`).forEach(celda => {
        const hay = googleActivo() && !!leerGoogle() && eventosDelDiaGoogle(celda.dataset.fecha).length > 0;
        celda.classList.toggle("con-google", hay);
        const estrella = celda.querySelector(".estrella-google");
        if (hay && !estrella) celda.append(el("span", { class: "estrella-google", "aria-hidden": "true", text: "★\uFE0E" }));
        else if (!hay && estrella) estrella.remove();
    });
}

// Se llama cada vez que se pinta el mes de tu calendario
function alMostrarMesGoogle(anio, mes) {
    if (!googleActivo() || !leerGoogle()) return;
    leerCacheGoogle();
    reconstruirEventosGoogle();
    precargarScriptGoogle();
    actualizarMarcasGoogle();
    if (tokenGoogleValido() && !mesesGoogleFrescos.has(anio + "-" + mes)) {
        cargarEventosGoogleMes(anio, mes).then(ok => { if (ok) { actualizarMarcasGoogle(); avisarGoogle(); } });
    }
}

// --- Botón de sincronizar (recuadro "Hoy") ---
const ICONO_SINCRONIZAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';

function avisarGoogle() {
    document.dispatchEvent(new CustomEvent("bbe-google"));
}

function textoBotonGoogle() {
    if (sincronizandoGoogle) return "Sincronizando…";
    return ultimaSyncGoogle ? "Google · " + textoHaceGoogle(ultimaSyncGoogle) : "Sincronizar Google";
}

function actualizarBotonGoogle() {
    document.querySelectorAll(".hoy-google").forEach(b => {
        b.classList.toggle("girando", sincronizandoGoogle);
        b.disabled = sincronizandoGoogle;
        const t = textoBotonGoogle();
        b.querySelector(".hoy-google-texto").textContent = t;
        b.setAttribute("aria-label", sincronizandoGoogle ? "Sincronizando con Google Calendar"
            : "Sincronizar con Google Calendar" + (ultimaSyncGoogle ? ". Última vez: " + textoHaceGoogle(ultimaSyncGoogle) : ""));
    });
}

// Botón dentro del recuadro "Hoy"; usa la clase del turno de hoy para heredar sus colores
function crearBotonGoogleHoy(claseTurno) {
    if (!googleActivo() || !leerGoogle()) return null;
    leerCacheGoogle();
    precargarScriptGoogle();
    const icono = el("span", { class: "hoy-google-icono" });
    icono.innerHTML = ICONO_SINCRONIZAR;   // texto fijo de esta aplicación, sin datos de nadie
    const boton = el("button", { type: "button", class: "hoy-google " + (claseTurno || ""), onclick: () => sincronizarGoogle() },
        icono, el("span", { class: "hoy-google-texto", text: textoBotonGoogle() }));
    boton.setAttribute("aria-label", "Sincronizar con Google Calendar");
    return boton;
}

// Pide el permiso (si hace falta) y actualiza los eventos del mes que ves y los dos de al lado
async function sincronizarGoogle() {
    if (sincronizandoGoogle || !googleActivo() || !leerGoogle()) return;
    sincronizandoGoogle = true;
    actualizarBotonGoogle();
    const promesaPermiso = pedirTokenGoogle("");   // se pide en el mismo toque, antes de cualquier espera
    try {
        await promesaPermiso;
        const f = fechaCalendario;
        const meses = [-1, 0, 1].map(d => new Date(f.getFullYear(), f.getMonth() + d, 1));
        const ok = await Promise.all(meses.map(m => cargarEventosGoogleMes(m.getFullYear(), m.getMonth(), true)));
        if (ok.some(Boolean)) {
            ultimaSyncGoogle = Date.now();
            guardarCacheGoogle();
            mostrarToast("Eventos de Google actualizados.");
        } else {
            mostrarToast(tokenGoogleValido() ? "No se pudieron cargar los eventos de Google." : textoErrorGoogle(new Error("caducado")), true);
        }
    } catch (e) {
        mostrarToast(textoErrorGoogle(e), true);
    } finally {
        sincronizandoGoogle = false;
        actualizarBotonGoogle();
        actualizarMarcasGoogle();
        avisarGoogle();
    }
}

// --- Sección en la ficha del día ---
function crearSeccionGoogle(empleado, fechaISO) {
    const mio = obtenerEmpleadoActual();
    if (!googleActivo() || !mio || mio.id !== empleado.id || !leerGoogle()) return null;
    leerCacheGoogle();
    const clave = Number(fechaISO.slice(0, 4)) + "-" + (Number(fechaISO.slice(5, 7)) - 1);
    const caja = el("div", { class: "detalle-linea google-dia" });
    const etiqueta = () => el("span", { class: "detalle-etiqueta", text: "Google Calendar" });
    const botonActualizar = (texto) => el("button", { type: "button", class: "btn-secundario google-ver", text: texto, onclick: () => sincronizarGoogle() });

    function pintar() {
        if (!caja.isConnected && caja.dataset.pintada) return;   // la ficha ya se cerró
        caja.dataset.pintada = "1";
        if (sincronizandoGoogle) { caja.replaceChildren(etiqueta(), el("span", { class: "google-estado", text: "Sincronizando…" })); return; }
        const mes = mesesGoogle.get(clave);
        if (!mes) {
            caja.replaceChildren(etiqueta(), el("span", { class: "google-estado", text: "Este mes aún no está sincronizado. " }), botonActualizar("Sincronizar con Google"));
            return;
        }
        const eventos = eventosDelDiaGoogle(fechaISO);
        const pie = el("div", { class: "google-pie" },
            el("span", { class: "google-estado", text: "Actualizado " + textoHaceGoogle(mes.ts) }),
            el("button", { type: "button", class: "google-actualizar", text: "Actualizar", onclick: () => sincronizarGoogle() }));
        caja.replaceChildren(etiqueta(),
            eventos.length
                ? el("ul", { class: "google-lista" }, eventos.map(ev =>
                    el("li", { class: "google-evento" },
                        el("span", { class: "google-hora", text: ev.hora }),
                        el("span", { class: "google-titulo", text: ev.titulo }),
                        el("span", { class: "google-cal", text: ev.calendario }))))
                : el("span", { class: "google-estado google-vacio", text: "Sin eventos este día" }),
            pie);
    }
    document.addEventListener("bbe-google", function repintar() {
        if (!caja.isConnected) { document.removeEventListener("bbe-google", repintar); return; }
        pintar();
    });
    pintar();
    return caja;
}

// --- Sección en Ajustes: vincular, elegir calendarios, desvincular ---
function pintarGoogleAjustes(contenedor) {
    if (!googleActivo()) { contenedor.replaceChildren(); return; }
    precargarScriptGoogle();
    let aviso = "";

    const vista = (...hijos) => contenedor.replaceChildren(
        el("h3", { class: "grupo-titulo", text: "Google Calendar" }),
        ...hijos
    );
    const notaAviso = () => aviso ? el("p", { class: "admin-nota google-aviso", text: aviso }) : null;

    function pintarInicio() {
        const cfg = leerGoogle();
        if (!cfg) {
            vista(
                el("p", { class: "admin-nota", text: "Vincula tu cuenta de Google para ver tus eventos dentro de tu calendario de turnos. La app solo lee: nunca crea ni cambia nada. Tus eventos van de Google a tu móvil y no se guardan en ningún servidor de la app; solo tú los ves." }),
                notaAviso(),
                el("button", { type: "button", class: "btn-ancho", text: "Vincular mi cuenta de Google", onclick: () => elegir("consent") })
            );
            return;
        }
        vista(
            el("p", { class: "admin-nota", text: "Calendarios sincronizados: " + cfg.calendarios.map(c => c.nombre).join(", ") + "." }),
            el("p", { class: "admin-nota", text: "Los calendarios elegidos y una copia de los últimos eventos se guardan solo en este dispositivo. Para actualizarlos, usa el botón de sincronizar del recuadro «Hoy» (Google renueva el permiso cada hora)." }),
            notaAviso(),
            el("div", { class: "fila-botones" },
                el("button", { type: "button", class: "btn-secundario", text: "Elegir calendarios", onclick: () => elegir("") }),
                el("button", { type: "button", class: "btn-secundario", text: "Desvincular", onclick: desvincular })
            )
        );
    }

    async function elegir(prompt) {
        aviso = "";
        try {
            await pedirTokenGoogle(prompt);
            vista(el("p", { class: "admin-nota", text: "Cargando tus calendarios…" }));
            const lista = await listarCalendariosGoogle();
            if (!lista.length) { aviso = "Tu cuenta de Google no tiene calendarios."; pintarInicio(); return; }
            const previos = new Set(((leerGoogle() || {}).calendarios || []).map(c => c.id));
            const casillas = lista.map(c => {
                const input = el("input", { type: "checkbox", value: c.id });
                input.checked = previos.size ? previos.has(c.id) : c.principal;
                return { c, input };
            });
            vista(
                el("p", { class: "admin-nota", text: "Marca los calendarios que quieres ver:" }),
                el("div", { class: "google-cal-lista" }, casillas.map(({ c, input }) =>
                    el("label", { class: "google-cal-fila" }, input, el("span", { text: c.nombre })))),
                el("div", { class: "fila-botones" },
                    el("button", { type: "button", class: "btn-ancho", text: "Guardar", onclick: () => {
                        const elegidos = casillas.filter(x => x.input.checked).map(x => ({ id: x.c.id, nombre: x.c.nombre }));
                        if (!elegidos.length) { mostrarToast("Marca al menos un calendario.", true); return; }
                        guardarGoogle({ calendarios: elegidos });
                        olvidarEventosGoogle();
                        aviso = "";
                        pintarInicio();
                        sincronizarGoogle();
                        mostrarToast("Calendarios guardados.");
                    } }),
                    el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: () => { aviso = ""; pintarInicio(); } })
                )
            );
        } catch (e) {
            aviso = textoErrorGoogle(e);
            pintarInicio();
        }
    }

    function desvincular() {
        const t = googleToken;
        if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
            try { window.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* nada */ }
        }
        googleToken = null; googleTokenCaduca = 0;
        borrarGoogle();
        olvidarEventosGoogle();
        actualizarMarcasGoogle();
        actualizarBotonGoogle();
        aviso = "Desvinculado en este dispositivo. Para retirar del todo el permiso, entra en myaccount.google.com/permissions.";
        pintarInicio();
    }

    pintarInicio();
}
