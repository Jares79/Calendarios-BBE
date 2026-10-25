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
        panelDetalle.remove();
    }
}

// --- GESTIÓN DE CLIC EN DÍA (Corregido el error de undefined) ---
function seleccionarDia(fechaStr, empleadoNombre, puestoTexto, turnoTexto, claseTurno){
    ocultarDetalleDia();

    // Convertimos la fechaStr (DD/MM/YYYY) a objeto Date para buscar coincidencias
    const partesFecha = fechaStr.split('/');
    const fechaObj = new Date(`${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}T00:00:00`);

    // Buscamos compañeros que tengan el mismo turno (si es M, T o N)
    let compisMismoTurno = [];
    
    if (["Mañana", "Tarde", "Noche"].includes(turnoTexto)) {
        // Revisar Jefes
        jefes.forEach(j => {
            if (j.name !== empleadoNombre) {
                let infoJ = obtenerInfoJT(fechaObj, j.inicio);
                if (infoJ.texto === turnoTexto) {
                    compisMismoTurno.push({ nombre: j.name, simbolo: "👨‍✈️" });
                }
            }
        });
        // Revisar Control
        control.forEach(o => {
            if (o.name !== empleadoNombre) {
                let infoO = obtenerInfoOP(fechaObj, o.inicio);
                if (infoO.texto === turnoTexto) {
                    compisMismoTurno.push({ nombre: o.name, simbolo: "🎛️" });
                }
            }
        });
        // Revisar Campo
        campo.forEach(o => {
            if (o.name !== empleadoNombre) {
                let infoO = obtenerInfoOP(fechaObj, o.inicio);
                if (infoO.texto === turnoTexto) {
                    compisMismoTurno.push({ nombre: o.name, simbolo: "🔧" });
                }
            }
        });
    }

    let panelDetalle = document.createElement("div");
    panelDetalle.id = "panelDetalleDia";
    panelDetalle.className = "card";
    panelDetalle.style.cssText = "border-left: 5px solid #0ea5e9; background: #f8fafc; margin-bottom: 15px; padding: 12px 16px;";

    let htmlCompis = "";
    if (compisMismoTurno.length > 0) {
        // Usamos c.nombre en lugar de c.name
        let listaCompis = compisMismoTurno.map(c => `${c.simbolo} ${c.nombre}`).join(" - ");
        htmlCompis = `
            <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                <p style="margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Compañeros de turno:</strong> ${listaCompis}</p>
            </div>
        `;
    }

    panelDetalle.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <h3 style="margin: 0; color: #1f4e79; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                📅 ${fechaStr} 
                <span style="font-weight: normal; color: #64748b; font-size: 0.85rem;">—</span>
                <span class="badge-turno ${claseTurno}" style="padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; display: inline-block;">${turnoTexto}</span>
            </h3>
            <button onclick="ocultarDetalleDia()" style="background:#64748b; padding:2px 8px; font-size:11px; border-radius: 4px;">✖ Cerrar</button>
        </div>
        <div style="font-size: 13.5px; color: #334155; display: flex; flex-direction: column; gap: 4px;">
            <p style="margin: 0;"><strong>Empleado:</strong> ${empleadoNombre} (${puestoTexto})</p>
            ${htmlCompis}
        </div>
    `;

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
    // Subimos suavemente la ventana principal para que la tarjeta se vea justo debajo de la cabecera
    window.scrollTo({ top: 0, behavior: 'smooth' });
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


// --- CALENDARIO ANUAL COMPACTO Y AJUSTADO SIN SCROLL ---
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
        tituloVista = "Planificación Anual Maestro";
        iconoPuesto = "⭐ Empleado";
    }

    let opcionesAniosHtml = "";
    for(let a = 2026; a <= 2050; a++){
        opcionesAniosHtml += `<option value="${a}" ${anio === a ? 'selected' : ''}>${a}</option>`;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h2 style="font-size:1.1rem; margin:0;">📅 ${tituloVista} (${anio})</h2>
            <div style="display:flex; gap:8px; align-items:center;">
                <select id="anioAnualSelect" style="padding:4px 8px; border-radius:6px; border:1px solid #ccc; font-size:0.85rem;" onchange="cambiarAnioAnual(this.value)">
                    ${opcionesAniosHtml}
                </select>
                <button onclick="cerrarVistaResultado()" style="background:#64748b; padding:6px 12px; font-size:12px;">✖ Volver</button>
            </div>
        </div>
    `;

    const esMovil = window.innerWidth <= 768;

    const anchoFecha = esMovil ? "11%" : "75px";
    const anchoDia = esMovil ? "10%" : "75px";

    html += `<div style="max-height:82vh; width:100%; overflow-x:hidden; overflow-y:auto; border:1px solid #cbd5e1; border-radius:8px; background:white;">`;
    html += `<table class="tabla-anual-unificada" style="width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0;">`;
    html += `<thead><tr>`;
    
    html += `<th class="th-vertical" style="left:0; z-index:4; width:${anchoFecha}; min-width:${anchoFecha}; max-width:${anchoFecha}; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:9px; padding: 4px 0px;">Fecha</th>`;
    html += `<th class="th-vertical" style="left:${anchoFecha}; z-index:4; width:${anchoDia}; min-width:${anchoDia}; max-width:${anchoDia}; writing-mode:horizontal-tb; transform:none; height:auto; text-align:center; font-size:9px; padding: 4px 0px;">Día</th>`;

    empleadosAProcesar.forEach(emp => {
        html += `<th class="th-vertical" style="font-size:9px; padding: 4px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${emp.name}</th>`;
    });

    html += `</tr></thead><tbody>`;

    const diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const diasLargos = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    let fechaIterador = new Date(anio, 0, 1);
    const fechaFin = new Date(anio, 11, 31);

    while(fechaIterador <= fechaFin){
        const anioF = fechaIterador.getFullYear();
        const mesF = String(fechaIterador.getMonth() + 1).padStart(2, '0');
        const diaF = String(fechaIterador.getDate()).padStart(2, '0');
        
        const fechaVistaMovil = `${diaF}/${mesF}`;
        const fechaFormateada = `${diaF}/${mesF}/${anioF}`;
        const nombreDiaSemana = esMovil ? diasCortos[fechaIterador.getDay()] : diasLargos[fechaIterador.getDay()];

        const esFinDeSemana = (fechaIterador.getDay() === 0 || fechaIterador.getDay() === 6);
        const estiloFilaFija = esFinDeSemana ? `background:#e2e8f0; color:#475569;` : `background:#f8fafc;`;

        html += `<tr>`;

        html += `<td style="${estiloFilaFija} font-weight:bold; border:1px solid #cbd5e1; padding:2px 1px; text-align:center; position:sticky; left:0; z-index:2; font-size:9px; width:${anchoFecha}; min-width:${anchoFecha}; max-width:${anchoFecha}; height:26px; white-space:nowrap; overflow:hidden;">${fechaVistaMovil}</td>`;
        html += `<td style="${estiloFilaFija} font-weight:bold; border:1px solid #cbd5e1; padding:2px 1px; text-align:center; position:sticky; left:${anchoFecha}; z-index:2; font-size:9px; width:${anchoDia}; min-width:${anchoDia}; max-width:${anchoDia}; height:26px; white-space:nowrap; overflow:hidden;">${nombreDiaSemana}</td>`;

        empleadosAProcesar.forEach(emp => {
            const info = emp.esJT 
                ? obtenerInfoJT(fechaIterador, emp.inicio) 
                : obtenerInfoOP(fechaIterador, emp.inicio);

            let puestoEmp = emp.esJT ? "👨‍✈️ Jefe de Turno" : (tipoColectivo === "control" ? "🎛️ Operador de Control" : (tipoColectivo === "campo" ? "🔧 Operador de Campo" : iconoPuesto));

            html += `
                <td style="text-align:center; padding:1px; height:26px; border:1px solid #cbd5e1; overflow:hidden;">
                    <button class="td-celda-turno ${info.clase}" onclick="seleccionarDia('${fechaFormateada}', '${emp.name}', '${puestoEmp}', '${info.texto}', '${info.clase}')" style="width:100%; height:100%; border:none; cursor:pointer; font-weight:bold; font-size:10px; display:flex; align-items:center; justify-content:center; padding:0; border-radius:3px;" title="${emp.name} | ${fechaFormateada} (${nombreDiaSemana}) : ${info.texto}">
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