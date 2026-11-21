// js/admin.js
// Menú de administrador: empleados, accesos (PIN) y ciclos de turno.
// Es solo interfaz: cada cambio pasa por funciones o tablas de Supabase que comprueban en el
// servidor que quien llama es administrador. Todo el texto se pinta con el() / textContent.

let adminAccesos = [];      // perfiles (accesos) existentes, para saber quién tiene acceso
let adminAviso = null;      // caja donde se muestran resultados y PIN provisionales

const MOTIVOS_ADMIN = {
    no_autorizado: "No tienes permiso de administrador.",
    no_existe: "No se ha encontrado a esa persona.",
    ya_existe: "Esa persona ya tiene acceso.",
    datos_invalidos: "Revisa los datos: iniciales de 2 a 8 letras, nombre, colectivo y fecha de inicio.",
    iniciales_duplicadas: "Ya existe alguien con esas iniciales.",
    no_propio: "No puedes hacerlo con tu propio usuario (darte de baja, quitarte el rol de administrador o eliminarte).",
    rol_invalido: "Rol no válido."
};

function prepararPanelAdmin() {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    document.querySelectorAll(".solo-admin").forEach(boton => { boton.style.display = ""; });
}

async function cargarAccesos() {
    const { data, error } = await supabaseClient
        .from("perfiles")
        .select("id, iniciales, rol, empleado_id, activo");
    if (error) {
        console.error("Error al cargar accesos:", error);
        adminAccesos = [];
        return false;
    }
    adminAccesos = data;
    return true;
}

function accesoPrincipal(empleadoId) {
    return adminAccesos.find(a => a.empleado_id === empleadoId && a.rol !== "familiar") || null;
}

function accesoFamiliar(empleadoId) {
    return adminAccesos.find(a => a.empleado_id === empleadoId && a.rol === "familiar") || null;
}

