let fechaCalendario = new Date();

function verMiCalendario() {

    const anio =
        fechaCalendario.getFullYear();

    const mes =
        fechaCalendario.getMonth();

    let nombreMes =
        fechaCalendario.toLocaleDateString(
            "es-ES",
            {
                month:"long",
                year:"numeric"
            }
        );

    nombreMes =
        nombreMes.charAt(0).toUpperCase() +
        nombreMes.slice(1);

    document.getElementById(
        "tituloMes"
    ).textContent = nombreMes;

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

    let html = `
    <div class="calendario-grid">

        <div class="dia-cabecera">L</div>
        <div class="dia-cabecera">M</div>
        <div class="dia-cabecera">X</div>
        <div class="dia-cabecera">J</div>
        <div class="dia-cabecera">V</div>
        <div class="dia-cabecera">S</div>
        <div class="dia-cabecera">D</div>
    `;

    let primerDia =
        new Date(anio, mes, 1).getDay();

    primerDia =
        primerDia === 0
        ? 6
        : primerDia - 1;

    for(let i = 0; i < primerDia; i++){

        html += `<div></div>`;
    }

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
            <div
                class="dia-calendario ${info.clase}"
            >
                <div class="numero-dia">
                    ${dia}
                </div>

                <div class="turno-dia">
                    ${inicial(info)}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    document.getElementById(
        "miCalendario"
    ).innerHTML = html;
}

function mesAnterior(){

    fechaCalendario.setMonth(
        fechaCalendario.getMonth() - 1
    );

    verMiCalendario();
}

function mesSiguiente(){

    fechaCalendario.setMonth(
        fechaCalendario.getMonth() + 1
    );

    verMiCalendario();
}