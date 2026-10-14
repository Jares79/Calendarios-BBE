let fechaCalendario = new Date();
let inicioTouchX = 0;
let finTouchX = 0;
let swipeActivo = false;

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
    const calendario =
    document.getElementById(
        "miCalendario"
    );

if(!swipeActivo){

    calendario.addEventListener(
        "touchstart",
        function(e){

            inicioTouchX =
                e.changedTouches[0].screenX;

        }
    );

    calendario.addEventListener(
        "touchend",
        function(e){

            finTouchX =
                e.changedTouches[0].screenX;

            manejarSwipe();

        }
    );

    swipeActivo = true;
}
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

function manejarSwipe(){

    const diferencia =
        inicioTouchX - finTouchX;

    const calendario =
        document.getElementById(
            "miCalendario"
        );

    calendario.classList.add(
        "calendario-animando"
    );

    setTimeout(function(){

        if(diferencia > 50){

            mesSiguiente();
        }

        if(diferencia < -50){

            mesAnterior();
        }

        calendario.classList.remove(
            "calendario-animando"
        );

    },200);

}

function mostrarSelectorMes(){

    document.getElementById(
        "mesSelector"
    ).value = fechaCalendario.getMonth();

    document.getElementById(
        "anioSelector"
    ).value = fechaCalendario.getFullYear();

    const selector =
        document.getElementById(
            "selectorMes"
        );

    if(selector.style.display === "block"){

        selector.style.display = "none";

    }else{

        selector.style.display = "block";
    }

}

function aplicarMes(){

    const mes =
        Number(
            document.getElementById(
                "mesSelector"
            ).value
        );

    const anio =
        Number(
            document.getElementById(
                "anioSelector"
            ).value
        );

    fechaCalendario =
        new Date(
            anio,
            mes,
            1
        );

    verMiCalendario();

    document.getElementById(
        "selectorMes"
    ).style.display = "none";

}

function irAHoy(){

    fechaCalendario =
        new Date();

    verMiCalendario();

    document.getElementById(
        "selectorMes"
    ).style.display = "none";

}