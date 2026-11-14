// js/datos.js
// Datos de la plantilla (colectivos y empleados), leídos de Supabase tras iniciar sesión,
// y utilidades comunes para pintar texto de forma segura.

const ANIO_MIN = 2025;
const ANIO_MAX = 2035;

// colectivos = [{ codigo, nombre, icono, puesto, patron, diasSolape, empleados: [{ id, nombre, iniciales, inicio, colectivo, activo, orden }] }]
// Los empleados dados de baja solo los ve el administrador, y no aparecen en los calendarios.
let colectivos = [];

async function cargarDatos() {
    const [rc, re] = await Promise.all([
        supabaseClient.from("colectivos").select("*").order("orden"),
        supabaseClient.from("empleados").select("*").order("orden")
    ]);
    if (rc.error || re.error) {
        console.error("Error al cargar datos:", rc.error || re.error);
        return false;
    }

    colectivos = rc.data.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        icono: c.icono,
        puesto: c.puesto,
        patron: c.patron,
        diasSolape: c.dias_solape,
        empleados: re.data
            .filter(e => e.colectivo === c.codigo)
            .map(e => ({
                id: e.id,
                nombre: e.nombre,
                iniciales: e.iniciales,
                inicio: e.inicio,
                colectivo: e.colectivo,
                activo: e.activo,
                orden: e.orden
            }))
    }));
    return true;
}

function buscarColectivo(codigo) {
    return colectivos.find(c => c.codigo === codigo) || null;
}

function buscarEmpleadoPorId(id) {
    for (const c of colectivos) {
        const e = c.empleados.find(emp => emp.id === id);
        if (e) return e;
    }
    return null;
}

// Empleados activos de un colectivo (los que salen en calendarios y búsquedas)
function empleadosActivos(colectivo) {
    return colectivo.empleados.filter(e => e.activo);
}

// Escapa texto antes de meterlo en un trozo de HTML
function esc(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Crea un elemento del DOM sin pasar por innerHTML (el texto nunca se interpreta como HTML)
// el("button", { class: "x", text: "Hola", onclick: fn }, hijo1, hijo2)
function el(etiqueta, props = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(props)) {
        if (valor === null || valor === undefined || valor === false) continue;
        if (clave === "class") nodo.className = valor;
        else if (clave === "text") nodo.textContent = valor;
        else if (clave === "style") nodo.style.cssText = valor;
        else if (clave.startsWith("on") && typeof valor === "function") nodo.addEventListener(clave.slice(2), valor);
        else if (clave === "value") nodo.value = valor;
        else nodo.setAttribute(clave, valor === true ? "" : valor);
    }
    hijos.flat().forEach(h => {
        if (h === null || h === undefined || h === false) return;
        nodo.append(h.nodeType ? h : document.createTextNode(String(h)));
    });
    return nodo;
}

// Rellena un <select> con los años permitidos
function rellenarAnios(select, seleccionado) {
    if (!select) return;
    select.innerHTML = "";
    for (let a = ANIO_MIN; a <= ANIO_MAX; a++) {
        select.append(el("option", { value: a, text: a, selected: a === seleccionado }));
    }
    select.value = String(seleccionado);
}
