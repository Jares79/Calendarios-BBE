// js/calendario.js
// Búsqueda por día, detalle de un día y calendario anual.

function pintar(nombre, info) {
    return `
        <div class="tarjeta-resultado">
            <span class="nombre-empleado">${esc(nombre)}</span>
            <span class="badge-turno ${info.clase}">${esc(info.texto)}</span>
        </div>
    `;
}

function agregarResumen(resumen, nombre, turno) {
    if (!resumen[turno]) resumen[turno] = [];
    resumen[turno].push(nombre);
}

// --- BÚSQUEDA POR DÍA ---
function consultar() {
    ocultarDetalleDia();

    const valor = document.getElementById("fecha").value;
    if (!valor) {
        alert("Selecciona una fecha");
        return;
    }

    const resumen = {};

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2>🔍 Búsqueda: ${esc(formatearFecha(valor))}</h2>
            <button onclick="cerrarVistaResultado()" style="background:#64748b; padding:8px 14px; font-size:13px;">✖ Volver</button>
        </div>
    `;

    colectivos.forEach((c, i) => {
        html += `<h3${i > 0 ? " style='margin-top:20px;'" : ""}>${esc(c.icono)} ${esc(c.nombre)}</h3><div class='resultado-grid'>`;
        empleadosActivos(c).forEach(emp => {
            const info = infoTurno(valor, emp);
            html += pintar(emp.nombre, info);
            agregarResumen(resumen, emp.nombre, info.texto);
        });
        html += "</div>";
    });

    html += "<hr style='margin:25px 0; border:0; border-top:1px solid #e2e8f0;'>";
    html += "<h3>📋 Resumen Diario</h3>";

    ["Mañana", "Tarde", "Noche", "Partida", "Intensiva", "Solape", "Fiesta"].forEach(turno => {
        if (!resumen[turno]) return;
        html += `<div style="font-size:14px; color:#1f4e79; margin-top:8px; font-weight:bold;">• ${turno}:</div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; margin-bottom:8px;">`;
        resumen[turno].forEach(persona => {
            html += `<span style="background:#e8f1fb; color:#1f4e79; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold;">${esc(persona)}</span>`;
        });
        html += `</div>`;
    });

    mostrarEnResultado(html);
}

function mostrarEnResultado(html) {
    const contenedor = document.getElementById("resultado");
    contenedor.innerHTML = html;
    contenedor.style.display = "block";
    contenedor.style.width = "100%";
    document.getElementById("cardCalendario").style.display = "none";
    window.scrollTo(0, 0);
}

function cerrarVistaResultado() {
    ocultarDetalleDia();
    document.getElementById("resultado").style.display = "none";
    document.getElementById("cardCalendario").style.display = "block";
    window.scrollTo(0, 0);
}

function ocultarDetalleDia() {
    const panelDetalle = document.getElementById("panelDetalleDia");
    if (panelDetalle) panelDetalle.remove();
}

