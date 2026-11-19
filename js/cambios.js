// js/cambios.js
// Solicitudes de cambio de turno entre compañeros del mismo colectivo (jefes de turno,
// operadores de control y operadores de campo). Los correturnos pueden pedirlos a los tres, y los de
// los tres pueden pedírselos a un correturno que esté sustituyendo (turno M, T o N ese día).
//
// Es una permuta: el solicitante se queda con el turno del compañero ese día y el compañero con
// el suyo. Se puede pedir un día suelto (desde la ficha del día) o varios (seleccionándolos en
// el calendario). Cada solicitud tiene un hilo de mensajes. Al aceptar, el servidor aplica el
// cambio en los dos calendarios (como cambio manual). Las solicitudes caducan el día del cambio
// y lo cerrado se borra solo a las 24 horas (todo esto lo hace el SQL de la fase 5).

const CODIGOS_CAMBIABLES = ["M", "T", "N", "P", "I", "S", "F"];   // turnos que se pueden intercambiar
const RANGO_TURNO = { M: 1, T: 2, N: 3 };                          // para detectar cambios cortos
const ETIQUETA_ESTADO = { pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "Rechazada", cancelada: "Cancelada", caducada: "Caducada" };

let modoCambio = false;                 // selección de varios días en curso
const seleccionCambio = new Set();      // fechas elegidas ("AAAA-MM-DD")
let cambiosDatos = { solicitudes: [], dias: [], mensajes: [] };
let cambiosSinVer = 0;                  // número del globo de notificación
let temporizadorCambios = null;
let pestanaCambios = "recibidas";
let primeraCargaCambios = true;
const cambiosAplicados = new Set();     // solicitudes aceptadas cuyo efecto ya está en pantalla

// --- Quién puede usarlo ---
// Los tres colectivos de turnos piden cambios dentro de su colectivo; los correturnos, que a veces
// sustituyen, pueden pedirlos a cualquiera de los tres colectivos de turnos.
function esColectivoDeTurnos(colectivo) {
    return !!colectivo && colectivo.tipo === "turnos";
}

function esCorreturnos(colectivo) {
    return !!colectivo && colectivo.tipo === "correturnos";
}

function puedeUsarCambios() {
    if (!usuarioActual || esPerfilFamiliar()) return false;
    const yo = obtenerEmpleadoActual();
    const colectivo = yo ? buscarColectivo(yo.colectivo) : null;
    return esColectivoDeTurnos(colectivo) || esCorreturnos(colectivo);
}

// Compañeros a los que puedo pedir un cambio: los de mi colectivo de turnos y, además, los correturnos
// (solo los días en que un correturno tiene puesto un turno M, T o N: ese día está sustituyendo).
// Un correturno puede pedirlo a cualquiera de los tres colectivos de turnos.
function candidatosCambio(yo) {
    const miColectivo = buscarColectivo(yo.colectivo);
    const colectivosValidos = esColectivoDeTurnos(miColectivo)
        ? [miColectivo, ...colectivos.filter(esCorreturnos)]
        : colectivos.filter(esColectivoDeTurnos);
    return colectivosValidos.flatMap(c => empleadosActivos(c)).filter(e => e.id !== yo.id);
}

// ¿Se le puede pedir el cambio a este compañero ese día, con ese turno suyo?
function turnoOfrecible(yo, empleado, codigo) {
    if (!CODIGOS_CAMBIABLES.includes(codigo)) return false;
    if (esCorreturnos(buscarColectivo(empleado.colectivo)) && esColectivoDeTurnos(buscarColectivo(yo.colectivo))) {
        return ["M", "T", "N"].includes(codigo);
    }
    return true;
}

function hoyISO() {
    return aISO(new Date());
}

// Un día se puede pedir si es posterior a hoy (la solicitud caduca el propio día) y su turno es cambiable
function diaSolicitable(fechaISO, info) {
    return fechaISO > hoyISO() && CODIGOS_CAMBIABLES.includes(info.codigo);
}

// Para el botón de la ficha del día
function puedeSolicitarCambioEnFicha(empleado, fechaISO, info) {
    return puedeEditarDesdeFicha(empleado) && puedeUsarCambios() && diaSolicitable(fechaISO, info);
}

function diaConAnio(iso) {
    return Number(iso.slice(0, 4));
}

function insigniaTurno(codigo) {
    const t = convertirTurno(codigo);
    return el("span", { class: "badge-turno " + t.clase, text: codigo, title: t.texto });
}

// --- Datos ---
async function rpcCambio(nombre, argumentos) {
    const { data, error } = await supabaseClient.rpc(nombre, argumentos);
    if (error) {
        console.error(`Error en ${nombre}:`, error);
        return { ok: false, motivo: "error" };
    }
    return data || { ok: true };
}

function motivoLegible(motivo) {
    return ({
        no_autorizado: "No tienes permiso para hacer eso.",
        destinatario_invalido: "Ese compañero no es válido para el cambio.",
        colectivo_no_permitido: "Tu colectivo no usa solicitudes de cambio.",
        datos_invalidos: "Los datos de la solicitud no son válidos.",
        fecha_pasada: "Solo se pueden pedir cambios desde mañana.",
        ya_hay_solicitud: "Ya hay una solicitud abierta para alguno de esos días con esas personas.",
        ya_cerrada: "Esa solicitud ya está cerrada.",
        caducada: "Esa solicitud ha caducado."
    })[motivo] || "No se pudo completar. Inténtalo de nuevo.";
}

