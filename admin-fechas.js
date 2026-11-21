// js/admin-fechas.js
// Menú de administrador: festivos e intensivas. Solo interfaz: la base de datos comprueba
// en el servidor que quien escribe es administrador.

// --- Utilidades comunes ---
function mostrarVistaAdmin() {
    terminarModoEdicion();
    cerrarPanelUsuario();
    ocultarDetalleDia();
    const contenedor = document.getElementById("resultado");
    contenedor.style.display = "block";
    document.getElementById("cardCalendario").style.display = "none";
    document.body.classList.add("vista-resultado");
    window.scrollTo(0, 0);
    return contenedor;
}

function selectorAnio(anio, alCambiar) {
    const select = el("select", { "aria-label": "Año" });
    rellenarAnios(select, anio);
    select.addEventListener("change", () => alCambiar(Number(select.value)));
    return select;
}

function anioInicialAdmin() {
    return Math.min(Math.max(new Date().getFullYear(), ANIO_MIN), ANIO_MAX);
}

function avisoAdmin(contenedor, texto, esError) {
    let aviso = contenedor.querySelector(".admin-aviso");
    if (!aviso) {
        aviso = el("div", { class: "admin-aviso" });
        contenedor.querySelector(".resultado-cabecera").after(aviso);
    }
    aviso.textContent = texto;
    aviso.className = "admin-aviso " + (esError ? "admin-error" : "admin-ok");
}

// --- FESTIVOS ---
function verGestionFestivos(anio) {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    anio = anio || anioInicialAdmin();
    const contenedor = mostrarVistaAdmin();

    const lista = [...festivos.entries()]
        .filter(([fecha]) => fecha.startsWith(anio + "-"))
        .sort(([a], [b]) => a.localeCompare(b));

    const inputFecha = el("input", { type: "date", min: `${anio}-01-01`, max: `${anio}-12-31`, value: `${anio}-01-01`, "aria-label": "Fecha del festivo" });
    const inputNombre = el("input", { type: "text", maxlength: "60", placeholder: "Nombre (opcional)", "aria-label": "Nombre del festivo" });

    const anadir = async () => {
        const fecha = inputFecha.value;
        if (!fecha) { avisoAdmin(contenedor, "Elige una fecha.", true); return; }
        if (festivos.has(fecha)) { avisoAdmin(contenedor, "Ese día ya está como festivo.", true); return; }

        const nombre = inputNombre.value.trim() || null;
        const { error } = await supabaseClient.from("festivos").insert({ fecha, nombre });
        if (error) {
            console.error(error);
            avisoAdmin(contenedor, "No se pudo guardar el festivo.", true);
            return;
        }
        festivos.set(fecha, nombre);
        verGestionFestivos(Number(fecha.slice(0, 4)));
        avisoAdmin(document.getElementById("resultado"), `Festivo del ${formatearFecha(fecha)} añadido.`, false);
    };

    const quitar = async (fecha) => {
        if (!confirm(`¿Quitar el festivo del ${formatearFecha(fecha)}?`)) return;
        const { error } = await supabaseClient.from("festivos").delete().eq("fecha", fecha);
        if (error) {
            console.error(error);
            avisoAdmin(contenedor, "No se pudo quitar el festivo.", true);
            return;
        }
        festivos.delete(fecha);
        verGestionFestivos(anio);
        avisoAdmin(document.getElementById("resultado"), "Festivo quitado.", false);
    };

    contenedor.replaceChildren(
        el("div", { class: "resultado-cabecera" },
            el("h2", { text: "Festivos" }),
            el("div", { class: "resultado-acciones" },
                selectorAnio(anio, verGestionFestivos),
                el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
            )
        ),
        el("p", { class: "admin-nota", text: "En un festivo, quien tenga una P o una I del ciclo pasa a tener F. M, T y N no cambian, y lo que cada uno haya editado a mano tampoco." }),
        el("form", { class: "admin-formulario formulario-fechas" },
            el("h3", { text: "Añadir festivo" }),
            el("div", { class: "fila-campos" }, inputFecha, inputNombre),
            el("button", { type: "submit", text: "Añadir festivo" })
        ),
        el("h3", { class: "grupo-titulo", text: `Festivos de ${anio} (${lista.length})` }),
        ...(lista.length
            ? lista.map(([fecha, nombre]) => el("div", { class: "admin-fila" },
                el("div", { class: "admin-fila-datos" },
                    el("strong", { text: fechaLarga(fecha) }),
                    el("div", { class: "admin-nota", text: nombre || "Sin nombre" })
                ),
                el("div", { class: "admin-acciones" },
                    el("button", { type: "button", class: "btn-peligro", text: "Quitar", onclick: () => quitar(fecha) })
                )))
            : [el("p", { class: "aviso-vacio", text: "Todavía no hay festivos este año." })])
    );

    contenedor.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); anadir(); });
}

