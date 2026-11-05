// js/app.js

let usuarioActual = null;

document.addEventListener("DOMContentLoaded", () => {
    // Quitamos la clase cargando para que el body vuelva a ser visible
    document.body.classList.remove('cargando');

    // 1. Comprobar si ya existe una sesión guardada en el navegador
    const usuarioGuardado = localStorage.getItem('bb_usuario');
    if (usuarioGuardado) {
        usuarioActual = JSON.parse(usuarioGuardado);
        iniciarApp();
    } else {
        mostrarPantallaLogin();
    }
});

function mostrarPantallaLogin() {
    // Si no hay sesión, reemplazamos temporalmente la vista por el formulario de Login
    document.body.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #eef2f7; padding: 20px;">
            <div class="card" style="width: 100%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 12px; padding: 25px;">
                <img src="img/LOGO_BBE_SOLO.png" style="height: 50px; margin-bottom: 10px;" alt="BBE Logo">
                <h2 style="margin-bottom: 5px; color: #1f4e79;">Calendario BBE</h2>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px;">Introduce tus iniciales y PIN para continuar</p>
                
                <form id="formLogin" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">Iniciales:</label>
                        <input type="text" id="inputIniciales" placeholder="Ej: JAM o JAM_F" required style="width: 100%; padding: 10px; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 8px; text-transform: uppercase; font-weight: bold; font-size: 1rem;" />
                    </div>
                    
                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">PIN:</label>
                        <input type="password" id="inputPin" placeholder="••••" required style="width: 100%; padding: 10px; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem;" />
                    </div>

                    <button type="submit" id="btnEntrar" style="padding: 12px; background: #1f4e79; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; margin-top: 10px;">
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    `;

    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnEntrar");
        btn.textContent = "Comprobando...";
        btn.disabled = true;

        const iniciales = document.getElementById("inputIniciales").value;
        const pin = document.getElementById("inputPin").value;

        // Llamada a la función creada en js/usuarios.js
        const user = await loginSupabase(iniciales, pin);

        if (user) {
            localStorage.setItem('bb_usuario', JSON.stringify(user));
            location.reload(); // Recargamos para mostrar la app completa limpia
        } else {
            btn.textContent = "Entrar";
            btn.disabled = false;
        }
    });
}

function iniciarApp() {
    // 2. Si el usuario logueado es de tipo familiar, mostramos una franja de aviso fija arriba
    if (usuarioActual.rol === 'familiar') {
        const aviso = document.createElement('div');
        aviso.style.cssText = "background: #fff3cd; color: #856404; padding: 8px 12px; text-align: center; font-weight: bold; font-size: 0.85rem; border-bottom: 1px solid #ffeeba; position: sticky; top: 0; z-index: 1001;";
        aviso.innerHTML = `👁️ <strong>Modo Familiar (Solo Lectura)</strong> — Consultando calendario de: ${usuarioActual.empleadoAsociado}`;
        document.body.prepend(aviso);
    }

    // 3. Pintamos el nombre del usuario en la cabecera
    const elemInfo = document.getElementById("infoUsuario");
    if (elemInfo) {
        elemInfo.innerHTML = "👤 <strong>" + usuarioActual.nombre + "</strong>&nbsp;&nbsp;&nbsp;▼";
    }
    
    // 4. Actualizamos la etiqueta del rol en el panel desplegable
    const badgeRol = document.getElementById("rolUsuarioTexto");
    if (badgeRol) {
        badgeRol.textContent = usuarioActual.rol.toUpperCase();
    }

    // 5. Renderizamos su calendario
    if (typeof verMiCalendario === 'function') {
        verMiCalendario();
    }
}

// Sobrescribimos la función de cerrar sesión del HTML para que borre la sesión real
function cerrarSesion() {
    localStorage.removeItem('bb_usuario');
    location.reload();
}