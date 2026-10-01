let usuarioActual = login(
    "JAM",
    "659740929"
);

console.log(usuarioActual);

if (usuarioActual) {

    document.getElementById("infoUsuario").innerHTML =
        "<strong>Usuario:</strong> " +
        usuarioActual.nombre +
        "<br>" +
        "<strong>Rol:</strong> " +
        usuarioActual.rol;

}
