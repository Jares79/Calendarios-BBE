// js/CalendarioMensual.js
// Mi calendario (vista mensual), menú de usuario y navegación entre meses.

let fechaCalendario = new Date();
let inicioTouchX = 0;
let finTouchX = 0;
let inicioTouchY = 0;
let finTouchY = 0;
let swipeActivo = false;

// Ficha del empleado cuyo calendario se muestra (el propio, o el del familiar vinculado)
function obtenerEmpleadoActual() {
    if (!usuarioActual || !usuarioActual.empleadoId) return null;
    const empleado = buscarEmpleadoPorId(usuarioActual.empleadoId);
    return empleado && empleado.activo ? empleado : null;
}

function esPerfilFamiliar() {
    return !!usuarioActual && usuarioActual.rol === "familiar";
}

// Cabecera de usuario: círculo con las iniciales, nombre y flecha del menú
function pintarCabeceraUsuario(flecha) {
    const cabecera = document.getElementById("infoUsuario");
    if (!cabecera || !usuarioActual) return;
    const iniciales = String(usuarioActual.iniciales || "").replace(/_F$/, "").slice(0, 3);
    const partes = [
        el("span", { class: "avatar", text: iniciales }),
        el("span", { class: "nombre-usuario", text: usuarioActual.nombre })
    ];
    if (esPerfilFamiliar()) partes.push(el("span", { class: "etiqueta-familiar", text: "Familiar" }));
    if (typeof cambiosSinVer === "number" && cambiosSinVer > 0) partes.push(el("span", { class: "globo", text: String(cambiosSinVer) }));
    if (flecha) partes.push(el("span", { class: "flecha", text: flecha }));
    cabecera.replaceChildren(...partes);
}

function verMiCalendario() {
    const anio = fechaCalendario.getFullYear();
    const mes = fechaCalendario.getMonth();

    let nombreMes = fechaCalendario.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    nombreMes = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    document.getElementById("tituloMes").textContent = nombreMes;

    // Si el año aún no está cargado, se pinta con lo que hay y se repinta al llegar los datos
    if (!aniosCargados.has(anio)) {
        asegurarAnio(anio).then(ok => { if (ok && fechaCalendario.getFullYear() === anio) verMiCalendario(); });
    }

    const empleado = obtenerEmpleadoActual();
    const contenedor = document.getElementById("miCalendario");
    pintarResumenHoy();

    if (!empleado) {
        contenedor.innerHTML = `
            <p class="aviso-vacio">
                No se ha encontrado tu ficha de empleado, así que no se puede mostrar el calendario.
                Avisa al administrador.
            </p>`;
        return;
    }

    const diasMes = new Date(anio, mes + 1, 0).getDate();
    const hoyISO = aISO(new Date());

    let primerDiaSemana = new Date(anio, mes, 1).getDay();
    primerDiaSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
    const semanas = Math.ceil((primerDiaSemana + diasMes) / 7);

    let html = `
    <div class="calendario-grid" data-semanas="${semanas}" style="--semanas: ${semanas};">
        <div class="dia-cabecera">L</div>
        <div class="dia-cabecera">M</div>
        <div class="dia-cabecera">X</div>
        <div class="dia-cabecera">J</div>
        <div class="dia-cabecera">V</div>
        <div class="dia-cabecera">S</div>
        <div class="dia-cabecera">D</div>
    `;

    let primerDia = new Date(anio, mes, 1).getDay();
    primerDia = primerDia === 0 ? 6 : primerDia - 1;
    for (let i = 0; i < primerDia; i++) html += `<div></div>`;

    for (let dia = 1; dia <= diasMes; dia++) {
        const iso = aISO(new Date(anio, mes, dia));
        const info = infoTurno(iso, empleado);

        const esHoy = iso === hoyISO ? " hoy" : "";
        const marcas = claseLargo(info) + (info.manual ? " editado" : "") + (info.partida ? " con-marca" : "") + (seleccionCambio.has(iso) ? " seleccionado" : "");
        const textoMarca = info.marca ? ` · ${info.marca.texto}` : "";
        // Colectivos con semanas: celda partida (arriba la marca de la semana, abajo el turno)
        const interior = info.partida
            ? htmlMitades(info, `<span class="numero-dia">${dia}</span>`)
            : `<span class="numero-dia">${dia}</span><span class="turno-dia">${esc(inicial(info))}</span>`;
        html += `
            <button type="button" class="dia-calendario ${info.clase}${esHoy}${marcas}" data-fecha="${iso}" data-emp="${esc(empleado.id)}" aria-label="${esc(fechaLarga(iso))}: ${esc(info.texto)}${esc(textoMarca)}">
                ${interior}
            </button>
        `;
    }

    html += `</div>`;
    contenedor.innerHTML = html;
    ajustarAlturaCalendario();

    if (!swipeActivo) {
        contenedor.addEventListener("touchstart", function (e) {
            inicioTouchX = e.changedTouches[0].screenX;
            inicioTouchY = e.changedTouches[0].screenY;
        });
        contenedor.addEventListener("touchend", function (e) {
            finTouchX = e.changedTouches[0].screenX;
            finTouchY = e.changedTouches[0].screenY;
            manejarSwipe();
        });
        swipeActivo = true;
    }
}

