// js/datos.js
// Datos de la plantilla (colectivos y empleados), leídos de Supabase tras iniciar sesión,
// y utilidades comunes para pintar texto de forma segura.

const ANIO_MIN = 2025;
const ANIO_MAX = 2035;

// Categorías en las que se agrupan los colectivos (subgrupos): Personal a turnos y Personal de jornada partida.
// La categoría se deduce del tipo: los colectivos de turnos van juntos y todo lo demás (correturnos y los
// subgrupos de jornada partida) cuelga de jornada partida.
const GRUPOS = [
    { codigo: "turnos",  nombre: "Personal a turnos",           icono: "🔁" },
    { codigo: "jornada", nombre: "Personal de jornada partida", icono: "🕘" }
];

function grupoDeColectivo(colectivo) {
    return colectivo && colectivo.tipo === "turnos" ? "turnos" : "jornada";
}

// colectivos = [{ codigo, nombre, icono, puesto, patron, diasSolape, tipo, empleados: [{ id, nombre, iniciales, inicio, colectivo, activo, orden, marcas }] }]
// tipo: 'turnos' (jefes de turno, operadores de control y de campo), 'correturnos' u 'otro'.
// marcas: marcas de arriba de la celda que ese empleado puede usar (D, CTD, CT1... CTY); vacío = celda entera.
// verHoras: el administrador le activa el resumen de horas anuales y excesos (los colectivos de turnos lo ven siempre).
// Los empleados dados de baja solo los ve el administrador, y no aparecen en los calendarios.
let colectivos = [];

// festivos: Map "AAAA-MM-DD" -> nombre (convierten una P o una I del ciclo en F)
let festivos = new Map();
// intensivas: [{ id, desde, hasta, nota }] (en esas fechas la P pasa a I)
let intensivas = [];
// excepciones: Map "empleadoId|AAAA-MM-DD" -> código (turnos puestos a mano)
const excepciones = new Map();
// semanas: Map "empleadoId|AAAA-MM-DD del lunes" -> código de marca (G, CTD, CT1...), solo en
// los colectivos con semanas especiales
const semanas = new Map();
// marcasDia: Map "empleadoId|AAAA-MM-DD" -> código de marca de ese día suelto ("-" = día sin marca)
const marcasDia = new Map();
const aniosCargados = new Set();
const cargasEnCurso = new Map();

async function cargarDatos() {
    const [rc, re, rf, ri] = await Promise.all([
        supabaseClient.from("colectivos").select("*").order("orden"),
        supabaseClient.from("empleados").select("*").order("orden"),
        supabaseClient.from("festivos").select("fecha, nombre").order("fecha"),
        supabaseClient.from("intensivas").select("id, desde, hasta, nota").order("desde")
    ]);
    if (rc.error || re.error || rf.error || ri.error) {
        console.error("Error al cargar datos:", rc.error || re.error || rf.error || ri.error);
        return false;
    }

    colectivos = rc.data.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        icono: c.icono,
        puesto: c.puesto,
        patron: c.patron,
        diasSolape: c.dias_solape,
        tipo: c.tipo || (c.codigo === "correturnos" ? "correturnos" : c.codigo === "jornada" ? "otro" : "turnos"),
        empleados: re.data
            .filter(e => e.colectivo === c.codigo)
            .map(e => ({
                id: e.id,
                nombre: e.nombre,
                iniciales: e.iniciales,
                inicio: e.inicio,
                colectivo: e.colectivo,
                activo: e.activo,
                orden: e.orden,
                marcas: Array.isArray(e.marcas) ? e.marcas : [],
                verHoras: e.ver_horas === true
            }))
    }));

    festivos = new Map(rf.data.map(f => [f.fecha, f.nombre]));
    intensivas = ri.data.map(i => ({ id: i.id, desde: i.desde, hasta: i.hasta, nota: i.nota }));

    // Cambios manuales: el año en curso y los dos de al lado; el resto se pide al navegar
    const anio = new Date().getFullYear();
    await Promise.all([anio - 1, anio, anio + 1].map(asegurarAnio));
    return true;
}

// Carga (una sola vez) los cambios manuales de un año. Devuelve true si todo fue bien.
async function asegurarAnio(anio) {
    if (aniosCargados.has(anio)) return true;
    if (cargasEnCurso.has(anio)) return cargasEnCurso.get(anio);

    const carga = (async () => {
        const desde = `${anio}-01-01`;
        const hasta = `${anio}-12-31`;
        const trozo = 1000;
        for (let inicio = 0; ; inicio += trozo) {
            const { data, error } = await supabaseClient
                .from("excepciones")
                .select("empleado_id, fecha, codigo")
                .gte("fecha", desde)
                .lte("fecha", hasta)
                .order("fecha")
                .order("empleado_id")
                .range(inicio, inicio + trozo - 1);
            if (error) {
                console.error("Error al cargar cambios manuales:", error);
                return false;
            }
            data.forEach(r => excepciones.set(claveExcepcion(r.empleado_id, r.fecha), r.codigo));
            if (data.length < trozo) break;
        }

        // Semanas especiales (G, CT1...) que tocan este año. Si la tabla aún no existe en Supabase
        // (falta ejecutar el SQL de la fase 4) no se rompe nada: simplemente no hay marcas.
        const desdeSemanas = lunesDe(desde);
        for (let inicio = 0; ; inicio += trozo) {
            const { data, error } = await supabaseClient
                .from("semanas_especiales")
                .select("empleado_id, semana, codigo")
                .gte("semana", desdeSemanas)
                .lte("semana", hasta)
                .order("semana")
                .order("empleado_id")
                .range(inicio, inicio + trozo - 1);
            if (error) {
                console.warn("No se pudieron cargar las semanas especiales:", error);
                break;
            }
            data.forEach(r => semanas.set(claveExcepcion(r.empleado_id, r.semana), r.codigo));
            if (data.length < trozo) break;
        }

        // Marcas de días sueltos (mismo criterio: si la tabla no existe, se ignora)
        for (let inicio = 0; ; inicio += trozo) {
            const { data, error } = await supabaseClient
                .from("marcas_dia")
                .select("empleado_id, fecha, codigo")
                .gte("fecha", desde)
                .lte("fecha", hasta)
                .order("fecha")
                .order("empleado_id")
                .range(inicio, inicio + trozo - 1);
            if (error) {
                console.warn("No se pudieron cargar las marcas de días sueltos:", error);
                break;
            }
            data.forEach(r => marcasDia.set(claveExcepcion(r.empleado_id, r.fecha), r.codigo));
            if (data.length < trozo) break;
        }

        aniosCargados.add(anio);
        return true;
    })();

    cargasEnCurso.set(anio, carga);
    const ok = await carga;
    cargasEnCurso.delete(anio);
    return ok;
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

// Sustituye el contenido de un elemento ignorando los hijos nulos (replaceChildren pintaría "null")
function reemplazarHijos(contenedor, ...hijos) {
    contenedor.replaceChildren(...hijos.flat().filter(h => h !== null && h !== undefined && h !== false));
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