// --- DETALLE DE UN DÍA (clic en una celda) ---
function seleccionarDia(fechaISO, empleadoId) {
    ocultarDetalleDia();

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
                    compis.push(`${c.icono} ${otro.nombre}`);
                }
            });
        });
    }

    const htmlCompis = compis.length ? `
        <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <p style="margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Compañeros de turno:</strong> ${compis.map(esc).join(" - ")}</p>
        </div>` : "";

    const panel = document.createElement("div");
    panel.id = "panelDetalleDia";
    panel.className = "card";
    panel.style.cssText = "border-left: 5px solid #0ea5e9; background: #f8fafc; margin-bottom: 15px; padding: 12px 16px;";
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1f4e79; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                📅 ${esc(formatearFecha(fechaISO))}
                <span style="font-weight: normal; color: #64748b; font-size: 0.85rem;">—</span>
                <span class="badge-turno ${info.clase}" style="padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; display: inline-block;">${esc(info.texto)}</span>
            </h3>
            <button onclick="ocultarDetalleDia()" style="background:#64748b; padding:2px 8px; font-size:11px; border-radius: 4px;">✖ Cerrar</button>
        </div>
        <div style="font-size: 13.5px; color: #334155; display: flex; flex-direction: column; gap: 4px;">
            <p style="margin: 0;"><strong>Empleado:</strong> ${esc(empleado.nombre)} (${esc(colectivo.icono)} ${esc(colectivo.puesto)})</p>
            ${htmlCompis}
        </div>
    `;

    const cardCalendario = document.getElementById("cardCalendario");
    const resultado = document.getElementById("resultado");

    if (resultado && resultado.style.display === "block") {
        resultado.insertBefore(panel, resultado.firstChild);
    } else if (cardCalendario) {
        cardCalendario.insertBefore(panel, cardCalendario.firstChild);
    } else {
        document.body.insertBefore(panel, document.body.firstChild);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Un solo "oyente" para todas las celdas: los botones llevan data-fecha y data-emp
document.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-fecha][data-emp]");
    if (boton) seleccionarDia(boton.dataset.fecha, boton.dataset.emp);
});

// --- CALENDARIO ANUAL ---
function verCalendario(anioParam, colectivoParam) {
    ocultarDetalleDia();

    const selectAnio = document.getElementById("anioAnualSelect");
    const anio = Number(anioParam) || (selectAnio ? Number(selectAnio.value) : new Date().getFullYear());

    const selectColectivo = document.getElementById("colectivoAnual");
    const esMovil = window.innerWidth <= 768;
    const codigo = colectivoParam || (selectColectivo ? selectColectivo.value : (esMovil ? colectivos[0].codigo : "todos"));

    let columnas = [];
    let tituloVista = "Planificación Anual Maestro";
    if (codigo === "todos") {
        colectivos.forEach(c => empleadosActivos(c).forEach(e => columnas.push(e)));
    } else {
        const c = buscarColectivo(codigo) || colectivos[0];
        columnas = empleadosActivos(c);
        tituloVista = `${c.icono} ${c.nombre}`;
    }

    const anchoFecha = esMovil ? "11%" : "75px";
    const anchoDia = esMovil ? "10%" : "75px";

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h2 style="font-size:1.1rem; margin:0;">📅 ${esc(tituloVista)} (${anio})</h2>
            <div style="display:flex; gap:8px; align-items:center;">
                <select id="anioVistaAnual" style="padding:4px 8px; border-radius:6px; border:1px solid #ccc; font-size:0.85rem;"></select>
                <button onclick="cerrarVistaResultado()" style="background:#64748b; padding:6px 12px; font-size:12px;">✖ Volver</button>
            </div>
        </div>
    `;

    html += `<div style="max-height:82vh; width:100%; overflow-x:hidden; overflow-y:auto; border:1px solid #cbd5e1; border-radius:8px; background:white;">`;
    html += `<table class="tabla-anual-unificada" style="width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0;">`;
    html += `<thead><tr>`;
    html += `<th class="th-vertical" style="left:0; z-index:4; width:${anchoFecha}; min-width:${anchoFecha}; max-width:${anchoFecha}; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:9px; padding: 4px 0px;">Fecha</th>`;
    html += `<th class="th-vertical" style="left:${anchoFecha}; z-index:4; width:${anchoDia}; min-width:${anchoDia}; max-width:${anchoDia}; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:9px; padding: 4px 0px;">Día</th>`;
    columnas.forEach(emp => {
        html += `<th class="th-vertical" style="font-size:9px; padding: 4px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(emp.nombre)}</th>`;
    });
    html += `</tr></thead><tbody>`;

    const diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const diasLargos = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const fechaIterador = new Date(anio, 0, 1);
    const fechaFin = new Date(anio, 11, 31);

    while (fechaIterador <= fechaFin) {
        const iso = aISO(fechaIterador);
        const [, mesF, diaF] = iso.split("-");
        const nombreDia = (esMovil ? diasCortos : diasLargos)[fechaIterador.getDay()];
        const esFinDeSemana = fechaIterador.getDay() === 0 || fechaIterador.getDay() === 6;
        const estiloFila = esFinDeSemana ? "background:#e2e8f0; color:#475569;" : "background:#f8fafc;";

        html += `<tr>`;
        html += `<td style="${estiloFila} font-weight:bold; border:1px solid #cbd5e1; padding:2px 1px; text-align:center; position:sticky; left:0; z-index:2; font-size:9px; width:${anchoFecha}; min-width:${anchoFecha}; max-width:${anchoFecha}; height:26px; white-space:nowrap; overflow:hidden;">${diaF}/${mesF}</td>`;
        html += `<td style="${estiloFila} font-weight:bold; border:1px solid #cbd5e1; padding:2px 1px; text-align:center; position:sticky; left:${anchoFecha}; z-index:2; font-size:9px; width:${anchoDia}; min-width:${anchoDia}; max-width:${anchoDia}; height:26px; white-space:nowrap; overflow:hidden;">${nombreDia}</td>`;

        columnas.forEach(emp => {
            const info = infoTurno(iso, emp);
            html += `
                <td style="text-align:center; padding:1px; height:26px; border:1px solid #cbd5e1; overflow:hidden;">
                    <button class="td-celda-turno ${info.clase}" data-fecha="${iso}" data-emp="${esc(emp.id)}" style="width:100%; height:100%; border:none; cursor:pointer; font-weight:bold; font-size:10px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:3px;" title="${esc(emp.nombre)} | ${formatearFecha(iso)} (${nombreDia}) : ${esc(info.texto)}">
                        ${esc(inicial(info))}
                    </button>
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
        if (btn) {
            btn.style.background = abrir ? "#1f4e79" : "#e2e8f0";
            btn.style.color = abrir ? "#ffffff" : "#1e293b";
        }
    });
}
