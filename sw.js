// sw.js · service worker de Calendario BBE
// Solo guarda los archivos de la propia web (HTML, CSS, JS, imágenes) para que la app abra
// rápido y se pueda instalar. Los datos (turnos, empleados, sesiones) NO se guardan nunca:
// se piden siempre a Supabase.
//
// Estrategia: primero la red (así los cambios nuevos llegan en cuanto hay conexión) y,
// si no hay red, lo último guardado. Para forzar que todos descarguen de nuevo los
// archivos, cambia el número de VERSION.

const VERSION = "bbe-v22";

const ARCHIVOS = [
    "./",
    "index.html",
    "css/styles.css",
    "js/usuarios.js",
    "js/permisos.js",
    "js/datos.js",
    "js/turnos.js",
    "js/semanas.js",
    "js/google.js",
    "js/push.js",
    "privacidad.html",
    "terminos.html",
    "js/calendario.js",
    "js/CalendarioMensual.js",
    "js/anio.js",
    "js/tema.js",
    "js/cambios.js",
    "js/horas.js",
    "js/admin.js",
    "js/admin-fechas.js",
    "js/edicion.js",
    "js/colores.js",
    "js/atras.js",
    "js/app.js",
    "manifest.webmanifest",
    "img/LOGO_BBE_SOLO.png",
    "img/favicon.ico"
];

self.addEventListener("install", (evento) => {
    evento.waitUntil(
        caches.open(VERSION)
            .then((cache) => cache.addAll(ARCHIVOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (evento) => {
    const peticion = evento.request;
    if (peticion.method !== "GET") return;

    // Solo archivos de esta misma web; Supabase, tipografías y librerías van directas a la red
    if (new URL(peticion.url).origin !== self.location.origin) return;

    evento.respondWith(
        fetch(peticion)
            .then((respuesta) => {
                if (respuesta.ok) {
                    const copia = respuesta.clone();
                    caches.open(VERSION).then((cache) => cache.put(peticion, copia));
                }
                return respuesta;
            })
            .catch(() => caches.match(peticion).then((guardada) => guardada || caches.match("index.html")))
    );
});

// --- Avisos (notificaciones push) ---
// Llega un aviso del servidor: se muestra siempre (los navegadores lo exigen) y al tocarlo se abre la app en "Cambios".
self.addEventListener("push", (evento) => {
    let datos = {};
    try { datos = evento.data ? evento.data.json() : {}; } catch (e) { datos = { cuerpo: evento.data ? evento.data.text() : "" }; }
    evento.waitUntil(self.registration.showNotification(datos.titulo || "Calendario BBE", {
        body: datos.cuerpo || "",
        tag: datos.tag || undefined,
        icon: "img/icon-192.png",
        badge: "img/LOGO_BBE_SOLO.png",
        data: { url: datos.url || "./" }
    }));
});

self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const url = (evento.notification.data && evento.notification.data.url) || "./";
    evento.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
            for (const v of ventanas) {
                if ("focus" in v) { v.postMessage({ ir: "cambios" }); return v.focus(); }
            }
            return self.clients.openWindow(url);
        })
    );
});
