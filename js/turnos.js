// js/turnos.js
// Cálculo de turnos. Todo se hace con fechas en texto "AAAA-MM-DD", sin horas ni zonas
// horarias: así el resultado es el mismo en cualquier móvil y cualquier país.
//
// Qué turno tiene alguien un día (de mayor a menor prioridad):
//   1. Un cambio puesto a mano por esa persona (excepciones).
//   2. Festivo: convierte en F una P o una I que salga del ciclo.
//   3. Intensiva: convierte en I cualquier P dentro de los periodos marcados.
//   4. El ciclo (patrón) de su colectivo, desde su fecha de inicio.

const TURNOS = {
    M:  { texto: "Mañana",            clase: "manana" },
    T:  { texto: "Tarde",             clase: "tarde" },
    N:  { texto: "Noche",             clase: "noche" },
    F:  { texto: "Fiesta",            clase: "fiesta" },
    P:  { texto: "Partida",           clase: "partida" },
    I:  { texto: "Intensiva",         clase: "intensiva" },
    S:  { texto: "Solape",            clase: "solape" },
    V:  { texto: "Vacaciones",        clase: "vacaciones" },
    E:  { texto: "Excesos",           clase: "excesos" },
    J:  { texto: "Permiso justificado", clase: "permiso" },
    LD: { texto: "Libre disposición", clase: "libredisp" }
};

// Marcas semanales (mitad de arriba de la celda) de los colectivos con semanas especiales:
// G = guardia (personal de jornada partida) y CTD, CT1... CTY (correturnos).
// No son turnos del día: van por semana (de lunes a domingo) y no cambian el turno de abajo.
const MARCAS = {
    G:   { texto: "Guardia",        clase: "marca-g" },
    CTD: { texto: "Correturno CTD", clase: "marca-ctd" },
    CT1: { texto: "Correturno CT1", clase: "marca-ct1" },
    CT2: { texto: "Correturno CT2", clase: "marca-ct2" },
    CT3: { texto: "Correturno CT3", clase: "marca-ct3" },
    CT4: { texto: "Correturno CT4", clase: "marca-ct4" },
    CTY: { texto: "Correturno CTY", clase: "marca-cty" }
};

// Turnos y marcas juntos (para el editor de colores)
const TIPOS_COLOR = { ...TURNOS, ...MARCAS };

// Letras que puede llevar el ciclo de un colectivo (las demás solo se ponen a mano)
const LETRAS_CICLO = ["M", "T", "N", "F", "P", "I", "S"];

// Date (hora local) -> "AAAA-MM-DD"
function aISO(fecha) {
    const a = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
}

// "AAAA-MM-DD" -> "DD/MM/AAAA"
function formatearFecha(iso) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
}

