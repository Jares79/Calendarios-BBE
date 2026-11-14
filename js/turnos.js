// js/turnos.js
// Cálculo de turnos a partir del ciclo (patrón) de cada colectivo.
// Todo se hace con fechas en texto "AAAA-MM-DD", sin horas ni zonas horarias:
// así el resultado es el mismo en cualquier móvil y cualquier país.

const TURNOS = {
    M: { texto: "Mañana",    clase: "manana" },
    T: { texto: "Tarde",     clase: "tarde" },
    N: { texto: "Noche",     clase: "noche" },
    F: { texto: "Fiesta",    clase: "fiesta" },
    P: { texto: "Partida",   clase: "partida" },
    I: { texto: "Intensiva", clase: "intensiva" },
    S: { texto: "Solape",    clase: "solape" }
};

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

function diaNumero(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return Math.round(Date.UTC(a, m - 1, d) / 86400000);
}

// Código de turno ("M", "T", "N", "F", "P", "I", "S") de un empleado en una fecha
function codigoTurno(fechaISO, empleado, colectivo) {
    const patron = colectivo.patron;
    const n = patron.length;
    const dias = diaNumero(fechaISO) - diaNumero(empleado.inicio);
    return patron[((dias % n) + n) % n];
}

function convertirTurno(codigo) {
    const t = TURNOS[codigo];
    return t
        ? { codigo, texto: t.texto, clase: t.clase }
        : { codigo, texto: codigo, clase: "" };
}

// Información del turno de un empleado (objeto de datos.js) en una fecha
function infoTurno(fechaISO, empleado) {
    const colectivo = buscarColectivo(empleado.colectivo);
    if (!colectivo) return convertirTurno("?");
    return convertirTurno(codigoTurno(fechaISO, empleado, colectivo));
}

// Letra que se pinta en la celda
function inicial(info) {
    return info.codigo || "?";
}
