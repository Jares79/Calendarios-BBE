// js/horas.js
// Horas y resumen del año:
//  · Administrador ("Horas y convenio"): horas que cuenta cada turno, horas que equivale un día
//    de excesos, días de vacaciones y horas anuales de cada empleado.
//  · Todos ("Ajustes" → Resumen): horas por mes, días de vacaciones, excesos, solapes, permisos...,
//    y las horas y días de excesos que quedan por pedir. Además, coincidencias con compañeros.
//
// Cálculo: horas computables del año = suma de las horas de cada día según su turno (con los
// cambios manuales, festivos e intensivas ya aplicados, y los días previstos del ciclo).
// Pendiente de pedir en excesos = horas computables − horas anuales. Los E que ya están puestos
// en el calendario ya han quitado horas de ese total, así que no se descuentan dos veces.

const CODIGOS_HORAS = ["M", "T", "N", "P", "I", "S", "V", "E", "J", "LD"];
const CODIGOS_TRABAJO = ["M", "T", "N", "P", "I", "S"];

let horasTurno = new Map();      // código -> horas
let configHoras = { horas_dia_exceso: 8, dias_vacaciones: 23 };
let horasAnuales = new Map();    // empleadoId -> horas (cada uno solo ve las suyas; el administrador, todas)
let horasCargadas = false;

async function cargarHoras(forzar) {
    if (horasCargadas && !forzar) return true;
    const [t, c, a] = await Promise.all([
        supabaseClient.from("horas_turno").select("*"),
        supabaseClient.from("config_horas").select("*"),
        supabaseClient.from("horas_anuales").select("*")
    ]);
    if (t.error || c.error || a.error) {
        console.warn("No se pudieron cargar las horas:", t.error || c.error || a.error);
        return false;
    }
    horasTurno = new Map(t.data.map(r => [r.codigo, Number(r.horas)]));
    if (c.data[0]) configHoras = { horas_dia_exceso: Number(c.data[0].horas_dia_exceso), dias_vacaciones: Number(c.data[0].dias_vacaciones) };
    horasAnuales = new Map(a.data.map(r => [r.empleado_id, Number(r.horas)]));
    horasCargadas = true;
    return true;
}

function horasConfiguradas() {
    return [...horasTurno.values()].some(h => h > 0);
}

