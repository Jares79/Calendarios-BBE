const patronJT = [
"F","P","M","M","T","T","N","N",
"F","F","F","I","M","M","T","T","N","N",
"F","F","F","P","P","P","P","I","F","F",
"P","P","P","P","I","F","F","F",
"M","M","T","T","N","N",
"F","F","F","P","M","M","T","T","N","N",
"F","F","F","F","M","M","T","T","N","N",
"F","F","F","P","M","M","T","T","N","N",
"F","F","F","F","M","M","T","T","N","N",
"F","F",
"P","P","P","P","I","F","F",
"P","P","P","P","I","F","F"
];

const patronOP = [
"M","M","T","T","T","F","F",
"F","P","M","M","N","N","N",
"F","F","F","P","M","T","T",
"N","N","F","F","F","M","M",
"T","T","N","N","F","F","F",
"P","P","P","P","I","F","F",
"P","P","P","P","I","F","F"
];

const jefes = [
{name:"Javi",inicio:"2026-03-02"},
{name:"Borja",inicio:"2026-02-02"},
{name:"Peje",inicio:"2026-04-13"},
{name:"Gari",inicio:"2026-03-16"},
{name:"Dani",inicio:"2026-02-16"},
{name:"Asier",inicio:"2026-03-30"},
{name:"David",inicio:"2026-01-19"}
];

const control = [
{name:"Aspi",inicio:"2025-01-13"},
{name:"Lauki",inicio:"2025-01-06"},
{name:"Alias",inicio:"2025-01-20"},
{name:"Pedro",inicio:"2025-02-17"},
{name:"Silva",inicio:"2025-02-03"},
{name:"Hector",inicio:"2025-01-27"},
{name:"Garces",inicio:"2025-02-10"}
];

const campo = [
{name:"Josu",inicio:"2025-01-13"},
{name:"Jose",inicio:"2025-01-06"},
{name:"Jurado",inicio:"2025-01-20"},
{name:"Oscar",inicio:"2025-02-17"},
{name:"Urko",inicio:"2025-02-03"},
{name:"Xabi",inicio:"2025-01-27"},
{name:"Alex",inicio:"2025-02-10"}
];

function diferenciaDias(fecha1, fecha2){

    return Math.floor(
        (fecha1.getTime() - fecha2.getTime())
        /
        (1000 * 60 * 60 * 24)
    );
}

function convertirTurno(turno){

    switch(turno){

        case "M":
            return {
                texto:"Mañana",
                clase:"manana"
            };

        case "T":
            return {
                texto:"Tarde",
                clase:"tarde"
            };

        case "N":
            return {
                texto:"Noche",
                clase:"noche"
            };

        case "F":
            return {
                texto:"Fiesta",
                clase:"fiesta"
            };

        case "P":
            return {
                texto:"Partida",
                clase:"partida"
            };

        case "I":
            return {
                texto:"Intensiva",
                clase:"intensiva"
            };

        default:
            return {
                texto:turno,
                clase:""
            };
    }
}

function obtenerInfoJT(fecha,inicio){

    let dias =
        diferenciaDias(
            fecha,
            new Date(inicio)
        );

    let pos =
    (((dias + 1) % patronJT.length)
    + patronJT.length)
    % patronJT.length;

    let turno = patronJT[pos];

    if(pos >= 21 && pos <= 27){
        return {
            texto:"Semana X",
            clase:"semanax"
        };
    }

    if(pos >= 28 && pos <= 34){
        return {
            texto:"Semana Y",
            clase:"semanay"
        };
    }

    if(pos >= 84 && pos <= 90){
        return {
            texto:"Semana X",
            clase:"semanax"
        };
    }

    if(pos >= 91 && pos <= 97){
        return {
            texto:"Semana Y",
            clase:"semanay"
        };
    }

    return convertirTurno(turno);
}

function obtenerInfoOP(fecha,inicio){

    let dias =
        diferenciaDias(
            fecha,
            new Date(inicio)
        );

    let pos =
    (((dias + 1) % patronOP.length)
    + patronOP.length)
    % patronOP.length;

    let turno = patronOP[pos];

    if(pos >= 35 && pos <= 41){
        return {
            texto:"Semana X",
            clase:"semanax"
        };
    }

    if(pos >= 42 && pos <= 48){
        return {
            texto:"Semana Y",
            clase:"semanay"
        };
    }

    return convertirTurno(turno);
}

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
