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

// Colectivos cuyo calendario anual puede ver la persona que ha entrado: el administrador, todos; el resto,
// el suyo y los grupos o subgrupos que el administrador le haya dado en su ficha
function colectivosVisiblesAnual() {
    if (typeof usuarioActual !== "undefined" && usuarioActual && usuarioActual.rol === "administrador") return colectivos;
    const yo = typeof obtenerEmpleadoActual === "function" ? obtenerEmpleadoActual() : null;
    if (!yo) return [];
    const ver = yo.anualVer || [];
    return colectivos.filter(c => c.codigo === yo.colectivo || ver.includes(c.codigo) || ver.includes("g:" + grupoDeColectivo(c)));
}

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

// Lee de Supabase los colectivos, empleados, festivos e intensivas. Devuelve los datos ya preparados
// (sin tocar nada de lo que hay en pantalla) o null si algo falló.
async function leerMaestros() {
    const [rc, re, rf, ri] = await Promise.all([
        supabaseClient.from("colectivos").select("*").order("orden"),
        supabaseClient.from("empleados").select("*").order("orden"),
        supabaseClient.from("festivos").select("fecha, nombre").order("fecha"),
        supabaseClient.from("intensivas").select("id, desde, hasta, nota").order("desde")
    ]);
    if (rc.error || re.error || rf.error || ri.error) {
        console.error("Error al cargar datos:", rc.error || re.error || rf.error || ri.error);
        return null;
    }

    return {
        colectivos: rc.data.map(c => ({
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
                    verHoras: e.ver_horas === true,
                    verCalendarioDe: e.ver_calendario_de || null,
                    anualVer: Array.isArray(e.anual_ver) ? e.anual_ver : []
                }))
        })),
        festivos: new Map(rf.data.map(f => [f.fecha, f.nombre])),
        intensivas: ri.data.map(i => ({ id: i.id, desde: i.desde, hasta: i.hasta, nota: i.nota }))
    };
}

function aplicarMaestros(m) {
    colectivos = m.colectivos;
    festivos = m.festivos;
    intensivas = m.intensivas;
}

async function cargarDatos() {
    const maestros = await leerMaestros();
    if (!maestros) return false;
    aplicarMaestros(maestros);

    // Cambios manuales: el año en curso y los dos de al lado; el resto se pide al navegar
    const anio = new Date().getFullYear();
    await Promise.all([anio - 1, anio, anio + 1].map(asegurarAnio));
    return true;
}

// Lee de una tabla (por trozos de 1000) las filas de un rango de fechas.
// Devuelve la lista de filas, o null si la lectura falló.
async function leerPorTrozos(tabla, campoFecha, desde, hasta, avisoSoloConsola) {
    const trozo = 1000;
    const filas = [];
    for (let inicio = 0; ; inicio += trozo) {
        const { data, error } = await supabaseClient
            .from(tabla)
            .select(`empleado_id, ${campoFecha}, codigo`)
            .gte(campoFecha, desde)
            .lte(campoFecha, hasta)
            .order(campoFecha)
            .order("empleado_id")
            .range(inicio, inicio + trozo - 1);
        if (error) {
            if (avisoSoloConsola) console.warn(avisoSoloConsola, error);
            else console.error(`Error al cargar ${tabla}:`, error);
            return null;
        }
        filas.push(...data);
        if (data.length < trozo) break;
    }
    return filas;
}

// Lee los datos de un año: cambios manuales (obligatorio), semanas especiales y marcas de días sueltos
// (si esas tablas aún no existen en Supabase no se rompe nada: simplemente no hay marcas).
// Devuelve { exc, sem, mar } (sem y mar pueden ser null) o null si falló lo obligatorio.
async function leerAnioServidor(anio) {
    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;
    const [exc, sem, mar] = await Promise.all([
        leerPorTrozos("excepciones", "fecha", desde, hasta),
        leerPorTrozos("semanas_especiales", "semana", lunesDe(desde), hasta, "No se pudieron cargar las semanas especiales:"),
        leerPorTrozos("marcas_dia", "fecha", desde, hasta, "No se pudieron cargar las marcas de días sueltos:")
    ]);
    return exc ? { exc, sem, mar } : null;
}

// Sustituye en un mapa todo lo de un rango de fechas por lo leído (las claves acaban en la fecha)
function reemplazarRango(mapa, desde, hasta, filas, campoFecha) {
    for (const clave of [...mapa.keys()]) {
        const fecha = clave.slice(-10);
        if (fecha >= desde && fecha <= hasta) mapa.delete(clave);
    }
    filas.forEach(r => mapa.set(claveExcepcion(r.empleado_id, r[campoFecha]), r.codigo));
}

function aplicarAnio(anio, datos) {
    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;
    reemplazarRango(excepciones, desde, hasta, datos.exc, "fecha");
    if (datos.sem) reemplazarRango(semanas, lunesDe(desde), hasta, datos.sem, "semana");
    if (datos.mar) reemplazarRango(marcasDia, desde, hasta, datos.mar, "fecha");
}

// Carga (una sola vez) los cambios manuales de un año. Devuelve true si todo fue bien.
async function asegurarAnio(anio) {
    if (aniosCargados.has(anio)) return true;
    if (cargasEnCurso.has(anio)) return cargasEnCurso.get(anio);

    const carga = (async () => {
        const datos = await leerAnioServidor(anio);
        if (!datos) return false;
        aplicarAnio(anio, datos);
        aniosCargados.add(anio);
        return true;
    })();

    cargasEnCurso.set(anio, carga);
    const ok = await carga;
    cargasEnCurso.delete(anio);
    return ok;
}

