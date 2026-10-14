let usuarioActual = login(
    "JAM",
    "admin123"
);


if (usuarioActual) {

    document.getElementById("infoUsuario").innerHTML =
    "👤 <strong>" +
    usuarioActual.nombre +
    "</strong> | 🔐 " +
    usuarioActual.rol;
verMiCalendario();
}
