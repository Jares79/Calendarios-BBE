// js/horas.js
// Horas, por año:
//  · Administrador ("Horas y convenio"): horas que cuenta cada turno, horas que equivale un día de
//    excesos, días de vacaciones y horas anuales de cada empleado. Cambian de un año a otro.
//  · Todos (menú "Horas"): horas por mes, días de vacaciones, excesos, solapes, permisos..., y las
//    horas y días de excesos que quedan por pedir. El administrador ve a todos.
//  · Editor de calendario: horas que computa cada turno y ajuste manual de las horas de un día
//    (por ejemplo, una baja que computa igual que el turno que tocaba).
//
// Cálculo: horas computables del año = suma de las horas de cada día (las del turno de ese año o el
// ajuste manual del día), con cambios manuales, festivos e intensivas ya aplicados y los días
// previstos del ciclo. Pendiente de pedir en excesos = horas computables − horas anuales. Los E que ya
// están puestos en el calendario ya han quitado horas de ese total, así que no se descuentan dos veces.

// Turnos con horas propias (las que fija el administrador en "Horas y convenio")
const CODIGOS_HORAS = ["M", "T", "N", "P", "I", "S", "V", "E"];
// Turnos que se pintan pero suman las horas que había previstas ese día (baja, libre disposición, permiso
// justificado, y el solape cuando se pone a mano). Se pueden ajustar día a día.
const CODIGOS_SUMAN_PREVISTAS = ["B", "LD", "J", "S"];
// Columnas de la tabla por meses del resumen de horas
const COLUMNAS_RESUMEN = ["M", "T", "N", "P", "I", "S", "V", "E", "J", "LD", "B"];

let horasTurno = new Map();      // "año|código" -> horas
let configHoras = new Map();     // año -> { horas_dia_exceso, dias_vacaciones }
let horasAnuales = new Map();    // "empleadoId|año" -> horas (cada uno solo ve las suyas; el administrador, todas)
let horasCargadas = false;
let anioHorasEnUso = new Date().getFullYear();

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
    horasTurno = new Map(t.data.map(r => [`${r.anio}|${r.codigo}`, Number(r.horas)]));
    configHoras = new Map(c.data.map(r => [Number(r.anio), {
        horas_dia_exceso: Number(r.horas_dia_exceso), dias_vacaciones: Number(r.dias_vacaciones),
        dias_ld: r.dias_ld === undefined || r.dias_ld === null ? 2 : Number(r.dias_ld)
    }]));
    horasAnuales = new Map(a.data.map(r => [`${r.empleado_id}|${r.anio}`, Number(r.horas)]));
    horasCargadas = true;
    return true;
}

// Texto corto con el motivo técnico de un fallo de Supabase, para que se pueda localizar el problema
function detalleError(error) {
    if (!error) return "";
    const motivo = error.code || error.message || "";
    return motivo ? ` (${String(motivo).slice(0, 60)})` : "";
}

function horasDeTurno(anio, codigo) {
    return horasTurno.get(`${anio}|${codigo}`) || 0;
}

function configDe(anio) {
    return configHoras.get(anio) || { horas_dia_exceso: 8, dias_vacaciones: 23, dias_ld: 2 };
}

function anualesDe(empleadoId, anio) {
    const clave = `${empleadoId}|${anio}`;
    return horasAnuales.has(clave) ? horasAnuales.get(clave) : null;
}

function horasConfiguradas(anio) {
    return CODIGOS_HORAS.some(c => horasDeTurno(anio, c) > 0);
}

