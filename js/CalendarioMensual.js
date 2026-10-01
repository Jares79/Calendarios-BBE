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

    const diasMes =
        new Date(
            anio,
            mes + 1,
            0
        ).getDate();

    let html = `
        <h3>
            Calendario de ${valor}
        </h3>
    `;

    for (let dia = 1; dia <= diasMes; dia++) {

        html += `
            <div class="item">
                Día ${dia}
            </div>
        `;
    }

    document.getElementById("miCalendario").innerHTML =
        html;
}
