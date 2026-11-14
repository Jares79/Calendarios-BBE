// js/app.js
// Arranque de la app: sesión, pantalla de acceso, cambio de PIN y carga de datos.

let usuarioActual = null;

const ESTILO_PANTALLA = "display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #eef2f7; padding: 20px;";
const ESTILO_TARJETA = "width: 100%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 12px; padding: 25px;";
const ESTILO_INPUT = "width: 100%; padding: 10px; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem;";
const ESTILO_BOTON = "padding: 12px; background: #1f4e79; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer;";

document.addEventListener("DOMContentLoaded", async () => {
    const r = await obtenerPerfilActual();
    document.body.classList.remove("cargando");

    if (r.estado === "sin_sesion") {
        mostrarPantallaLogin();
        return;
    }
    if (r.estado === "error") {
        mostrarPantallaError("No se pudo conectar con el servidor.");
        return;
    }

    usuarioActual = r.perfil;
    if (usuarioActual.debeCambiarPin) {
        mostrarPantallaCambioPin();
    } else {
        await iniciarApp();
    }

    // Si la sesión se cierra o caduca estando dentro, se vuelve al acceso
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((evento) => {
            if (evento === "SIGNED_OUT" && usuarioActual) location.reload();
        });
    }
});

function mostrarPantallaError(mensaje) {
    document.body.innerHTML = `
        <div style="${ESTILO_PANTALLA}">
            <div class="card" style="${ESTILO_TARJETA}">
                <img src="img/LOGO_BBE_SOLO.png" style="height: 50px; margin-bottom: 10px;" alt="BBE Logo">
                <p style="color: #b91c1c;">${esc(mensaje)}</p>
                <button type="button" onclick="location.reload()" style="${ESTILO_BOTON}">Reintentar</button>
            </div>
        </div>`;
}

function mostrarPantallaLogin() {
    document.body.innerHTML = `
        <div style="${ESTILO_PANTALLA}">
            <div class="card" style="${ESTILO_TARJETA}">
                <img src="img/LOGO_BBE_SOLO.png" style="height: 50px; margin-bottom: 10px;" alt="BBE Logo">
                <h2 style="margin-bottom: 5px; color: #1f4e79;">Calendario BBE</h2>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px;">Introduce tus iniciales y PIN para continuar</p>

                <form id="formLogin" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">Iniciales:</label>
                        <input type="text" id="inputIniciales" placeholder="Ej: JAM o JAM_F" required autocomplete="username" autocapitalize="characters" style="${ESTILO_INPUT} text-transform: uppercase; font-weight: bold;" />
                    </div>

                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">PIN:</label>
                        <input type="password" id="inputPin" placeholder="••••" required inputmode="numeric" autocomplete="current-password" style="${ESTILO_INPUT}" />
                    </div>

                    <p id="errorLogin" style="color: #b91c1c; font-size: 0.85rem; margin: 0; min-height: 1.1em;"></p>

                    <button type="submit" id="btnEntrar" style="${ESTILO_BOTON}">Entrar</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnEntrar");
        const error = document.getElementById("errorLogin");
        error.textContent = "";
        btn.textContent = "Comprobando...";
        btn.disabled = true;

        const r = await loginSupabase(
            document.getElementById("inputIniciales").value,
            document.getElementById("inputPin").value
        );

        if (r.ok) {
            usuarioActual = r.perfil;
            if (r.perfil.debeCambiarPin) {
                // Primer acceso (o PIN reseteado): hay que elegir un PIN nuevo antes de entrar
                mostrarPantallaCambioPin();
            } else {
                location.reload();
            }
            return;
        }

        const mensajes = {
            credenciales: "Iniciales o PIN incorrectos.",
            demasiados: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
            sin_acceso: "Tu acceso no está activo. Habla con el administrador.",
            conexion: "No se pudo conectar con el servidor."
        };
        error.textContent = mensajes[r.motivo] || mensajes.conexion;
        btn.textContent = "Entrar";
        btn.disabled = false;
    });
}

function mostrarPantallaCambioPin() {
    document.body.classList.remove("cargando");
    document.body.innerHTML = `
        <div style="${ESTILO_PANTALLA}">
            <div class="card" style="${ESTILO_TARJETA}">
                <img src="img/LOGO_BBE_SOLO.png" style="height: 50px; margin-bottom: 10px;" alt="BBE Logo">
                <h2 style="margin-bottom: 5px; color: #1f4e79;">Elige tu PIN</h2>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px;">Es tu primer acceso: crea un PIN personal de 6 a 10 números.</p>

                <form id="formCambioPin" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">PIN nuevo:</label>
                        <input type="password" id="inputPinNuevo" inputmode="numeric" autocomplete="new-password" maxlength="10" required style="${ESTILO_INPUT}" />
                    </div>

                    <div style="text-align: left;">
                        <label style="font-size: 0.8rem; font-weight: bold; color: #475569;">Repite el PIN nuevo:</label>
                        <input type="password" id="inputPinRepetido" inputmode="numeric" autocomplete="new-password" maxlength="10" required style="${ESTILO_INPUT}" />
                    </div>

                    <p id="errorCambioPin" style="color: #b91c1c; font-size: 0.85rem; margin: 0; min-height: 1.1em;"></p>

                    <button type="submit" id="btnGuardarPin" style="${ESTILO_BOTON}">Guardar y entrar</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById("formCambioPin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const error = document.getElementById("errorCambioPin");
        const btn = document.getElementById("btnGuardarPin");
        const nuevo = document.getElementById("inputPinNuevo").value.trim();
        const repetido = document.getElementById("inputPinRepetido").value.trim();

        if (!/^[0-9]{6,10}$/.test(nuevo)) {
            error.textContent = "El PIN debe tener entre 6 y 10 números.";
            return;
        }
        if (nuevo !== repetido) {
            error.textContent = "Los dos PIN no coinciden.";
            return;
        }

        error.textContent = "";
        btn.textContent = "Guardando...";
        btn.disabled = true;

        const resultado = await cambiarPinSupabase(nuevo);

        if (resultado.ok) {
            location.reload();
        } else {
            error.textContent = resultado.mensaje;
            btn.textContent = "Guardar y entrar";
            btn.disabled = false;
        }
    });
}

async function iniciarApp() {
    const cargados = await cargarDatos();
    if (!cargados) {
        mostrarPantallaError("No se pudieron cargar los datos de la plantilla.");
        return;
    }

    // Modo familiar: franja de aviso fija arriba
    if (usuarioActual.rol === "familiar") {
        const aviso = document.createElement("div");
        aviso.style.cssText = "background: #fff3cd; color: #856404; padding: 8px 12px; text-align: center; font-weight: bold; font-size: 0.85rem; border-bottom: 1px solid #ffeeba; position: sticky; top: 0; z-index: 1001;";
        aviso.append("👁️ ", el("strong", { text: "Modo Familiar (Solo Lectura)" }),
            " — Consultando calendario de: " + (usuarioActual.empleadoNombre || usuarioActual.nombre));
        document.body.prepend(aviso);
    }

    pintarCabeceraUsuario("▼");

    const badgeRol = document.getElementById("rolUsuarioTexto");
    if (badgeRol) badgeRol.textContent = usuarioActual.rol.toUpperCase();

    prepararPanelUsuario();
    aplicarModoFamiliar();   // oculta el menú y marca la cabecera
    prepararPanelAdmin();    // solo administradores

    verMiCalendario();
}

async function cerrarSesion() {
    await cerrarSesionSupabase();
    location.reload();
}
