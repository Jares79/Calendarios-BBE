// js/edicion.js
// Editor de tu propio calendario: cambiar el turno de un día o de un rango de fechas.
// Cada persona solo puede editar el suyo (lo garantiza la base de datos); los demás ven tus cambios.

let modoEdicion = false;

// --- Aviso breve en pantalla ---
let temporizadorAviso = null;

function mostrarToast(texto, esError) {
    let aviso = document.getElementById("toast");
    if (!aviso) {
        aviso = el("div", { id: "toast", class: "toast", role: "status" });
        document.body.append(aviso);
    }
    aviso.textContent = texto;
    aviso.className = "toast visible" + (esError ? " toast-error" : "");
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), esError ? 3500 : 1800);
}

// --- Entrar y salir del modo edición ---
function activarModoEdicion() {
    cerrarPanelUsuario();
    if (typeof terminarModoCambio === "function") terminarModoCambio();
    ocultarDetalleDia();

    // Si había una vista de resultados abierta (anual, búsqueda...), se vuelve al calendario
    const resultado = document.getElementById("resultado");
    if (resultado && resultado.style.display === "block") cerrarVistaResultado();

    if (!obtenerEmpleadoActual()) {
        mostrarToast("No tienes ficha de empleado, así que no puedes editar un calendario.", true);
        return;
    }

    modoEdicion = true;
    document.body.classList.add("modo-edicion");
    pintarBarraEdicion();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function terminarModoEdicion() {
    if (typeof terminarModoCambio === "function") terminarModoCambio();
    modoEdicion = false;
    document.body.classList.remove("modo-edicion");
    const barra = document.getElementById("barraEdicion");
    if (barra) barra.remove();
    ocultarDetalleDia();
    ajustarAlturaCalendario();
}

function pintarBarraEdicion() {
    let barra = document.getElementById("barraEdicion");
    if (barra) barra.remove();

    barra = el("div", { id: "barraEdicion", class: "barra-edicion" },
        el("div", { class: "barra-edicion-texto" },
            el("strong", { text: "Editando tu calendario" }),
            el("span", { text: "Toca un día para cambiar su turno" })
        ),
        el("div", { class: "barra-edicion-acciones" },
            el("button", { type: "button", class: "btn-secundario", text: "Varios días", onclick: abrirEditorRango }),
            el("button", { type: "button", text: "Listo", onclick: terminarModoEdicion })
        )
    );
    const calendario = document.getElementById("miCalendario");
    calendario.parentNode.insertBefore(barra, calendario);
    ajustarAlturaCalendario();
}

// --- Rejilla de turnos disponibles (la usan el selector de un día y el de un rango) ---
function crearRejillaTurnos(alElegir, seleccionado) {
    return el("div", { class: "rejilla-turnos", role: "group", "aria-label": "Turnos disponibles" },
        turnosPermitidosDe(obtenerEmpleadoActual()).map(([codigo, t]) =>
            el("button", {
                type: "button",
                class: "opcion-turno " + t.clase + (codigo.length > 1 ? " largo" : "") + (codigo === seleccionado ? " elegido" : ""),
                "data-codigo": codigo,
                "aria-pressed": codigo === seleccionado ? "true" : "false",
                onclick: () => alElegir(codigo)
            },
                el("span", { class: "opcion-letra", text: codigo }),
                el("span", { class: "opcion-nombre", text: t.texto })
            ))
    );
}

// --- Cambiar el turno de un día ---
async function abrirSelectorTurno(fechaISO) {
    ocultarDetalleDia();
    const empleado = obtenerEmpleadoActual();
    if (!empleado) return;
    if (typeof prepararHoras === "function") await prepararHoras(fechaISO);   // horas de cada turno y ajustes
    const info = infoTurno(fechaISO, empleado);
    const seccionHoras = typeof crearSeccionHorasDia === "function" ? crearSeccionHorasDia(fechaISO, empleado) : null;
    const seccionSemana = crearSeccionSemana(fechaISO, empleado);   // solo en colectivos con semanas

    const panel = el("div", { id: "panelDetalleDia", class: "detalle-dia hoja-edicion", role: "dialog", "aria-label": "Cambiar turno" },
        el("div", { class: "detalle-cabecera" },
            el("div", { class: "detalle-textos" },
                el("strong", { text: "Cambiar turno" }),
                el("span", { class: "detalle-fecha", text: `${fechaLarga(fechaISO)} · ahora: ${info.texto}` })
            ),
            el("button", { type: "button", class: "btn-cerrar", "aria-label": "Cerrar", text: "×", onclick: ocultarDetalleDia })
        ),
        seccionSemana ? el("p", { class: "detalle-etiqueta", text: "Turno del día (mitad de abajo)" }) : null,
        crearRejillaTurnos((codigo) => {
            ocultarDetalleDia();
            guardarCambiosCalendario([{ fecha: fechaISO, codigo }]);
        }, info.manual ? info.codigo : null),
        el("button", {
            type: "button", class: "btn-secundario btn-ancho btn-ciclo",
            text: "Volver al turno del ciclo",
            disabled: info.manual ? null : true,
            onclick: () => {
                ocultarDetalleDia();
                guardarCambiosCalendario([{ fecha: fechaISO, codigo: null }]);
            }
        }),
        seccionHoras,
        seccionSemana
    );
    document.body.append(panel);
}

// --- Cambiar varios días a la vez ---
async function abrirEditorRango() {
    ocultarDetalleDia();
    const hoy = aISO(new Date());
    let elegido = null;
    const empleadoActual = obtenerEmpleadoActual();
    if (typeof prepararHoras === "function") await prepararHoras(hoy);
    const bloqueHoras = typeof crearBloqueHorasRango === "function" && empleadoActual ? crearBloqueHorasRango(empleadoActual) : null;

    const desde = el("input", { type: "date", value: hoy, "aria-label": "Desde" });
    const hasta = el("input", { type: "date", value: hoy, "aria-label": "Hasta" });
    const error = el("p", { class: "error-texto", role: "alert" });
    const rejilla = el("div");

    const pintarRejilla = () => {
        rejilla.replaceChildren(crearRejillaTurnos((codigo) => { elegido = codigo; pintarRejilla(); }, elegido));
    };
    pintarRejilla();

    const fechasValidas = () => {
        if (!desde.value || !hasta.value) { error.textContent = "Elige las dos fechas."; return null; }
        if (hasta.value < desde.value) { error.textContent = "La fecha final no puede ser anterior a la inicial."; return null; }
        const fechas = rangoFechas(desde.value, hasta.value);
        if (fechas.length > 366) { error.textContent = "El máximo son 366 días de una vez."; return null; }
        error.textContent = "";
        return fechas;
    };

    const panel = el("div", { id: "panelDetalleDia", class: "detalle-dia hoja-edicion", role: "dialog", "aria-label": "Cambiar varios días" },
        el("div", { class: "detalle-cabecera" },
            el("div", { class: "detalle-textos" },
                el("strong", { text: "Varios días" }),
                el("span", { class: "detalle-fecha", text: "Elige las fechas y el turno" })
            ),
            el("button", { type: "button", class: "btn-cerrar", "aria-label": "Cerrar", text: "×", onclick: ocultarDetalleDia })
        ),
        el("div", { class: "rango-fechas" },
            el("label", { class: "campo" }, el("span", { text: "Desde" }), desde),
            el("label", { class: "campo" }, el("span", { text: "Hasta" }), hasta)
        ),
        rejilla,
        bloqueHoras ? bloqueHoras.elemento : null,
        error,
        el("div", { class: "barra-edicion-acciones" },
            el("button", {
                type: "button", text: "Aplicar turno",
                onclick: async () => {
                    const fechas = fechasValidas();
                    if (!fechas) return;
                    if (!elegido) { error.textContent = "Elige un turno."; return; }
                    ocultarDetalleDia();
                    const guardado = await guardarCambiosCalendario(fechas.map(fecha => ({ fecha, codigo: elegido })));
                    if (guardado && bloqueHoras) await bloqueHoras.aplicar(fechas);   // las horas se ajustan después del turno
                }
            }),
            bloqueHoras ? el("button", {
                type: "button", class: "btn-secundario", text: "Solo horas",
                onclick: async () => {
                    const fechas = fechasValidas();
                    if (!fechas) return;
                    if (!bloqueHoras.hayAccion()) { error.textContent = "Elige qué hacer con las horas."; return; }
                    ocultarDetalleDia();
                    await bloqueHoras.aplicar(fechas);
                }
            }) : null,
            el("button", {
                type: "button", class: "btn-secundario", text: "Volver al ciclo",
                onclick: () => {
                    const fechas = fechasValidas();
                    if (!fechas) return;
                    ocultarDetalleDia();
                    guardarCambiosCalendario(fechas.map(fecha => ({ fecha, codigo: null })));
                }
            })
        )
    );
    document.body.append(panel);
}

// --- Guardar ---
// cambios: [{ fecha: "AAAA-MM-DD", codigo: "V" | null }]  (null = volver al turno del ciclo)
async function guardarCambiosCalendario(cambios) {
    const empleado = obtenerEmpleadoActual();
    const colectivo = empleado ? buscarColectivo(empleado.colectivo) : null;
    if (!empleado || !colectivo) {
        mostrarToast("No se pudo guardar: falta tu ficha de empleado.", true);
        return false;
    }

    // Se asegura de tener cargados los años afectados antes de decidir qué se sube o se borra
    const anios = [...new Set(cambios.map(c => Number(c.fecha.slice(0, 4))))];
    await Promise.all(anios.map(asegurarAnio));

    // Avisos antes de tocar el turno: si viene de un cambio con otra persona, o si ese turno ya está cubierto
    if (typeof revisarAntesDeGuardar === "function") {
        const decision = await revisarAntesDeGuardar(empleado, colectivo, cambios);
        if (decision !== "guardar") return false;
    }

    // Baja (B), libre disposición (LD), permiso (J) y solape a mano (S) mantienen las horas previstas. Si el día
    // traía otras horas que las del ciclo (un turno puesto a mano) y no hay ajuste de horas, se conservan como
    // ajuste para que el nuevo turno siga sumándolas.
    const conservarHoras = [];
    const sumaPrev = typeof CODIGOS_SUMAN_PREVISTAS !== "undefined" ? CODIGOS_SUMAN_PREVISTAS : [];
    if (cambios.some(c => sumaPrev.includes(c.codigo)) && typeof cargarHoras === "function" && await cargarHoras()) {
        await Promise.all(anios.map(asegurarHorasDia));
        cambios.forEach(({ fecha, codigo }) => {
            if (!sumaPrev.includes(codigo)) return;
            const previo = infoTurno(fecha, empleado).codigo;
            if (previo === codigo || horasDia.has(claveExcepcion(empleado.id, fecha))) return;
            const eran = horasDeDia(empleado, fecha, previo);
            const delCiclo = horasDelCiclo(fecha, empleado).horas;   // las horas del turno que tocaba por ciclo
            if (Math.abs(eran - delCiclo) > 0.001) conservarHoras.push({ fecha, horas: eran });
        });
    }

    const subir = [];
    const borrar = [];
    const anterior = new Map();

    cambios.forEach(({ fecha, codigo }) => {
        const clave = claveExcepcion(empleado.id, fecha);
        anterior.set(clave, excepciones.get(clave));

        // Si el turno elegido es el que ya da el ciclo, no hace falta guardar un cambio
        const efectivo = codigo && turnoAutomatico(fecha, empleado, colectivo).codigo === codigo ? null : codigo;

        if (efectivo) subir.push({ empleado_id: empleado.id, fecha, codigo: efectivo });
        else if (excepciones.has(clave)) borrar.push(fecha);
    });

    if (!subir.length && !borrar.length) {
        mostrarToast("Ya estaba así");
        return true;
    }

    // Se refleja al instante y se confirma con el servidor
    subir.forEach(r => excepciones.set(claveExcepcion(r.empleado_id, r.fecha), r.codigo));
    borrar.forEach(f => excepciones.delete(claveExcepcion(empleado.id, f)));
    verMiCalendario();

    let fallo = null;
    for (let i = 0; i < subir.length && !fallo; i += 200) {
        const r = await supabaseClient.from("excepciones")
            .upsert(subir.slice(i, i + 200), { onConflict: "empleado_id,fecha" });
        fallo = r.error;
    }
    for (let i = 0; i < borrar.length && !fallo; i += 100) {
        const r = await supabaseClient.from("excepciones")
            .delete().eq("empleado_id", empleado.id).in("fecha", borrar.slice(i, i + 100));
        fallo = r.error;
    }

    if (fallo) {
        console.error("Error al guardar cambios:", fallo);
        anterior.forEach((valor, clave) => {
            if (valor === undefined) excepciones.delete(clave);
            else excepciones.set(clave, valor);
        });
        verMiCalendario();
        mostrarToast("No se pudo guardar. Inténtalo de nuevo.", true);
        return false;
    }

    // Cambiar el turno de un día quita su ajuste manual de horas (salvo al pasar a B, LD, J o S, que lo mantienen)
    if (typeof limpiarAjustesHoras === "function") {
        await limpiarAjustesHoras(empleado, [...subir.filter(r => !sumaPrev.includes(r.codigo)).map(r => r.fecha), ...borrar]);
    }
    if (conservarHoras.length && typeof guardarHorasDia === "function") {
        await guardarHorasDia(empleado, conservarHoras, true);
    }

    mostrarToast(cambios.length > 1 ? "Cambios guardados" : "Guardado");
    return true;
}
