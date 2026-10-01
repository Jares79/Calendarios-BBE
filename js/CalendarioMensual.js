function verMiCalendario() {

    const valor =
        document.getElementById("mesUsuario").value;

    if (!valor) {
        alert("Selecciona un mes");
        return;
    }

    const partes = valor.split("-");

    const anio = Number(partes[0]);
    const mes = Number(partes[1]) - 1;

    const empleado = jefes.find(
        j => j.name === usuarioActual.empleado
    );

    if (!empleado) {
        alert("Empleado no encontrado");
        return;
    }

    const diasMes =
        new Date(
            anio,
            mes + 1,
            0
        ).getDate();

    let html =
        `<h3>${usuarioActual.nombre}</h3>`;

    for (let dia = 1; dia <= diasMes; dia++) {

        const fecha =
            new Date(
                anio,
                mes,
                dia
            );

        const info =
            obtenerInfoJT(
                fecha,
                empleado.inicio
            );

        html += `
            <div class="item ${info.clase}">
                Día ${dia} - ${info.texto}
            </div>
        `;
    }

    document.getElementById("miCalendario").innerHTML =
        html;
}