// --- Mantener los datos al día ---
// Los cambios de otras personas llegan por Realtime (de uno en uno, sin recargar nada). Como el móvil
// corta la conexión en segundo plano, al volver a la app (o recuperar la red) se vuelve a leer todo.
// Si Realtime no estuviera activado en Supabase, solo falla lo instantáneo: al volver a la app se actualiza igual.

// Mientras se guarda algo propio no se aplica ninguna lectura del servidor (podría pisar lo recién guardado)
let escriturasLocales = 0;
let marcaEscrituraLocal = 0;
async function conEscrituraLocal(accion) {
    escriturasLocales++;
    marcaEscrituraLocal++;
    try {
        return await accion();
    } finally {
        escriturasLocales--;
        marcaEscrituraLocal++;
    }
}

let refrescando = false;
let refrescoPendiente = false;
let temporizadorRefresco = null;
let temporizadorRepintado = null;
let canalDatos = null;
let canalYaConectado = false;
let ocultoDesde = 0;
let sincronizacionIniciada = false;

function programarRepintado() {
    clearTimeout(temporizadorRepintado);
    temporizadorRepintado = setTimeout(() => {
        if (typeof refrescarCalendarioPropio === "function" && document.getElementById("cardCalendario")) refrescarCalendarioPropio();
    }, 200);
}

function programarRefresco(ms) {
    clearTimeout(temporizadorRefresco);
    temporizadorRefresco = setTimeout(refrescarDatos, ms == null ? 800 : ms);
}

// Vuelve a leer del servidor lo maestro y los años ya cargados, y repinta el mes
async function refrescarDatos() {
    if (refrescando) { refrescoPendiente = true; return; }
    refrescando = true;
    let aplicado = false;
    try {
        for (let pasada = 0; pasada < 3; pasada++) {
            refrescoPendiente = false;
            const marca = marcaEscrituraLocal;
            const anios = [...aniosCargados];
            const [maestros, leidos] = await Promise.all([leerMaestros(), Promise.all(anios.map(leerAnioServidor))]);

            // Si mientras tanto se guardó algo propio, esta lectura puede estar vieja: se descarta y se repite
            if (escriturasLocales > 0 || marca !== marcaEscrituraLocal) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            if (maestros) aplicarMaestros(maestros);
            anios.forEach((anio, i) => { if (leidos[i]) aplicarAnio(anio, leidos[i]); });
            if (typeof tickCambios === "function") tickCambios();   // solicitudes de cambio al día también
            programarRepintado();
            aplicado = true;
            if (!refrescoPendiente) break;
        }
        // Si un guardado propio tardó demasiado y no se pudo aplicar ninguna lectura, se vuelve a intentar más tarde
        if (!aplicado) programarRefresco(3000);
    } catch (e) {
        console.warn("No se pudieron refrescar los datos:", e);
    } finally {
        refrescando = false;
    }
}

// Cambio de una fila de excepciones / semanas_especiales / marcas_dia llegado por Realtime
function alCambiarFila(mapa, campoFecha, cambio) {
    const nueva = cambio.new || {};
    const vieja = cambio.old || {};
    if (cambio.eventType === "DELETE") {
        if (vieja.empleado_id && vieja[campoFecha]) mapa.delete(claveExcepcion(vieja.empleado_id, vieja[campoFecha]));
        else { programarRefresco(); return; }
    } else if (nueva.empleado_id && nueva[campoFecha] && nueva.codigo != null) {
        mapa.set(claveExcepcion(nueva.empleado_id, nueva[campoFecha]), nueva.codigo);
    } else {
        programarRefresco();
        return;
    }
    programarRepintado();
}

function iniciarSincronizacion() {
    if (sincronizacionIniciada) return;
    sincronizacionIniciada = true;

    // Al volver a la app tras un rato en segundo plano, o al recuperar la conexión
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) { ocultoDesde = Date.now(); return; }
        if (ocultoDesde && Date.now() - ocultoDesde > 20000) programarRefresco(100);
    });
    window.addEventListener("online", () => programarRefresco(500));

    if (typeof supabaseClient.channel !== "function") return;
    try {
        canalDatos = supabaseClient.channel("bbe-datos");
        [["excepciones", excepciones, "fecha"], ["semanas_especiales", semanas, "semana"], ["marcas_dia", marcasDia, "fecha"]]
            .forEach(([tabla, mapa, campo]) => {
                canalDatos.on("postgres_changes", { event: "*", schema: "public", table: tabla }, cambio => alCambiarFila(mapa, campo, cambio));
            });
        ["empleados", "colectivos", "festivos", "intensivas"].forEach(tabla => {
            canalDatos.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => programarRefresco(1200));
        });
        canalDatos.subscribe(estado => {
            if (estado === "SUBSCRIBED") {
                if (canalYaConectado) programarRefresco(300);   // reconexión: se recupera lo que se haya perdido
                canalYaConectado = true;
            }
        });
    } catch (e) {
        console.warn("Realtime no disponible:", e);
    }
}

// Pone al día, desde el servidor, los cambios manuales de una persona en unos días concretos
// (para decidir con datos frescos, por ejemplo si un día viene de un cambio con un compañero)
async function sincronizarDiasDe(empleadoId, fechas) {
    if (!fechas.length) return;
    try {
        const { data, error } = await supabaseClient.from("excepciones")
            .select("fecha, codigo").eq("empleado_id", empleadoId).in("fecha", fechas);
        if (error) return;
        const del = new Map(data.map(r => [r.fecha, r.codigo]));
        fechas.forEach(f => {
            const clave = claveExcepcion(empleadoId, f);
            if (del.has(f)) excepciones.set(clave, del.get(f)); else excepciones.delete(clave);
        });
    } catch (e) { /* si falla, se sigue con lo que hay en pantalla */ }
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
