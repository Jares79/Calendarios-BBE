// --- BÚSQUEDA POR DÍA (Moderna y en tarjetas) ---
function pintar(nombre, info){
    return `
        <div class="tarjeta-resultado">
            <span class="nombre-empleado">${nombre}</span>
            <span class="badge-turno ${info.clase}">${info.texto}</span>
        </div>
    `;
}

function agregarResumen(resumen, nombre, turno){
    if(!resumen[turno]){
        resumen[turno] = [];
    }
    resumen[turno].push(nombre);
}

function consultar(){
    ocultarDetalleDia();

    const valor = document.getElementById("fecha").value;

    if(!valor){
        alert("Selecciona una fecha");
        return;
    }

    const fecha = new Date(valor + "T00:00:00");
    let resumen = {};

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2>🔍 Búsqueda: ${valor}</h2>
            <button onclick="cerrarVistaResultado()" style="background:#64748b; padding:8px 14px; font-size:13px;">✖ Volver</button>
        </div>
    `;

    html += "<h3>👨‍✈️ Jefes de Turno</h3><div class='resultado-grid'>";
    jefes.forEach(j => {
        let info = obtenerInfoJT(fecha, j.inicio);
        html += pintar(j.name, info);
        agregarResumen(resumen, j.name, info.texto);
    });
    html += "</div>";

    html += "<h3 style='margin-top:20px;'>🎛️ Operadores de Control</h3><div class='resultado-grid'>";
    control.forEach(o => {
        let info = obtenerInfoOP(fecha, o.inicio);
        html += pintar(o.name, info);
        agregarResumen(resumen, o.name, info.texto);
    });
    html += "</div>";

    html += "<h3 style='margin-top:20px;'>🔧 Operadores de Campo</h3><div class='resultado-grid'>";
    campo.forEach(o => {
        let info = obtenerInfoOP(fecha, o.inicio);
        html += pintar(o.name, info);
        agregarResumen(resumen, o.name, info.texto);
    });
    html += "</div>";

    html += "<hr style='margin:25px 0; border:0; border-top:1px solid #e2e8f0;'>";
    html += "<h3>📋 Resumen Diario</h3>";

    const orden = ["Semana X", "Semana Y", "Mañana", "Tarde", "Noche", "Partida", "Intensiva", "Fiesta"];
    orden.forEach(turno => {
        if(!resumen[turno]) return;
        html += `<div style="font-size:14px; color:#1f4e79; margin-top:8px; font-weight:bold;">• ${turno}:</div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; margin-bottom:8px;">`;
        resumen[turno].forEach(persona => {
            html += `<span style="background:#e8f1fb; color:#1f4e79; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold;">${persona}</span>`;
        });
        html += `</div>`;
    });

    const contenedorResultado = document.getElementById("resultado");
    contenedorResultado.innerHTML = html;
    contenedorResultado.style.display = "block";
    contenedorResultado.style.width = "100%";
    document.getElementById("cardCalendario").style.display = "none";
    window.scrollTo(0, 0);
}

function cerrarVistaResultado(){
    ocultarDetalleDia();
    
    document.getElementById("resultado").style.display = "none";
    document.getElementById("cardCalendario").style.display = "block";
    window.scrollTo(0, 0);
}

function ocultarDetalleDia(){
    const panelDetalle = document.getElementById("panelDetalleDia");
    if(panelDetalle){
        panelDetalle.style.display = "none";
    }
}