// Siempre se fija el día 1 antes de cambiar de mes (evita saltarse meses el día 29, 30 o 31)
function mesAnterior() {
    fechaCalendario = new Date(fechaCalendario.getFullYear(), fechaCalendario.getMonth() - 1, 1);
    verMiCalendario();
}

function mesSiguiente() {
    fechaCalendario = new Date(fechaCalendario.getFullYear(), fechaCalendario.getMonth() + 1, 1);
    verMiCalendario();
}

function manejarSwipe() {
    const diferenciaX = inicioTouchX - finTouchX;
    const diferenciaY = inicioTouchY - finTouchY;

    if (Math.abs(diferenciaY) > Math.abs(diferenciaX)) return;
    if (Math.abs(diferenciaX) < 50) return;

    const calendario = document.getElementById("miCalendario");
    calendario.classList.add("calendario-animando");

    setTimeout(function () {
        if (diferenciaX > 0) mesSiguiente();
        else mesAnterior();
        calendario.classList.remove("calendario-animando");
    }, 200);
}

function mostrarSelectorMes() {
    document.getElementById("mesSelector").value = fechaCalendario.getMonth();
    document.getElementById("anioSelector").value = fechaCalendario.getFullYear();

    const selector = document.getElementById("selectorMes");
    selector.style.display = selector.style.display === "block" ? "none" : "block";
}

function aplicarMes() {
    const mes = Number(document.getElementById("mesSelector").value);
    const anio = Number(document.getElementById("anioSelector").value);

    fechaCalendario = new Date(anio, mes, 1);
    verMiCalendario();
    document.getElementById("selectorMes").style.display = "none";
}

function irAHoy() {
    fechaCalendario = new Date();
    verMiCalendario();
    document.getElementById("selectorMes").style.display = "none";
}

// --- MENÚ DE USUARIO ---

// Rellena las opciones del menú con los datos cargados (colectivos y años)
function prepararPanelUsuario() {
    const hoy = new Date().getFullYear();
    const anioActual = Math.min(Math.max(hoy, ANIO_MIN), ANIO_MAX);

    rellenarAnios(document.getElementById("anioSelector"), anioActual);
    rellenarAnios(document.getElementById("anioAnualSelect"), anioActual);

    const select = document.getElementById("colectivoAnual");
    if (select) {
        select.innerHTML = "";
        colectivos.forEach(c => {
            select.append(el("option", { value: c.codigo, text: `${c.icono} ${c.nombre} (${empleadosActivos(c).length})` }));
        });
        const total = colectivos.reduce((suma, c) => suma + empleadosActivos(c).length, 0);
        select.append(el("option", { value: "todos", text: `👥 Todos (${total})` }));
    }
}