// --- Vista principal ---
async function verGestionAdmin() {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;

    const contenedor = mostrarVistaAdmin();
    contenedor.replaceChildren(el("p", { class: "aviso-vacio", text: "Cargando..." }));

    const [datosOk, accesosOk] = await Promise.all([cargarDatos(), cargarAccesos()]);
    if (!datosOk || !accesosOk) {
        contenedor.replaceChildren(
            el("p", { class: "aviso-vacio", text: "No se pudieron cargar los datos. Inténtalo de nuevo." }),
            el("button", { class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        );
        return;
    }
    pintarGestionAdmin();
}

// Colectivos que el administrador tiene desplegados en el listado de empleados
const gruposAbiertos = new Set();

function pintarGestionAdmin() {
    const contenedor = document.getElementById("resultado");

    adminAviso = el("div", { id: "adminAviso", class: "admin-aviso", style: "display:none;" });

    const cabecera = el("div", { class: "resultado-cabecera" },
        el("h2", { text: "Empleados y accesos" }),
        el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
    );

    const formulario = el("div", { id: "adminFormulario" });
    const botonNuevo = el("button", {
        class: "admin-nuevo", text: "➕ Añadir empleado",
        onclick: () => mostrarFormularioEmpleado(null)
    });

    // Dos categorías (personal a turnos y jornada partida) y, dentro, un desplegable por subgrupo.
    // Cerrados al entrar; se recuerda cuáles has abierto mientras trabajas.
    const listas = GRUPOS.map(g => {
        const hijos = colectivos.filter(c => grupoDeColectivo(c) === g.codigo);
        const total = hijos.reduce((n, c) => n + c.empleados.filter(e => e.activo).length, 0);
        const contenido = [];
        if (g.codigo === "jornada") contenido.push(formularioNuevoSubgrupo());
        hijos.forEach(c => contenido.push(desplegableSubgrupo(c)));
        return desplegableAdmin("g:" + g.codigo, `${g.icono} ${g.nombre}`, String(total), "admin-grupo admin-desplegable", contenido);
    });

    const botonMarcas = el("button", {
        class: "admin-nuevo btn-secundario", text: "🏷️ Disponibilidades y CT",
        onclick: verMarcasAdmin
    });

    contenedor.replaceChildren(
        cabecera, adminAviso, botonNuevo, botonMarcas, formulario, ...listas,
        el("hr", { class: "separador" }),
        seccionCiclos()
    );
}

// <details> recordando si está abierto
function desplegableAdmin(clave, titulo, cuantos, clases, contenido) {
    const detalles = el("details", { class: clases, open: gruposAbiertos.has(clave) },
        el("summary", {},
            el("span", { text: titulo }),
            el("span", { class: "admin-desplegable-n", text: cuantos })),
        contenido.flat());
    detalles.addEventListener("toggle", () => {
        if (detalles.open) gruposAbiertos.add(clave); else gruposAbiertos.delete(clave);
    });
    return detalles;
}

function desplegableSubgrupo(c) {
    const activos = c.empleados.filter(e => e.activo).length;
    const contenido = [];

    // Colectivos de turnos: cuántos solapes al año tiene cada persona (0 = no se muestran en su resumen)
    if (c.tipo === "turnos") contenido.push(filaSolapes(c));
    // Subgrupos creados por el administrador: renombrar y borrar
    if (c.tipo === "otro" && c.codigo !== "jornada") contenido.push(filaGestionSubgrupo(c));
    // El colectivo base de jornada partida se puede renombrar, pero no borrar
    if (c.codigo === "jornada") contenido.push(filaGestionSubgrupo(c, false));

    contenido.push(c.empleados.length
        ? c.empleados.map(emp => filaEmpleado(emp, c))
        : el("p", { class: "admin-nota", text: "Sin empleados." }));

    return desplegableAdmin("c:" + c.codigo, `${c.icono} ${c.nombre}`,
        c.empleados.length === activos ? `${activos}` : `${activos} de ${c.empleados.length}`,
        "admin-subdesplegable admin-desplegable", contenido);
}

function filaSolapes(c) {
    const input = el("input", { type: "number", min: "0", max: "366", step: "1", inputmode: "numeric", class: "input-corto", "aria-label": `Solapes al año de ${c.nombre}` });
    input.value = String(c.diasSolape);
    const guardar = el("button", { type: "button", class: "btn-secundario", text: "Guardar" });
    guardar.addEventListener("click", async () => {
        const n = Number(input.value);
        if (!Number.isInteger(n) || n < 0 || n > 366) { mostrarAviso("Los solapes deben ser un número entero de 0 a 366.", true); return; }
        guardar.disabled = true;
        const { error } = await supabaseClient.from("colectivos").update({ dias_solape: n }).eq("codigo", c.codigo);
        guardar.disabled = false;
        if (error) { console.error(error); mostrarAviso("No se pudieron guardar los solapes." + detalleError(error), true); return; }
        c.diasSolape = n;
        mostrarAviso(n > 0 ? `${c.nombre}: ${n} solapes al año. Cada persona los verá en su resumen.` : `${c.nombre}: sin solapes (no se muestran en el resumen).`, false);
    });
    return el("div", { class: "admin-fila-solapes" },
        el("label", { class: "fila-horas" },
            el("span", { class: "fila-horas-nombre", text: "Solapes al año de cada persona" }), input, el("span", { class: "fila-horas-unidad", text: "días" })),
        guardar,
        el("p", { class: "admin-nota", text: "Con 0 no aparecen en el resumen. Con más de 0, cada persona verá cuántos ha utilizado y cuántos le quedan." }));
}

const MENSAJES_SUBGRUPO = {
    nombre_repetido: "Ya existe un subgrupo con ese nombre.",
    datos_invalidos: "El nombre debe tener entre 1 y 40 caracteres.",
    tiene_empleados: "Primero pasa a otro subgrupo a los empleados que tiene.",
    no_permitido: "Ese subgrupo no se puede cambiar.",
    en_uso: "Ese subgrupo tiene datos asociados y no se puede borrar.",
    no_autorizado: "No tienes permiso para hacer esto."
};

async function llamarSubgrupo(funcion, args, textoOk, antesDeRecargar) {
    const r = await supabaseClient.rpc(funcion, args);
    if (r.error || !r.data) {
        console.error(r.error);
        mostrarAviso("No se pudo hacer el cambio. Puede que falte ejecutar el script de la fase 12 en Supabase." + detalleError(r.error), true);
        return false;
    }
    if (!r.data.ok) { mostrarAviso(MENSAJES_SUBGRUPO[r.data.motivo] || "No se pudo hacer el cambio.", true); return false; }
    if (antesDeRecargar) antesDeRecargar(r.data);
    await recargarGestionAdmin();
    mostrarAviso(textoOk, false);
    return r.data;
}

function formularioNuevoSubgrupo() {
    const input = el("input", { type: "text", maxlength: "40", placeholder: "Nombre del subgrupo nuevo", required: true, "aria-label": "Nombre del subgrupo nuevo" });
    const form = el("form", { class: "admin-form-subgrupo" }, input, el("button", { type: "submit", text: "➕ Crear subgrupo" }));
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await llamarSubgrupo("admin_crear_subgrupo", { p_nombre: input.value }, `Subgrupo «${input.value.trim()}» creado. Ya puedes asignarle empleados.`,
            (datos) => { gruposAbiertos.add("g:jornada"); if (datos.codigo) gruposAbiertos.add("c:" + datos.codigo); });
    });
    return form;
}

