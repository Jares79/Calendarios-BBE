let fechaCalendario = new Date();
let inicioTouchX = 0;
let finTouchX = 0;
let inicioTouchY = 0;
let finTouchY = 0;
let swipeActivo = false;

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

    const empleado = jefes.find(
        j => j.name === usuarioActual.empleado
    );

    if (!empleado) {
        alert("Empleado no encontrado");
        return;
    }

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

    let iconoPuestoRol = "👨‍✈️ Jefe de Turno";
    const rolLower = (usuarioActual.rol || "").toLowerCase();
    if(rolLower.includes("control")){
        iconoPuestoRol = "🎛️ Operador de Control";
    } else if(rolLower.includes("campo")){
        iconoPuestoRol = "🔧 Operador de Campo";
    }

    for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = new Date(anio, mes, dia);
        const info = obtenerInfoJT(fecha, empleado.inicio);

        const anioF = fecha.getFullYear();
        const mesF = String(fecha.getMonth() + 1).padStart(2, '0');
        const diaF = String(fecha.getDate()).padStart(2, '0');
        const fechaStr = `${diaF}/${mesF}/${anioF}`;

        html += `
            <button type="button" class="dia-calendario ${info.clase}" onclick="seleccionarDia('${fechaStr}', '${empleado.name}', '${iconoPuestoRol}', '${info.texto}', '${info.clase}')">
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

// Variable global para bloquear rebotes de doble clic
let _bloqueoToggleUsuario = false;

function toggleUsuario(){
    if(typeof ocultarDetalleDia === 'function'){
        ocultarDetalleDia();
    }

    const panel = document.getElementById("panelUsuario");
    const cabecera = document.getElementById("infoUsuario");

    if(!panel || !cabecera) return;

    // Leemos el estado real actual
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
    
    // 1. Ejecutamos la búsqueda
    consultar();
    
    // 2. Ocultamos el panel principal y la subsección de búsqueda
    if(panel) panel.style.display = 'none';
    if(secBusqueda) secBusqueda.style.display = 'none';
    
    // 3. Restauramos la flechita de la cabecera para que apunte hacia abajo (▼)
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

// --- GESTIÓN GLOBAL DE CLICS FUERA (LIMPIO Y SIN INTERFERENCIAS) ---
document.addEventListener('click', function(event) {
    // 1. Cerrar selector de mes si se hace clic fuera
    const selectorMes = document.getElementById('selectorMes');
    const tituloMes = document.getElementById('tituloMes');
    if (selectorMes && selectorMes.style.display === 'block') {
        if (!selectorMes.contains(event.target) && !tituloMes.contains(event.target)) {
            selectorMes.style.display = 'none';
        }
    }

    // 2. Cerrar el panel de detalle del día si se hace clic fuera de él
    const panelDetalle = document.getElementById('panelDetalleDia');
    if (panelDetalle) {
        const esDentroDelPanel = panelDetalle.contains(event.target);
        const esBotonCalendario = event.target.closest('.dia-calendario') || event.target.closest('.td-celda-turno');
        
        if (!esDentroDelPanel && !esBotonCalendario) {
            ocultarDetalleDia();
        }
    }

    // 3. Cerrar el panel de usuario si está abierto y se hace clic fuera de él o de su cabecera
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

// Enlazamos el evento de apertura/cierre de la cabecera de usuario de forma exclusiva
document.addEventListener('DOMContentLoaded', () => {
    const contenedorUsuario = document.querySelector('.usuarioCabecera');
    if (contenedorUsuario) {
        contenedorUsuario.addEventListener('click', function(e) {
            // Si hacen clic en cerrar sesión, dejamos que actúe su propio onclick
            if (e.target.closest('.cerrarSesion')) return;

            // Evitamos que el clic suba al documento global y dispare el cierre inmediato
            e.stopPropagation();

            toggleUsuario();
        });
    }
});