function toggleUsuario() {
    ocultarDetalleDia();

    const panel = document.getElementById("panelUsuario");
    const cabecera = document.getElementById("infoUsuario");
    if (!panel || !cabecera) return;

    const estaAbierto = window.getComputedStyle(panel).display === "block";

    if (estaAbierto) {
        panel.style.display = "none";
        pintarCabeceraUsuario("▼");
        ajustarAlturaCalendario();
    } else {
        panel.style.display = "block";
        pintarCabeceraUsuario("▲");
        window.scrollTo({ top: 0, behavior: "smooth" });   // el menú se abre arriba del todo

        const inputFecha = document.getElementById("fecha");
        if (inputFecha && !inputFecha.value) {
            inputFecha.value = aISO(new Date());
        }

        const selectColectivo = document.getElementById("colectivoAnual");
        if (selectColectivo && colectivos.length) {
            selectColectivo.value = window.innerWidth <= 768 ? colectivos[0].codigo : "todos";
        }
    }
}

function cerrarPanelUsuario() {
    const panel = document.getElementById("panelUsuario");
    if (panel) panel.style.display = "none";
    pintarCabeceraUsuario("▼");
    ajustarAlturaCalendario();
}

function ejecutarBusquedaDesdeMenu() {
    const secBusqueda = document.getElementById("seccionBusqueda");

    consultar();

    cerrarPanelUsuario();
    if (secBusqueda) secBusqueda.style.display = "none";
}

function verCalendarioDesdeMenu() {
    const anio = document.getElementById("anioAnualSelect").value;
    const colectivo = document.getElementById("colectivoAnual").value;

    cerrarPanelUsuario();
    verCalendario(anio, colectivo);
}

// --- CLIC FUERA: cierra selector de mes, detalle de día y menú de usuario ---
document.addEventListener("click", function (event) {
    const selectorMes = document.getElementById("selectorMes");
    const tituloMes = document.getElementById("tituloMes");
    if (selectorMes && selectorMes.style.display === "block") {
        if (!selectorMes.contains(event.target) && !tituloMes.contains(event.target)) {
            selectorMes.style.display = "none";
        }
    }

    const panelDetalle = document.getElementById("panelDetalleDia");
    if (panelDetalle) {
        // composedPath() incluye el panel aunque el botón pulsado se haya repintado en el clic
        const dentroDelPanel = panelDetalle.contains(event.target) || event.composedPath().includes(panelDetalle);
        const esBotonDeTurno = event.target.closest(".dia-calendario") || event.target.closest(".td-celda-turno") || event.target.closest(".cuadro-dia");
        // Los botones de la barra de edición abren sus propias hojas: no cuentan como "fuera"
        const esBarraEdicion = event.target.closest(".barra-edicion");
        if (!dentroDelPanel && !esBotonDeTurno && !esBarraEdicion) ocultarDetalleDia();
    }

    const panelUsuario = document.getElementById("panelUsuario");
    const usuarioCabecera = document.querySelector(".usuarioCabecera");
    if (panelUsuario && panelUsuario.style.display === "block") {
        const dentroPanel = panelUsuario.contains(event.target);
        const dentroCabecera = usuarioCabecera && usuarioCabecera.contains(event.target);
        if (!dentroPanel && !dentroCabecera) cerrarPanelUsuario();
    }
});

// Perfil familiar: oculta el panel y marca la cabecera. Se llama desde iniciarApp(),
// cuando usuarioActual ya está cargado.
function aplicarModoFamiliar() {
    if (!esPerfilFamiliar()) return;

    const panelUsuario = document.getElementById("panelUsuario");
    if (panelUsuario) panelUsuario.style.display = "none";

    pintarCabeceraUsuario(null);
}