async function cargarCambios() {
    const tablas = ["cambios_solicitudes", "cambios_dias", "cambios_mensajes"];
    const [s, d, m] = await Promise.all(tablas.map(t => supabaseClient.from(t).select("*")));
    if (s.error || d.error || m.error) {
        console.warn("No se pudieron cargar los cambios:", s.error || d.error || m.error);
        return false;
    }
    cambiosDatos = { solicitudes: s.data, dias: d.data, mensajes: m.data };
    aplicarCambiosAceptados();
    return true;
}

// Si otra persona acepta un cambio mientras tienes la app abierta, se refleja en tu calendario.
// (En la primera carga solo se anotan: lo que ya estaba aceptado viene de la base de datos.)
function aplicarCambiosAceptados() {
    let cambio = false;
    cambiosDatos.solicitudes.filter(s => s.estado === "aceptada").forEach(s => {
        if (cambiosAplicados.has(s.id)) return;
        cambiosAplicados.add(s.id);
        if (primeraCargaCambios) return;
        aplicarDiasEnPantalla(s);
        cambio = true;
    });
    primeraCargaCambios = false;
    if (cambio) refrescarCalendarioPropio();
}

function aplicarDiasEnPantalla(solicitud) {
    cambiosDatos.dias.filter(d => d.solicitud_id === solicitud.id).forEach(d => {
        excepciones.set(claveExcepcion(solicitud.solicitante_id, d.fecha), d.codigo_destinatario);
        excepciones.set(claveExcepcion(solicitud.destinatario_id, d.fecha), d.codigo_solicitante);
    });
}

function contarSinVer() {
    const yo = obtenerEmpleadoActual();
    if (!yo) return 0;
    return cambiosDatos.solicitudes.filter(s =>
        (s.destinatario_id === yo.id && !s.visto_destinatario) ||
        (s.solicitante_id === yo.id && !s.visto_solicitante)
    ).length;
}

// Globo de notificación: en el menú y junto al nombre
function actualizarGlobo() {
    cambiosSinVer = contarSinVer();
    const globo = document.getElementById("globoCambios");
    if (globo) {
        globo.textContent = String(cambiosSinVer);
        globo.style.display = cambiosSinVer ? "" : "none";
    }
    const flecha = document.querySelector("#infoUsuario .flecha");
    pintarCabeceraUsuario(flecha ? flecha.textContent : "▼");
}

async function tickCambios() {
    if (!usuarioActual || !puedeUsarCambios()) return;
    await rpcCambio("limpiar_cambios", {});
    if (await cargarCambios()) actualizarGlobo();
}

// Se llama al entrar en la app
function iniciarCambios() {
    const boton = document.getElementById("btnCambios");
    if (boton) boton.style.display = puedeUsarCambios() ? "" : "none";
    if (temporizadorCambios) clearInterval(temporizadorCambios);
    temporizadorCambios = null;
    primeraCargaCambios = true;
    cambiosAplicados.clear();
    if (!puedeUsarCambios()) return;
    tickCambios();
    temporizadorCambios = setInterval(tickCambios, 60000);
}

// --- Avisos de descanso ---
function descripcionDescanso(a, b) {
    const ra = RANGO_TURNO[a], rb = RANGO_TURNO[b];
    if (!ra || !rb || rb >= ra) return null;
    if (a === "N" && b === "M") return "noche seguida de mañana, sin descanso";
    return a === "N" ? "cambio corto: noche → tarde" : "cambio corto: tarde → mañana";
}

// movimientos: [{ emp, fecha, nuevo }]. Devuelve los avisos que aparecen con el cambio y no existían antes.
async function calcularAvisos(movimientos) {
    const anios = new Set();
    movimientos.forEach(m => {
        anios.add(diaConAnio(sumarDias(m.fecha, -1)));
        anios.add(diaConAnio(sumarDias(m.fecha, 1)));
    });
    await Promise.all([...anios].map(asegurarAnio));

    const nuevos = new Map(movimientos.map(m => [claveExcepcion(m.emp.id, m.fecha), m.nuevo]));
    const codigo = (emp, f, conCambio) => (conCambio && nuevos.get(claveExcepcion(emp.id, f))) || infoTurno(f, emp).codigo;

    const yo = obtenerEmpleadoActual();
    const avisos = new Set();
    movimientos.forEach(m => {
        [[sumarDias(m.fecha, -1), m.fecha], [m.fecha, sumarDias(m.fecha, 1)]].forEach(([a, b]) => {
            const antes = descripcionDescanso(codigo(m.emp, a, false), codigo(m.emp, b, false));
            const despues = descripcionDescanso(codigo(m.emp, a, true), codigo(m.emp, b, true));
            if (despues && despues !== antes) {
                const quien = yo && m.emp.id === yo.id ? "Tú" : m.emp.nombre;
                avisos.add(`${quien}: ${despues} (${formatoCorto(a)} → ${formatoCorto(b)})`);
            }
        });
    });
    return [...avisos];
}

