// js/calendario.js
// Búsqueda por día, detalle de un día y calendario anual.

function pintar(nombre, info) {
    return `
        <div class="tarjeta-resultado">
            <span class="nombre-empleado">${esc(nombre)}</span>
            <span class="badges">
                ${info.marca ? `<span class="badge-turno ${info.marca.clase}">${esc(info.marca.codigo)}</span>` : ""}
                <span class="badge-turno ${info.clase}">${esc(info.texto)}</span>
            </span>
        </div>
    `;
}

function agregarResumen(resumen, nombre, turno) {
    if (!resumen[turno]) resumen[turno] = [];
    resumen[turno].push(nombre);
}

// --- BÚSQUEDA POR DÍA ---
async function consultar() {
    ocultarDetalleDia();
    terminarModoEdicion();

    const valor = document.getElementById("fecha").value;
    if (!valor) {
        alert("Selecciona una fecha");
        return;
    }
    await asegurarAnio(Number(valor.slice(0, 4)));

    const resumen = {};

    let html = `
        <div class="resultado-cabecera">
            <h2>${esc(fechaLarga(valor))}</h2>
            <button type="button" class="btn-secundario" onclick="cerrarVistaResultado()">Volver</button>
        </div>
    `;

    colectivos.forEach(c => {
        html += `<h3 class="grupo-titulo">${esc(c.icono)} ${esc(c.nombre)}</h3><div class="resultado-grid">`;
        empleadosActivos(c).forEach(emp => {
            const info = infoTurno(valor, emp);
            html += pintar(emp.nombre, info);
            agregarResumen(resumen, emp.nombre, info.texto);
        });
        html += "</div>";
    });

    html += `<h3 class="grupo-titulo resumen-titulo">Resumen del día</h3>`;

    Object.values(TURNOS).forEach(({ texto: turno, clase }) => {
        if (!resumen[turno]) return;
        html += `<div class="resumen-turno ${clase}"><span class="resumen-nombre">${esc(turno)}</span><div class="chips">`;
        resumen[turno].forEach(persona => {
            html += `<span class="chip">${esc(persona)}</span>`;
        });
        html += `</div></div>`;
    });

    mostrarEnResultado(html);
}

function mostrarEnResultado(html) {
    const contenedor = document.getElementById("resultado");
    contenedor.innerHTML = html;
    contenedor.style.display = "block";
    document.getElementById("cardCalendario").style.display = "none";
    document.body.classList.add("vista-resultado");
    window.scrollTo(0, 0);
}

function cerrarVistaResultado() {
    ocultarDetalleDia();
    document.getElementById("resultado").style.display = "none";
    document.getElementById("cardCalendario").style.display = "block";
    document.body.classList.remove("vista-resultado");
    verMiCalendario();
    window.scrollTo(0, 0);
}

function ocultarDetalleDia() {
    const panelDetalle = document.getElementById("panelDetalleDia");
    if (panelDetalle) panelDetalle.remove();
}