function formatoHoras(h) {
    return Number(h).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function textoColectivo(empleado) {
    const c = buscarColectivo(empleado.colectivo);
    return c ? c.nombre : "";
}

function todosLosEmpleadosActivos() {
    return colectivos.flatMap(c => empleadosActivos(c));
}

// ======================================================================
// Pantalla del administrador: horas y convenio
// ======================================================================
async function verHorasAdmin() {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    const contenedor = mostrarVistaAdmin();
    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Cargando…" }));

    if (!(await cargarHoras(true))) {
        reemplazarHijos(contenedor, cabeceraHoras("Horas y convenio"),
            el("p", { class: "error-texto", text: "No se pudieron cargar los datos. Puede que falte ejecutar el script de la fase 6 en Supabase." }));
        return;
    }

    // 1) Horas por turno
    const entradasTurno = new Map();
    const filasTurno = CODIGOS_HORAS.map(codigo => {
        const input = el("input", { type: "number", min: "0", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", "aria-label": `Horas de ${TURNOS[codigo].texto}` });
        input.value = horasTurno.has(codigo) ? String(horasTurno.get(codigo)) : "0";
        entradasTurno.set(codigo, input);
        return el("label", { class: "fila-horas " + TURNOS[codigo].clase },
            el("span", { class: "fila-horas-letra", text: codigo }),
            el("span", { class: "fila-horas-nombre", text: TURNOS[codigo].texto }),
            input, el("span", { class: "fila-horas-unidad", text: "h" }));
    });
    const avisoTurnos = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardarTurnos = el("button", { type: "button", text: "Guardar horas por turno" });
    guardarTurnos.addEventListener("click", async () => {
        const filas = [];
        for (const [codigo, input] of entradasTurno) {
            const h = Number(input.value.replace(",", "."));
            if (!Number.isFinite(h) || h < 0 || h > 24) { avisoTurnos.textContent = `Revisa las horas de ${TURNOS[codigo].texto}: entre 0 y 24.`; avisoTurnos.className = "admin-aviso-corto error-texto"; return; }
            filas.push({ codigo, horas: h });
        }
        guardarTurnos.disabled = true;
        const { error } = await supabaseClient.from("horas_turno").upsert(filas, { onConflict: "codigo" });
        guardarTurnos.disabled = false;
        if (error) { console.error(error); avisoTurnos.textContent = "No se pudo guardar."; avisoTurnos.className = "admin-aviso-corto error-texto"; return; }
        filas.forEach(f => horasTurno.set(f.codigo, f.horas));
        avisoTurnos.textContent = "Guardado."; avisoTurnos.className = "admin-aviso-corto admin-ok";
    });

    // 2) Excesos y vacaciones
    const inputExceso = el("input", { type: "number", min: "0.25", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", "aria-label": "Horas de un día de excesos" });
    inputExceso.value = String(configHoras.horas_dia_exceso);
    const inputVacaciones = el("input", { type: "number", min: "0", max: "365", step: "1", inputmode: "numeric", class: "input-corto", "aria-label": "Días de vacaciones al año" });
    inputVacaciones.value = String(configHoras.dias_vacaciones);
    const avisoConfig = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardarConfig = el("button", { type: "button", text: "Guardar" });
    guardarConfig.addEventListener("click", async () => {
        const he = Number(inputExceso.value.replace(",", "."));
        const dv = Number(inputVacaciones.value);
        if (!Number.isFinite(he) || he <= 0 || he > 24 || !Number.isInteger(dv) || dv < 0 || dv > 365) {
            avisoConfig.textContent = "Revisa los valores."; avisoConfig.className = "admin-aviso-corto error-texto"; return;
        }
        guardarConfig.disabled = true;
        const { error } = await supabaseClient.from("config_horas").upsert({ id: 1, horas_dia_exceso: he, dias_vacaciones: dv }, { onConflict: "id" });
        guardarConfig.disabled = false;
        if (error) { console.error(error); avisoConfig.textContent = "No se pudo guardar."; avisoConfig.className = "admin-aviso-corto error-texto"; return; }
        configHoras = { horas_dia_exceso: he, dias_vacaciones: dv };
        avisoConfig.textContent = "Guardado."; avisoConfig.className = "admin-aviso-corto admin-ok";
    });

    // 3) Horas anuales por empleado
    const entradasAnuales = new Map();
    const filasAnuales = colectivos.flatMap(c => empleadosActivos(c).map(emp => {
        const input = el("input", { type: "number", min: "0", max: "9999", step: "0.5", inputmode: "decimal", class: "input-medio", placeholder: "sin definir", "aria-label": `Horas anuales de ${emp.nombre}` });
        if (horasAnuales.has(emp.id)) input.value = String(horasAnuales.get(emp.id));
        entradasAnuales.set(emp.id, input);
        return el("label", { class: "fila-horas fila-horas-emp" },
            el("span", { class: "fila-horas-nombre" }, el("strong", { text: emp.nombre }), el("small", { text: ` · ${c.nombre}` })),
            input, el("span", { class: "fila-horas-unidad", text: "h" }));
    }));
    const avisoAnuales = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardarAnuales = el("button", { type: "button", text: "Guardar horas anuales" });
    guardarAnuales.addEventListener("click", async () => {
        const subir = [], borrar = [];
        for (const [id, input] of entradasAnuales) {
            const texto = input.value.trim().replace(",", ".");
            if (texto === "") { if (horasAnuales.has(id)) borrar.push(id); continue; }
            const h = Number(texto);
            if (!Number.isFinite(h) || h < 0 || h > 9999) { avisoAnuales.textContent = `Revisa las horas de ${buscarEmpleadoPorId(id).nombre}.`; avisoAnuales.className = "admin-aviso-corto error-texto"; return; }
            if (horasAnuales.get(id) !== h) subir.push({ empleado_id: id, horas: h });
        }
        guardarAnuales.disabled = true;
        let error = null;
        if (subir.length) error = (await supabaseClient.from("horas_anuales").upsert(subir, { onConflict: "empleado_id" })).error;
        if (!error && borrar.length) error = (await supabaseClient.from("horas_anuales").delete().in("empleado_id", borrar)).error;
        guardarAnuales.disabled = false;
        if (error) { console.error(error); avisoAnuales.textContent = "No se pudo guardar."; avisoAnuales.className = "admin-aviso-corto error-texto"; return; }
        subir.forEach(r => horasAnuales.set(r.empleado_id, r.horas));
        borrar.forEach(id => horasAnuales.delete(id));
        avisoAnuales.textContent = "Guardado."; avisoAnuales.className = "admin-aviso-corto admin-ok";
    });

    reemplazarHijos(contenedor,
        cabeceraHoras("Horas y convenio"),
        el("div", { class: "admin-grupo" },
            el("h3", { text: "Horas de cada turno" }),
            el("p", { class: "admin-nota", text: "Las horas que cuenta cada día de ese turno al sumar las del año. Pon 0 en los que no deben sumar (por ejemplo E, si los excesos no cuentan como trabajados; F no suma nunca)." }),
            filasTurno, el("div", { class: "fila-guardar" }, guardarTurnos, avisoTurnos)),
        el("div", { class: "admin-grupo" },
            el("h3", { text: "Excesos y vacaciones" }),
            el("label", { class: "fila-horas" }, el("span", { class: "fila-horas-nombre", text: "Horas que equivale un día de excesos (E)" }), inputExceso, el("span", { class: "fila-horas-unidad", text: "h" })),
            el("label", { class: "fila-horas" }, el("span", { class: "fila-horas-nombre", text: "Días de vacaciones al año" }), inputVacaciones, el("span", { class: "fila-horas-unidad", text: "días" })),
            el("div", { class: "fila-guardar" }, guardarConfig, avisoConfig)),
        el("div", { class: "admin-grupo" },
            el("h3", { text: "Horas anuales de cada empleado" }),
            el("p", { class: "admin-nota", text: "Las horas anuales de convenio de cada persona. Cada uno solo ve las suyas. Déjalo vacío si aún no lo sabes." }),
            filasAnuales, el("div", { class: "fila-guardar" }, guardarAnuales, avisoAnuales))
    );
}

function cabeceraHoras(titulo, alVolver) {
    return el("div", { class: "resultado-cabecera" },
        el("h2", { text: titulo }),
        el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: alVolver || volverDeHoras })
    );
}

function volverDeHoras() {
    cerrarVistaResultado();
    verMiCalendario();
}

// ======================================================================
// Resumen del año y coincidencias (desde Ajustes)
// ======================================================================
let resumenAnio = null;
let resumenPestana = "resumen";          // resumen | coincidencias | todos
let resumenEmpleadoId = null;
let coincidenciasAmbito = "colectivo";   // colectivo | todos
let coincidenciasDesdeHoy = false;

function puedeVerResumen() {
    return !!usuarioActual && !esPerfilFamiliar() && !!obtenerEmpleadoActual();
}

// Horas y días de un empleado en un año
async function calcularResumen(empleado, anio) {
    await asegurarAnio(anio);
    const meses = Array.from({ length: 12 }, () => ({ horas: 0, dias: {} }));
    const total = { horas: 0, dias: {} };
    for (let mes = 0; mes < 12; mes++) {
        const diasMes = new Date(anio, mes + 1, 0).getDate();
        for (let dia = 1; dia <= diasMes; dia++) {
            const codigo = infoTurno(aISO(new Date(anio, mes, dia)), empleado).codigo;
            const h = horasTurno.get(codigo) || 0;
            meses[mes].horas += h;
            meses[mes].dias[codigo] = (meses[mes].dias[codigo] || 0) + 1;
            total.horas += h;
            total.dias[codigo] = (total.dias[codigo] || 0) + 1;
        }
    }
    return { meses, total };
}

// Horas que quedan por pedir como excesos (negativo = se ha pedido de más). null si no hay horas anuales.
function excesoPendiente(horasComputables, empleadoId) {
    return horasAnuales.has(empleadoId) ? horasComputables - horasAnuales.get(empleadoId) : null;
}

function textoExceso(pendiente) {
    if (pendiente === null) return "—";
    const dias = Math.abs(pendiente) / configHoras.horas_dia_exceso;
    const diasTexto = formatoHoras(Math.round(dias * 10) / 10);
    if (Math.abs(pendiente) < 0.005) return "0 h";
    return pendiente > 0 ? `${formatoHoras(pendiente)} h (≈ ${diasTexto} días)` : `−${formatoHoras(-pendiente)} h (≈ −${diasTexto} días, de más)`;
}

async function verResumen(pestana) {
    if (!puedeVerResumen()) return;
    const contenedor = mostrarVistaAdmin();
    if (pestana) resumenPestana = pestana;
    if (resumenAnio === null) resumenAnio = anioInicialAdmin();
    const yo = obtenerEmpleadoActual();
    const esAdmin = puedeGestionarUsuarios(usuarioActual);
    if (!esAdmin || !buscarEmpleadoPorId(resumenEmpleadoId)) resumenEmpleadoId = yo.id;
    if (resumenPestana === "todos" && !esAdmin) resumenPestana = "resumen";

    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Calculando…" }));
    const ok = await cargarHoras();
    if (!ok) {
        reemplazarHijos(contenedor, cabeceraHoras("Resumen", volverAAjustes),
            el("p", { class: "error-texto", text: "No se pudieron cargar los datos de horas. Puede que falte activar esta función en Supabase (script de la fase 6)." }));
        return;
    }
    await asegurarAnio(resumenAnio);

    const pestanas = [["resumen", "Resumen"], ["coincidencias", "Coincidencias"]];
    if (esAdmin) pestanas.push(["todos", "Todos"]);

    const barra = el("div", { class: "pestanas-cambios" }, pestanas.map(([clave, texto]) =>
        el("button", { type: "button", class: "pestana-cambios" + (resumenPestana === clave ? " elegido" : ""),
            onclick: () => verResumen(clave) }, texto)));

    const selectAnio = selectorAnio(resumenAnio, (a) => { resumenAnio = a; verResumen(); });
    const cabecera = el("div", { class: "resultado-cabecera" },
        el("h2", { text: "Resumen del año" }),
        el("div", { class: "resultado-acciones" }, selectAnio,
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: volverAAjustes }))
    );

    let selectorPersona = null;
    if (esAdmin && resumenPestana !== "todos") {
        const select = el("select", { "aria-label": "Persona" },
            todosLosEmpleadosActivos().map(e => el("option", { value: e.id, text: `${e.nombre} (${e.iniciales}) · ${textoColectivo(e)}` })));
        select.value = resumenEmpleadoId;
        select.addEventListener("change", () => { resumenEmpleadoId = select.value; verResumen(); });
        selectorPersona = el("label", { class: "campo" }, el("span", { text: "Persona" }), select);
    }

    const aviso = !horasConfiguradas()
        ? el("p", { class: "avisos-cambio", text: esAdmin
            ? "Aún no has indicado las horas de cada turno: entra en «Horas y convenio» del menú para que se calculen las horas."
            : "El administrador aún no ha indicado las horas de cada turno, así que las horas salen a 0." })
        : null;

    let cuerpo;
    if (resumenPestana === "coincidencias") cuerpo = await cuerpoCoincidencias(buscarEmpleadoPorId(resumenEmpleadoId));
    else if (resumenPestana === "todos") cuerpo = await cuerpoTodos();
    else cuerpo = await cuerpoResumenPersona(buscarEmpleadoPorId(resumenEmpleadoId), resumenAnio);

    reemplazarHijos(contenedor, cabecera, barra, selectorPersona, aviso, cuerpo);
}

function volverAAjustes() {
    if (typeof verAjustes === "function") verAjustes();
    else volverDeHoras();
}

function dato(etiqueta, valor, clase) {
    return el("div", { class: "dato-resumen " + (clase || "") },
        el("span", { class: "dato-etiqueta", text: etiqueta }),
        el("strong", { class: "dato-valor", text: valor }));
}

async function cuerpoResumenPersona(empleado, anio) {
    const { meses, total } = await calcularResumen(empleado, anio);
    const anuales = horasAnuales.has(empleado.id) ? horasAnuales.get(empleado.id) : null;
    const pendiente = excesoPendiente(total.horas, empleado.id);
    const dias = (c) => total.dias[c] || 0;
    const vac = configHoras.dias_vacaciones;

    const tarjetas = el("div", { class: "tarjetas-resumen" },
        dato("Horas anuales (convenio)", anuales === null ? "Sin definir" : `${formatoHoras(anuales)} h`),
        dato("Horas computables del año", `${formatoHoras(total.horas)} h`),
        dato("Excesos pendientes de pedir", textoExceso(pendiente), pendiente !== null && pendiente < 0 ? "dato-aviso" : "dato-destacado"),
        dato("Vacaciones (V)", `${dias("V")} de ${vac} · quedan ${Math.max(0, vac - dias("V"))}`, dias("V") > vac ? "dato-aviso" : ""),
        dato("Excesos puestos (E)", `${dias("E")} ${dias("E") === 1 ? "día" : "días"}`),
        dato("Solapes (S)", `${dias("S")} ${dias("S") === 1 ? "día" : "días"}`),
        dato("Permisos justificados (J)", `${dias("J")} ${dias("J") === 1 ? "día" : "días"}`),
        dato("Libre disposición (LD)", `${dias("LD")} ${dias("LD") === 1 ? "día" : "días"}`)
    );

    // Tabla por meses: solo las columnas de turnos que aparecen en el año
    const columnas = CODIGOS_HORAS.filter(c => dias(c) > 0);
    const nombreMes = (i) => new Date(2000, i, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    const tabla = el("div", { class: "tabla-scroll" }, el("table", { class: "tabla-resumen" },
        el("thead", {}, el("tr", {},
            el("th", { text: "Mes" }), el("th", { text: "Horas" }),
            columnas.map(c => el("th", { class: TURNOS[c].clase, text: c, title: TURNOS[c].texto })))),
        el("tbody", {}, meses.map((m, i) => el("tr", {},
            el("td", { text: nombreMes(i) }), el("td", { class: "num", text: formatoHoras(m.horas) }),
            columnas.map(c => el("td", { class: "num", text: m.dias[c] || "" }))))),
        el("tfoot", {}, el("tr", {},
            el("td", { text: "Año" }), el("td", { class: "num", text: formatoHoras(total.horas) }),
            columnas.map(c => el("td", { class: "num", text: dias(c) }))))
    ));

    return el("div", {},
        el("h3", { class: "grupo-titulo", text: `${empleado.nombre} · ${anio}` }),
        tarjetas,
        el("p", { class: "admin-nota", text: "Las horas incluyen los días previstos del año (ciclo, festivos, intensivas y tus cambios). Los excesos que ya has puesto en el calendario ya están descontados de las horas computables." }),
        el("h3", { class: "grupo-titulo", text: "Por meses" }),
        tabla
    );
}

// Administrador: todos los empleados de un vistazo
async function cuerpoTodos() {
    const anio = resumenAnio;
    const filas = [];
    for (const colectivo of colectivos) {
        for (const emp of empleadosActivos(colectivo)) {
            const { total } = await calcularResumen(emp, anio);
            const pend = excesoPendiente(total.horas, emp.id);
            const d = (c) => total.dias[c] || 0;
            filas.push(el("tr", { class: "fila-clicable", onclick: () => { resumenEmpleadoId = emp.id; verResumen("resumen"); } },
                el("td", {}, el("strong", { text: emp.nombre }), el("small", { text: ` · ${colectivo.puesto}` })),
                el("td", { class: "num", text: horasAnuales.has(emp.id) ? formatoHoras(horasAnuales.get(emp.id)) : "—" }),
                el("td", { class: "num", text: formatoHoras(total.horas) }),
                el("td", { class: "num" + (pend !== null && pend < 0 ? " dato-aviso" : ""), text: pend === null ? "—" : formatoHoras(Math.round(pend * 100) / 100) }),
                el("td", { class: "num", text: pend === null ? "—" : formatoHoras(Math.round(pend / configHoras.horas_dia_exceso * 10) / 10) }),
                el("td", { class: "num", text: d("V") }), el("td", { class: "num", text: d("E") }),
                el("td", { class: "num", text: d("S") }), el("td", { class: "num", text: d("J") })));
        }
    }
    return el("div", {},
        el("h3", { class: "grupo-titulo", text: `Todos los empleados · ${anio}` }),
        el("p", { class: "admin-nota", text: "Toca una persona para ver su resumen por meses. «Pend.» son las horas de excesos que le quedan por pedir (negativo = de más) y «Días E» su equivalente en días." }),
        el("div", { class: "tabla-scroll" }, el("table", { class: "tabla-resumen" },
            el("thead", {}, el("tr", {}, ["Empleado", "Anuales", "Horas", "Pend. h", "Días E", "V", "E", "S", "J"].map(t => el("th", { text: t })))),
            el("tbody", {}, filas))));
}

// Coincidencias con compañeros: cuántos días coincides con cada uno
async function cuerpoCoincidencias(empleado) {
    const anio = resumenAnio;
    const hoy = aISO(new Date());
    const miColectivo = buscarColectivo(empleado.colectivo);
    const candidatos = (coincidenciasAmbito === "colectivo" ? empleadosActivos(miColectivo) : todosLosEmpleadosActivos())
        .filter(e => e.id !== empleado.id);

    const dias = [];
    for (let mes = 0; mes < 12; mes++) {
        const n = new Date(anio, mes + 1, 0).getDate();
        for (let d = 1; d <= n; d++) {
            const iso = aISO(new Date(anio, mes, d));
            if (!coincidenciasDesdeHoy || iso >= hoy) dias.push(iso);
        }
    }
    const mios = dias.map(iso => infoTurno(iso, empleado).codigo);

    const resultados = candidatos.map(emp => {
        let mismo = 0, ambos = 0, libran = 0;
        dias.forEach((iso, i) => {
            const a = mios[i], b = infoTurno(iso, emp).codigo;
            const ta = CODIGOS_TRABAJO.includes(a), tb = CODIGOS_TRABAJO.includes(b);
            if (ta && tb) { ambos++; if (a === b) mismo++; }
            if (a === "F" && b === "F") libran++;
        });
        return { emp, mismo, ambos, libran };
    }).sort((x, y) => y.mismo - x.mismo || y.ambos - x.ambos);

    const selectAmbito = el("select", { "aria-label": "Compañeros" },
        el("option", { value: "colectivo", text: "Mi colectivo" }), el("option", { value: "todos", text: "Todos los colectivos" }));
    selectAmbito.value = coincidenciasAmbito;
    selectAmbito.addEventListener("change", () => { coincidenciasAmbito = selectAmbito.value; verResumen("coincidencias"); });
    const selectPeriodo = el("select", { "aria-label": "Periodo" },
        el("option", { value: "anio", text: "Año completo" }), el("option", { value: "hoy", text: "Desde hoy" }));
    selectPeriodo.value = coincidenciasDesdeHoy ? "hoy" : "anio";
    selectPeriodo.addEventListener("change", () => { coincidenciasDesdeHoy = selectPeriodo.value === "hoy"; verResumen("coincidencias"); });

    return el("div", {},
        el("h3", { class: "grupo-titulo", text: `Coincidencias de ${empleado.nombre} · ${anio}` }),
        el("div", { class: "fila-campos" },
            el("label", { class: "campo" }, el("span", { text: "Con" }), selectAmbito),
            el("label", { class: "campo" }, el("span", { text: "Periodo" }), selectPeriodo)),
        el("p", { class: "admin-nota", text: "«Mismo turno»: días en que los dos trabajáis el mismo turno. «Trabajáis»: días en que los dos trabajáis (sea el turno que sea). «Libráis»: días en que los dos estáis de fiesta (F)." }),
        resultados.length
            ? el("div", { class: "tabla-scroll" }, el("table", { class: "tabla-resumen" },
                el("thead", {}, el("tr", {}, ["Compañero", "Mismo turno", "Trabajáis", "Libráis"].map(t => el("th", { text: t })))),
                el("tbody", {}, resultados.map(r => el("tr", {},
                    el("td", {}, el("strong", { text: r.emp.nombre }),
                        coincidenciasAmbito === "todos" ? el("small", { text: ` · ${textoColectivo(r.emp)}` }) : null),
                    el("td", { class: "num dato-destacado", text: r.mismo }),
                    el("td", { class: "num", text: r.ambos }), el("td", { class: "num", text: r.libran }))))))
            : el("p", { class: "aviso-vacio", text: "No hay compañeros con los que comparar." }));
}