function cajaAvisos(avisos, claseExtra) {
    if (!avisos.length) return null;
    return el("div", { class: "avisos-cambio " + (claseExtra || ""), role: "status" },
        el("strong", { text: "Ojo con el descanso" }),
        el("ul", {}, avisos.map(a => el("li", { text: a }))),
        el("span", { class: "admin-nota", text: "Es solo un aviso: el cambio se puede pedir igualmente." })
    );
}

// --- Ventana modal sencilla ---
function abrirModal(...contenido) {
    cerrarModal();
    const hoja = el("div", { class: "modal-hoja", role: "dialog", "aria-modal": "true" }, contenido);
    const fondo = el("div", { id: "modalCambio", class: "modal-fondo" }, hoja);
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarModal(); });
    document.body.append(fondo);
    return fondo;
}

function cerrarModal() {
    const m = document.getElementById("modalCambio");
    if (m) m.remove();
}

// --- Solicitar un cambio (uno o varios días) ---
async function abrirSolicitudCambio(fechas) {
    const yo = obtenerEmpleadoActual();
    if (!yo || !puedeUsarCambios() || !fechas.length) return;
    fechas = [...fechas].sort();
    await Promise.all([...new Set(fechas.map(diaConAnio))].map(asegurarAnio));

    const companeros = candidatosCambio(yo);
    const variosColectivos = new Set(companeros.map(e => e.colectivo)).size > 1;

    // Desplegable de una fila: si hay varios colectivos (correturnos), las opciones van agrupadas por colectivo
    const crearOpciones = (lista) => {
        const opcion = x => el("option", { value: x.emp.id, text: `${x.emp.nombre} · ${x.info.texto}` });
        if (!variosColectivos) return lista.map(opcion);
        return colectivos.filter(c => lista.some(x => x.emp.colectivo === c.codigo)).map(c =>
            el("optgroup", { label: c.nombre }, lista.filter(x => x.emp.colectivo === c.codigo).map(opcion)));
    };

    // Una fila por día: mi turno y, en el desplegable, los compañeros con turno cambiable ese día
    const filas = fechas.map(fecha => {
        const miInfo = infoTurno(fecha, yo);
        const opciones = companeros
            .map(emp => ({ emp, info: infoTurno(fecha, emp) }))
            .filter(x => turnoOfrecible(yo, x.emp, x.info.codigo) && x.info.codigo !== miInfo.codigo);
        const select = el("select", { "aria-label": `Compañero para el ${fechaLarga(fecha)}` },
            opciones.length ? crearOpciones(opciones) : el("option", { value: "", text: "Nadie disponible" })
        );
        select.disabled = !opciones.length;
        return { fecha, miInfo, opciones, select };
    });

    const avisos = el("div", { class: "avisos-lugar" });
    let ticket = 0;
    const actualizarAvisos = async () => {
        const mio = ++ticket;
        const movimientos = [];
        filas.forEach(f => {
            const x = f.opciones.find(o => o.emp.id === f.select.value);
            if (!x) return;
            movimientos.push({ emp: yo, fecha: f.fecha, nuevo: x.info.codigo });
            movimientos.push({ emp: x.emp, fecha: f.fecha, nuevo: f.miInfo.codigo });
        });
        const lista = movimientos.length ? await calcularAvisos(movimientos) : [];
        if (mio !== ticket) return;
        avisos.replaceChildren(...[cajaAvisos(lista)].filter(Boolean));
    };
    filas.forEach(f => f.select.addEventListener("change", actualizarAvisos));

    // Varios días: un desplegable para pedirlos todos al mismo compañero (lo habitual)
    let todos = null;
    if (fechas.length > 1) {
        const cobertura = new Map();
        filas.forEach(f => f.opciones.forEach(o => cobertura.set(o.emp.id, (cobertura.get(o.emp.id) || 0) + 1)));
        const ordenados = companeros.filter(c => cobertura.has(c.id)).sort((a, b) => cobertura.get(b.id) - cobertura.get(a.id));
        if (ordenados.length) {
            todos = el("select", { "aria-label": "Pedir todos los días a" },
                ordenados.map(c => el("option", { value: c.id, text: `${c.nombre}${variosColectivos ? " · " + buscarColectivo(c.colectivo).puesto : ""} (${cobertura.get(c.id)} de ${fechas.length} días)` })));
            const aplicar = () => {
                filas.forEach(f => { if (f.opciones.some(o => o.emp.id === todos.value)) f.select.value = todos.value; });
                actualizarAvisos();
            };
            todos.addEventListener("change", aplicar);
            aplicar();
        }
    }
    actualizarAvisos();

    const mensaje = el("textarea", { rows: "2", maxlength: "500", placeholder: "Mensaje para tu compañero (opcional)", "aria-label": "Mensaje" });
    const error = el("p", { class: "error-texto", role: "alert" });
    const botonEnviar = el("button", { type: "button", text: "Enviar solicitud" });

    botonEnviar.addEventListener("click", async () => {
        const grupos = new Map();   // compañero -> días
        filas.forEach(f => {
            const x = f.opciones.find(o => o.emp.id === f.select.value);
            if (!x) return;
            if (!grupos.has(x.emp.id)) grupos.set(x.emp.id, []);
            grupos.get(x.emp.id).push({ fecha: f.fecha, codigo_solicitante: f.miInfo.codigo, codigo_destinatario: x.info.codigo });
        });
        if (!grupos.size) { error.textContent = "No hay ningún día con compañero disponible."; return; }

        botonEnviar.disabled = true;
        error.textContent = "";
        let enviadas = 0, fallo = null;
        for (const [destinatario, dias] of grupos) {
            const r = await rpcCambio("crear_cambios", { p_destinatario: destinatario, p_dias: dias, p_mensaje: mensaje.value.trim() || null });
            if (r.ok) enviadas++;
            else fallo = r.motivo;
        }
        botonEnviar.disabled = false;

        if (enviadas) {
            cerrarModal();
            terminarModoCambio();
            mostrarToast(enviadas === 1 ? "Solicitud enviada" : `${enviadas} solicitudes enviadas`);
            tickCambios();
        }
        if (fallo) {
            if (enviadas) mostrarToast(motivoLegible(fallo) + " (alguna solicitud no se envió)", true);
            else error.textContent = motivoLegible(fallo);
        }
    });

    abrirModal(
        el("h3", { text: "Solicitar cambio" }),
        el("p", { class: "admin-nota", text: "Es un intercambio: tú te quedas con el turno de tu compañero ese día y él con el tuyo." }),
        todos ? el("label", { class: "campo" }, el("span", { text: "Pedir todos a" }), todos) : null,
        el("div", { class: "filas-cambio" }, filas.map(f =>
            el("div", { class: "fila-cambio" },
                el("div", { class: "fila-cambio-dia" },
                    el("strong", { text: fechaLarga(f.fecha) }),
                    el("span", { class: "fila-cambio-turno" }, "Tu turno ", insigniaTurno(f.miInfo.codigo))
                ),
                f.select
            )
        )),
        avisos,
        el("label", { class: "campo" }, el("span", { text: "Mensaje" }), mensaje),
        error,
        el("div", { class: "modal-acciones" },
            el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: cerrarModal }),
            botonEnviar
        )
    );
}

