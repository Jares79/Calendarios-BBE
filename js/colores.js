// js/colores.js
// Colores de los turnos elegidos por cada usuario. Se guardan en su perfil (Supabase),
// así que le siguen aunque cambie de móvil u ordenador. Cada persona solo ve los suyos.

// Código de turno -> prefijo de las variables CSS (--m-bg, --m-fg...)
// (las marcas semanales D, CTD, CT1... también se pueden recolorear)
const PREFIJO_COLOR = {
    M: "m", T: "t", N: "n", F: "f", P: "p", I: "i", S: "s", V: "v", E: "e", J: "j", LD: "ld", B: "b",
    D: "d", CTD: "ctd", CT1: "ct1", CT2: "ct2", CT3: "ct3", CT4: "ct4", CTY: "cty"
};

// Paleta amplia: 12 tonos en 4 intensidades + una fila de grises
const PALETA = (() => {
    const colores = [];
    const luminosidades = [34, 48, 63, 80];
    luminosidades.forEach(l => {
        for (let h = 0; h < 360; h += 30) colores.push(hslAHex(h, l < 40 ? 75 : 80, l));
    });
    ["#000000", "#2b2b2b", "#555555", "#808080", "#aaaaaa", "#d0d0d0", "#ebebeb", "#ffffff"].forEach(g => colores.push(g));
    return colores;
})();

function hslAHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

