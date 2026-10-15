let usuarioActual = login(
    "JAM",
    "admin123"
);


if (usuarioActual) {

document.getElementById("infoUsuario").innerHTML =
    "👤 <strong>" +
    usuarioActual.nombre +
    "</strong>&nbsp;&nbsp;&nbsp;▼";
verMiCalendario();
}