// --- Selección de varios días en el calendario ---
function pintarBarraCambio() {
    let barra = document.getElementById("barraCambio");
    if (barra) barra.remove();

    const continuar = el("button", { id: "btnContinuarCambio", type: "button", text: "Continuar", onclick: () => abrirSolicitudCambio([...seleccionCambio]) });
    barra = el("div", { id: "barraCambio", class: "barra-edicion barra-cambio" },
        el("div", { class: "barra-edicion-texto" },
            el("strong", { text: "Elige los días a cambiar" }),
            el("span", { id: "contadorCambio", text: "" })
        ),
        el("div", { class: "barra-edicion-acciones" },
            el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: terminarModoCambio }),
            continuar
        )
    );
    const calendario = document.getElementById("miCalendario");
    calendario.parentNode.insertBefore(barra, calendario);
    actualizarContadorCambio();
    ajustarAlturaCalendario();
}

function actualizarContadorCambio() {
    const c = document.getElementById("contadorCambio");
    const n = seleccionCambio.size;
    if (c) c.textContent = n ? `${n} ${n === 1 ? "día elegido" : "días elegidos"}` : "Toca los días de tu calendario (puedes cambiar de mes)";
    const b = document.getElementById("btnContinuarCambio");
    if (b) b.disabled = n === 0;
}