// --- DETALLE DE UN DÍA (clic en una celda): hoja que sube desde abajo ---
function seleccionarDia(fechaISO, empleadoId) {
    ocultarDetalleDia();

    // En la selección de varios días para pedir un cambio, tocar un día lo marca o desmarca
    if (typeof modoCambio !== "undefined" && modoCambio) {
        alternarDiaCambio(fechaISO, empleadoId);
        return;
    }

    // En modo edición, tocar un día de tu calendario abre el selector de turnos
    if (modoEdicion) {
        const mio = obtenerEmpleadoActual();
        if (mio && mio.id === empleadoId) {
            abrirSelectorTurno(fechaISO);
            return;
        }
    }

    const empleado = buscarEmpleadoPorId(empleadoId);
    if (!empleado) return;
    const colectivo = buscarColectivo(empleado.colectivo);
    const info = infoTurno(fechaISO, empleado);

    // Compañeros con el mismo turno (solo si es mañana, tarde o noche)
    const compis = [];
    if (["M", "T", "N"].includes(info.codigo)) {
        colectivos.forEach(c => {
            empleadosActivos(c).forEach(otro => {
                if (otro.id !== empleado.id && infoTurno(fechaISO, otro).codigo === info.codigo) {
                    compis.push(otro.nombre);
                }
            });
        });
    }

    const panel = el("div", { id: "panelDetalleDia", class: "detalle-dia " + info.clase, role: "dialog", "aria-label": "Detalle del día" },
        el("div", { class: "detalle-cabecera" },
            el("div", { class: "detalle-titulo" },
                el("span", { class: "detalle-letra" + claseLargo(info), text: info.codigo }),
                el("div", { class: "detalle-textos" },
                    el("strong", { text: info.texto }),
                    el("span", { class: "detalle-fecha", text: fechaLarga(fechaISO) })
                )
            ),
            el("button", { type: "button", class: "btn-cerrar", "aria-label": "Cerrar", text: "×", onclick: ocultarDetalleDia })
        ),
        el("p", { class: "detalle-linea" },
            el("span", { class: "detalle-etiqueta", text: "Empleado" }),
            `${empleado.nombre} · ${colectivo.puesto}`
        ),
        el("p", { class: "detalle-linea" },
            el("span", { class: "detalle-etiqueta", text: "Origen" }),
            textoOrigen(info)
        ),
        info.marca
            ? el("p", { class: "detalle-linea" },
                el("span", { class: "detalle-etiqueta", text: "Marca" }),
                el("span", { class: "badge-turno " + info.marca.clase, text: info.marca.texto }),
                (info.marca.dia ? " · solo este día" : ` · del ${formatearFecha(lunesDe(fechaISO))} al ${formatearFecha(domingoDe(fechaISO))}`)
              )
            : null,
        compis.length
            ? el("div", { class: "detalle-linea" },
                el("span", { class: "detalle-etiqueta", text: "Mismo turno" }),
                el("div", { class: "chips" }, compis.map(n => el("span", { class: "chip", text: n })))
              )
            : null,
        (typeof crearSeccionGoogle === "function") ? crearSeccionGoogle(empleado, fechaISO) : null,
        puedeSolicitarCambioEnFicha(empleado, fechaISO, info)
            ? el("button", {
                type: "button", class: "btn-ancho btn-editar-ficha",
                text: "Solicitar cambio",
                onclick: () => { ocultarDetalleDia(); setTimeout(() => abrirSolicitudCambio([fechaISO]), 0); }
            })
            : null,
        puedeSolicitarCambioEnFicha(empleado, fechaISO, info)
            ? el("button", {
                type: "button", class: "btn-secundario btn-ancho btn-editar-ficha",
                text: "Cambio de varios días",
                onclick: () => { ocultarDetalleDia(); setTimeout(() => iniciarModoCambio(fechaISO), 0); }
            })
            : null,
        puedeEditarDesdeFicha(empleado)
            ? el("button", {
                type: "button", class: "btn-secundario btn-ancho btn-editar-ficha",
                text: "Editar este día",
                // setTimeout: así el mismo clic no cierra al instante el selector recién abierto
                onclick: () => { activarModoEdicion(); setTimeout(() => abrirSelectorTurno(fechaISO), 0); }
            })
            : null
    );

    document.body.append(panel);
}

// El botón "Editar este día" de la ficha: solo en tu propio calendario (no familiares)
// y solo si se está viendo el calendario mensual, no una vista de resultados
function puedeEditarDesdeFicha(empleado) {
    const mio = obtenerEmpleadoActual();
    const resultado = document.getElementById("resultado");
    return !!mio && mio.id === empleado.id && !esPerfilFamiliar()
        && !(resultado && resultado.style.display === "block");
}

function textoOrigen(info) {
    if (info.origen === "manual") return "Cambio manual";
    if (info.origen === "festivo") return info.nota ? `Festivo: ${info.nota}` : "Festivo";
    if (info.origen === "intensiva") return "Periodo de intensiva";
    return "Ciclo de turnos";
}

// Un solo "oyente" para todas las celdas: los botones llevan data-fecha y data-emp
document.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-fecha][data-emp]");
    if (boton) seleccionarDia(boton.dataset.fecha, boton.dataset.emp);
});

