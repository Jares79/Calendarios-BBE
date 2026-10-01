const usuarioActual = login(
    "JAM",
    "659740929"
);

console.log(usuarioActual);

if (usuarioActual) {
    console.log("Bienvenido " + usuarioActual.nombre);
    console.log("Rol: " + usuarioActual.rol);
}