function iniciarModoCambio(preseleccion) {
    if (!puedeUsarCambios()) return;
    terminarModoEdicion();
    const resultado = document.getElementById("resultado");
    if (resultado && resultado.style.display === "block") cerrarVistaResultado();
    cerrarPanelUsuario();

    modoCambio = true;
    seleccionCambio.clear();
    if (preseleccion) seleccionCambio.add(preseleccion);
    document.body.classList.add("modo-cambio");
    pintarBarraCambio();
    verMiCalendario();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function terminarModoCambio() {
    const habia = modoCambio || !!document.getElementById("barraCambio");
    modoCambio = false;
    seleccionCambio.clear();
    document.body.classList.remove("modo-cambio");
    const barra = document.getElementById("barraCambio");
    if (barra) barra.remove();
    document.querySelectorAll(".dia-calendario.seleccionado").forEach(b => b.classList.remove("seleccionado"));
    if (habia) ajustarAlturaCalendario();
}

// Tocar un día en el modo de selección
function alternarDiaCambio(fechaISO, empleadoId) {
    const yo = obtenerEmpleadoActual();
    if (!yo || yo.id !== empleadoId) return;
    const info = infoTurno(fechaISO, yo);

    if (fechaISO <= hoyISO()) { mostrarToast("Solo se pueden pedir cambios desde mañana.", true); return; }
    if (!CODIGOS_CAMBIABLES.includes(info.codigo)) { mostrarToast(`Un día de «${info.texto}» no se puede cambiar.`, true); return; }

    if (seleccionCambio.has(fechaISO)) seleccionCambio.delete(fechaISO);
    else seleccionCambio.add(fechaISO);

    const boton = document.querySelector(`.dia-calendario[data-fecha="${fechaISO}"]`);
    if (boton) boton.classList.toggle("seleccionado", seleccionCambio.has(fechaISO));
    actualizarContadorCambio();
}

// --- Antes de guardar un cambio manual en tu calendario ---
// 1) Si ese turno viene de un cambio con otra persona, tocarlo solo tú deja los dos calendarios sin cuadrar:
//    se sugiere pedirle que lo deshaga.
// 2) Si cambias a M, T o N un día en que ese turno ya está cubierto, se avisa.
let permutas = new Map();   // "empleadoId|fecha" -> { con, recibido, cedido }: cambios hechos con otra persona

async function cargarPermutas() {
    const { data, error } = await supabaseClient.from("cambios_hechos").select("*");
    if (error) {   // la tabla aún no existe (falta el script de la fase 7): no se avisa de nada
        permutas = new Map();
        return;
    }
    permutas = new Map(data.map(r => [claveExcepcion(r.empleado_id, r.fecha),
        { con: r.con_empleado_id, recibido: r.codigo_recibido, cedido: r.codigo_cedido }]));
}

// Solo vale mientras el turno siga siendo el recibido en el cambio
function permutaVigente(empleado, fechaISO) {
    const p = permutas.get(claveExcepcion(empleado.id, fechaISO));
    return p && excepciones.get(claveExcepcion(empleado.id, fechaISO)) === p.recibido ? p : null;
}

function nombresY(lista) {
    return lista.map(e => e.nombre).join(" y ");
}

// Aviso de cobertura de un turno de 24 horas (M, T, N), o null
function avisoCobertura(empleado, colectivo, fechaISO, nuevo) {
    if (!["M", "T", "N"].includes(nuevo)) return null;
    const turno = TURNOS[nuevo].texto.toLowerCase();
    const fecha = formatoCorto(fechaISO);
    // cuántos tienen ese turno por ciclo y cuántos lo tienen ahora (con cambios manuales)
    const porCiclo = (c, excluirId) => empleadosActivos(c).filter(e => e.id !== excluirId && turnoAutomatico(fechaISO, e, c).codigo === nuevo).length;
    const ahora = (c, excluirId) => empleadosActivos(c).filter(e => e.id !== excluirId && infoTurno(fechaISO, e).codigo === nuevo);

    if (esColectivoDeTurnos(colectivo)) {
        const otros = ahora(colectivo, empleado.id);
        const habitual = porCiclo(colectivo, empleado.id) + (turnoAutomatico(fechaISO, empleado, colectivo).codigo === nuevo ? 1 : 0);
        if (otros.length >= 1 && otros.length + 1 > habitual) {
            return `${fecha}: ${nombresY(otros)} ya ${otros.length > 1 ? "tienen" : "tiene"} el turno de ${turno} en tu colectivo (puede que esté de baja y no lo haya puesto).`;
        }
        return null;
    }
    if (esCorreturnos(colectivo)) {
        // Un correturno cubre un hueco: falta alguien en ese turno en alguno de los colectivos de turnos
        const huecos = colectivos.filter(esColectivoDeTurnos)
            .reduce((total, c) => total + Math.max(0, porCiclo(c) - ahora(c).length), 0);
        const otrosCorre = ahora(colectivo, empleado.id);
        if (huecos - otrosCorre.length <= 0) {
            return huecos === 0
                ? `${fecha}: ahora mismo no falta nadie en el turno de ${turno} en los colectivos de turnos.`
                : `${fecha}: el hueco del turno de ${turno} ya lo cubre ${nombresY(otrosCorre)}.`;
        }
    }
    return null;
}

// Pide deshacer los cambios (un cambio nuevo que devuelve a cada uno su turno). Devuelve true si se envió algo.
async function pedirDeshacer(empleado, afectadas) {
    const grupos = new Map();
    const noPosibles = [];
    afectadas.forEach(a => {
        const mio = infoTurno(a.fecha, empleado).codigo;
        const suyo = infoTurno(a.fecha, a.otro).codigo;
        if (!turnoOfrecible(empleado, a.otro, suyo) || suyo === mio) { noPosibles.push(`${formatoCorto(a.fecha)} (${a.otro.nombre})`); return; }
        if (!grupos.has(a.otro.id)) grupos.set(a.otro.id, { otro: a.otro, dias: [] });
        grupos.get(a.otro.id).dias.push({ fecha: a.fecha, codigo_solicitante: mio, codigo_destinatario: suyo });
    });

    let enviadas = 0, fallo = null;
    for (const { otro, dias } of grupos.values()) {
        const fechas = dias.map(d => formatoCorto(d.fecha)).join(", ");
        const r = await rpcCambio("crear_cambios", {
            p_destinatario: otro.id, p_dias: dias,
            p_mensaje: `Te pido deshacer el cambio que hicimos (${fechas}).`
        });
        if (r.ok) enviadas++; else fallo = r.motivo;
    }
    if (enviadas) {
        mostrarToast(enviadas === 1 ? "Petición para deshacer enviada" : `${enviadas} peticiones para deshacer enviadas`);
        tickCambios();
    }
    if (fallo) mostrarToast(motivoLegible(fallo), true);
    if (noPosibles.length) mostrarToast(`No se pudo pedir automáticamente: ${noPosibles.join(", ")}. Habla con esa persona.`, true);
    return enviadas > 0;
}

// Devuelve "guardar" (seguir con el cambio), "cancelar" o "deshacer" (se pidió deshacer y no se guarda nada)
async function revisarAntesDeGuardar(empleado, colectivo, cambios) {
    if (puedeUsarCambios()) await cargarPermutas();
    else permutas = new Map();

    const avisos = [], afectadas = [];
    cambios.forEach(({ fecha, codigo }) => {
        const nuevo = codigo || turnoAutomatico(fecha, empleado, colectivo).codigo;
        if (nuevo === infoTurno(fecha, empleado).codigo) return;   // no cambia nada
        const p = permutaVigente(empleado, fecha);
        const otro = p ? buscarEmpleadoPorId(p.con) : null;
        if (p && otro) afectadas.push({ fecha, ...p, otro });
        const aviso = avisoCobertura(empleado, colectivo, fecha, nuevo);
        if (aviso) avisos.push(aviso);
    });
    if (!afectadas.length && !avisos.length) return "guardar";

    const futuras = afectadas.filter(a => a.fecha > hoyISO());
    const nombresOtros = [...new Set(futuras.map(a => a.otro.nombre))].join(" y ");

    return new Promise(resolver => {
        let resuelto = false;
        const fin = (resultado) => { if (resuelto) return; resuelto = true; cerrarModal(); resolver(resultado); };

        const bloqueCambio = afectadas.length ? el("div", { class: "avisos-cambio" },
            el("strong", { text: "Esto afecta a otra persona" }),
            el("ul", {}, afectadas.map(a => el("li", { text:
                `${formatoCorto(a.fecha)}: tu turno (${a.recibido}) viene de un cambio con ${a.otro.nombre}. Si lo cambias solo tú, ${a.otro.nombre} se quedaría con tu ${a.cedido} y los dos calendarios dejarían de cuadrar.` +
                (a.fecha > hoyISO() ? "" : " Ya no se puede pedir deshacerlo (es hoy o una fecha pasada).") }))),
            el("span", { class: "admin-nota", text: "Lo mejor es pedirle que deshaga el cambio." })
        ) : null;
        const bloqueCobertura = avisos.length ? el("div", { class: "avisos-cambio" },
            el("strong", { text: "Ojo con la cobertura" }),
            el("ul", {}, avisos.map(a => el("li", { text: a }))),
            el("span", { class: "admin-nota", text: "Es solo un aviso: puedes guardarlo igualmente." })
        ) : null;

        const botonDeshacer = futuras.length ? el("button", { type: "button", text: `Pedir a ${nombresOtros} que lo deshaga`,
            onclick: async () => { if (await pedirDeshacer(empleado, futuras)) fin("deshacer"); } }) : null;

        const modal = abrirModal(
            el("h3", { text: "Antes de guardar" }),
            bloqueCambio, bloqueCobertura,
            futuras.length ? el("p", { class: "admin-nota", text: "Si pides deshacerlo, ahora no se guarda ningún cambio de los que ibas a hacer." }) : null,
            el("div", { class: "modal-acciones modal-acciones-columna" },
                botonDeshacer,
                el("button", { type: "button", class: "btn-secundario", text: afectadas.length ? "Cambiar solo el mío" : "Guardar igualmente", onclick: () => fin("guardar") }),
                el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: () => fin("cancelar") })
            )
        );
        modal.addEventListener("click", (e) => { if (e.target === modal) fin("cancelar"); });
    });
}