// --- GESTIÓN DE CLIC EN DÍA ( TARJETA DE DETALLE UNIFICADA ARRIBA DEL TODO ) ---
function seleccionarDia(fechaStr, empleadoNombre, puestoTexto, turnoTexto, claseTurno){
    let panelDetalle = document.getElementById("panelDetalleDia");
    
    if(!panelDetalle){
        panelDetalle = document.createElement("div");
        panelDetalle.id = "panelDetalleDia";
        panelDetalle.className = "card";
        panelDetalle.style.cssText = "border-left: 5px solid #0ea5e9; background: #f8fafc; margin-bottom: 20px;";
    }

    panelDetalle.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #1f4e79;">📌 Detalle del Día</h3>
            <button onclick="ocultarDetalleDia()" style="background:#64748b; padding:4px 10px; font-size:12px;">✖ Cerrar</button>
        </div>
        <div style="margin-top: 10px; font-size: 14px; color: #334155;">
            <p><strong>Fecha:</strong> ${fechaStr}</p>
            <p><strong>Empleado:</strong> ${empleadoNombre} <span style="color: #64748b; font-weight: normal;">(${puestoTexto})</span></p>
            <p><strong>Turno:</strong> <span class="badge-turno ${claseTurno}" style="padding: 2px 8px; border-radius: 4px; display: inline-block;">${turnoTexto}</span></p>
            <p style="color: #64748b; font-style: italic; margin-top: 8px;">💡 (Espacio reservado para futuras propiedades).</p>
        </div>
    `;

    // Forzamos la inserción siempre como primer hijo de la tarjeta principal para que quede arriba del todo
    const cardCalendario = document.getElementById("cardCalendario");
    const resultado = document.getElementById("resultado");
    
    if (resultado && resultado.style.display === "block") {
        resultado.insertBefore(panelDetalle, resultado.firstChild);
    } else if (cardCalendario) {
        cardCalendario.insertBefore(panelDetalle, cardCalendario.firstChild);
    } else {
        document.body.insertBefore(panelDetalle, document.body.firstChild);
    }

    panelDetalle.style.display = "block";
    panelDetalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// --- UTILIDADES ---
function colorCelda(clase){
    switch(clase){
        case "manana": return "#38bdf8";
        case "tarde": return "#0284c7";
        case "noche": return "#9333ea";
        case "fiesta": return "#e11d48";
        case "partida": return "#64748b";
        case "intensiva": return "#cbd5e1";
        case "semanax": return "#ca8a04";
        case "semanay": return "#64748b";
        default: return "white";
    }
}

function inicial(info){
    switch(info.texto){
        case "Mañana": return "M";
        case "Tarde": return "T";
        case "Noche": return "N";
        case "Fiesta": return "F";
        case "Partida": return "P";
        case "Intensiva": return "I";
        case "Semana X": return "X";
        case "Semana Y": return "Y";
        default: return "?";
    }
}


// --- CALENDARIO ANUAL (POR COLECTIVOS O MAESTRO) ---
function verCalendario(anioParam){
    ocultarDetalleDia();

    const selectAnio = document.getElementById("anioAnualSelect");
    const anio = Number(anioParam) || (selectAnio ? Number(selectAnio.value) : new Date().getFullYear());
    
    const selectColectivo = document.getElementById("colectivoAnual");
    const tipoColectivo = selectColectivo ? selectColectivo.value : (window.innerWidth <= 768 ? "jefes" : "todos");

    let empleadosAProcesar = [];
    let tituloVista = "";
    let iconoPuesto = "👨‍✈️ Jefe de Turno";

    if(tipoColectivo === "jefes"){
        empleadosAProcesar = jefes.map(e => ({ ...e, esJT: true }));
        tituloVista = "👨‍✈️ Jefes de Turno";
        iconoPuesto = "👨‍✈️ Jefe de Turno";
    } else if(tipoColectivo === "control"){
        empleadosAProcesar = control.map(e => ({ ...e, esJT: false }));
        tituloVista = "🎛️ Operadores de Control";
        iconoPuesto = "🎛️ Operador de Control";
    } else if(tipoColectivo === "campo"){
        empleadosAProcesar = campo.map(e => ({ ...e, esJT: false }));
        tituloVista = "🔧 Operadores de Campo";
        iconoPuesto = "🔧 Operador de Campo";
    } else {
        empleadosAProcesar = [
            ...control.map(e => ({ ...e, esJT: false })),
            ...campo.map(e => ({ ...e, esJT: false })),
            ...jefes.map(e => ({ ...e, esJT: true }))
        ];
        tituloVista = "Planificación Anual Formato Maestro";
        iconoPuesto = "⭐ Empleado";
    }

    let opcionesAniosHtml = "";
    for(let a = 2026; a <= 2050; a++){
        opcionesAniosHtml += `<option value="${a}" ${anio === a ? 'selected' : ''}>${a}</option>`;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
            <h2>📅 ${tituloVista} (${anio})</h2>
            <div style="display:flex; gap:10px; align-items:center;">
                <label style="font-weight:bold; color:#1f4e79;">Año:</label>
                <select id="anioAnualSelect" style="padding:6px; border-radius:6px; border:1px solid #ccc;" onchange="cambiarAnioAnual(this.value)">
                    ${opcionesAniosHtml}
                </select>
                <button onclick="cerrarVistaResultado()" style="background:#64748b; padding:8px 14px; font-size:13px;">✖ Volver</button>
            </div>
        </div>
        <p style="color:#666; font-size:13px; margin-bottom:15px;">
            ℹ️ Vista anual optimizada. Desliza para explorar todo el año.
        </p>
    `;

    html += `<div class="table-responsive" style="max-height:82vh; width:100%; border:1px solid #cbd5e1; border-radius:8px;">`;
    html += `<table class="tabla-anual-unificada" style="width:100%;">`;
    html += `<thead><tr>`;
    
    html += `<th class="th-vertical" style="left:0; z-index:4; min-width:70px; width:70px; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:11px; padding: 10px 4px;">Fecha</th>`;
    html += `<th class="th-vertical" style="left:70px; z-index:4; min-width:75px; width:75px; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:11px; padding: 10px 4px;">Día</th>`;

    empleadosAProcesar.forEach(emp => {
        html += `<th class="th-vertical" style="min-width:38px; width:38px;">${emp.name}</th>`;
    });

    html += `</tr></thead><tbody>`;

    const diasSemanaNombres = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    let fechaIterador = new Date(anio, 0, 1);
    const fechaFin = new Date(anio, 11, 31);

    while(fechaIterador <= fechaFin){
        const anioF = fechaIterador.getFullYear();
        const mesF = String(fechaIterador.getMonth() + 1).padStart(2, '0');
        const diaF = String(fechaIterador.getDate()).padStart(2, '0');
        const fechaFormateada = `${diaF}/${mesF}/${anioF}`;
        const nombreDiaSemana = diasSemanaNombres[fechaIterador.getDay()];

        const esFinDeSemana = (fechaIterador.getDay() === 0 || fechaIterador.getDay() === 6);
        const estiloFilaFija = esFinDeSemana ? `background:#f1f5f9; color:#64748b;` : `background:#f8fafc;`;

        html += `<tr>`;

        html += `<td style="${estiloFilaFija} font-weight:bold; border:1px solid #cbd5e1; padding:6px 4px; text-align:center; position:sticky; left:0; z-index:2; white-space:nowrap; font-size:11px; min-width:70px; width:70px; height:32px;">${fechaFormateada}</td>`;
        html += `<td style="${estiloFilaFija} font-weight:bold; border:1px solid #cbd5e1; padding:6px 4px; text-align:center; position:sticky; left:70px; z-index:2; white-space:nowrap; font-size:11px; min-width:75px; width:75px; height:32px;">${nombreDiaSemana}</td>`;

        empleadosAProcesar.forEach(emp => {
            const info = emp.esJT 
                ? obtenerInfoJT(fechaIterador, emp.inicio) 
                : obtenerInfoOP(fechaIterador, emp.inicio);

            let puestoEmp = emp.esJT ? "👨‍✈️ Jefe de Turno" : (tipoColectivo === "control" ? "🎛️ Operador de Control" : (tipoColectivo === "campo" ? "🔧 Operador de Campo" : iconoPuesto));

            html += `
                <td style="text-align:center; padding:2px; min-width:38px; width:38px; height:32px; border:1px solid #cbd5e1;">
                    <button class="td-celda-turno ${info.clase}" onclick="seleccionarDia('${fechaFormateada}', '${emp.name}', '${puestoEmp}', '${info.texto}', '${info.clase}')" style="width:100%; height:100%; border:none; cursor:pointer; font-weight:bold; font-size:12px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:6px;" title="${emp.name} | ${fechaFormateada} (${nombreDiaSemana}) : ${info.texto}">
                        ${inicial(info)}
                    </button>
                </td>
            `;
        });

        html += `</tr>`;
        fechaIterador.setDate(fechaIterador.getDate() + 1);
    }

    html += `</tbody></table></div>`;

    const contenedorResultado = document.getElementById("resultado");
    contenedorResultado.innerHTML = html;
    contenedorResultado.style.display = "block";
    contenedorResultado.style.width = "100%";
    document.getElementById("cardCalendario").style.display = "none";
    window.scrollTo(0, 0);
}

function cambiarAnioAnual(nuevoAnio){
    verCalendario(nuevoAnio);
}