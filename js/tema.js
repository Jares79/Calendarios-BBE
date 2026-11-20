// js/tema.js
// Apariencia: "claro", "oscuro" o "sistema" (por defecto). Se guarda en este dispositivo.
// Se carga en la cabecera, antes de pintar, para que no haya parpadeo.

const CLAVE_TEMA = "bbe-tema";
const COLOR_BARRA = { claro: "#eef2f6", oscuro: "#0b1420" };

function temaGuardado() {
    try {
        const t = localStorage.getItem(CLAVE_TEMA);
        return t === "claro" || t === "oscuro" ? t : "sistema";
    } catch (e) {
        return "sistema";
    }
}

// Aplica el tema a la página (y al color de la barra del navegador en el móvil)
function aplicarTema(tema) {
    const raiz = document.documentElement;
    if (tema === "claro" || tema === "oscuro") raiz.setAttribute("data-tema", tema);
    else raiz.removeAttribute("data-tema");

    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        if (!meta.dataset.original) meta.dataset.original = meta.getAttribute("content");
        meta.setAttribute("content", COLOR_BARRA[tema] || meta.dataset.original);
    });
}

function elegirTema(tema) {
    try {
        if (tema === "sistema") localStorage.removeItem(CLAVE_TEMA);
        else localStorage.setItem(CLAVE_TEMA, tema);
    } catch (e) { /* sin almacenamiento: vale solo hasta recargar */ }
    aplicarTema(tema);
}

aplicarTema(temaGuardado());

// --- Pantalla de ajustes (se abre desde el menú) ---
function verAjustes() {
    const contenedor = mostrarVistaAdmin();
    const actual = temaGuardado();
    const opciones = [
        ["claro", "Modo normal (claro)"],
        ["oscuro", "Modo oscuro"],
        ["sistema", "Según el sistema"]
    ];

    const botones = opciones.map(([valor, texto]) => {
        const boton = el("button", {
            type: "button",
            class: "opcion-tema" + (valor === actual ? " elegido" : ""),
            "aria-pressed": valor === actual ? "true" : "false",
            onclick: () => {
                elegirTema(valor);
                botones.forEach(b => { b.classList.remove("elegido"); b.setAttribute("aria-pressed", "false"); });
                boton.classList.add("elegido");
                boton.setAttribute("aria-pressed", "true");
            }
        }, el("span", { class: "punto-tema" }), texto);
        return boton;
    });

    // Horas anuales de la persona (solo si se le enseñan las horas); se rellena al cargar los datos
    const bloqueHoras = el("div", { class: "ajustes-horas" });
    // Google Calendar (cada persona vincula el suyo; solo aparece si está configurado)
    const bloqueGoogle = el("div", { class: "ajustes-google" });

    reemplazarHijos(contenedor,
        el("div", { class: "resultado-cabecera" },
            el("h2", { text: "Ajustes" }),
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        ),
        el("h3", { class: "grupo-titulo", text: "Apariencia" }),
        el("p", { class: "admin-nota", text: "Se guarda en este dispositivo. \"Según el sistema\" sigue el modo claro u oscuro de tu móvil u ordenador." }),
        el("div", { class: "opciones-tema" }, botones),
        bloqueHoras,
        bloqueGoogle
    );
    if (typeof pintarHorasAnualesAjustes === "function") pintarHorasAnualesAjustes(bloqueHoras);
    if (typeof pintarGoogleAjustes === "function") pintarGoogleAjustes(bloqueGoogle);
}
