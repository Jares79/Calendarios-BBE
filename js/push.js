// js/push.js
// Avisos en el móvil (notificaciones push): solicitudes de cambio y mensajes. Se activan y desactivan en Ajustes.
// Si PUSH_VAPID_PUBLICA está vacía, la función no aparece en ninguna pantalla.
// Lo que se guarda en la base de datos: la "dirección" del aviso de ese navegador y sus claves de cifrado (tabla
// push_suscripciones), y si quieres avisos de cambios y/o de mensajes. Se borra al desactivar, al cerrar sesión o al borrar la cuenta.

const PUSH_VAPID_PUBLICA = "BFmmlVb4KISPVqmQ69Wz8KAJXM-l43W7Hei6b_KB7vtsdmnm-qH2ZToArWkXFDEVvr0ry-pKQdZ4FsBwZTKLkyQ";   // ← pega aquí la clave pública VAPID (ver PUSH-CONFIGURAR.md). Es pública, no es un secreto.

function pushClave() { return PUSH_VAPID_PUBLICA || window.__PUSH_VAPID || ""; }
function pushSoportado() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function pushActivoParaMi() { return !!pushClave() && !sinCalendario() && !esPerfilFamiliar() && !!obtenerEmpleadoActual(); }
function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function appInstalada() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }

function claveAUint8(b64url) {
    const relleno = "=".repeat((4 - (b64url.length % 4)) % 4);
    const bin = atob((b64url + relleno).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function registroPush() { return navigator.serviceWorker.ready; }
async function suscripcionPush() { return (await registroPush()).pushManager.getSubscription(); }

function datosSuscripcion(sub) {
    const j = sub.toJSON();
    return { endpoint: j.endpoint, p256dh: j.keys && j.keys.p256dh, auth: j.keys && j.keys.auth };
}

// Debe llamarse desde un toque del usuario (el navegador pide permiso)
async function activarPush() {
    if (Notification.permission === "denied") throw new Error("bloqueado");
    const permiso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permiso !== "granted") throw new Error("denegado");
    const reg = await registroPush();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAUint8(pushClave()) });
    const d = datosSuscripcion(sub);
    const { data, error } = await supabaseClient.rpc("push_guardar", { p_endpoint: d.endpoint, p_p256dh: d.p256dh, p_auth: d.auth });
    if (error || !data || !data.ok) { try { await sub.unsubscribe(); } catch (e) { /* nada */ } throw new Error("servidor"); }
    return d.endpoint;
}

async function desactivarPush() {
    const sub = await suscripcionPush();
    if (!sub) return;
    try { await supabaseClient.rpc("push_borrar", { p_endpoint: sub.endpoint }); } catch (e) { console.warn("No se pudo borrar el aviso del servidor:", e); }
    try { await sub.unsubscribe(); } catch (e) { /* nada */ }
}

// Al cerrar sesión, este móvil deja de recibir avisos de esa cuenta
async function olvidarPushAlCerrarSesion() {
    try { if (pushSoportado() && pushClave()) await desactivarPush(); } catch (e) { /* no debe impedir salir */ }
}

async function preferenciasPush(endpoint) {
    const { data } = await supabaseClient.from("push_suscripciones").select("avisar_cambios, avisar_mensajes").eq("endpoint", endpoint).maybeSingle();
    return data || null;
}

function textoErrorPush(e) {
    const m = (e && e.message) || "";
    if (m === "bloqueado") return "Las notificaciones están bloqueadas para esta web. Actívalas en los ajustes del navegador.";
    if (m === "denegado") return "No has dado permiso para las notificaciones.";
    if (m === "servidor") return "No se pudo registrar este dispositivo. Inténtalo de nuevo.";
    return "No se pudieron activar los avisos en este dispositivo.";
}

// Abrir un aviso lleva a "Cambios"
function alAbrirDesdeAviso() {
    try {
        const url = new URL(location.href);
        if (url.searchParams.get("ir") === "cambios") {
            url.searchParams.delete("ir");
            history.replaceState(null, "", url.pathname + url.search + url.hash);
            if (typeof verCambios === "function") verCambios();
        }
    } catch (e) { /* nada */ }
}
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data && e.data.ir === "cambios" && typeof verCambios === "function") verCambios();
    });
}