function luminancia(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Color de texto (oscuro o blanco) con más contraste sobre un fondo
function textoSobre(hex) {
    const l = luminancia(hex);
    const contrasteBlanco = 1.05 / (l + 0.05);
    const contrasteOscuro = (l + 0.05) / (luminancia("#10243a") + 0.05);
    return contrasteBlanco >= contrasteOscuro ? "#ffffff" : "#10243a";
}

const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;

// Aplica los colores del usuario sobre los de por defecto
function aplicarColoresUsuario(colores) {
    const raiz = document.documentElement.style;
    Object.entries(PREFIJO_COLOR).forEach(([codigo, prefijo]) => {
        const hex = colores && colores[codigo];
        if (hex && COLOR_VALIDO.test(hex)) {
            raiz.setProperty(`--${prefijo}-bg`, hex);
            raiz.setProperty(`--${prefijo}-fg`, textoSobre(hex));
            if (codigo === "LD") raiz.setProperty("--ld-borde", "transparent");
        } else {
            raiz.removeProperty(`--${prefijo}-bg`);
            raiz.removeProperty(`--${prefijo}-fg`);
            if (codigo === "LD") raiz.removeProperty("--ld-borde");
        }
    });
}

// --- Guardado en Supabase (con un pequeño retardo para no guardar en cada clic) ---
let temporizadorColores = null;

function guardarColoresDiferido() {
    clearTimeout(temporizadorColores);
    temporizadorColores = setTimeout(async () => {
        const { data, error } = await supabaseClient.rpc("guardar_colores", { p_colores: usuarioActual.colores || {} });
        if (error || !data || !data.ok) {
            console.error("Error al guardar colores:", error || data);
            mostrarToast("No se pudieron guardar los colores.", true);
        } else {
            mostrarToast("Colores guardados");
        }
    }, 500);
}

function cambiarColor(codigo, hex) {
    usuarioActual.colores = { ...(usuarioActual.colores || {}), [codigo]: hex };
    aplicarColoresUsuario(usuarioActual.colores);
    guardarColoresDiferido();
}

function restaurarColor(codigo) {
    const nuevos = { ...(usuarioActual.colores || {}) };
    delete nuevos[codigo];
    usuarioActual.colores = nuevos;
    aplicarColoresUsuario(nuevos);
    guardarColoresDiferido();
}

function restaurarTodosLosColores() {
    usuarioActual.colores = {};
    aplicarColoresUsuario({});
    guardarColoresDiferido();
}

// --- Pantalla del editor ---
let turnoColorElegido = "M";

function verEditorColores() {
    terminarModoEdicion();
    cerrarPanelUsuario();
    ocultarDetalleDia();

    const contenedor = document.getElementById("resultado");
    contenedor.style.display = "block";
    document.getElementById("cardCalendario").style.display = "none";
    document.body.classList.add("vista-resultado");
    window.scrollTo(0, 0);
    pintarEditorColores();
}

function pintarEditorColores() {
    const contenedor = document.getElementById("resultado");
    const personalizados = usuarioActual.colores || {};
    // Las marcas solo se ofrecen si alguien tiene marcas activadas
    const hayMarcas = hayMarcasEnUso();
    const disponibles = hayMarcas ? TIPOS_COLOR : TURNOS;
    const elegido = disponibles[turnoColorElegido] ? turnoColorElegido : "M";

    const turnos = el("div", { class: "selector-turnos", role: "group", "aria-label": "Turno a cambiar" },
        Object.entries(disponibles).map(([codigo, t]) =>
            el("button", {
                type: "button",
                class: "ficha-turno " + t.clase + (codigo.length > 1 ? " largo" : "") + (codigo === elegido ? " elegido" : ""),
                "aria-pressed": codigo === elegido ? "true" : "false",
                "data-codigo": codigo,
                onclick: () => { turnoColorElegido = codigo; pintarEditorColores(); }
            },
                el("span", { class: "ficha-letra", text: codigo }),
                el("span", { class: "ficha-nombre", text: t.texto })
            ))
    );

    const actual = personalizados[elegido];
    // CT1 a CT4 comparten color: CT2, CT3 y CT4 siguen a CT1 mientras no tengan uno propio
    const notaCT = elegido === "CT1"
        ? "CT1, CT2, CT3 y CT4 comparten color: al cambiar el de CT1 cambian también los que no tengan uno propio."
        : ["CT2", "CT3", "CT4"].includes(elegido)
            ? (actual ? `${elegido} tiene su propio color. «Restaurar este turno» lo devuelve al de CT1.` : `${elegido} usa el color de CT1. Elige uno aquí si quieres que sea distinto.`)
            : null;
    const muestras = el("div", { class: "paleta", role: "group", "aria-label": "Colores" },
        PALETA.map(hex => el("button", {
            type: "button",
            class: "muestra" + (actual && actual.toLowerCase() === hex ? " elegida" : ""),
            style: `background:${hex}`,
            "aria-label": hex,
            title: hex,
            "data-color": hex,
            onclick: () => { cambiarColor(elegido, hex); pintarEditorColores(); }
        }))
    );

    const selectorLibre = el("input", {
        type: "color", class: "color-libre", "aria-label": "Otro color",
        value: actual && COLOR_VALIDO.test(actual) ? actual : "#808080"
    });
    selectorLibre.addEventListener("change", () => { cambiarColor(elegido, selectorLibre.value.toLowerCase()); pintarEditorColores(); });

    reemplazarHijos(contenedor,
        el("div", { class: "resultado-cabecera" },
            el("h2", { text: "Colores de los turnos" }),
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        ),
        el("p", { class: "admin-nota nota-colores", text: "Elige un turno y luego su color. Solo lo verás tú, y se guarda en tu cuenta." }),
        turnos,
        el("h3", { class: "grupo-titulo", text: `Color de ${disponibles[elegido].texto}` }),
        notaCT ? el("p", { class: "admin-nota", text: notaCT }) : null,
        muestras,
        el("div", { class: "color-libre-fila" },
            el("label", { class: "campo-inline" }, el("span", { text: "Otro color" }), selectorLibre),
            el("button", {
                type: "button", class: "btn-secundario", text: "Restaurar este turno",
                disabled: actual ? null : true,
                onclick: () => { restaurarColor(elegido); pintarEditorColores(); }
            }),
            el("button", {
                type: "button", class: "btn-secundario", text: "Restaurar todos",
                disabled: Object.keys(personalizados).length ? null : true,
                onclick: () => { restaurarTodosLosColores(); pintarEditorColores(); }
            })
        )
    );
}
