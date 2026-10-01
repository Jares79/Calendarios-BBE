function verMiCalendario() {

    const valor =
        document.getElementById("mesUsuario").value;

    if (!valor) {
        alert("Selecciona un mes");
        return;
    }

    document.getElementById("miCalendario").innerHTML =
        `
        <h3>Calendario mensual</h3>
        <p>Mes seleccionado: ${valor}</p>
        `;
}
