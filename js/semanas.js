// js/semanas.js
// Marcas de la mitad de arriba de la celda: D (disponible) y las semanas de correturno
// (CTD, CT1, CT2, CT3, CT4, CTY). Cada una se pone a una semana entera (de lunes a domingo) o a un
// día suelto; la mitad de abajo sigue siendo el turno del día.
//
// El administrador decide quién puede usar cada marca (Empleados y accesos → Disponibilidades y CT);
// solo a esas personas se les parte la celda y se les ofrecen esas marcas en el editor.
// La base de datos comprueba los permisos en el servidor.

// Marcas que un empleado puede usar, en el orden de MARCAS
function permitidasDe(empleado) {
    return empleado ? Object.keys(MARCAS).filter(c => empleado.marcas.includes(c)) : [];
}

function formatoCorto(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
}

function sumarDias(iso, dias) {
    return new Date((diaNumero(iso) + dias) * 86400000).toISOString().slice(0, 10);
}

// --- Guardar ---
// cambios: [{ semana: "AAAA-MM-DD" (lunes), codigo: "D" | "CT1"... | null }]  (null = quitar la marca)
async function guardarSemanas(empleado, cambios) {
    const permitidas = permitidasDe(empleado);
    if (!permitidas.length) {
        mostrarToast("Esa persona no tiene marcas activadas.", true);
        return false;
    }
    if (cambios.some(c => c.codigo && !permitidas.includes(c.codigo))) {
        mostrarToast("Ese código no está permitido para esta persona.", true);
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

    // Poner o quitar una semana entera deja también sin efecto los días sueltos de esa semana
    const limpiar = [];
    cambios.forEach(({ semana }) => {
        for (let i = 0; i < 7; i++) {
            const f = sumarDias(semana, i);
            if (marcasDia.has(claveExcepcion(empleado.id, f))) limpiar.push({ fecha: f, codigo: null });
        }
    });

    if (!subir.length && !borrar.length && !limpiar.length) {
        mostrarToast("Ya estaba así");
        return true;
    }
    if (limpiar.length && !(await guardarMarcasDia(empleado, limpiar, true))) return false;
    if (!subir.length && !borrar.length) {
        mostrarToast("Guardado");
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

// Marcas de días sueltos. cambios: [{ fecha, codigo }] con codigo = "D" | "CT1"... (marca ese día),
// "-" (ese día sin marca aunque su semana la tenga) o null (borra el día suelto).
async function guardarMarcasDia(empleado, cambios, silencioso) {
    const permitidas = permitidasDe(empleado);
    if (!permitidas.length) {
        mostrarToast("Esa persona no tiene marcas activadas.", true);
        return false;
    }
    if (cambios.some(c => c.codigo && c.codigo !== "-" && !permitidas.includes(c.codigo))) {
        mostrarToast("Ese código no está permitido para esta persona.", true);
        return false;
    }
    await Promise.all([...new Set(cambios.map(c => Number(c.fecha.slice(0, 4))))].map(asegurarAnio));

    const subir = [], borrar = [], anterior = new Map();
    cambios.forEach(({ fecha, codigo }) => {
        const clave = claveExcepcion(empleado.id, fecha);
        const actual = marcasDia.get(clave);
        if ((codigo || undefined) === actual) return;
        anterior.set(clave, actual);
        if (codigo) subir.push({ empleado_id: empleado.id, fecha, codigo });
        else borrar.push(fecha);
    });
    if (!subir.length && !borrar.length) {
        if (!silencioso) mostrarToast("Ya estaba así");
        return true;
    }

    subir.forEach(r => marcasDia.set(claveExcepcion(r.empleado_id, r.fecha), r.codigo));
    borrar.forEach(f => marcasDia.delete(claveExcepcion(empleado.id, f)));
    refrescarCalendarioPropio();

    let fallo = null;
    for (let i = 0; i < subir.length && !fallo; i += 200) {
        const r = await supabaseClient.from("marcas_dia")
            .upsert(subir.slice(i, i + 200), { onConflict: "empleado_id,fecha" });
        fallo = r.error;
    }
    for (let i = 0; i < borrar.length && !fallo; i += 100) {
        const r = await supabaseClient.from("marcas_dia")
            .delete().eq("empleado_id", empleado.id).in("fecha", borrar.slice(i, i + 100));
        fallo = r.error;
    }
    if (fallo) {
        console.error("Error al guardar marcas de días:", fallo);
        anterior.forEach((valor, clave) => {
            if (valor === undefined) marcasDia.delete(clave);
            else marcasDia.set(clave, valor);
        });
        refrescarCalendarioPropio();
        mostrarToast("No se pudo guardar. Inténtalo de nuevo.", true);
        return false;
    }
    if (!silencioso) mostrarToast("Guardado");
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

// Bloque "Marca" de la hoja de edición de un día: poner o quitar la marca de ese día o de toda su semana
function crearSeccionSemana(fechaISO, empleado) {
    const permitidas = permitidasDe(empleado);
    if (!permitidas.length) return null;
    const lunes = lunesDe(fechaISO);
    const marcaHoy = infoTurno(fechaISO, empleado).marca;
    const semanaTiene = !!semanas.get(claveExcepcion(empleado.id, lunes));
    const hayDiasSueltos = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
        .some(f => marcasDia.has(claveExcepcion(empleado.id, f)));

    let ambito = "dia";   // "dia" = solo este día, "semana" = toda la semana
    const botonDia = el("button", { type: "button", class: "btn-secundario elegido", text: "Solo este día" });
    const botonSemana = el("button", { type: "button", class: "btn-secundario", text: "Toda la semana" });
    const elegirAmbito = (nuevo) => {
        ambito = nuevo;
        botonDia.classList.toggle("elegido", nuevo === "dia");
        botonSemana.classList.toggle("elegido", nuevo === "semana");
    };
    botonDia.onclick = () => elegirAmbito("dia");
    botonSemana.onclick = () => elegirAmbito("semana");

    return el("div", { class: "seccion-semana" },
        el("p", { class: "detalle-etiqueta", text: `Marca de arriba (semana del ${formatoCorto(lunes)} al ${formatoCorto(domingoDe(fechaISO))})` }),
        el("div", { class: "ambito-marca" }, botonDia, botonSemana),
        crearRejillaMarcas(permitidas, (codigo) => {
            ocultarDetalleDia();
            if (ambito === "dia") guardarMarcasDia(empleado, [{ fecha: fechaISO, codigo }]);
            else guardarSemanas(empleado, [{ semana: lunes, codigo }]);
        }, marcaHoy ? marcaHoy.codigo : null),
        el("button", {
            type: "button", class: "btn-secundario btn-ancho",
            text: "Quitar la marca solo de este día",
            disabled: marcaHoy ? null : true,
            onclick: () => {
                ocultarDetalleDia();
                // Si la semana tiene marca, este día se queda "sin marca"; si no, se borra el día suelto
                guardarMarcasDia(empleado, [{ fecha: fechaISO, codigo: semanaTiene ? "-" : null }]);
            }
        }),
        el("button", {
            type: "button", class: "btn-secundario btn-ancho",
            text: "Quitar la marca de toda la semana",
            disabled: semanaTiene || hayDiasSueltos ? null : true,
            onclick: () => {
                ocultarDetalleDia();
                guardarSemanas(empleado, [{ semana: lunes, codigo: null }]);
            }
        })
    );
}

// --- Administrador: quién puede usar cada marca ---
async function verMarcasAdmin() {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    const contenedor = mostrarVistaAdmin();
    const codigos = Object.keys(MARCAS);
    const entradas = new Map();   // empleadoId -> { empleado, cajas: Map(codigo -> checkbox) }

    const grupos = colectivos.map(c => el("div", { class: "admin-grupo" },
        el("h3", { text: `${c.icono} ${c.nombre}` }),
        c.empleados.filter(e => e.activo).length
            ? c.empleados.filter(e => e.activo).map(emp => {
                const cajas = new Map();
                entradas.set(emp.id, { empleado: emp, cajas });
                return el("div", { class: "fila-marcas" },
                    el("strong", { class: "fila-marcas-nombre", text: emp.nombre }),
                    el("div", { class: "fila-marcas-opciones" }, codigos.map(codigo => {
                        const caja = el("input", { type: "checkbox", "aria-label": `${MARCAS[codigo].texto} para ${emp.nombre}` });
                        caja.checked = emp.marcas.includes(codigo);
                        cajas.set(codigo, caja);
                        return el("label", { class: "opcion-marca " + MARCAS[codigo].clase, title: MARCAS[codigo].texto }, caja, el("span", { text: codigo }));
                    })));
            })
            : el("p", { class: "admin-nota", text: "Sin empleados activos." })
    ));

    const aviso = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardar = el("button", { type: "button", text: "Guardar" });
    guardar.addEventListener("click", async () => {
        guardar.disabled = true;
        let fallos = 0, cambiados = 0;
        for (const { empleado, cajas } of entradas.values()) {
            const nuevas = codigos.filter(c => cajas.get(c).checked);
            if (nuevas.join() === empleado.marcas.join()) continue;
            const r = await rpcMarcas(empleado.id, nuevas);
            if (r.ok) { empleado.marcas = nuevas; cambiados++; } else fallos++;
        }
        guardar.disabled = false;
        if (fallos) { aviso.textContent = "No se pudieron guardar algunos cambios."; aviso.className = "admin-aviso-corto error-texto"; }
        else { aviso.textContent = cambiados ? "Guardado." : "No había cambios."; aviso.className = "admin-aviso-corto admin-ok"; }
    });

    reemplazarHijos(contenedor,
        el("div", { class: "resultado-cabecera" },
            el("h2", { text: "Disponibilidades y CT" }),
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: verGestionAdmin })),
        el("p", { class: "admin-nota", text: "Marca qué puede hacer cada persona: D (disponible) y las semanas de correturno CTD, CT1, CT2, CT3, CT4 y CTY. Solo a quien tenga alguna marcada se le parte la celda en dos mitades y se le ofrecen esas marcas al editar su calendario." }),
        grupos,
        el("div", { class: "fila-guardar" }, guardar, aviso));
}

async function rpcMarcas(empleadoId, marcas) {
    const { data, error } = await supabaseClient.rpc("admin_guardar_marcas", { p_empleado: empleadoId, p_marcas: marcas });
    if (error) { console.error("Error al guardar marcas:", error); return { ok: false }; }
    return data || { ok: false };
}