function filaGestionSubgrupo(c, puedeBorrar = true) {
    const renombrar = el("button", { type: "button", class: "btn-secundario", text: "✏️ Cambiar nombre" });
    renombrar.addEventListener("click", async () => {
        const nuevo = prompt("Nuevo nombre del subgrupo", c.nombre);
        if (nuevo === null || nuevo.trim() === c.nombre) return;
        await llamarSubgrupo("admin_renombrar_subgrupo", { p_codigo: c.codigo, p_nombre: nuevo }, `Subgrupo renombrado a «${nuevo.trim()}».`);
    });
    const botones = [renombrar];
    if (puedeBorrar && c.tipo === "otro") {
        const borrar = el("button", { type: "button", class: "btn-peligro", text: "🗑️ Borrar subgrupo" });
        borrar.addEventListener("click", async () => {
            if (!confirm(`¿Borrar el subgrupo «${c.nombre}»? Solo se puede si no tiene empleados.`)) return;
            await llamarSubgrupo("admin_borrar_subgrupo", { p_codigo: c.codigo }, `Subgrupo «${c.nombre}» borrado.`);
        });
        botones.push(borrar);
    }
    return el("div", { class: "admin-acciones" }, botones);
}

function filaEmpleado(emp, colectivo) {
    const principal = accesoPrincipal(emp.id);
    const familiar = accesoFamiliar(emp.id);

    const detalle = [
        `Inicio de ciclo: ${formatearFecha(emp.inicio)}`,
        principal ? `Rol: ${principal.rol}` : "Sin acceso a la app",
        familiar ? "Con acceso familiar" : null,
        emp.activo ? null : "DE BAJA"
    ].filter(Boolean).join(" · ");

    return el("div", { class: "admin-fila" + (emp.activo ? "" : " admin-baja") },
        el("div", { class: "admin-fila-datos" },
            el("strong", { text: emp.nombre }),
            el("span", { class: "admin-iniciales", text: ` (${emp.iniciales})` }),
            el("div", { class: "admin-nota", text: detalle })
        ),
        el("div", { class: "admin-acciones" },
            el("button", { text: "✏️ Editar", onclick: () => mostrarFormularioEmpleado(emp) }),
            principal
                ? el("button", { text: "🔑 PIN", onclick: () => resetearPin(principal.iniciales, emp.nombre) })
                : el("button", { text: "🔓 Dar acceso", onclick: () => crearAcceso(emp.id, "empleado") }),
            familiar
                ? [
                    el("button", { text: "👪 PIN familiar", onclick: () => resetearPin(familiar.iniciales, emp.nombre + " (familiar)") }),
                    el("button", { class: "btn-peligro", text: "🗑️ Quitar familiar", onclick: () => eliminarFamiliar(emp) })
                ]
                : el("button", { text: "👪 Crear familiar", onclick: () => crearAcceso(emp.id, "familiar") }),
            el("button", { class: "btn-peligro", text: "🗑️ Eliminar", onclick: () => eliminarEmpleado(emp) })
        )
    );
}

