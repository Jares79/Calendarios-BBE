let usuarioActual = login(
    "JAM",
    "admin123"
);


if (usuarioActual) {

    document.getElementById("infoUsuario").innerHTML =
        "<strong>Usuario:</strong> " +
        usuarioActual.nombre +
        "<br>" +
        "<strong>Rol:</strong> " +
        usuarioActual.rol;

}
