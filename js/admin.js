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

    const listas = colectivos.map(c => el("div", { class: "admin-grupo" },
        el("h3", { text: `${c.icono} ${c.nombre}` }),
        c.empleados.length
            ? c.empleados.map(emp => filaEmpleado(emp, c))
            : el("p", { class: "admin-nota", text: "Sin empleados." })
    ));

    contenedor.replaceChildren(
        cabecera, adminAviso, botonNuevo, formulario, ...listas,
        el("hr", { class: "separador" }),
        seccionCiclos()
    );
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
    const selectColectivo = el("select", {}, colectivos.map(c => el("option", { value: c.codigo, text: c.nombre })));
    selectColectivo.value = emp ? emp.colectivo : colectivos[0].codigo;
    const inputInicio = el("input", { type: "date", value: emp ? emp.inicio : "", required: true });
    const selectRol = el("select", {},
        [["empleado", "Empleado"], ["supervisor", "Supervisor"], ["administrador", "Administrador"]]
            .map(([v, t]) => el("option", { value: v, text: t })));
    selectRol.value = principal ? principal.rol : "empleado";
    if (!esNuevo && !principal) selectRol.disabled = true;
    const checkActivo = el("input", { type: "checkbox", checked: emp ? emp.activo : true });
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
