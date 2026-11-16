// js/semanas.js
// Semanas especiales: guardias (G) del personal de jornada partida y semanas de correturno
// (CTD, CT1, CT2, CT3, CT4, CTY). Cada semana va de lunes a domingo y se pinta en la mitad de
// arriba de la celda; la mitad de abajo sigue siendo el turno del día.
//
// Cada persona asigna sus propias semanas. El administrador puede además asignarlas a cualquiera
// y crear un patrón que se repite. La base de datos comprueba los permisos en el servidor.

// --- Quién puede ver la pantalla ---
function colectivoConSemanas(empleado) {
    const c = empleado ? buscarColectivo(empleado.colectivo) : null;
    return c && c.marcas.length > 0 ? c : null;
}

// Empleados activos de los colectivos que usan semanas
function empleadosConSemanas() {
    return colectivos.filter(c => c.marcas.length > 0).flatMap(c => empleadosActivos(c));
}

function puedeVerSemanas() {
    if (!usuarioActual || esPerfilFamiliar()) return false;
    if (puedeGestionarUsuarios(usuarioActual)) return empleadosConSemanas().length > 0;
    return !!colectivoConSemanas(obtenerEmpleadoActual());
}

// Muestra el botón del menú solo a quien corresponde
function prepararPanelSemanas() {
    const boton = document.getElementById("btnSemanas");
    if (boton) boton.style.display = puedeVerSemanas() ? "" : "none";
}

function formatoCorto(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
}

function sumarDias(iso, dias) {
    return new Date((diaNumero(iso) + dias) * 86400000).toISOString().slice(0, 10);
}

// Todos los lunes de las semanas que tocan un año
function lunesDelAnio(anio) {
    const lista = [];
    for (let l = lunesDe(`${anio}-01-01`); l <= `${anio}-12-31`; l = sumarDias(l, 7)) lista.push(l);
    return lista;
}

// --- Guardar ---
// cambios: [{ semana: "AAAA-MM-DD" (lunes), codigo: "G" | "CT1"... | null }]  (null = quitar la marca)
async function guardarSemanas(empleado, cambios) {
    const colectivo = empleado ? colectivoConSemanas(empleado) : null;
    if (!colectivo) {
        mostrarToast("Esa persona no tiene semanas especiales.", true);
        return false;
    }
    if (cambios.some(c => c.codigo && !colectivo.marcas.includes(c.codigo))) {
        mostrarToast("Ese código no está permitido para este colectivo.", true);
        return false;
    }

    // Se asegura de tener cargados los años que tocan estas semanas
    const anios = new Set();
    cambios.forEach(c => { anios.add(Number(c.semana.slice(0, 4))); anios.add(Number(sumarDias(c.semana, 6).slice(0, 4))); });
    await Promise.all([...anios].map(asegurarAnio));

    const subir = [];
    const borrar = [];
    const anterior = new Map();

    cambios.forEach(({ semana, codigo }) => {
        const clave = claveExcepcion(empleado.id, semana);
        const actual = semanas.get(clave);
        if ((codigo || undefined) === actual) return;   // ya estaba así
        anterior.set(clave, actual);
        if (codigo) subir.push({ empleado_id: empleado.id, semana, codigo });
        else borrar.push(semana);
    });

    if (!subir.length && !borrar.length) {
        mostrarToast("Ya estaba así");
        return true;
    }

    // Se refleja al instante y se confirma con el servidor
    subir.forEach(r => semanas.set(claveExcepcion(r.empleado_id, r.semana), r.codigo));
    borrar.forEach(f => semanas.delete(claveExcepcion(empleado.id, f)));
    refrescarCalendarioPropio();

    let fallo = null;
    for (let i = 0; i < subir.length && !fallo; i += 200) {
        const r = await supabaseClient.from("semanas_especiales")
            .upsert(subir.slice(i, i + 200), { onConflict: "empleado_id,semana" });
        fallo = r.error;
    }
    for (let i = 0; i < borrar.length && !fallo; i += 100) {
        const r = await supabaseClient.from("semanas_especiales")
            .delete().eq("empleado_id", empleado.id).in("semana", borrar.slice(i, i + 100));
        fallo = r.error;
    }

    if (fallo) {
        console.error("Error al guardar semanas:", fallo);
        anterior.forEach((valor, clave) => {
            if (valor === undefined) semanas.delete(clave);
            else semanas.set(clave, valor);
        });
        refrescarCalendarioPropio();
        mostrarToast("No se pudo guardar. Inténtalo de nuevo.", true);
        return false;
    }

    mostrarToast(cambios.length > 1 ? "Semanas guardadas" : "Guardado");
    return true;
}

