// js/anio.js
// "Mi año": los 12 meses a la vez, un cuadradito por día con el color de su turno, y debajo
// el recuento de días por turno. Usa infoTurno(), así que respeta cambios manuales, festivos,
// intensivas y (en los colectivos con semanas) la marca de la semana.

let anioVista = null;

const NOMBRES_MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function verMiAnio(anio) {
    const viejo = document.getElementById("btnVolverAnio"); if (viejo) viejo.remove();
    const empleado = obtenerEmpleadoActual();
    mostrarVistaAdmin();
    if (!empleado) {
        document.getElementById("resultado").replaceChildren(
            el("p", { class: "aviso-vacio", text: "No se ha encontrado tu ficha de empleado, así que no se puede mostrar tu año." }),
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        );
        return;
    }
    if (anio === undefined) anio = anioVista !== null ? anioVista : Math.min(Math.max(new Date().getFullYear(), ANIO_MIN), ANIO_MAX);
    pintarMiAnio(anio);
}

async function pintarMiAnio(anio) {
    anioVista = anio;
    const contenedor = document.getElementById("resultado");
    const empleado = obtenerEmpleadoActual();
    if (!empleado) return;
    const colectivo = buscarColectivo(empleado.colectivo);

    const ok = await asegurarAnio(anio);
    if (anioVista !== anio) return;   // se cambió de año mientras cargaba

    const hoyISO = aISO(new Date());
    const conteo = new Map();      // código de turno -> días
    const semanasMarca = new Map(); // código de marca -> días

    const meses = [];
    for (let mes = 0; mes < 12; mes++) {
        const diasMes = new Date(anio, mes + 1, 0).getDate();
        let hueco = new Date(anio, mes, 1).getDay();
        hueco = hueco === 0 ? 6 : hueco - 1;

        const celdas = [];
        for (let i = 0; i < hueco; i++) celdas.push(el("span", { class: "cuadro-vacio" }));

        for (let dia = 1; dia <= diasMes; dia++) {
            const iso = aISO(new Date(anio, mes, dia));
            const info = infoTurno(iso, empleado);
            conteo.set(info.codigo, (conteo.get(info.codigo) || 0) + 1);
            if (info.marca) semanasMarca.set(info.marca.codigo, (semanasMarca.get(info.marca.codigo) || 0) + 1);

            const titulo = `${fechaLarga(iso)}: ${info.texto}${info.marca ? " · " + info.marca.texto : ""}`;
            celdas.push(el("button", {
                type: "button",
                class: "cuadro-dia " + info.clase + (info.marca ? " con-marca" : "") + (iso === hoyISO ? " hoy" : ""),
                title: titulo, "aria-label": titulo
            },
                info.marca ? el("span", { class: "cuadro-marca " + info.marca.clase }, el("span", { class: "cuadro-marca-letra", text: info.marca.codigo })) : null,
                el("span", { class: "cuadro-letra", text: info.codigo })));
        }

        meses.push(el("section", { class: "mes-mini mes-clicable", onclick: () => abrirMesDesdeAnio(anio, mes) },
            el("h4", { text: NOMBRES_MESES[mes] }),
            el("div", { class: "mes-mini-grid" }, celdas)
        ));
    }

    const totales = Object.entries(TURNOS)
        .filter(([codigo]) => conteo.get(codigo))
        .map(([codigo, t]) => el("li", { class: "total-chip " + t.clase, title: t.texto },
            el("span", { class: "total-letra" + (codigo.length > 1 ? " largo" : ""), text: codigo }),
            el("span", { class: "total-num", text: conteo.get(codigo) })
        ));

    const totalesMarcas = Object.entries(MARCAS)
        .filter(([codigo]) => semanasMarca.get(codigo))
        .map(([codigo, m]) => el("li", { class: "total-chip " + m.clase, title: m.texto },
            el("span", { class: "total-letra largo", text: codigo }),
            el("span", { class: "total-num", text: semanasMarca.get(codigo) })
        ));

    const flecha = (texto, etiqueta, destino, desactivada) => el("button", {
        type: "button", class: "btn-icono", "aria-label": etiqueta, text: texto,
        disabled: desactivada ? true : null,
        onclick: () => pintarMiAnio(destino)
    });

    reemplazarHijos(contenedor,
        el("div", { class: "resultado-cabecera" },
            el("div", {},
                el("h2", { text: `Año ${anio}` }),
                el("p", { class: "anio-sub", text: `${empleado.nombre}${colectivo ? " · " + colectivo.puesto : ""}` })
            ),
            el("button", { type: "button", class: "btn-secundario", text: "Volver", onclick: cerrarVistaResultado })
        ),
        el("div", { class: "anio-nav" },
            flecha("‹", "Año anterior", anio - 1, anio <= ANIO_MIN),
            el("strong", { class: "anio-nav-texto", text: String(anio) }),
            flecha("›", "Año siguiente", anio + 1, anio >= ANIO_MAX)
        ),
        ok ? null : el("p", { class: "error-texto", text: "No se pudieron cargar todos los cambios manuales de este año." }),
        el("div", { class: "anio-meses" }, meses),
        el("h3", { class: "grupo-titulo", text: "Días por turno" }),
        el("ul", { class: "anio-totales" }, totales),
        totalesMarcas.length ? el("h3", { class: "grupo-titulo", text: "Días con marca" }) : null,
        totalesMarcas.length ? el("ul", { class: "anio-totales" }, totalesMarcas) : null
    );
    registrarVista(() => pintarMiAnio(anio));
}

// Al pulsar un mes del año se abre ese mes (con sus días pulsables) y un botón para volver al año
function abrirMesDesdeAnio(anio, mes) {
    fechaCalendario = new Date(anio, mes, 1);
    cerrarVistaResultado();   // vuelve al calendario mensual y lo pinta

    const antiguo = document.getElementById("btnVolverAnio");
    if (antiguo) antiguo.remove();
    const boton = el("button", {
        id: "btnVolverAnio", type: "button", class: "btn-secundario btn-ancho",
        text: "← Volver al año " + anio,
        onclick: () => { boton.remove(); verMiAnio(anio); }
    });
    document.getElementById("cardCalendario").prepend(boton);
    ajustarAlturaCalendario();   // en móvil recalcula para que el mes siga cabiendo
}