document.addEventListener("DOMContentLoaded", () => {
    const chipUsuario = document.getElementById("infoUsuario");
    if (chipUsuario) {
        chipUsuario.addEventListener("keydown", function (e) {
            if ((e.key === "Enter" || e.key === " ") && !esPerfilFamiliar()) {
                e.preventDefault();
                toggleUsuario();
            }
        });
    }

    const contenedorUsuario = document.querySelector(".usuarioCabecera");
    if (contenedorUsuario) {
        contenedorUsuario.addEventListener("click", function (e) {
            if (e.target.closest(".cerrarSesion")) return;
            e.stopPropagation();
            // El familiar no tiene menú desplegable
            if (esPerfilFamiliar()) return;
            toggleUsuario();
        });
    }
});


// --- BLOQUE "HOY" Y LEYENDA ---
const DIAS_SEMANA_CORTOS = ["D", "L", "M", "X", "J", "V", "S"];

function pintarResumenHoy() {
    const contenedor = document.getElementById("resumenHoy");
    if (!contenedor) return;

    const empleado = obtenerEmpleadoActual();
    if (!empleado) {
        contenedor.hidden = true;
        return;
    }

    const hoy = new Date();
    const iso = aISO(hoy);
    const info = infoTurno(iso, empleado);

    const proximos = [];
    for (let i = 1; i <= 6; i++) {
        const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
        const isoDia = aISO(dia);
        const infoDia = infoTurno(isoDia, empleado);
        proximos.push(el("li", { class: "chip-dia " + infoDia.clase + claseLargo(infoDia), title: `${fechaLarga(isoDia)}: ${infoDia.texto}${infoDia.marca ? " · " + infoDia.marca.texto : ""}` },
            el("span", { class: "chip-sem", text: DIAS_SEMANA_CORTOS[dia.getDay()] }),
            el("span", { class: "chip-num", text: dia.getDate() }),
            el("span", { class: "chip-letra", text: infoDia.codigo }),
            infoDia.partida
                ? el("span", { class: "chip-marca " + (infoDia.marca ? infoDia.marca.clase : "sin-marca"), text: infoDia.marca ? infoDia.marca.codigo : "·" })
                : null
        ));
    }

    contenedor.replaceChildren(
        el("div", { class: "hoy-bloque " + info.clase },
            el("div", { class: "hoy-textos" },
                el("span", { class: "hoy-etiqueta", text: "Hoy" }),
                el("span", { class: "hoy-nombre", text: info.texto }),
                el("span", { class: "hoy-fecha", text: fechaLarga(iso) }),
                info.marca ? el("span", { class: "hoy-marca " + info.marca.clase, text: info.marca.texto }) : null
            ),
            el("span", { class: "hoy-letra" + claseLargo(info), text: info.codigo })
        ),
        el("div", { class: "hoy-proximos-caja" },
            el("p", { class: "hoy-subtitulo", text: "Próximos días" }),
            el("ul", { class: "hoy-proximos" }, proximos)
        )
    );
    contenedor.hidden = false;
}

function pintarLeyenda() {
    const contenedor = document.getElementById("leyenda");
    if (!contenedor) return;

    const item = ([codigo, t]) =>
        el("li", { class: t.clase },
            el("span", { class: "leyenda-letra" + (codigo.length > 1 ? " largo" : ""), text: codigo }),
            el("span", { text: t.texto })
        );

    // Las marcas semanales solo se explican si hay algún colectivo que las use
    const hayMarcas = colectivos.some(c => c.marcas.length > 0);
    reemplazarHijos(contenedor,
        el("h2", { text: "Turnos" }),
        el("ul", { class: "leyenda-lista" }, Object.entries(TURNOS).map(item)),
        hayMarcas ? el("h2", { class: "leyenda-sub", text: "Semanas (mitad de arriba de la celda)" }) : null,
        hayMarcas ? el("ul", { class: "leyenda-lista" }, Object.entries(MARCAS).map(item)) : null
    );
}


