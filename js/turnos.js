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

// Información del turno de un empleado (objeto de datos.js) en una fecha:
// { codigo, texto, clase, origen: "manual" | "festivo" | "intensiva" | "ciclo", nota, manual }
function infoTurno(fechaISO, empleado) {
    const colectivo = buscarColectivo(empleado.colectivo);
    if (!colectivo) return { ...convertirTurno("?"), origen: "ciclo", nota: null, manual: false };

    const manual = excepciones.get(claveExcepcion(empleado.id, fechaISO));
    if (manual) {
        return { ...convertirTurno(manual), origen: "manual", nota: null, manual: true };
    }

    const auto = turnoAutomatico(fechaISO, empleado, colectivo);
    return { ...convertirTurno(auto.codigo), origen: auto.origen, nota: auto.nota, manual: false };
}

// Letra que se pinta en la celda
function inicial(info) {
    return info.codigo || "?";
}

// Clase extra para los códigos de dos letras (LD), que necesitan letra más pequeña
function claseLargo(info) {
    return info.codigo && info.codigo.length > 1 ? " largo" : "";
}
