
function pintar(nombre,info){

    return `
        <div class="item ${info.clase}">
            ${nombre} → ${info.texto}
        </div>
    `;
}

function agregarResumen(resumen,nombre,turno){

    if(!resumen[turno]){
        resumen[turno] = [];
    }

    resumen[turno].push(nombre);
}

function consultar(){

    const valor =
        document.getElementById("fecha").value;

    if(!valor){
        alert("Selecciona una fecha");
        return;
    }

    const fecha =
        new Date(valor + "T00:00:00");

    let resumen = {};

    let html =
        `<h2>Fecha: ${valor}</h2>`;

    html += "<h2>👨‍✈️ Jefes de Turno</h2>";

    jefes.forEach(j=>{

        let info =
            obtenerInfoJT(
                fecha,
                j.inicio
            );

        html += pintar(j.name,info);

        agregarResumen(
            resumen,
            j.name,
            info.texto
        );

    });

    html += "<h2>🎛️ Operadores de Control</h2>";

    control.forEach(o=>{

        let info =
            obtenerInfoOP(
                fecha,
                o.inicio
            );

        html += pintar(o.name,info);

        agregarResumen(
            resumen,
            o.name,
            info.texto
        );

    });

    html += "<h2>🔧 Operadores de Campo</h2>";

    campo.forEach(o=>{

        let info =
            obtenerInfoOP(
                fecha,
                o.inicio
            );

        html += pintar(o.name,info);

        agregarResumen(
            resumen,
            o.name,
            info.texto
        );

    });

    html += "<hr>";
    html += "<h2>📋 Resumen Diario</h2>";

    const orden = [
        "Semana X",
        "Semana Y",
        "Mañana",
        "Tarde",
        "Noche",
        "Partida",
        "Intensiva",
        "Fiesta"
    ];

    orden.forEach(turno=>{

        if(!resumen[turno]) return;

        html += `<h3>${turno}</h3>`;

        resumen[turno].forEach(persona=>{

            html +=
            `<div class="resumen">• ${persona}</div>`;

        });

    });

    document.getElementById("resultado").innerHTML =
        html;
}
function colorCelda(clase){

    switch(clase){

        case "manana":
            return "#B3E5FC";

        case "tarde":
            return "#42A5F5";

        case "noche":
            return "#9C27B0";

        case "fiesta":
            return "#E53935";

        case "partida":
            return "#E0E0E0";

        case "intensiva":
            return "#E0E0E0";

        case "semanax":
            return "#FFD54F";

        case "semanay":
            return "#E0E0E0";

        default:
            return "white";
    }

}

function inicial(info){

    switch(info.texto){

        case "Mañana": return "M";
        case "Tarde": return "T";
        case "Noche": return "N";
        case "Fiesta": return "F";
        case "Partida": return "P";
        case "Intensiva": return "I";
        case "Semana X": return "X";
        case "Semana Y": return "Y";
        default: return "?";
    }

}

function crearFila(nombre,inicio,fechaMes,esJT){

    let fila =
        `<tr><td class="nombre">${nombre}</td>`;

    const diasMes =
        new Date(
            fechaMes.getFullYear(),
            fechaMes.getMonth()+1,
            0
        ).getDate();

    for(let dia=1; dia<=diasMes; dia++){

        const fecha =
            new Date(
                fechaMes.getFullYear(),
                fechaMes.getMonth(),
                dia
            );

        const info =
            esJT
            ? obtenerInfoJT(fecha,inicio)
            : obtenerInfoOP(fecha,inicio);

        fila += `
            <td
            style="
            background:${colorCelda(info.clase)};
            ">
            ${inicial(info)}
            </td>
        `;
    }

    fila += "</tr>";

    return fila;
}

function verCalendario(){

    const mes =
        Number(
            document.getElementById("mes").value
        );

    const anio =
        Number(
            document.getElementById("anio").value
        );

    const fechaMes =
        new Date(
            anio,
            mes,
            1
        );

    const diasMes =
        new Date(
            anio,
            mes+1,
            0
        ).getDate();

    let html = `
        <h2>
        Calendario mensual
        </h2>
    `;

    html += "<table>";

    html += "<tr>";
    html += "<th>Persona</th>";

    for(let dia=1; dia<=diasMes; dia++){

        html += `<th>${dia}</th>`;

    }

    html += "</tr>";

    html += `
        <tr>
            <th colspan="${diasMes+1}">
            👨‍✈️ Jefes de Turno
            </th>
        </tr>
    `;

    jefes.forEach(j=>{

        html += crearFila(
            j.name,
            j.inicio,
            fechaMes,
            true
        );

    });

    html += `
        <tr>
            <th colspan="${diasMes+1}">
            🎛️ Operadores Control
            </th>
        </tr>
    `;

    control.forEach(o=>{

        html += crearFila(
            o.name,
            o.inicio,
            fechaMes,
            false
        );

    });

    html += `
        <tr>
            <th colspan="${diasMes+1}">
            🔧 Operadores Campo
            </th>
        </tr>
    `;

    campo.forEach(o=>{

        html += crearFila(
            o.name,
            o.inicio,
            fechaMes,
            false
        );

    });

    html += "</table>";

    document.getElementById("resultado").innerHTML =
        html;
}
