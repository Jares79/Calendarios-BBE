const usuarios = [
{
id: 1,
nombre: "Javier Ares",
usuario: "JAM",
password: "admin123",
rol: "administrador",
empleado: "Javi"
},
{
id: 2,
nombre: "Jorge Soto",
usuario: "jsp",
password: "super123",
rol: "supervisor"
},
{
id: 3,
nombre: "Demo",
usuario: "demo",
password: "demo",
rol: "empleado"
}
];
function login(usuario, password) {
    return usuarios.find(
        u =>
            u.usuario === usuario &&
            u.password === password
    );
}