function formatoHoras(h) {
    return Number(h).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

// ¿Se le enseñan las horas anuales y los excesos? Los colectivos de turnos siempre; el resto,
// solo si el administrador lo activa en la ficha del empleado.
function veHoras(empleado) {
    if (!empleado) return false;
    const c = buscarColectivo(empleado.colectivo);
    return !!c && (c.tipo === "turnos" || empleado.verHoras === true);
}

function textoColectivo(empleado) {
    const c = buscarColectivo(empleado.colectivo);
    return c ? c.nombre : "";
}

function todosLosEmpleadosActivos() {
    return colectivos.flatMap(c => empleadosActivos(c));
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
// Pantalla del administrador: horas y convenio (por año)
// ======================================================================
let horasAdminAnio = null;

// plantilla: año del que se copian los valores (opcional); no se guardan hasta pulsar Guardar
async function verHorasAdmin(anio, plantilla) {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    const contenedor = mostrarVistaAdmin();
    if (anio === undefined) anio = horasAdminAnio !== null ? horasAdminAnio : anioInicialAdmin();
    horasAdminAnio = anio;
    const origen = plantilla !== undefined ? plantilla : anio;
    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Cargando…" }));

    if (!(await cargarHoras(true))) {
        reemplazarHijos(contenedor, cabeceraHoras("Horas y convenio"),
            el("p", { class: "error-texto", text: "No se pudieron cargar los datos. Puede que falte ejecutar el script de la fase 9 en Supabase." }));
        return;
    }

    const selectAnio = selectorAnio(anio, (a) => verHorasAdmin(a));
    const config0 = configHoras.has(origen) ? configHoras.get(origen) : configDe(anio);

    // 1) Horas por turno
    const entradasTurno = new Map();
    const filasTurno = CODIGOS_HORAS.map(codigo => {
        const input = el("input", { type: "number", min: "0", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", "aria-label": `Horas de ${TURNOS[codigo].texto}` });
        input.value = String(horasDeTurno(origen, codigo));
        entradasTurno.set(codigo, input);
        return el("label", { class: "fila-horas " + TURNOS[codigo].clase },
            el("span", { class: "fila-horas-letra", text: codigo }),
            el("span", { class: "fila-horas-nombre", text: TURNOS[codigo].texto }),
            input, el("span", { class: "fila-horas-unidad", text: "h" }));
    });
    const avisoTurnos = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardarTurnos = el("button", { type: "button", text: `Guardar horas por turno de ${anio}` });
    guardarTurnos.addEventListener("click", async () => {
        const filas = [];
        for (const [codigo, input] of entradasTurno) {
            const h = Number(input.value.replace(",", "."));
            if (!Number.isFinite(h) || h < 0 || h > 24) { avisoTurnos.textContent = `Revisa las horas de ${TURNOS[codigo].texto}: entre 0 y 24.`; avisoTurnos.className = "admin-aviso-corto error-texto"; return; }
            filas.push({ anio, codigo, horas: h });
        }
        guardarTurnos.disabled = true;
        const { error } = await supabaseClient.from("horas_turno").upsert(filas, { onConflict: "anio,codigo" });
        guardarTurnos.disabled = false;
        if (error) { console.error(error); avisoTurnos.textContent = "No se pudo guardar." + detalleError(error); avisoTurnos.className = "admin-aviso-corto error-texto"; return; }
        filas.forEach(f => horasTurno.set(`${anio}|${f.codigo}`, f.horas));
        avisoTurnos.textContent = "Guardado."; avisoTurnos.className = "admin-aviso-corto admin-ok";
    });

    // 2) Excesos y vacaciones
    const inputExceso = el("input", { type: "number", min: "0.25", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", "aria-label": "Horas de un día de excesos" });
    inputExceso.value = String(config0.horas_dia_exceso);
    const inputVacaciones = el("input", { type: "number", min: "0", max: "365", step: "1", inputmode: "numeric", class: "input-corto", "aria-label": "Días de vacaciones al año" });
    inputVacaciones.value = String(config0.dias_vacaciones);
    const inputLD = el("input", { type: "number", min: "0", max: "365", step: "1", inputmode: "numeric", class: "input-corto", "aria-label": "Días de libre disposición al año" });
    inputLD.value = String(config0.dias_ld);
    const avisoConfig = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardarConfig = el("button", { type: "button", text: `Guardar ${anio}` });
    guardarConfig.addEventListener("click", async () => {
        const he = Number(inputExceso.value.replace(",", "."));
        const dv = Number(inputVacaciones.value);
        const dl = Number(inputLD.value);
        if (!Number.isFinite(he) || he <= 0 || he > 24 || !Number.isInteger(dv) || dv < 0 || dv > 365 || !Number.isInteger(dl) || dl < 0 || dl > 365) {
            avisoConfig.textContent = "Revisa los valores."; avisoConfig.className = "admin-aviso-corto error-texto"; return;
        }
        guardarConfig.disabled = true;
        const { error } = await supabaseClient.from("config_horas").upsert({ anio, horas_dia_exceso: he, dias_vacaciones: dv, dias_ld: dl }, { onConflict: "anio" });
        guardarConfig.disabled = false;
        if (error) { console.error(error); avisoConfig.textContent = "No se pudo guardar." + detalleError(error); avisoConfig.className = "admin-aviso-corto error-texto"; return; }
        configHoras.set(anio, { horas_dia_exceso: he, dias_vacaciones: dv, dias_ld: dl });
        avisoConfig.textContent = "Guardado."; avisoConfig.className = "admin-aviso-corto admin-ok";
    });

    const copiar = el("button", { type: "button", class: "btn-secundario", text: `Copiar los valores de ${anio - 1}`,
        onclick: () => verHorasAdmin(anio, anio - 1) });

    reemplazarHijos(contenedor,
        cabeceraHoras("Horas y convenio"),
        el("div", { class: "fila-guardar" }, selectAnio, copiar),
        plantilla !== undefined ? el("p", { class: "avisos-cambio", text: `Valores copiados de ${plantilla}: revísalos y pulsa Guardar en cada apartado para aplicarlos a ${anio}.` }) : null,
        el("div", { class: "admin-grupo" },
            el("h3", { text: `Horas de cada turno · ${anio}` }),
            el("p", { class: "admin-nota", text: "Las horas que cuenta cada día de ese turno al sumar las del año. Pon 0 en los que no deben sumar (por ejemplo E, si los excesos no cuentan como trabajados; F no suma nunca)." }),
            filasTurno,
            el("p", { class: "admin-nota", text: "B (baja), LD y J no tienen horas propias: suman las que había previstas ese día (se pueden ajustar en cada día). El solape (S) tiene las suyas cuando sale del ciclo y, si se pone a mano, suma las previstas." }),
            el("div", { class: "fila-guardar" }, guardarTurnos, avisoTurnos)),
        el("div", { class: "admin-grupo" },
            el("h3", { text: `Excesos, vacaciones y libre disposición · ${anio}` }),
            el("label", { class: "fila-horas" }, el("span", { class: "fila-horas-nombre", text: "Horas que equivale un día de excesos (E)" }), inputExceso, el("span", { class: "fila-horas-unidad", text: "h" })),
            el("label", { class: "fila-horas" }, el("span", { class: "fila-horas-nombre", text: "Días de vacaciones al año" }), inputVacaciones, el("span", { class: "fila-horas-unidad", text: "días" })),
            el("label", { class: "fila-horas" }, el("span", { class: "fila-horas-nombre", text: "Días de libre disposición (LD) al año" }), inputLD, el("span", { class: "fila-horas-unidad", text: "días" })),
            el("div", { class: "fila-guardar" }, guardarConfig, avisoConfig))
        ,
        el("p", { class: "admin-nota", text: "Las horas anuales de convenio las pone cada persona en sus Ajustes. Aquí las verás en la pantalla Horas (pestaña Todos)." })
    );
}

// ======================================================================
// Sección "Horas" del menú: resumen del año
// ======================================================================
let resumenAnio = null;
let resumenPestana = "resumen";          // resumen | todos
let resumenEmpleadoId = null;

function puedeVerResumen() {
    return !!usuarioActual && !esPerfilFamiliar() && (!!obtenerEmpleadoActual() || sinCalendario());
}

function prepararPanelHoras() {
    const boton = document.getElementById("btnHoras");
    if (boton) boton.style.display = puedeVerResumen() ? "" : "none";
}

// Horas y días de un empleado en un año
async function calcularResumen(empleado, anio) {
    await Promise.all([asegurarAnio(anio), asegurarHorasDia(anio)]);
    const meses = Array.from({ length: 12 }, () => ({ horas: 0, dias: {} }));
    const total = { horas: 0, dias: {} };
    for (let mes = 0; mes < 12; mes++) {
        const diasMes = new Date(anio, mes + 1, 0).getDate();
        for (let dia = 1; dia <= diasMes; dia++) {
            const iso = aISO(new Date(anio, mes, dia));
            const codigo = infoTurno(iso, empleado).codigo;
            const h = horasDeDia(empleado, iso, codigo);
            meses[mes].horas += h;
            meses[mes].dias[codigo] = (meses[mes].dias[codigo] || 0) + 1;
            total.horas += h;
            total.dias[codigo] = (total.dias[codigo] || 0) + 1;
        }
    }
    return { meses, total };
}

// Horas que quedan por pedir como excesos (negativo = se ha pedido de más). null si no hay horas anuales.
function excesoPendiente(horasComputables, empleadoId, anio) {
    const anuales = anualesDe(empleadoId, anio);
    return anuales === null ? null : horasComputables - anuales;
}

function textoExceso(pendiente, anio) {
    if (pendiente === null) return "—";
    if (Math.abs(pendiente) < 0.005) return "0 h";
    const dias = formatoHoras(Math.round(Math.abs(pendiente) / configDe(anio).horas_dia_exceso * 10) / 10);
    return pendiente > 0 ? `${formatoHoras(pendiente)} h (≈ ${dias} días)` : `−${formatoHoras(-pendiente)} h (≈ −${dias} días, de más)`;
}

async function verResumen(pestana) {
    if (!puedeVerResumen()) return;
    cerrarPanelUsuario();
    const contenedor = mostrarVistaAdmin();
    if (pestana) resumenPestana = pestana;
    if (resumenAnio === null) resumenAnio = anioInicialAdmin();
    const yo = obtenerEmpleadoActual();
    const esAdmin = puedeGestionarUsuarios(usuarioActual);
    if (!esAdmin || !buscarEmpleadoPorId(resumenEmpleadoId)) {
        resumenEmpleadoId = yo ? yo.id : (todosLosEmpleadosActivos()[0] || {}).id;   // el administrador sin ficha empieza por el primero
    }
    if (resumenPestana === "todos" && !esAdmin) resumenPestana = "resumen";

    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Calculando…" }));
    if (!(await cargarHoras())) {
        reemplazarHijos(contenedor, cabeceraHoras("Horas"),
            el("p", { class: "error-texto", text: "No se pudieron cargar los datos de horas. Puede que falte activar esta función en Supabase (script de la fase 9)." }));
        return;
    }
    await asegurarAnio(resumenAnio);

    const selectAnio = selectorAnio(resumenAnio, (a) => { resumenAnio = a; verResumen(); });
    const cabecera = el("div", { class: "resultado-cabecera" },
        el("h2", { text: "Horas" }),
        el("div", { class: "resultado-acciones" }, selectAnio,
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: volverDeHoras }))
    );

    // Solo el administrador tiene dos pestañas (una persona / todos)
    const barra = esAdmin ? el("div", { class: "pestanas-cambios" },
        [["resumen", "Una persona"], ["todos", "Todos"]].map(([clave, texto]) =>
            el("button", { type: "button", class: "pestana-cambios" + (resumenPestana === clave ? " elegido" : ""), onclick: () => verResumen(clave) }, texto))) : null;

    let selectorPersona = null;
    if (esAdmin && resumenPestana !== "todos") {
        const select = el("select", { "aria-label": "Persona" },
            todosLosEmpleadosActivos().map(e => el("option", { value: e.id, text: `${e.nombre} (${e.iniciales}) · ${textoColectivo(e)}` })));
        select.value = resumenEmpleadoId;
        select.addEventListener("change", () => { resumenEmpleadoId = select.value; verResumen(); });
        selectorPersona = el("label", { class: "campo" }, el("span", { text: "Persona" }), select);
    }

    const aviso = !horasConfiguradas(resumenAnio)
        ? el("p", { class: "avisos-cambio", text: esAdmin
            ? `Aún no has indicado las horas de cada turno de ${resumenAnio}: entra en «Horas y convenio» del menú para que se calculen.`
            : `El administrador aún no ha indicado las horas de cada turno de ${resumenAnio}, así que las horas salen a 0.` })
        : null;

    const cuerpo = resumenPestana === "todos"
        ? await cuerpoTodos()
        : await cuerpoResumenPersona(buscarEmpleadoPorId(resumenEmpleadoId), resumenAnio);

    reemplazarHijos(contenedor, cabecera, barra, selectorPersona, aviso, cuerpo);
}

function yoId() {
    const yo = obtenerEmpleadoActual();
    return yo ? yo.id : null;
}

function dato(etiqueta, valor, clase) {
    return el("div", { class: "dato-resumen " + (clase || "") },
        el("span", { class: "dato-etiqueta", text: etiqueta }),
        el("strong", { class: "dato-valor", text: valor }));
}

async function cuerpoResumenPersona(empleado, anio) {
    const { meses, total } = await calcularResumen(empleado, anio);
    const anuales = anualesDe(empleado.id, anio);
    const pendiente = excesoPendiente(total.horas, empleado.id, anio);
    const dias = (c) => total.dias[c] || 0;
    const vac = configDe(anio).dias_vacaciones;

    const tarjetas = el("div", { class: "tarjetas-resumen" },
        dato("Horas anuales (convenio)", anuales === null ? (empleado.id === yoId() ? "Sin definir · ponlas en Ajustes" : "Sin definir") : `${formatoHoras(anuales)} h`),
        dato("Horas computables del año", `${formatoHoras(total.horas)} h`),
        dato("Excesos pendientes de pedir", textoExceso(pendiente, anio), pendiente !== null && pendiente < 0 ? "dato-aviso" : "dato-destacado"),
        dato("Vacaciones (V)", `${dias("V")} de ${vac} · quedan ${Math.max(0, vac - dias("V"))}`, dias("V") > vac ? "dato-aviso" : ""),
        dato("Excesos puestos (E)", `${dias("E")} ${dias("E") === 1 ? "día" : "días"}`),
        dato("Solapes (S)", `${dias("S")} ${dias("S") === 1 ? "día" : "días"}`),
        dato("Permisos justificados (J)", `${dias("J")} ${dias("J") === 1 ? "día" : "días"}`),
        dato("Libre disposición (LD)", `${dias("LD")} de ${configDe(anio).dias_ld} · quedan ${Math.max(0, configDe(anio).dias_ld - dias("LD"))}`, dias("LD") > configDe(anio).dias_ld ? "dato-aviso" : ""),
        dato("Bajas (B)", `${dias("B")} ${dias("B") === 1 ? "día" : "días"}`)
    );

    // Tabla por meses: solo las columnas de turnos que aparecen en el año
    const columnas = COLUMNAS_RESUMEN.filter(c => dias(c) > 0);
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
        el("p", { class: "admin-nota", text: "Las horas incluyen los días previstos del año (ciclo, festivos, intensivas y tus cambios) y los ajustes de horas que hayas hecho en algún día. Las bajas (B) suman las horas que tenías previstas. Los excesos que ya has puesto en el calendario ya están descontados de las horas computables." }),
        el("h3", { class: "grupo-titulo", text: "Por meses" }),
        tabla
    );
}

// Administrador: todos los empleados de un vistazo
async function cuerpoTodos() {
    const anio = resumenAnio;
    const horasDia1 = configDe(anio).horas_dia_exceso;
    const filas = [];
    for (const colectivo of colectivos) {
        for (const emp of empleadosActivos(colectivo)) {
            const { total } = await calcularResumen(emp, anio);
            const pend = excesoPendiente(total.horas, emp.id, anio);
            const d = (c) => total.dias[c] || 0;
            const anuales = anualesDe(emp.id, anio);
            filas.push(el("tr", { class: "fila-clicable", onclick: () => { resumenEmpleadoId = emp.id; verResumen("resumen"); } },
                el("td", {}, el("strong", { text: emp.nombre }), el("small", { text: ` · ${colectivo.puesto}` })),
                el("td", { class: "num", text: anuales !== null ? formatoHoras(anuales) : "—" }),
                el("td", { class: "num", text: formatoHoras(total.horas) }),
                el("td", { class: "num" + (pend !== null && pend < 0 ? " dato-aviso" : ""), text: pend === null ? "—" : formatoHoras(Math.round(pend * 100) / 100) }),
                el("td", { class: "num", text: pend === null ? "—" : formatoHoras(Math.round(pend / horasDia1 * 10) / 10) }),
                el("td", { class: "num", text: d("V") }), el("td", { class: "num", text: d("E") }),
                el("td", { class: "num", text: d("S") }), el("td", { class: "num", text: d("J") })));
        }
    }
    return el("div", {},
        el("h3", { class: "grupo-titulo", text: `Todos los empleados · ${anio}` }),
        el("p", { class: "admin-nota", text: "Toca una persona para ver su resumen por meses. «Pend. h» son las horas de excesos que le quedan por pedir (negativo = de más) y «Días E» su equivalente en días." }),
        el("div", { class: "tabla-scroll" }, el("table", { class: "tabla-resumen" },
            el("thead", {}, el("tr", {}, ["Empleado", "Anuales", "Horas", "Pend. h", "Días E", "V", "E", "S", "J"].map(t => el("th", { text: t })))),
            el("tbody", {}, filas))));
}

// ======================================================================
// Horas de un día suelto: lo que computa cada turno y ajustes manuales
// (por ejemplo, una baja que computa igual que el turno que tocaba)
// ======================================================================
let horasDia = new Map();          // "empleadoId|AAAA-MM-DD" -> horas ajustadas a mano
const aniosHorasDia = new Set();

async function asegurarHorasDia(anio) {
    if (aniosHorasDia.has(anio)) return;
    for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabaseClient.from("horas_dia").select("empleado_id, fecha, horas")
            .gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`)
            .order("fecha").order("empleado_id").range(inicio, inicio + 999);
        if (error) { console.warn("No se pudieron cargar los ajustes de horas:", error); return; }   // falta el SQL de la fase 8
        data.forEach(r => horasDia.set(claveExcepcion(r.empleado_id, r.fecha), Number(r.horas)));
        if (data.length < 1000) break;
    }
    aniosHorasDia.add(anio);
}

// Horas que computa un día: el ajuste manual si lo hay; si no, las del turno
// Baja (B), libre disposición (LD), permiso justificado (J) y solape puesto a mano (S) no tienen horas
// propias: suman las que había previstas ese día. Es el ajuste manual de horas si lo hay y, si no,
// las del turno que tocaba por ciclo, intensiva o festivo. (Un solape que sale del ciclo sí tiene
// las suyas, las que fija el administrador.)
function sumaPrevistas(empleado, fechaISO, codigo) {
    if (codigo === "B" || codigo === "LD" || codigo === "J") return true;
    return codigo === "S" && excepciones.has(claveExcepcion(empleado.id, fechaISO));
}

function horasDeDia(empleado, fechaISO, codigo) {
    const ajuste = horasDia.get(claveExcepcion(empleado.id, fechaISO));
    if (ajuste !== undefined) return ajuste;
    const anio = Number(fechaISO.slice(0, 4));
    if (sumaPrevistas(empleado, fechaISO, codigo)) {
        const colectivo = buscarColectivo(empleado.colectivo);
        return colectivo ? horasDeTurno(anio, turnoAutomatico(fechaISO, empleado, colectivo).codigo) : 0;
    }
    return horasDeTurno(anio, codigo);
}

// Texto de las horas de un turno para las rejillas ("8 h"), o "" si aún no se conocen
function textoHorasTurno(codigo) {
    if (CODIGOS_SUMAN_PREVISTAS.includes(codigo)) return "las previstas";
    const clave = `${anioHorasEnUso}|${codigo}`;
    return horasCargadas && horasTurno.has(clave) ? `${formatoHoras(horasTurno.get(clave))} h` : "";
}

async function prepararHoras(fechaISO) {
    anioHorasEnUso = Number(fechaISO.slice(0, 4));   // año de las horas que se muestran en las rejillas
    await cargarHoras();
    await asegurarHorasDia(Number(fechaISO.slice(0, 4)));
}

// cambios: [{ fecha, horas }] con horas = número (ajustar) o null (quitar el ajuste)
async function guardarHorasDia(empleado, cambios, silencioso) {
    if (cambios.some(c => c.horas !== null && (!Number.isFinite(c.horas) || c.horas < 0 || c.horas > 24))) {
        mostrarToast("Las horas tienen que estar entre 0 y 24.", true);
        return false;
    }
    await Promise.all([...new Set(cambios.map(c => Number(c.fecha.slice(0, 4))))].map(asegurarHorasDia));

    const subir = [], borrar = [], anterior = new Map();
    cambios.forEach(({ fecha, horas }) => {
        const clave = claveExcepcion(empleado.id, fecha);
        const actual = horasDia.get(clave);
        if ((horas === null ? undefined : horas) === actual) return;
        anterior.set(clave, actual);
        if (horas === null) borrar.push(fecha); else subir.push({ empleado_id: empleado.id, fecha, horas });
    });
    if (!subir.length && !borrar.length) return true;

    subir.forEach(r => horasDia.set(claveExcepcion(empleado.id, r.fecha), r.horas));
    borrar.forEach(f => horasDia.delete(claveExcepcion(empleado.id, f)));

    let fallo = null;
    for (let i = 0; i < subir.length && !fallo; i += 200) {
        fallo = (await supabaseClient.from("horas_dia").upsert(subir.slice(i, i + 200), { onConflict: "empleado_id,fecha" })).error;
    }
    for (let i = 0; i < borrar.length && !fallo; i += 100) {
        fallo = (await supabaseClient.from("horas_dia").delete().eq("empleado_id", empleado.id).in("fecha", borrar.slice(i, i + 100))).error;
    }
    if (fallo) {
        console.error("Error al guardar las horas:", fallo);
        anterior.forEach((valor, clave) => { if (valor === undefined) horasDia.delete(clave); else horasDia.set(clave, valor); });
        mostrarToast("No se pudieron guardar las horas. Inténtalo de nuevo." + detalleError(fallo), true);
        return false;
    }
    if (!silencioso) mostrarToast("Horas guardadas");
    return true;
}

// Cambiar el turno de un día borra su ajuste de horas (es una decisión nueva); lo llama edicion.js
async function limpiarAjustesHoras(empleado, fechas) {
    await Promise.all([...new Set(fechas.map(f => Number(f.slice(0, 4))))].map(asegurarHorasDia));
    const conAjuste = fechas.filter(f => horasDia.has(claveExcepcion(empleado.id, f)));
    if (conAjuste.length) await guardarHorasDia(empleado, conAjuste.map(fecha => ({ fecha, horas: null })), true);
}

function horasDelCiclo(fechaISO, empleado) {
    const colectivo = buscarColectivo(empleado.colectivo);
    const codigo = turnoAutomatico(fechaISO, empleado, colectivo).codigo;
    return { codigo, horas: horasDeTurno(Number(fechaISO.slice(0, 4)), codigo) };
}

// Sección "Horas de este día" de la hoja de edición de un día (null si aún no hay datos de horas)
function crearSeccionHorasDia(fechaISO, empleado) {
    if (!horasCargadas) return null;
    const info = infoTurno(fechaISO, empleado);
    const hayAjuste = horasDia.has(claveExcepcion(empleado.id, fechaISO));
    const actual = horasDeDia(empleado, fechaISO, info.codigo);
    const ciclo = horasDelCiclo(fechaISO, empleado);

    const entrada = el("input", { type: "number", min: "0", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", "aria-label": "Horas de este día" });
    entrada.value = String(actual);
    const guardar = (horas) => { ocultarDetalleDia(); guardarHorasDia(empleado, [{ fecha: fechaISO, horas }]); };

    return el("div", { class: "seccion-horas" },
        el("p", { class: "detalle-etiqueta", text: "Horas de este día" }),
        el("p", { class: "seccion-horas-actual" },
            el("strong", { text: `Computa ${formatoHoras(actual)} h` }),
            el("span", { text: hayAjuste ? " · ajustado a mano" : " · según el turno" })),
        el("div", { class: "fila-horas-dia" }, entrada, el("span", { class: "fila-horas-unidad", text: "h" }),
            el("button", { type: "button", text: "Ajustar", onclick: () => guardar(Number(entrada.value.replace(",", "."))) })),
        el("button", { type: "button", class: "btn-secundario btn-ancho", text: `Igual que el turno del ciclo (${ciclo.codigo} · ${formatoHoras(ciclo.horas)} h)`,
            onclick: () => guardar(ciclo.horas) }),
        el("button", { type: "button", class: "btn-secundario btn-ancho", text: "Quitar el ajuste (usar las horas del turno)",
            disabled: hayAjuste ? null : true, onclick: () => guardar(null) })
    );
}

// Bloque de horas del editor de varios días. aplicar(fechas) devuelve true si hizo algo.
function crearBloqueHorasRango(empleado) {
    if (!horasCargadas) return null;
    const modo = el("select", { "aria-label": "Horas de esos días" },
        el("option", { value: "nada", text: "No tocar las horas" }),
        el("option", { value: "ciclo", text: "Igual que el turno del ciclo de cada día" }),
        el("option", { value: "fijas", text: "Fijar las horas de cada día" }),
        el("option", { value: "quitar", text: "Quitar los ajustes de horas" }));
    const fijas = el("input", { type: "number", min: "0", max: "24", step: "0.25", inputmode: "decimal", class: "input-corto", value: "8", "aria-label": "Horas por día" });
    const fila = el("div", { class: "fila-horas-dia", style: "display: none" }, fijas, el("span", { class: "fila-horas-unidad", text: "h por día" }));
    modo.addEventListener("change", () => { fila.style.display = modo.value === "fijas" ? "" : "none"; });

    return {
        elemento: el("div", { class: "seccion-horas" },
            el("p", { class: "detalle-etiqueta", text: "Horas de esos días" }), modo, fila),
        hayAccion: () => modo.value !== "nada",
        aplicar: async (fechas) => {
            if (modo.value === "nada") return false;
            const n = Number(fijas.value.replace(",", "."));
            const cambios = fechas.map(fecha => ({
                fecha,
                horas: modo.value === "ciclo" ? horasDelCiclo(fecha, empleado).horas : modo.value === "fijas" ? n : null
            }));
            return guardarHorasDia(empleado, cambios);
        }
    };
}

// ======================================================================
// Mis horas anuales: cada persona pone las suyas en sus Ajustes (solo el total del año)
// ======================================================================
let ajustesAnio = null;

async function pintarHorasAnualesAjustes(contenedor) {
    const yo = obtenerEmpleadoActual();
    if (!yo || esPerfilFamiliar() || !veHoras(yo)) { contenedor.replaceChildren(); return; }
    if (ajustesAnio === null) ajustesAnio = anioInicialAdmin();
    const anio = ajustesAnio;

    if (!(await cargarHoras())) {
        reemplazarHijos(contenedor, el("h3", { class: "grupo-titulo", text: "Mis horas anuales" }),
            el("p", { class: "error-texto", text: "No se pudieron cargar los datos de horas. Puede que falte ejecutar el script de la fase 10 en Supabase." }));
        return;
    }

    const actual = anualesDe(yo.id, anio);
    const input = el("input", { type: "number", min: "0", max: "9999", step: "0.5", inputmode: "decimal", class: "input-medio", placeholder: "sin definir", "aria-label": `Mis horas anuales de ${anio}` });
    if (actual !== null) input.value = String(actual);
    const aviso = el("p", { class: "admin-aviso-corto", role: "status" });
    const guardar = el("button", { type: "button", text: `Guardar mis horas de ${anio}` });

    guardar.addEventListener("click", async () => {
        const texto = input.value.trim().replace(",", ".");
        const previa = anualesDe(yo.id, anio);
        const h = texto === "" ? null : Number(texto);
        if (h !== null && (!Number.isFinite(h) || h < 0 || h > 9999)) {
            aviso.textContent = "Revisa las horas: entre 0 y 9999."; aviso.className = "admin-aviso-corto error-texto"; return;
        }
        guardar.disabled = true;
        let error = null;
        if (h === null) {
            if (previa !== null) error = (await supabaseClient.from("horas_anuales").delete().eq("empleado_id", yo.id).eq("anio", anio)).error;
        } else {
            error = (await supabaseClient.from("horas_anuales").upsert({ empleado_id: yo.id, anio, horas: h }, { onConflict: "empleado_id,anio" })).error;
        }
        guardar.disabled = false;
        if (error) {
            console.error(error);
            aviso.textContent = "No se pudo guardar." + detalleError(error); aviso.className = "admin-aviso-corto error-texto"; return;
        }
        if (h === null) horasAnuales.delete(`${yo.id}|${anio}`); else horasAnuales.set(`${yo.id}|${anio}`, h);
        aviso.textContent = "Guardado."; aviso.className = "admin-aviso-corto admin-ok";
    });

    reemplazarHijos(contenedor,
        el("h3", { class: "grupo-titulo", text: "Mis horas anuales" }),
        el("p", { class: "admin-nota", text: "Las horas de convenio de todo el año (solo el total). Con ellas se calculan tus excesos disponibles. Solo las ves tú y el administrador." }),
        el("div", { class: "fila-guardar" }, selectorAnio(anio, (a) => { ajustesAnio = a; pintarHorasAnualesAjustes(contenedor); })),
        el("label", { class: "fila-horas fila-horas-emp" }, el("span", { class: "fila-horas-nombre", text: `Horas anuales de ${anio}` }), input, el("span", { class: "fila-horas-unidad", text: "h" })),
        el("div", { class: "fila-guardar" }, guardar, aviso)
    );
}

// ======================================================================
// Resumen de la pantalla principal (debajo de "Hoy"): vacaciones, libre disposición y,
// para quien corresponda, horas anuales y excesos del año en curso
// ======================================================================
let tokenResumenPrincipal = 0;

function miniDato(etiqueta, valor, sub, ancho, clase, alTocar) {
    return el(alTocar ? "button" : "div", { type: alTocar ? "button" : null, class: `mini-dato mini-${ancho} ${clase || ""}`, onclick: alTocar || null },
        el("span", { class: "mini-etiqueta", text: etiqueta }),
        el("strong", { class: "mini-valor", text: valor }),
        sub ? el("span", { class: "mini-sub", text: sub }) : null);
}

async function pintarResumenPrincipal(caja, empleado) {
    const token = ++tokenResumenPrincipal;
    if (!(await cargarHoras())) {
        if (token === tokenResumenPrincipal) reemplazarHijos(caja, el("p", { class: "hoy-subtitulo", text: "No se pudo cargar el resumen." }));
        return;
    }
    const anio = new Date().getFullYear();
    const { total } = await calcularResumen(empleado, anio);
    if (token !== tokenResumenPrincipal) return;   // llegó otro pintado más reciente

    const cfg = configDe(anio);
    const dias = (c) => total.dias[c] || 0;
    const plural = (n) => (Math.abs(n - 1) < 0.005 ? "día" : "días");
    const tarjetas = [];

    // Apuntados / disponibles
    const vac = dias("V"), ld = dias("LD");
    const verHoras = veHoras(empleado);
    // Solapes: solo los colectivos de turnos y solo si el administrador les ha dado alguno al año
    const colectivo = buscarColectivo(empleado.colectivo);
    const solapesAnio = colectivo && colectivo.tipo === "turnos" ? Number(colectivo.diasSolape) || 0 : 0;
    const verSolapes = solapesAnio > 0;
    const sol = dias("S");
    const anchoFila1 = verHoras || verSolapes ? "2" : "3";
    tarjetas.push(miniDato("Vacaciones", `${vac} / ${Math.max(0, cfg.dias_vacaciones - vac)}`, null, anchoFila1, vac > cfg.dias_vacaciones ? "mini-aviso" : ""));
    tarjetas.push(miniDato("Libre disposición", `${ld} / ${Math.max(0, cfg.dias_ld - ld)}`, null, anchoFila1, ld > cfg.dias_ld ? "mini-aviso" : ""));
    if (verSolapes) tarjetas.push(miniDato("Solapes", `${sol} / ${Math.max(0, solapesAnio - sol)}`, null, anchoFila1, sol > solapesAnio ? "mini-aviso" : ""));

    if (verHoras) {
        const anuales = anualesDe(empleado.id, anio);
        const pendiente = excesoPendiente(total.horas, empleado.id, anio);
        const e = dias("E");
        const anchoExc = verSolapes ? "2" : "3";   // con solapes hay tres tarjetas por fila
        tarjetas.push(anuales === null
            ? miniDato("Horas anuales", "Sin definir", "Tócalo para ponerlas", "2", "mini-aviso", () => verAjustes())
            : miniDato("Horas anuales", `${formatoHoras(anuales)} h`, null, "2"));
        tarjetas.push(miniDato("Excesos utilizados", `${e} ${plural(e)}`, null, anchoExc));
        if (pendiente === null) {
            tarjetas.push(miniDato("Excesos disponibles", "—", "Faltan tus horas anuales", anchoExc));
        } else if (pendiente > 0.005) {
            const d = Math.round(pendiente / cfg.horas_dia_exceso * 10) / 10;
            tarjetas.push(miniDato("Excesos disponibles", `${formatoHoras(d)} ${plural(d)}`, `${formatoHoras(Math.round(pendiente * 100) / 100)} h`, anchoExc, "mini-destacado"));
        } else {
            tarjetas.push(miniDato("Excesos disponibles", "0 días", pendiente < -0.005 ? `te has pasado ${formatoHoras(Math.round(-pendiente * 100) / 100)} h` : "0 h", anchoExc, pendiente < -0.005 ? "mini-aviso" : ""));
        }
    }

    reemplazarHijos(caja,
        el("p", { class: "hoy-subtitulo", text: `Resumen ${anio} · utilizados / disponibles` }),
        el("div", { class: "mini-grid" }, tarjetas));
}