// --- Avisos y PIN provisionales ---
function mostrarAviso(texto, esError) {
    adminAviso.replaceChildren(el("div", { text: texto }));
    adminAviso.className = "admin-aviso " + (esError ? "admin-error" : "admin-ok");
    adminAviso.style.display = "block";
    adminAviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function mostrarPinProvisional(r) {
    adminAviso.replaceChildren(
        el("div", { text: `PIN provisional de ${r.nombre || ""} (${r.iniciales}):` }),
        el("div", { class: "admin-pin", text: r.pinTemporal }),
        el("div", { class: "admin-nota", text: "Solo se muestra ahora. Díselo en persona; tendrá que elegir uno nuevo al entrar." })
    );
    adminAviso.className = "admin-aviso admin-ok";
    adminAviso.style.display = "block";
    adminAviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function recargarGestionAdmin() {
    const aviso = adminAviso ? adminAviso.cloneNode(true) : null;
    const [datosOk, accesosOk] = await Promise.all([cargarDatos(), cargarAccesos()]);
    if (!datosOk || !accesosOk) return;
    pintarGestionAdmin();
    if (aviso && aviso.style.display !== "none") {
        adminAviso.replaceWith(aviso);
        adminAviso = aviso;
    }
}

// --- Acciones sobre accesos ---
async function resetearPin(iniciales, nombre) {
    if (!confirm(`¿Generar un PIN provisional para ${nombre}? Su PIN actual dejará de valer y se cerrará su sesión.`)) return;

    const { data, error } = await supabaseClient.rpc("admin_resetear_acceso", { p_objetivo: iniciales });
    if (error) {
        console.error(error);
        mostrarAviso("Error de conexión con el servidor.", true);
        return;
    }
    if (!data || !data.ok) {
        mostrarAviso(MOTIVOS_ADMIN[data && data.motivo] || "No se pudo resetear el PIN.", true);
        return;
    }
    mostrarPinProvisional(data);
}

async function crearAcceso(empleadoId, rol) {
    const { data, error } = await supabaseClient.rpc("admin_crear_acceso", { p_empleado_id: empleadoId, p_rol: rol });
    if (error) {
        console.error(error);
        mostrarAviso("Error de conexión con el servidor.", true);
        return;
    }
    if (!data || !data.ok) {
        mostrarAviso(MOTIVOS_ADMIN[data && data.motivo] || "No se pudo crear el acceso.", true);
        return;
    }
    await recargarGestionAdmin();
    mostrarPinProvisional(data);
}

async function eliminarEmpleado(emp) {
    const aviso = `¿Eliminar DEFINITIVAMENTE a ${emp.nombre} (${emp.iniciales})?\n\nSe borrará su ficha y todos sus accesos, y no se puede deshacer.\n\nSi solo quieres que deje de aparecer en los calendarios, pulsa Cancelar, usa Editar y desmarca "Activo".`;
    if (!confirm(aviso)) return;

    const { data, error } = await supabaseClient.rpc("admin_eliminar_empleado", { p_id: emp.id });
    if (error) {
        console.error(error);
        mostrarAviso("Error de conexión con el servidor.", true);
        return;
    }
    if (!data || !data.ok) {
        mostrarAviso(MOTIVOS_ADMIN[data && data.motivo] || "No se pudo eliminar.", true);
        return;
    }
    await recargarGestionAdmin();
    mostrarAviso(`${emp.nombre} eliminado.`, false);
}

async function eliminarFamiliar(emp) {
    if (!confirm(`¿Quitar el acceso de familiar de ${emp.nombre}? Dejará de poder entrar con su PIN.`)) return;

    const { data, error } = await supabaseClient.rpc("admin_eliminar_familiar", { p_empleado_id: emp.id });
    if (error) {
        console.error(error);
        mostrarAviso("Error de conexión con el servidor.", true);
        return;
    }
    if (!data || !data.ok) {
        mostrarAviso(MOTIVOS_ADMIN[data && data.motivo] || "No se pudo quitar el acceso familiar.", true);
        return;
    }
    await recargarGestionAdmin();
    mostrarAviso(`Acceso familiar de ${emp.nombre} eliminado.`, false);
}

// --- Formulario de empleado (alta y edición) ---
function mostrarFormularioEmpleado(emp) {
    const esNuevo = !emp;
    const principal = emp ? accesoPrincipal(emp.id) : null;
    const contenedor = document.getElementById("adminFormulario");

    const inputNombre = el("input", { type: "text", maxlength: "40", value: emp ? emp.nombre : "", required: true });
    const inputIniciales = el("input", { type: "text", maxlength: "8", value: emp ? emp.iniciales : "", required: true, class: "input-iniciales" });
    const selectColectivo = el("select", {}, GRUPOS.map(g => el("optgroup", { label: g.nombre },
        colectivos.filter(c => grupoDeColectivo(c) === g.codigo).map(c => el("option", { value: c.codigo, text: c.nombre })))));
    selectColectivo.value = emp ? emp.colectivo : colectivos[0].codigo;
    const inputInicio = el("input", { type: "date", value: emp ? emp.inicio : "", required: true });
    const selectRol = el("select", {},
        [["empleado", "Empleado"], ["supervisor", "Supervisor"], ["administrador", "Administrador"]]
            .map(([v, t]) => el("option", { value: v, text: t })));
    selectRol.value = principal ? principal.rol : "empleado";
    if (!esNuevo && !principal) selectRol.disabled = true;
    const checkActivo = el("input", { type: "checkbox", checked: emp ? emp.activo : true });
    const checkVerHoras = el("input", { type: "checkbox", checked: emp ? emp.verHoras : false });
    const filaVerHoras = el("label", { class: "admin-campo admin-check" }, checkVerHoras,
        el("span", { text: "Enseñarle su resumen de horas anuales y excesos (los colectivos de turnos siempre lo ven)" }));
    const actualizarVerHoras = () => {
        const c = buscarColectivo(selectColectivo.value);
        filaVerHoras.style.display = esNuevo || (c && c.tipo === "turnos") ? "none" : "";
    };
    selectColectivo.addEventListener("change", actualizarVerHoras);
    actualizarVerHoras();

    // Calendario anual: grupos completos o subgrupos sueltos que puede ver (además de su propio colectivo)
    const anualInicial = emp ? emp.anualVer : [];
    const cajasAnual = [];   // { token, tipo: "grupo" | "sub", caja, hijos: [], colectivo }
    const bloqueAnual = el("div", { class: "admin-campo admin-anual" },
        el("strong", { text: "Calendario anual: qué puede ver" }),
        el("span", { class: "admin-nota", text: "Siempre ve el de su propio colectivo. Marca grupos completos o subgrupos sueltos. El administrador ve todos." }));
    GRUPOS.forEach(g => {
        const cajaGrupo = el("input", { type: "checkbox", "aria-label": `Ver ${g.nombre} completo` });
        cajaGrupo.checked = anualInicial.includes("g:" + g.codigo);
        const entradaGrupo = { token: "g:" + g.codigo, tipo: "grupo", caja: cajaGrupo, hijos: [] };
        cajasAnual.push(entradaGrupo);
        const subs = colectivos.filter(c => grupoDeColectivo(c) === g.codigo).map(c => {
            const caja = el("input", { type: "checkbox", "aria-label": `Ver ${c.nombre}` });
            caja.checked = anualInicial.includes(c.codigo);
            const entrada = { token: c.codigo, tipo: "sub", caja, colectivo: c };
            entradaGrupo.hijos.push(entrada);
            cajasAnual.push(entrada);
            return el("label", { class: "admin-check admin-anual-sub" }, caja, el("span", { text: `${c.icono} ${c.nombre}` }));
        });
        bloqueAnual.append(
            el("label", { class: "admin-check admin-anual-grupo" }, cajaGrupo, el("span", { text: `${g.icono} ${g.nombre} (completo)` })),
            el("div", { class: "admin-anual-subs" }, subs));
    });
    // Un grupo completo marca y bloquea sus subgrupos; el colectivo propio siempre se ve
    const actualizarAnual = () => {
        cajasAnual.filter(x => x.tipo === "grupo").forEach(gr => gr.hijos.forEach(h => {
            const propio = h.colectivo.codigo === selectColectivo.value;
            if (gr.caja.checked || propio) h.caja.checked = true;
            h.caja.disabled = gr.caja.checked || propio;
        }));
    };
    cajasAnual.forEach(x => x.caja.addEventListener("change", actualizarAnual));
    selectColectivo.addEventListener("change", actualizarAnual);
    actualizarAnual();
    const leerAnual = () => {
        const grupos = cajasAnual.filter(x => x.tipo === "grupo" && x.caja.checked).map(x => x.token);
        const subs = cajasAnual.filter(x => x.tipo === "sub" && x.caja.checked && !x.caja.disabled).map(x => x.token);
        return [...grupos, ...subs];
    };

    const error = el("p", { class: "admin-error-texto", text: "" });

    const campo = (etiqueta, control) => el("label", { class: "admin-campo" }, el("span", { text: etiqueta }), control);

    const formulario = el("form", { class: "admin-formulario" },
        el("h3", { text: esNuevo ? "Nuevo empleado" : `Editar a ${emp.nombre}` }),
        campo("Nombre", inputNombre),
        campo("Iniciales (2 a 8 letras)", inputIniciales),
        campo("Colectivo", selectColectivo),
        campo("Día en que empieza su ciclo de turnos", inputInicio),
        campo("Rol en la app", selectRol),
        esNuevo ? null : el("label", { class: "admin-campo admin-check" }, checkActivo, el("span", { text: "Activo (si lo desmarcas, no sale en calendarios y no puede entrar)" })),
        esNuevo ? null : filaVerHoras,
        esNuevo ? null : bloqueAnual,
        error,
        el("div", { class: "admin-acciones" },
            el("button", { type: "submit", text: esNuevo ? "Crear empleado" : "Guardar cambios" }),
            el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: () => contenedor.replaceChildren() })
        )
    );

    formulario.addEventListener("submit", async (e) => {
        e.preventDefault();
        error.textContent = "";

        const nombre = inputNombre.value.trim();
        const iniciales = inputIniciales.value.trim().toUpperCase();
        if (!nombre || !/^[A-Z]{2,8}$/.test(iniciales) || !inputInicio.value) {
            error.textContent = MOTIVOS_ADMIN.datos_invalidos;
            return;
        }

        // Los colectivos de ciclo semanal (7 días) empiezan siempre en lunes
        const colectivoElegido = buscarColectivo(selectColectivo.value);
        if (colectivoElegido && colectivoElegido.patron.length === 7 && !esLunes(inputInicio.value)) {
            error.textContent = "El ciclo de este colectivo es semanal: el día de inicio tiene que ser un lunes.";
            return;
        }

        const botonGuardar = formulario.querySelector("button[type=submit]");
        botonGuardar.disabled = true;

        let respuesta;
        if (esNuevo) {
            respuesta = await supabaseClient.rpc("admin_crear_empleado", {
                p_iniciales: iniciales, p_nombre: nombre, p_colectivo: selectColectivo.value,
                p_inicio: inputInicio.value, p_rol: selectRol.value
            });
        } else {
            respuesta = await supabaseClient.rpc("admin_editar_empleado", {
                p_id: emp.id, p_nombre: nombre, p_iniciales: iniciales, p_colectivo: selectColectivo.value,
                p_inicio: inputInicio.value, p_activo: checkActivo.checked,
                p_rol: principal ? selectRol.value : null
            });
        }
        botonGuardar.disabled = false;

        if (respuesta.error) {
            console.error(respuesta.error);
            error.textContent = "Error de conexión con el servidor.";
            return;
        }
        const r = respuesta.data;
        if (!r || !r.ok) {
            error.textContent = MOTIVOS_ADMIN[r && r.motivo] || "No se pudo guardar.";
            return;
        }

        // Resumen de horas para quien no es de un colectivo de turnos (se guarda aparte)
        if (!esNuevo && checkVerHoras.checked !== emp.verHoras) {
            const rv = await supabaseClient.rpc("admin_guardar_ver_horas", { p_empleado: emp.id, p_ver: checkVerHoras.checked });
            if (rv.error || !rv.data || !rv.data.ok) {
                console.error(rv.error || rv.data);
                await recargarGestionAdmin();
                mostrarAviso("Los cambios se guardaron, pero no se pudo cambiar lo del resumen de horas (falta ejecutar el script de la fase 10 en Supabase).", true);
                return;
            }
        }

        // Qué calendarios anuales puede ver (se guarda aparte)
        if (!esNuevo) {
            const nuevoAnual = leerAnual();
            if ([...nuevoAnual].sort().join() !== [...emp.anualVer].sort().join()) {
                const ra = await supabaseClient.rpc("admin_guardar_anual_ver", { p_empleado: emp.id, p_ver: nuevoAnual });
                if (ra.error || !ra.data || !ra.data.ok) {
                    console.error(ra.error || ra.data);
                    await recargarGestionAdmin();
                    mostrarAviso("Los cambios se guardaron, pero no se pudo cambiar qué calendarios anuales puede ver (falta ejecutar el script de la fase 15 en Supabase).", true);
                    return;
                }
            }
        }

        await recargarGestionAdmin();
        if (esNuevo) mostrarPinProvisional(r);
        else mostrarAviso("Cambios guardados.", false);
    });

    contenedor.replaceChildren(formulario);
    contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Ciclos de turno y solapes por colectivo ---
function seccionCiclos() {
    return el("div", { class: "admin-grupo" },
        el("h3", { text: "🔁 Ciclos de turno y días de solape" }),
        el("p", { class: "admin-nota", text: "Cada letra es un día del ciclo (M, T, N, F, P, I, S), separadas por espacios. V, E, J y LD no van en el ciclo: se ponen a mano. Al terminar el ciclo vuelve a empezar. Cada empleado lo recorre desde su día de inicio. Cambiarlo modifica los calendarios de todo el colectivo." }),
        colectivos.map(c => {
            const texto = el("textarea", { rows: "4", spellcheck: "false", value: c.patron.join(" ") });
            const solape = el("input", { type: "number", min: "0", max: "366", value: String(c.diasSolape), class: "input-corto" });
            const msg = el("span", { class: "admin-nota", text: "" });

            const guardar = async () => {
                const letras = texto.value.toUpperCase().split(/[^A-Z]+/).filter(Boolean).flatMap(t => t.split(""));
                if (!letras.length || letras.some(l => !LETRAS_CICLO.includes(l))) {
                    msg.textContent = "Solo se admiten las letras M, T, N, F, P, I y S.";
                    return;
                }
                const dias = Number(solape.value);
                if (!Number.isInteger(dias) || dias < 0) {
                    msg.textContent = "Los días de solape deben ser un número entero.";
                    return;
                }
                if (!confirm(`Vas a cambiar el ciclo de ${c.nombre} (${letras.length} días). Se verá reflejado en todos sus calendarios. ¿Continuar?`)) return;

                const { data, error } = await supabaseClient
                    .from("colectivos")
                    .update({ patron: letras, dias_solape: dias })
                    .eq("codigo", c.codigo)
                    .select();
                if (error || !data || !data.length) {
                    console.error(error);
                    msg.textContent = "No se pudo guardar.";
                    return;
                }
                c.patron = letras;
                c.diasSolape = dias;
                texto.value = letras.join(" ");
                msg.textContent = `Guardado (${letras.length} días de ciclo).`;
            };

            return el("div", { class: "admin-ciclo" },
                el("strong", { text: `${c.icono} ${c.nombre}` }),
                texto,
                el("label", { class: "admin-nota" }, "Días de solape (S) al año: ", solape),
                el("div", { class: "admin-acciones" }, el("button", { text: "Guardar ciclo", onclick: guardar }), msg)
            );
        })
    );
}
