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