// Repinta el mes si se está viendo (la vista de resultados no se toca)
function refrescarCalendarioPropio() {
    const tarjeta = document.getElementById("cardCalendario");
    if (tarjeta && tarjeta.style.display !== "none") verMiCalendario();
}

// --- Selector de marca para una semana (se usa en la hoja de edición de un día) ---
function crearRejillaMarcas(codigos, alElegir, seleccionado) {
    return el("div", { class: "rejilla-turnos", role: "group", "aria-label": "Marcas de la semana" },
        codigos.map(codigo => {
            const m = MARCAS[codigo] || { texto: codigo, clase: "" };
            return el("button", {
                type: "button",
                class: "opcion-turno " + m.clase + (codigo.length > 1 ? " largo" : "") + (codigo === seleccionado ? " elegido" : ""),
                "aria-pressed": codigo === seleccionado ? "true" : "false",
                onclick: () => alElegir(codigo)
            },
                el("span", { class: "opcion-letra", text: codigo }),
                el("span", { class: "opcion-nombre", text: m.texto })
            );
        })
    );
}

// Bloque "Semana" de la hoja de edición de un día: elegir o quitar la marca de esa semana
function crearSeccionSemana(fechaISO, empleado) {
    const colectivo = colectivoConSemanas(empleado);
    if (!colectivo) return null;
    const lunes = lunesDe(fechaISO);
    const actual = semanas.get(claveExcepcion(empleado.id, lunes)) || null;

    return el("div", { class: "seccion-semana" },
        el("p", { class: "detalle-etiqueta", text: `Semana del ${formatoCorto(lunes)} al ${formatoCorto(domingoDe(fechaISO))} (mitad de arriba)` }),
        crearRejillaMarcas(colectivo.marcas, (codigo) => {
            ocultarDetalleDia();
            guardarSemanas(empleado, [{ semana: lunes, codigo }]);
        }, actual),
        el("button", {
            type: "button", class: "btn-secundario btn-ancho",
            text: "Quitar la marca de esta semana",
            disabled: actual ? null : true,
            onclick: () => {
                ocultarDetalleDia();
                guardarSemanas(empleado, [{ semana: lunes, codigo: null }]);
            }
        })
    );
}

// --- Pantalla "Semanas" ---
let semanasAnioVista = null;
let semanasEmpleadoId = null;

function verSemanas() {
    if (!puedeVerSemanas()) return;
    const contenedor = mostrarVistaAdmin();
    const propio = obtenerEmpleadoActual();

    if (semanasAnioVista === null) semanasAnioVista = anioInicialAdmin();
    if (puedeGestionarUsuarios(usuarioActual)) {
        const lista = empleadosConSemanas();
        const sigueValido = lista.some(e => e.id === semanasEmpleadoId);
        if (!sigueValido) semanasEmpleadoId = propio && colectivoConSemanas(propio) ? propio.id : lista[0].id;
    } else {
        semanasEmpleadoId = propio.id;
    }
    pintarSemanas();
}