// --- Pantalla "Cambios" ---
function textoDias(solicitud) {
    const fechas = cambiosDatos.dias.filter(d => d.solicitud_id === solicitud.id).map(d => d.fecha).sort();
    const cortas = fechas.map(formatoCorto);
    return cortas.length > 4 ? `${cortas.slice(0, 4).join(", ")}… (${cortas.length} días)` : cortas.join(", ");
}

// Una solicitud pendiente cuyo primer día ya llegó está caducada aunque el servidor aún no lo haya anotado
function estadoReal(solicitud) {
    return solicitud.estado === "pendiente" && solicitud.primer_dia <= hoyISO() ? "caducada" : solicitud.estado;
}

async function verCambios(pestana) {
    if (!puedeUsarCambios()) return;
    const contenedor = mostrarVistaAdmin();
    if (pestana) pestanaCambios = pestana;
    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Cargando…" }));

    await rpcCambio("limpiar_cambios", {});
    const ok = await cargarCambios();
    actualizarGlobo();
    if (!ok) {
        reemplazarHijos(contenedor, cabeceraCambios("Cambios"),
            el("p", { class: "error-texto", text: "No se pudieron cargar las solicitudes. Puede que falte activar esta función en Supabase (script de la fase 5)." }));
        return;
    }
    pintarListaCambios();
}

// Al salir de la pantalla de cambios se repinta el mes (por si un cambio aceptado lo ha modificado)
function volverDeCambios() {
    cerrarVistaResultado();
    verMiCalendario();
}

