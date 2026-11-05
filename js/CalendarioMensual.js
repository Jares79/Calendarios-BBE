let fechaCalendario = new Date();
let inicioTouchX = 0;
let finTouchX = 0;
let inicioTouchY = 0;
let finTouchY = 0;
let swipeActivo = false;

// Función robusta para encontrar al empleado vinculando Supabase con los arrays de empleados.js por iniciales
function obtenerDatosEmpleadoActual() {
    const inicialesUser = (usuarioActual.iniciales || "").replace('_F', '').trim().toLowerCase();
    const empleadoAsoc = (usuarioActual.empleadoAsociado || "").replace('_F', '').trim().toLowerCase();
    const nombreUser = (usuarioActual.nombre || "").trim().toLowerCase();

    const coincide = (emp) => {
        const eNombre = (emp.name || "").trim().toLowerCase();
        const eIniciales = (emp.iniciales || "").trim().toLowerCase();
        return (eIniciales && (eIniciales === inicialesUser || eIniciales === empleadoAsoc)) ||
               (eNombre === nombreUser || eNombre === inicialesUser || eNombre === empleadoAsoc);
    };

    // 1. Buscar en Jefes
    let encontrado = jefes.find(j => coincide(j));
    if (encontrado) return { ...encontrado, esJT: true, tipoPuesto: "👨‍✈️ Jefe de Turno" };

    // 2. Buscar en Control
    encontrado = control.find(o => coincide(o));
    if (encontrado) return { ...encontrado, esJT: false, tipoPuesto: "🎛️ Operador de Control" };

    // 3. Buscar en Campo
    encontrado = campo.find(c => coincide(c));
    if (encontrado) return { ...encontrado, esJT: false, tipoPuesto: "🔧 Operador de Campo" };

   // Red de seguridad para evitar que la aplicación se rompa si faltara algún dato
    console.warn("⚠️ Usuario no encontrado en los arrays de empleados:", usuarioActual);
    return { name: usuarioActual.nombre || "Desconocido", inicio: "2026-01-01", esJT: true, tipoPuesto: "👨‍✈️ Jefe de Turno" };
}