// --- AJUSTE A LA PANTALLA (móvil) ---
// En móvil el mes debe verse entero sin bajar, sea cual sea el tamaño del teléfono.
// Se reparte la altura libre entre las filas de semanas; si las celdas quedarían demasiado
// pequeñas, se va compactando lo de arriba: 1) se oculta la tira de próximos días,
// 2) el bloque "Hoy" se reduce a una franja, 3) se oculta el bloque "Hoy".
// Altura que ocupa el menú de usuario si está desplegado (0 si está cerrado)
function alturaMenuAbierto() {
    const panel = document.getElementById("panelUsuario");
    if (!panel || window.getComputedStyle(panel).display === "none") return 0;
    return panel.getBoundingClientRect().height + (parseFloat(window.getComputedStyle(panel).marginBottom) || 0);
}

const NIVELES_COMPACTOS = [
    [],
    ["pantalla-baja"],
    ["pantalla-baja", "pantalla-muy-baja"],
    ["pantalla-baja", "pantalla-muy-baja", "sin-hoy"]
];
const CLASES_COMPACTAS = ["pantalla-baja", "pantalla-muy-baja", "sin-hoy"];
const ALTO_CELDA_COMODO = 40;   // por debajo de esto se compacta lo de arriba
const ALTO_CELDA_MINIMO = 30;

function ajustarAlturaCalendario() {
    const contenedor = document.getElementById("miCalendario");
    const grid = contenedor ? contenedor.querySelector(".calendario-grid") : null;
    if (!grid) return;

    const quitarCompactacion = () => document.body.classList.remove(...CLASES_COMPACTAS);

    if (!window.matchMedia("(max-width: 767px)").matches) {
        grid.classList.remove("altura-fija");
        contenedor.style.removeProperty("--alto-celda");
        quitarCompactacion();
        return;
    }

    const semanas = Number(grid.dataset.semanas) || 6;
    const hueco = parseFloat(getComputedStyle(grid).rowGap) || 4;
    const tarjeta = document.getElementById("cardCalendario");
    const estilo = tarjeta ? getComputedStyle(tarjeta) : null;
    const rellenoAbajo = estilo ? parseFloat(estilo.paddingBottom) + parseFloat(estilo.borderBottomWidth) : 13;

    // Altura que le tocaría a cada fila con la compactación actual (sin recortar)
    const altoPorFila = () => {
        const cabecera = grid.querySelector(".dia-cabecera");
        const altoCabecera = cabecera ? cabecera.getBoundingClientRect().height : 24;
        // Si el menú está desplegado ocupa sitio arriba: se calcula como si estuviera cerrado
        const arriba = grid.getBoundingClientRect().top + window.scrollY - alturaMenuAbierto();
        const libre = window.innerHeight - arriba - (rellenoAbajo + 30) - altoCabecera - hueco * semanas;
        return libre / semanas;
    };

    grid.classList.add("altura-fija");
    contenedor.style.setProperty("--alto-celda", ALTO_CELDA_COMODO + "px");

    let porFila = 0;
    for (let i = 0; i < NIVELES_COMPACTOS.length; i++) {
        quitarCompactacion();
        document.body.classList.add(...NIVELES_COMPACTOS[i]);
        porFila = altoPorFila();
        if (porFila >= ALTO_CELDA_COMODO) break;
    }

    const anchoCelda = (grid.getBoundingClientRect().width - hueco * 6) / 7;
    let alto = Math.floor(Math.min(anchoCelda * 1.06, Math.max(ALTO_CELDA_MINIMO, porFila)));
    contenedor.style.setProperty("--alto-celda", alto + "px");

    // Comprobación final con la página real: si aún se desborda, se afina fila a fila
    // (solo con el menú cerrado: abierto, la página es más alta a propósito)
    for (let i = 0; i < 4 && !alturaMenuAbierto(); i++) {
        const exceso = document.documentElement.scrollHeight - window.innerHeight;
        if (exceso <= 0 || alto <= ALTO_CELDA_MINIMO) break;
        alto = Math.max(ALTO_CELDA_MINIMO, alto - Math.ceil(exceso / semanas));
        contenedor.style.setProperty("--alto-celda", alto + "px");
    }
}

window.addEventListener("resize", ajustarAlturaCalendario);
window.addEventListener("orientationchange", () => setTimeout(ajustarAlturaCalendario, 150));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarAlturaCalendario);