function cabeceraCambios(titulo, alVolver) {
    return el("div", { class: "resultado-cabecera" },
        el("h2", { text: titulo }),
        el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: alVolver || volverDeCambios })
    );
}

function pintarListaCambios() {
    const contenedor = document.getElementById("resultado");
    const yo = obtenerEmpleadoActual();
    if (!yo) return;

    const esMia = (s) => s.solicitante_id === yo.id;
    const sinVer = (s) => esMia(s) ? !s.visto_solicitante : !s.visto_destinatario;
    const recibidas = cambiosDatos.solicitudes.filter(s => !esMia(s));
    const enviadas = cambiosDatos.solicitudes.filter(esMia);
    const lista = pestanaCambios === "enviadas" ? enviadas : recibidas;

    const orden = { pendiente: 0 };
    lista.sort((a, b) => ((orden[estadoReal(a)] ?? 1) - (orden[estadoReal(b)] ?? 1)) || String(b.creada_en).localeCompare(String(a.creada_en)));

    const pestana = (clave, texto, items) => {
        const nuevos = items.filter(sinVer).length;
        return el("button", {
            type: "button", class: "pestana-cambios" + (pestanaCambios === clave ? " elegido" : ""),
            onclick: () => { pestanaCambios = clave; pintarListaCambios(); }
        }, texto, nuevos ? el("span", { class: "globo globo-pestana", text: String(nuevos) }) : null);
    };

    const tarjetas = lista.map(s => {
        const otro = buscarEmpleadoPorId(esMia(s) ? s.destinatario_id : s.solicitante_id);
        const estado = estadoReal(s);
        return el("button", { type: "button", class: "tarjeta-cambio" + (sinVer(s) ? " nueva" : ""), onclick: () => verDetalleCambio(s.id) },
            el("div", { class: "tarjeta-cambio-fila" },
                el("strong", { text: (esMia(s) ? "A " : "De ") + (otro ? otro.nombre : "—") }),
                el("span", { class: "estado-cambio estado-" + estado, text: ETIQUETA_ESTADO[estado] })
            ),
            el("span", { class: "tarjeta-cambio-dias", text: textoDias(s) }),
            sinVer(s) ? el("span", { class: "punto-nuevo", "aria-label": "Novedad" }) : null
        );
    });

    reemplazarHijos(contenedor,
        cabeceraCambios("Cambios"),
        el("button", { type: "button", class: "btn-ancho", text: "Solicitar cambio de varios días", onclick: () => iniciarModoCambio() }),
        el("p", { class: "admin-nota", text: "Para un solo día, toca el día en tu calendario y elige «Solicitar cambio»." }),
        el("div", { class: "pestanas-cambios" }, pestana("recibidas", "Recibidas", recibidas), pestana("enviadas", "Mis solicitudes", enviadas)),
        tarjetas.length
            ? el("div", { class: "lista-cambios" }, tarjetas)
            : el("p", { class: "aviso-vacio", text: pestanaCambios === "enviadas" ? "No has enviado ninguna solicitud." : "No tienes solicitudes recibidas." })
    );
}