function verMiCalendario() {
    const anio = fechaCalendario.getFullYear();
    const mes = fechaCalendario.getMonth();

    let nombreMes = fechaCalendario.toLocaleDateString(
        "es-ES",
        {
            month:"long",
            year:"numeric"
        }
    );

    nombreMes = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    document.getElementById("tituloMes").textContent = nombreMes;

    // Obtenemos el empleado de forma robusta y dinámica
    const empleado = obtenerDatosEmpleadoActual();

    const diasMes = new Date(anio, mes + 1, 0).getDate();

    let html = `
    <div class="calendario-grid">
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

    for(let i = 0; i < primerDia; i++){
        html += `<div></div>`;
    }

    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(anio, mes, dia);
        
        // Calcula el turno exacto según su patrón (JT u OP)
        const info = empleado.esJT 
            ? obtenerInfoJT(fecha, empleado.inicio) 
            : obtenerInfoOP(fecha, empleado.inicio);

        const anioF = fecha.getFullYear();
        const mesF = String(fecha.getMonth() + 1).padStart(2, '0');
        const diaF = String(fecha.getDate()).padStart(2, '0');
        const fechaStr = `${diaF}/${mesF}/${anioF}`;

        html += `
            <button type="button" class="dia-calendario ${info.clase}" onclick="seleccionarDia('${fechaStr}', '${empleado.name}', '${empleado.tipoPuesto}', '${info.texto}', '${info.clase}')">
                <span class="numero-dia">${dia}</span>
                <span class="turno-dia">${inicial(info)}</span>
            </button>
        `;
    }

    html += `</div>`;

    document.getElementById("miCalendario").innerHTML = html;
    const calendario = document.getElementById("miCalendario");

    if(!swipeActivo){
        calendario.addEventListener(
            "touchstart",
            function(e){
                inicioTouchX = e.changedTouches[0].screenX;
                inicioTouchY = e.changedTouches[0].screenY;
            }
        );

        calendario.addEventListener(
            "touchend",
            function(e){
                finTouchX = e.changedTouches[0].screenX;
                finTouchY = e.changedTouches[0].screenY;
                manejarSwipe();
            }
        );

        swipeActivo = true;
    }
}

function mesAnterior(){
    fechaCalendario.setMonth(fechaCalendario.getMonth() - 1);
    verMiCalendario();
}

function mesSiguiente(){
    fechaCalendario.setMonth(fechaCalendario.getMonth() + 1);
    verMiCalendario();
}

function manejarSwipe(){
    const diferenciaX = inicioTouchX - finTouchX;
    const diferenciaY = inicioTouchY - finTouchY;

    if(Math.abs(diferenciaY) > Math.abs(diferenciaX)) return;
    if(Math.abs(diferenciaX) < 50) return;

    const calendario = document.getElementById("miCalendario");
    calendario.classList.add("calendario-animando");

    setTimeout(function(){
        if(diferenciaX > 0){
            mesSiguiente();
        }else{
            mesAnterior();
        }
        calendario.classList.remove("calendario-animando");
    },200);
}

function mostrarSelectorMes(){
    document.getElementById("mesSelector").value = fechaCalendario.getMonth();
    document.getElementById("anioSelector").value = fechaCalendario.getFullYear();

    const selector = document.getElementById("selectorMes");
    if(selector.style.display === "block"){
        selector.style.display = "none";
    }else{
        selector.style.display = "block";
    }
}

function aplicarMes(){
    const mes = Number(document.getElementById("mesSelector").value);
    const anio = Number(document.getElementById("anioSelector").value);

    fechaCalendario = new Date(anio, mes, 1);
    verMiCalendario();
    document.getElementById("selectorMes").style.display = "none";
}

function irAHoy(){
    fechaCalendario = new Date();
    verMiCalendario();
    document.getElementById("selectorMes").style.display = "none";
}

function cerrarSesion(){
    console.log("Cerrar sesión pendiente");
}

let _bloqueoToggleUsuario = false;

function toggleUsuario(){
    if(typeof ocultarDetalleDia === 'function'){
        ocultarDetalleDia();
    }

    const panel = document.getElementById("panelUsuario");
    const cabecera = document.getElementById("infoUsuario");

    if(!panel || !cabecera) return;

    const currentDisplay = window.getComputedStyle(panel).display;
    const estaAbierto = currentDisplay === "block";

    if(estaAbierto){
        panel.style.display = "none";
        if(typeof usuarioActual !== 'undefined'){
            cabecera.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▼";
        }
    } else {
        panel.style.display = "block";
        if(typeof usuarioActual !== 'undefined'){
            cabecera.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▲";
        }

        const inputFecha = document.getElementById("fecha");
        if(inputFecha && !inputFecha.value){
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');
            inputFecha.value = `${yyyy}-${mm}-${dd}`;
        }

        const selectColectivo = document.getElementById("colectivoAnual");
        if(selectColectivo){
            const esMovil = window.innerWidth <= 768;
            selectColectivo.value = esMovil ? "jefes" : "todos";
        }
    }
}

function ejecutarBusquedaDesdeMenu(){
    const panel = document.getElementById("panelUsuario");
    const cabecera = document.getElementById("infoUsuario");
    const secBusqueda = document.getElementById("seccionBusqueda");
    
    consultar();
    
    if(panel) panel.style.display = 'none';
    if(secBusqueda) secBusqueda.style.display = 'none';
    
    if(cabecera && typeof usuarioActual !== 'undefined') {
        cabecera.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▼";
    }
}

function verCalendarioDesdeMenu(){
    const panel = document.getElementById("panelUsuario");
    const cabecera = document.getElementById("infoUsuario");
    const selectAnio = document.getElementById("anioAnualSelect");
    const anioVal = selectAnio ? selectAnio.value : new Date().getFullYear();
    
    if(panel) panel.style.display = 'none';
    if(cabecera && typeof usuarioActual !== 'undefined') {
        cabecera.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▼";
    }

    document.getElementById('cardCalendario').style.display = 'none';
    const res = document.getElementById('resultado');
    res.style.display = 'block';
    
    verCalendario(anioVal);
    window.scrollTo(0, 0);
}

// Función precisa: solo devuelve true si las iniciales terminan estrictamente en _f
function esPerfilFamiliar() {
    if (typeof usuarioActual === 'undefined' || !usuarioActual) return false;
    const iniciales = (usuarioActual.iniciales || "").trim().toLowerCase();
    return iniciales.endsWith('_f');
}

document.addEventListener('click', function(event) {
    const selectorMes = document.getElementById('selectorMes');
    const tituloMes = document.getElementById('tituloMes');
    if (selectorMes && selectorMes.style.display === 'block') {
        if (!selectorMes.contains(event.target) && !tituloMes.contains(event.target)) {
            selectorMes.style.display = 'none';
        }
    }

    const panelDetalle = document.getElementById('panelDetalleDia');
    if (panelDetalle) {
        const esDentroDelPanel = panelDetalle.contains(event.target);
        const esBotonCalendario = event.target.closest('.dia-calendario') || event.target.closest('.td-celda-turno');
        
        if (!esDentroDelPanel && !esBotonCalendario) {
            ocultarDetalleDia();
        }
    }

    const panelUsuario = document.getElementById('panelUsuario');
    const usuarioCabecera = document.querySelector('.usuarioCabecera');
    if (panelUsuario && (panelUsuario.style.display === 'block' || panelUsuario.classList.contains('abierto'))) {
        const esDentroPanel = panelUsuario.contains(event.target);
        const esDentroCabecera = usuarioCabecera && usuarioCabecera.contains(event.target);
        
        if (!esDentroPanel && !esDentroCabecera) {
            panelUsuario.style.display = 'none';
            panelUsuario.classList.remove('abierto');
            const cabeceraUsuario = document.getElementById('infoUsuario');
            if (cabeceraUsuario && typeof usuarioActual !== 'undefined') {
                cabeceraUsuario.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▼";
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Si es perfil familiar estricto, ocultamos el panel y añadimos la etiqueta de familiar
    if (esPerfilFamiliar()) {
        const panelUsuario = document.getElementById('panelUsuario');
        if (panelUsuario) {
            panelUsuario.style.display = 'none';
        }
        const infoUsr = document.getElementById('infoUsuario');
        if (infoUsr && typeof usuarioActual !== 'undefined') {
            infoUsr.innerHTML = `👤 <strong>${usuarioActual.nombre}</strong> (Familiar)`;
        }
    }

    const contenedorUsuario = document.querySelector('.usuarioCabecera');
    if (contenedorUsuario) {
        contenedorUsuario.addEventListener('click', function(e) {
            if (e.target.closest('.cerrarSesion')) return;
            
            // Si es perfil familiar, bloqueamos la apertura del menú desplegable
            if (esPerfilFamiliar()) {
                e.stopPropagation();
                return;
            }

            e.stopPropagation();
            toggleUsuario();
        });
    }
});