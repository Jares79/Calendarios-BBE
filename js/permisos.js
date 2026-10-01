function esAdministrador(usuario) {
    return usuario.rol === "administrador";
}

function esSupervisor(usuario) {
    return usuario.rol === "supervisor";
}

function esEmpleado(usuario) {
    return usuario.rol === "empleado";
}