// --- Sección en Ajustes ---
function pintarPushAjustes(contenedor) {
    if (!pushActivoParaMi()) { contenedor.replaceChildren(); return; }
    const titulo = () => el("h3", { class: "grupo-titulo", text: "Avisos en el móvil" });
    if (!pushSoportado()) {
        const iosSinInstalar = esIOS() && !appInstalada();
        contenedor.replaceChildren(titulo(), el("p", { class: "admin-nota", text: iosSinInstalar
            ? "En iPhone, los avisos solo funcionan con la app instalada: toca Compartir → «Añadir a pantalla de inicio» y ábrela desde ahí."
            : "Este navegador no admite avisos." }));
        return;
    }
    if (esIOS() && !appInstalada()) {
        contenedor.replaceChildren(titulo(), el("p", { class: "admin-nota", text: "En iPhone, los avisos solo funcionan con la app instalada: toca Compartir → «Añadir a pantalla de inicio» y ábrela desde ahí." }));
        return;
    }

    const estado = el("p", { class: "admin-nota push-estado" });
    const interruptor = el("input", { type: "checkbox", id: "pushInterruptor" });
    const fCambios = el("input", { type: "checkbox", id: "pushCambios" });
    const fMensajes = el("input", { type: "checkbox", id: "pushMensajes" });
    const detalle = el("div", { class: "push-detalle" },
        el("label", { class: "push-fila" }, fCambios, el("span", { text: "Solicitudes de cambio (nuevas, aceptadas, rechazadas o canceladas)" })),
        el("label", { class: "push-fila" }, fMensajes, el("span", { text: "Mensajes en una solicitud" })),
        el("button", { type: "button", class: "btn-secundario push-probar", text: "Enviar aviso de prueba", onclick: probar })
    );
    detalle.hidden = true;

    contenedor.replaceChildren(titulo(),
        el("p", { class: "admin-nota", text: "Recibe un aviso en este dispositivo cuando te pidan un cambio de turno o te escriban. Puedes desactivarlos aquí cuando quieras." }),
        el("label", { class: "push-fila push-principal" }, interruptor, el("span", { text: "Recibir avisos en este dispositivo" })),
        detalle, estado);

    let endpoint = null;
    async function refrescar() {
        estado.textContent = "";
        try {
            const sub = await suscripcionPush();
            const prefs = sub ? await preferenciasPush(sub.endpoint) : null;
            endpoint = sub && prefs ? sub.endpoint : null;
            interruptor.checked = !!endpoint;
            detalle.hidden = !endpoint;
            if (prefs) { fCambios.checked = !!prefs.avisar_cambios; fMensajes.checked = !!prefs.avisar_mensajes; }
            if (!endpoint && Notification.permission === "denied") estado.textContent = "Las notificaciones están bloqueadas para esta web en el navegador. Para recibirlas, actívalas en sus ajustes.";
        } catch (e) { console.warn("No se pudo leer el estado de los avisos:", e); }
    }

    interruptor.addEventListener("change", async () => {
        interruptor.disabled = true;
        try {
            if (interruptor.checked) { endpoint = await activarPush(); mostrarToast("Avisos activados en este dispositivo."); }
            else { await desactivarPush(); endpoint = null; mostrarToast("Avisos desactivados."); }
        } catch (e) { mostrarToast(textoErrorPush(e), true); }
        interruptor.disabled = false;
        refrescar();
    });
    async function guardarPrefs() {
        if (!endpoint) return;
        const { error } = await supabaseClient.rpc("push_preferencias", { p_endpoint: endpoint, p_cambios: fCambios.checked, p_mensajes: fMensajes.checked });
        if (error) { mostrarToast("No se pudo guardar la preferencia.", true); refrescar(); }
    }
    fCambios.addEventListener("change", guardarPrefs);
    fMensajes.addEventListener("change", guardarPrefs);

    async function probar() {
        try {
            const { data, error } = await supabaseClient.functions.invoke("rapid-service", { body: { tipo: "prueba" } });
            if (error) throw error;
            mostrarToast(data && data.enviados ? "Aviso de prueba enviado." : "No se envió ningún aviso. Revisa la configuración.", !(data && data.enviados));
        } catch (e) { mostrarToast("No se pudo enviar el aviso de prueba.", true); }
    }
    refrescar();
}