// --- INTENSIVAS ---
function textoPeriodo(p) {
    if (p.desde === p.hasta) return `${fechaLarga(p.desde)} (un día)`;
    return `Del ${formatearFecha(p.desde)} al ${formatearFecha(p.hasta)}`;
}

function verGestionIntensivas(anio) {
    if (!usuarioActual || !puedeGestionarUsuarios(usuarioActual)) return;
    anio = anio || anioInicialAdmin();
    const contenedor = mostrarVistaAdmin();

    const lista = intensivas
        .filter(p => p.desde.slice(0, 4) === String(anio) || p.hasta.slice(0, 4) === String(anio))
        .sort((a, b) => a.desde.localeCompare(b.desde));

    const inputDesde = el("input", { type: "date", value: `${anio}-06-15`, "aria-label": "Desde" });
    const inputHasta = el("input", { type: "date", value: "", "aria-label": "Hasta (vacío = un solo día)" });
    const inputNota = el("input", { type: "text", maxlength: "60", placeholder: "Nota (opcional)", "aria-label": "Nota" });

    const anadir = async () => {
        const desde = inputDesde.value;
        const hasta = inputHasta.value || desde;
        if (!desde) { avisoAdmin(contenedor, "Elige al menos la fecha inicial.", true); return; }
        if (hasta < desde) { avisoAdmin(contenedor, "La fecha final no puede ser anterior a la inicial.", true); return; }

        const { data, error } = await supabaseClient
            .from("intensivas")
            .insert({ desde, hasta, nota: inputNota.value.trim() || null })
            .select()
            .single();
        if (error || !data) {
            console.error(error);
            avisoAdmin(contenedor, "No se pudo guardar el periodo.", true);
            return;
        }
        intensivas.push({ id: data.id, desde: data.desde, hasta: data.hasta, nota: data.nota });
        verGestionIntensivas(Number(desde.slice(0, 4)));
        avisoAdmin(document.getElementById("resultado"), "Periodo añadido.", false);
    };

    const quitar = async (periodo) => {
        if (!confirm(`¿Quitar el periodo "${textoPeriodo(periodo)}"?`)) return;
        const { error } = await supabaseClient.from("intensivas").delete().eq("id", periodo.id);
        if (error) {
            console.error(error);
            avisoAdmin(contenedor, "No se pudo quitar el periodo.", true);
            return;
        }
        intensivas = intensivas.filter(p => p.id !== periodo.id);
        verGestionIntensivas(anio);
        avisoAdmin(document.getElementById("resultado"), "Periodo quitado.", false);
    };

    const sugerir = () => {
        inputDesde.value = `${anio}-06-15`;
        inputHasta.value = `${anio}-09-15`;
        inputNota.value = "Verano";
    };

    contenedor.replaceChildren(
        el("div", { class: "resultado-cabecera" },
            el("h2", { text: "Intensivas" }),
            el("div", { class: "resultado-acciones" },
                selectorAnio(anio, verGestionIntensivas),
                el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
            )
        ),
        el("p", { class: "admin-nota", text: "En estas fechas, quien tenga una P del ciclo pasa a tener I. Un festivo sigue ganando (F) y lo que cada uno haya editado a mano también." }),
        el("form", { class: "admin-formulario formulario-fechas" },
            el("h3", { text: "Añadir periodo" }),
            el("div", { class: "fila-campos" },
                el("label", { class: "campo" }, el("span", { text: "Desde" }), inputDesde),
                el("label", { class: "campo" }, el("span", { text: "Hasta (vacío = un solo día)" }), inputHasta)
            ),
            inputNota,
            el("div", { class: "admin-acciones" },
                el("button", { type: "submit", text: "Añadir periodo" }),
                el("button", { type: "button", class: "btn-secundario", text: "Poner 15/06 – 15/09", onclick: sugerir })
            )
        ),
        el("h3", { class: "grupo-titulo", text: `Periodos de ${anio} (${lista.length})` }),
        ...(lista.length
            ? lista.map(p => el("div", { class: "admin-fila" },
                el("div", { class: "admin-fila-datos" },
                    el("strong", { text: textoPeriodo(p) }),
                    el("div", { class: "admin-nota", text: p.nota || "Sin nota" })
                ),
                el("div", { class: "admin-acciones" },
                    el("button", { type: "button", class: "btn-peligro", text: "Quitar", onclick: () => quitar(p) })
                )))
            : [el("p", { class: "aviso-vacio", text: "Todavía no hay periodos de intensiva este año." })])
    );

    contenedor.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); anadir(); });
}