// "AAAA-MM-DD" -> "Sábado, 14 de noviembre"
function fechaLarga(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    const texto = new Date(a, m - 1, d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function diaNumero(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return Math.round(Date.UTC(a, m - 1, d) / 86400000);
}

// Todas las fechas "AAAA-MM-DD" de un rango, ambos extremos incluidos
function rangoFechas(desdeISO, hastaISO) {
    const fechas = [];
    for (let n = diaNumero(desdeISO); n <= diaNumero(hastaISO); n++) {
        fechas.push(new Date(n * 86400000).toISOString().slice(0, 10));
    }
    return fechas;
}

// Código que da el ciclo de un colectivo ("M", "T", "N", "F", "P", "I", "S")
function codigoTurno(fechaISO, empleado, colectivo) {
    const patron = colectivo.patron;
    const n = patron.length;
    const dias = diaNumero(fechaISO) - diaNumero(empleado.inicio);
    return patron[((dias % n) + n) % n];
}

// Lunes de la semana de una fecha, como "AAAA-MM-DD" (el 1-1-1970 fue jueves)
function lunesDe(fechaISO) {
    const n = diaNumero(fechaISO);
    const diasDesdeLunes = (((n + 3) % 7) + 7) % 7;
    return new Date((n - diasDesdeLunes) * 86400000).toISOString().slice(0, 10);
}

function domingoDe(fechaISO) {
    return new Date((diaNumero(lunesDe(fechaISO)) + 6) * 86400000).toISOString().slice(0, 10);
}

function esLunes(fechaISO) {
    return lunesDe(fechaISO) === fechaISO;
}

function convertirMarca(codigo) {
    const m = MARCAS[codigo];
    return m
        ? { codigo, texto: m.texto, clase: m.clase }
        : { codigo, texto: codigo, clase: "" };
}

function claveExcepcion(empleadoId, fechaISO) {
    return empleadoId + "|" + fechaISO;
}

function enIntensiva(fechaISO) {
    return intensivas.some(p => fechaISO >= p.desde && fechaISO <= p.hasta);
}

// Turno sin contar los cambios manuales: ciclo, intensiva y festivo
function turnoAutomatico(fechaISO, empleado, colectivo) {
    let codigo = codigoTurno(fechaISO, empleado, colectivo);
    let origen = "ciclo";
    let nota = null;

    if (codigo === "P" && enIntensiva(fechaISO)) {
        codigo = "I";
        origen = "intensiva";
    }
    if ((codigo === "P" || codigo === "I") && festivos.has(fechaISO)) {
        codigo = "F";
        origen = "festivo";
        nota = festivos.get(fechaISO) || null;
    }
    return { codigo, origen, nota };
}

function convertirTurno(codigo) {
    const t = TURNOS[codigo];
    return t
        ? { codigo, texto: t.texto, clase: t.clase }
        : { codigo, texto: codigo, clase: "" };
}

// Marca semanal (G, CT1...) de un empleado en una fecha, o null. Solo existe en los colectivos
// con semanas especiales; la semana va de lunes a domingo.
function marcaDeSemana(fechaISO, empleado, colectivo) {
    if (!colectivo.marcas.length) return null;
    const codigo = semanas.get(claveExcepcion(empleado.id, lunesDe(fechaISO)));
    return codigo ? convertirMarca(codigo) : null;
}

// Información del turno de un empleado (objeto de datos.js) en una fecha:
// { codigo, texto, clase, origen: "manual" | "festivo" | "intensiva" | "ciclo", nota, manual,
//   partida: la celda se dibuja partida (colectivos con semanas), marca: mitad de arriba o null }
function infoTurno(fechaISO, empleado) {
    const colectivo = buscarColectivo(empleado.colectivo);
    if (!colectivo) return { ...convertirTurno("?"), origen: "ciclo", nota: null, manual: false, partida: false, marca: null };

    const partida = colectivo.marcas.length > 0;
    const marca = marcaDeSemana(fechaISO, empleado, colectivo);

    const manual = excepciones.get(claveExcepcion(empleado.id, fechaISO));
    if (manual) {
        return { ...convertirTurno(manual), origen: "manual", nota: null, manual: true, partida, marca };
    }

    const auto = turnoAutomatico(fechaISO, empleado, colectivo);
    return { ...convertirTurno(auto.codigo), origen: auto.origen, nota: auto.nota, manual: false, partida, marca };
}

// Letra que se pinta en la celda
function inicial(info) {
    return info.codigo || "?";
}

// Contenido de una celda partida en dos mitades (arriba la marca de la semana, abajo el turno).
// Devuelve HTML con textos ya escapados; las clases salen de constantes.
function htmlMitades(info, extraArriba) {
    const claseArriba = info.marca ? info.marca.clase : "sin-marca";
    const codigoMarca = info.marca ? esc(info.marca.codigo) : "";
    return `<span class="mitad-arriba ${claseArriba}">${extraArriba || ""}<span class="marca-codigo">${codigoMarca}</span></span>` +
           `<span class="mitad-abajo"><span class="turno-dia">${esc(inicial(info))}</span></span>`;
}

// Clase extra para los códigos de dos letras (LD), que necesitan letra más pequeña
function claseLargo(info) {
    return info.codigo && info.codigo.length > 1 ? " largo" : "";
}