// --- CALENDARIO ANUAL ---
async function verCalendario(anioParam, colectivoParam) {
    ocultarDetalleDia();
    terminarModoEdicion();

    const selectAnio = document.getElementById("anioAnualSelect");
    const anio = Number(anioParam) || (selectAnio ? Number(selectAnio.value) : new Date().getFullYear());
    await asegurarAnio(anio);

    const selectColectivo = document.getElementById("colectivoAnual");
    const esMovil = window.innerWidth <= 768;
    const visibles = colectivosVisiblesAnual();
    if (!visibles.length) return;
    let codigo = colectivoParam || (selectColectivo ? selectColectivo.value : (esMovil || visibles.length === 1 ? visibles[0].codigo : "todos"));
    // Solo se puede ver lo que el administrador ha dado a esta persona
    if (codigo !== "todos" && !visibles.some(c => c.codigo === codigo)) codigo = visibles[0].codigo;
    if (codigo === "todos" && visibles.length === 1) codigo = visibles[0].codigo;

    let columnas = [];
    let tituloVista = "Planificación anual";
    if (codigo === "todos") {
        visibles.forEach(c => empleadosActivos(c).forEach(e => columnas.push(e)));
    } else {
        const c = buscarColectivo(codigo) || visibles[0];
        columnas = empleadosActivos(c);
        tituloVista = c.nombre;
    }

    const hoyISO = aISO(new Date());

    let html = `
        <div class="resultado-cabecera">
            <h2>${esc(tituloVista)} · ${anio}</h2>
            <div class="resultado-acciones">
                <select id="anioVistaAnual" aria-label="Año"></select>
                <button type="button" class="btn-secundario" onclick="cerrarVistaResultado()">Volver</button>
            </div>
        </div>
    `;

    html += `<div class="anual-scroll"><table class="tabla-anual-unificada"><thead><tr>`;
    html += `<th class="col-fecha"><span>Fecha</span></th><th class="col-dia"><span>Día</span></th>`;
    columnas.forEach(emp => {
        html += `<th class="th-vertical"><span>${esc(emp.nombre)}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    const diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    const fechaIterador = new Date(anio, 0, 1);
    const fechaFin = new Date(anio, 11, 31);

    while (fechaIterador <= fechaFin) {
        const iso = aISO(fechaIterador);
        const [, mesF, diaF] = iso.split("-");
        const nombreDia = diasCortos[fechaIterador.getDay()];
        const esFinDeSemana = fechaIterador.getDay() === 0 || fechaIterador.getDay() === 6;

        const clases = [];
        if (esFinDeSemana) clases.push("fila-finde");
        if (diaF === "01") clases.push("inicio-mes");
        if (iso === hoyISO) clases.push("fila-hoy");

        html += `<tr${clases.length ? ` class="${clases.join(" ")}"` : ""}>`;
        html += `<td class="celda-fecha col-fecha">${diaF}/${mesF}</td>`;
        html += `<td class="celda-fecha col-dia">${nombreDia}</td>`;

        columnas.forEach(emp => {
            const info = infoTurno(iso, emp);
            const titulo = `${emp.nombre} · ${formatearFecha(iso)} (${nombreDia}): ${info.texto}${info.marca ? " · " + info.marca.texto : ""}`;
            const interior = info.partida
                ? `<span class="tm-arriba ${info.marca ? info.marca.clase : "sin-marca"}">${info.marca ? esc(info.marca.codigo) : ""}</span><span class="tm-abajo">${esc(inicial(info))}</span>`
                : esc(inicial(info));
            html += `
                <td class="celda-turno">
                    <button type="button" class="td-celda-turno ${info.clase}${claseLargo(info)}${info.manual ? " editado" : ""}${info.partida ? " con-marca" : ""}" data-fecha="${iso}" data-emp="${esc(emp.id)}" title="${esc(titulo)}">${interior}</button>
                </td>
            `;
        });

        html += `</tr>`;
        fechaIterador.setDate(fechaIterador.getDate() + 1);
    }

    html += `</tbody></table></div>`;

    mostrarEnResultado(html);

    const selectVista = document.getElementById("anioVistaAnual");
    rellenarAnios(selectVista, anio);
    selectVista.addEventListener("change", () => verCalendario(selectVista.value, codigo));

    // Deja a la vista el día de hoy si se mira el año en curso
    const filaHoy = document.querySelector(".fila-hoy");
    const contenedorScroll = document.querySelector(".anual-scroll");
    if (filaHoy && contenedorScroll) {
        contenedorScroll.scrollTop = filaHoy.offsetTop - contenedorScroll.clientHeight / 2;
    }
}

function toggleSeccionPanel(tipo) {
    const secciones = {
        busqueda: { sec: "seccionBusqueda", btn: "btnToggleBusqueda" },
        anual:    { sec: "seccionAnual",    btn: "btnToggleAnual" }
    };
    if (!secciones[tipo]) return;

    const secActual = document.getElementById(secciones[tipo].sec);
    if (!secActual) return;
    const estabaAbierta = secActual.style.display === "block";

    // Abre la sección pulsada (o la cierra si ya estaba abierta) y cierra las demás
    Object.keys(secciones).forEach(clave => {
        const sec = document.getElementById(secciones[clave].sec);
        const btn = document.getElementById(secciones[clave].btn);
        const abrir = (clave === tipo) && !estabaAbierta;
        if (sec) sec.style.display = abrir ? "block" : "none";
        if (btn) btn.classList.toggle("activo", abrir);
    });
}
