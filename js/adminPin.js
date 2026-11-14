// js/adminPin.js
// Opción de menú para que un administrador resetee el PIN de un empleado.
// Es solo interfaz: el servidor vuelve a comprobar el PIN y el rol del administrador.

function prepararPanelAdmin() {
    if (typeof usuarioActual === 'undefined' || !usuarioActual) return;
    if (!puedeGestionarUsuarios(usuarioActual)) return;

    const fila = document.getElementById('filaAdminPin');
    if (fila) fila.style.display = 'block';

    // Sugerencias de iniciales a partir de la plantilla (se puede escribir cualquier otra)
    const lista = document.getElementById('listaInicialesEmpleados');
    if (lista) {
        lista.innerHTML = '';
        [
            { grupo: 'Jefe de Turno', empleados: jefes },
            { grupo: 'Operador de Control', empleados: control },
            { grupo: 'Operador de Campo', empleados: campo }
        ].forEach(({ grupo, empleados }) => {
            empleados.forEach(emp => {
                if (!emp.iniciales) return;
                const opcion = document.createElement('option');
                opcion.value = emp.iniciales;
                opcion.label = `${emp.name} (${grupo})`;
                lista.appendChild(opcion);
            });
        });
    }
}

async function ejecutarResetPin() {
    const inputObjetivo = document.getElementById('resetPinObjetivo');
    const inputPinAdmin = document.getElementById('resetPinAdmin');
    const resultado = document.getElementById('resetPinResultado');
    const btn = document.getElementById('btnEjecutarResetPin');

    const objetivo = inputObjetivo.value.trim();
    const pinAdmin = inputPinAdmin.value.trim();

    resultado.textContent = '';
    resultado.style.color = '#b91c1c';

    if (!objetivo || !pinAdmin) {
        resultado.textContent = 'Escribe las iniciales del empleado y tu PIN.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Generando...';

    const r = await resetearPinSupabase(usuarioActual.iniciales, pinAdmin, objetivo);

    // El PIN de administrador no se deja en pantalla
    inputPinAdmin.value = '';
    btn.disabled = false;
    btn.textContent = 'Generar PIN provisional';

    if (!r.ok) {
        resultado.textContent = r.mensaje;
        return;
    }

    resultado.style.color = '#166534';
    resultado.textContent = '';

    const linea1 = document.createElement('div');
    linea1.textContent = `PIN provisional de ${r.nombre || ''} (${r.iniciales}):`;

    const pin = document.createElement('div');
    pin.textContent = r.pinTemporal;
    pin.style.cssText = 'font-size: 1.6rem; font-weight: bold; letter-spacing: 4px; margin: 6px 0;';

    const aviso = document.createElement('div');
    aviso.textContent = 'Solo se muestra ahora. Díselo en persona; tendrá que elegir uno nuevo al entrar.';
    aviso.style.cssText = 'font-size: 0.78rem; color: #64748b;';

    resultado.append(linea1, pin, aviso);
    inputObjetivo.value = '';
}