async function pintarSemanas() {
    const contenedor = document.getElementById("resultado");
    const empleado = buscarEmpleadoPorId(semanasEmpleadoId);
    const colectivo = colectivoConSemanas(empleado);
    if (!empleado || !colectivo) { cerrarVistaResultado(); return; }

    const anio = semanasAnioVista;
    const esAdmin = puedeGestionarUsuarios(usuarioActual);
    await Promise.all([anio - 1, anio, anio + 1].filter(a => a >= ANIO_MIN && a <= ANIO_MAX).map(asegurarAnio));

    const aviso = el("p", { class: "error-texto", role: "alert" });
    const hoyLunes = lunesDe(aISO(new Date()));

    // Cabecera
    const selectAnio = selectorAnio(anio, (a) => { semanasAnioVista = a; pintarSemanas(); });
    const cabecera = el("div", { class: "resultado-cabecera" },
        el("h2", { text: esAdmin ? "Semanas especiales" : "Mis semanas" }),
        el("div", { class: "resultado-acciones" },
            selectAnio,
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        )
    );

    // Administrador: elegir persona
    let elegirPersona = null;
    if (esAdmin) {
        const select = el("select", { "aria-label": "Persona" },
            empleadosConSemanas().map(e => el("option", { value: e.id, text: `${e.nombre} (${e.iniciales}) · ${buscarColectivo(e.colectivo).nombre}` })));
        select.value = empleado.id;
        select.addEventListener("change", () => { semanasEmpleadoId = select.value; pintarSemanas(); });
        elegirPersona = el("label", { class: "campo" }, el("span", { text: "Persona" }), select);
    }

    const nota = el("p", { class: "admin-nota", text:
        `Cada semana va de lunes a domingo y se pinta en la mitad de arriba de la celda. Códigos de ${colectivo.nombre}: ${colectivo.marcas.join(", ")}.` });

    // Lista de semanas del año
    const filas = lunesDelAnio(anio).map(lunes => {
        const actual = semanas.get(claveExcepcion(empleado.id, lunes)) || "";
        const select = el("select", { "aria-label": `Semana del ${formatoCorto(lunes)}` },
            el("option", { value: "", text: "—" }),
            colectivo.marcas.map(c => el("option", { value: c, text: c })));
        select.value = actual;

        const fila = el("div", { class: "fila-semana" + (lunes === hoyLunes ? " semana-actual" : "") },
            el("span", { class: "semana-fechas", text: `${formatoCorto(lunes)} – ${formatoCorto(sumarDias(lunes, 6))}` }),
            lunes === hoyLunes ? el("span", { class: "semana-hoy", text: "Esta semana" }) : null,
            select
        );
        pintarFilaSemana(fila, actual);

        let anteriorValor = actual;
        select.addEventListener("change", async () => {
            const nuevo = select.value || null;
            const ok = await guardarSemanas(empleado, [{ semana: lunes, codigo: nuevo }]);
            if (ok) { anteriorValor = select.value; pintarFilaSemana(fila, select.value); }
            else select.value = anteriorValor;
        });
        return fila;
    });

    // Aplicar un código a varias semanas seguidas
    const desde = el("input", { type: "date", value: aISO(new Date()), "aria-label": "Desde" });
    const hasta = el("input", { type: "date", value: aISO(new Date()), "aria-label": "Hasta" });
    const codigoRango = el("select", { "aria-label": "Código" },
        el("option", { value: "", text: "Quitar marca" }),
        colectivo.marcas.map(c => el("option", { value: c, text: c })));
    codigoRango.value = colectivo.marcas[0];

    const aplicarRango = async () => {
        if (!desde.value || !hasta.value) { aviso.textContent = "Elige las dos fechas."; return; }
        if (hasta.value < desde.value) { aviso.textContent = "La fecha final no puede ser anterior a la inicial."; return; }
        const lunes = [];
        for (let l = lunesDe(desde.value); l <= hasta.value; l = sumarDias(l, 7)) lunes.push(l);
        if (lunes.length > 110) { aviso.textContent = "El máximo son 110 semanas de una vez."; return; }
        aviso.textContent = "";
        const ok = await guardarSemanas(empleado, lunes.map(semana => ({ semana, codigo: codigoRango.value || null })));
        if (ok) pintarSemanas();
    };

    const bloqueRango = el("div", { class: "admin-grupo" },
        el("h3", { text: "Varias semanas seguidas" }),
        el("p", { class: "admin-nota", text: "Se aplica a todas las semanas que toque el intervalo de fechas." }),
        el("div", { class: "fila-campos" },
            el("label", { class: "campo" }, el("span", { text: "Desde" }), desde),
            el("label", { class: "campo" }, el("span", { text: "Hasta" }), hasta),
            el("label", { class: "campo" }, el("span", { text: "Código" }), codigoRango),
            el("button", { type: "button", text: "Aplicar", onclick: aplicarRango })
        )
    );

    // Solo administrador: patrón que se repite
    let bloquePatron = null;
    if (esAdmin) {
        const inicioPatron = el("input", { type: "date", value: hoyLunes, "aria-label": "Primera semana" });
        const secuencia = el("input", { type: "text", spellcheck: "false", value: colectivo.marcas.join(" "), "aria-label": "Secuencia" });
        const cuantas = el("input", { type: "number", min: "1", max: "260", value: "52", class: "input-corto", "aria-label": "Número de semanas" });

        const aplicarPatron = async () => {
            if (!inicioPatron.value) { aviso.textContent = "Elige la primera semana."; return; }
            const elementos = secuencia.value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
            if (!elementos.length || elementos.some(e => e !== "-" && !colectivo.marcas.includes(e))) {
                aviso.textContent = `Usa solo ${colectivo.marcas.join(", ")} o "-" para una semana sin marca, separados por espacios.`;
                return;
            }
            const n = Number(cuantas.value);
            if (!Number.isInteger(n) || n < 1 || n > 260) { aviso.textContent = "El número de semanas debe estar entre 1 y 260."; return; }
            if (!confirm(`Se pondrán ${n} semanas a ${empleado.nombre} desde la semana del ${formatearFecha(lunesDe(inicioPatron.value))}, repitiendo: ${elementos.join(" ")}. Sustituye lo que haya en esas semanas. ¿Continuar?`)) return;
            aviso.textContent = "";
            const primero = lunesDe(inicioPatron.value);
            const cambios = Array.from({ length: n }, (_, i) => {
                const e = elementos[i % elementos.length];
                return { semana: sumarDias(primero, i * 7), codigo: e === "-" ? null : e };
            });
            const ok = await guardarSemanas(empleado, cambios);
            if (ok) pintarSemanas();
        };

        bloquePatron = el("div", { class: "admin-grupo" },
            el("h3", { text: "Patrón que se repite (administrador)" }),
            el("p", { class: "admin-nota", text: "Escribe la secuencia de códigos, una por semana, y se repite desde la primera semana. Usa - para una semana sin marca. Ejemplo: CT1 CT2 CT3 CT4 CTD CTY" }),
            el("div", { class: "fila-campos" },
                el("label", { class: "campo" }, el("span", { text: "Primera semana (cualquier día)" }), inicioPatron),
                el("label", { class: "campo" }, el("span", { text: "Secuencia" }), secuencia),
                el("label", { class: "campo" }, el("span", { text: "Semanas" }), cuantas),
                el("button", { type: "button", text: "Aplicar patrón", onclick: aplicarPatron })
            )
        );
    }

    reemplazarHijos(contenedor,
        cabecera, elegirPersona, nota, aviso, bloqueRango, bloquePatron,
        el("h3", { class: "grupo-titulo", text: `Semanas de ${anio}` }),
        el("div", { class: "lista-semanas" }, filas)
    );
}

function pintarFilaSemana(fila, codigo) {
    const base = "fila-semana" + (fila.classList.contains("semana-actual") ? " semana-actual" : "");
    fila.className = base + (codigo && MARCAS[codigo] ? " " + MARCAS[codigo].clase + " con-codigo" : "");
}