function horaMensaje(iso) {
    return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function verDetalleCambio(id) {
    const contenedor = mostrarVistaAdmin();
    const yo = obtenerEmpleadoActual();
    const solicitud = cambiosDatos.solicitudes.find(s => s.id === id);
    if (!yo || !solicitud) { verCambios(); return; }

    const soySolicitante = solicitud.solicitante_id === yo.id;
    const otro = buscarEmpleadoPorId(soySolicitante ? solicitud.destinatario_id : solicitud.solicitante_id);
    const estado = estadoReal(solicitud);
    const pendiente = estado === "pendiente";
    const dias = cambiosDatos.dias.filter(d => d.solicitud_id === id).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const mensajes = cambiosDatos.mensajes.filter(m => m.solicitud_id === id).sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)));

    // Quita el globo de esta solicitud para quien la abre
    if (soySolicitante ? !solicitud.visto_solicitante : !solicitud.visto_destinatario) {
        rpcCambio("marcar_visto_cambio", { p_solicitud: id });
        if (soySolicitante) solicitud.visto_solicitante = true; else solicitud.visto_destinatario = true;
        actualizarGlobo();
    }

    // Lo que cada uno da y recibe, según quién soy
    const filas = dias.map(d => ({
        fecha: d.fecha,
        doy: soySolicitante ? d.codigo_solicitante : d.codigo_destinatario,
        recibo: soySolicitante ? d.codigo_destinatario : d.codigo_solicitante
    }));

    // Comprobación de que los turnos siguen como cuando se pidió
    await Promise.all([...new Set(dias.map(d => diaConAnio(d.fecha)))].map(asegurarAnio));
    const solicitante = buscarEmpleadoPorId(solicitud.solicitante_id);
    const destinatario = buscarEmpleadoPorId(solicitud.destinatario_id);
    const obsoleto = pendiente && solicitante && destinatario && dias.some(d =>
        infoTurno(d.fecha, solicitante).codigo !== d.codigo_solicitante ||
        infoTurno(d.fecha, destinatario).codigo !== d.codigo_destinatario);

    let avisos = [];
    if (pendiente && !obsoleto && solicitante && destinatario) {
        avisos = await calcularAvisos(dias.flatMap(d => [
            { emp: solicitante, fecha: d.fecha, nuevo: d.codigo_destinatario },
            { emp: destinatario, fecha: d.fecha, nuevo: d.codigo_solicitante }
        ]));
    }

    const error = el("p", { class: "error-texto", role: "alert" });
    const volver = () => pintarListaDespuesDeCargar();

    const accion = async (nombre, args, confirmacion, exito) => {
        if (confirmacion && !confirm(confirmacion)) return;
        error.textContent = "";
        const r = await rpcCambio(nombre, args);
        if (!r.ok) { error.textContent = motivoLegible(r.motivo); await cargarCambios(); return; }
        if (nombre === "responder_cambio" && args.p_aceptar) {
            aplicarDiasEnPantalla(solicitud);
            cambiosAplicados.add(id);
            refrescarCalendarioPropio();
        }
        mostrarToast(exito);
        await cargarCambios();
        actualizarGlobo();
        verDetalleCambio(id);
    };

    // Mensajes
    const caja = el("textarea", { rows: "2", maxlength: "500", placeholder: "Escribe un mensaje…", "aria-label": "Mensaje" });
    const hilo = el("div", { class: "hilo-cambio" },
        mensajes.length
            ? mensajes.map(m => {
                const mio = m.autor_id === yo.id;
                const autor = buscarEmpleadoPorId(m.autor_id);
                return el("div", { class: "burbuja " + (mio ? "mia" : "suya") },
                    el("span", { class: "burbuja-autor", text: `${mio ? "Tú" : (autor ? autor.nombre : "—")} · ${horaMensaje(m.creado_en)}` }),
                    el("span", { text: m.texto })
                );
            })
            : el("p", { class: "admin-nota", text: "Aún no hay mensajes." })
    );

    reemplazarHijos(contenedor,
        cabeceraCambios("Solicitud de cambio", volver),
        el("p", { class: "detalle-linea" },
            el("strong", { text: soySolicitante ? `Se lo pides a ${otro ? otro.nombre : "—"}` : `Te lo pide ${otro ? otro.nombre : "—"}` }),
            " ", el("span", { class: "estado-cambio estado-" + estado, text: ETIQUETA_ESTADO[estado] })
        ),
        el("div", { class: "tabla-cambio" },
            el("div", { class: "tabla-cambio-cab" }, el("span", { text: "Día" }), el("span", { text: "Tú das" }), el("span", { text: "Tú recibes" })),
            filas.map(f => el("div", { class: "tabla-cambio-fila" },
                el("span", { text: fechaLarga(f.fecha) }), insigniaTurno(f.doy), insigniaTurno(f.recibo)))
        ),
        obsoleto
            ? el("div", { class: "avisos-cambio" }, el("strong", { text: "Los turnos han cambiado" }),
                el("span", { text: "El turno de alguno de los dos ya no es el de cuando se envió la solicitud, así que no se puede aceptar. Hay que cancelarla y pedirla de nuevo." }))
            : cajaAvisos(avisos),
        el("h3", { class: "grupo-titulo", text: "Mensajes" }),
        hilo,
        pendiente
            ? el("div", { class: "responder-cambio" }, caja,
                el("button", { type: "button", class: "btn-secundario btn-ancho", text: "Enviar mensaje", onclick: async () => {
                    const texto = caja.value.trim();
                    if (!texto) return;
                    error.textContent = "";
                    const r = await rpcCambio("enviar_mensaje_cambio", { p_solicitud: id, p_texto: texto });
                    if (!r.ok) { error.textContent = motivoLegible(r.motivo); return; }
                    await cargarCambios();
                    verDetalleCambio(id);
                } }))
            : null,
        error,
        pendiente && !soySolicitante
            ? el("div", { class: "acciones-cambio" },
                el("button", { type: "button", text: "Aceptar el cambio", disabled: obsoleto ? true : null,
                    onclick: () => accion("responder_cambio", { p_solicitud: id, p_aceptar: true },
                        `¿Aceptar el cambio? Se modificarán tu calendario y el de ${otro ? otro.nombre : "tu compañero"}.`, "Cambio aceptado") }),
                el("button", { type: "button", class: "btn-peligro", text: "Rechazar",
                    onclick: () => accion("responder_cambio", { p_solicitud: id, p_aceptar: false }, "¿Rechazar la solicitud?", "Solicitud rechazada") }))
            : null,
        pendiente && soySolicitante
            ? el("button", { type: "button", class: "btn-peligro btn-ancho", text: "Cancelar mi solicitud",
                onclick: () => accion("cancelar_cambio", { p_solicitud: id }, "¿Cancelar la solicitud?", "Solicitud cancelada") })
            : null,
        pendiente ? null : el("p", { class: "admin-nota", text: "Esta solicitud se borrará sola 24 horas después de cerrarse." })
    );
}

async function pintarListaDespuesDeCargar() {
    const contenedor = mostrarVistaAdmin();
    await cargarCambios();
    actualizarGlobo();
    pintarListaCambios();
}
