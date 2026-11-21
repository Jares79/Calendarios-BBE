// js/app.js
// Arranque de la app: sesión, pantalla de acceso, cambio de PIN y carga de datos.

let usuarioActual = null;

// Marco común de las pantallas de acceso (login, cambio de PIN, errores)
function pantallaAcceso(contenido) {
    document.body.classList.remove("cargando");
    document.body.innerHTML = `
        <div class="pantalla-acceso">
            <div class="tarjeta-acceso">
                <span class="marca-logo acceso-logo"><img src="img/LOGO_BBE_SOLO.png" class="logoCabecera" alt="BBE"></span>
                ${contenido}
            </div>
        </div>`;
}

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
    pantallaAcceso(`
        <h2>Algo ha fallado</h2>
        <p class="acceso-texto error-texto">${esc(mensaje)}</p>
        <button type="button" class="btn-ancho" onclick="location.reload()">Reintentar</button>
    `);
}

function mostrarPantallaLogin() {
    pantallaAcceso(`
        <h2>Calendario BBE</h2>
        <p class="acceso-texto">Entra con tus iniciales y tu PIN</p>

        <form id="formLogin" class="acceso-form">
            <label class="campo">
                <span>Iniciales</span>
                <input type="text" id="inputIniciales" placeholder="Ej: ABC" required autocomplete="username" autocapitalize="characters" class="input-iniciales" />
            </label>

            <label class="campo">
                <span>PIN</span>
                <input type="password" id="inputPin" placeholder="De 6 a 10 dígitos" required inputmode="numeric" maxlength="10" autocomplete="current-password" />
                <small class="campo-ayuda">Tu PIN tiene de 6 a 10 dígitos</small>
            </label>

            <p id="errorLogin" class="error-texto" role="alert"></p>

            <button type="submit" id="btnEntrar" class="btn-ancho">Entrar</button>
            <p class="acceso-legal"><a href="privacidad.html">Política de privacidad</a> · <a href="terminos.html">Términos y condiciones</a></p>
        </form>
    `);

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
    pantallaAcceso(`
        <h2>Elige tu PIN</h2>
        <p class="acceso-texto">Es tu primer acceso: crea un PIN personal de 6 a 10 números.</p>

        <form id="formCambioPin" class="acceso-form">
            <label class="campo">
                <span>PIN nuevo</span>
                <input type="password" id="inputPinNuevo" inputmode="numeric" autocomplete="new-password" maxlength="10" required />
            </label>

            <label class="campo">
                <span>Repite el PIN nuevo</span>
                <input type="password" id="inputPinRepetido" inputmode="numeric" autocomplete="new-password" maxlength="10" required />
            </label>

            <p id="errorCambioPin" class="error-texto" role="alert"></p>

            <button type="submit" id="btnGuardarPin" class="btn-ancho">Guardar y entrar</button>
        </form>
    `);

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
    aplicarColoresUsuario(usuarioActual.colores);   // los colores elegidos por esta persona
    const cargados = await cargarDatos();
    if (!cargados) {
        mostrarPantallaError("No se pudieron cargar los datos de la plantilla.");
        return;
    }

    // Modo familiar: franja de aviso arriba
    if (usuarioActual.rol === "familiar") {
        const aviso = el("div", { class: "banner-familiar" },
            el("strong", { text: "Modo familiar · solo lectura" }),
            " — calendario de " + (usuarioActual.empleadoNombre || usuarioActual.nombre));
        document.body.prepend(aviso);
    }

    pintarCabeceraUsuario("▼");

    const badgeRol = document.getElementById("rolUsuarioTexto");
    if (badgeRol) badgeRol.textContent = usuarioActual.rol.toUpperCase();

    prepararPanelUsuario();
    pintarLeyenda();
    aplicarModoFamiliar();   // oculta el menú y marca la cabecera
    prepararPanelAdmin();    // solo administradores
    prepararPanelHoras();    // sección Horas del menú
    iniciarCambios();        // solicitudes de cambio entre compañeros (globo de avisos)

    verMiCalendario();
    if (typeof alAbrirDesdeAviso === "function") alAbrirDesdeAviso();   // si se abrió desde un aviso, va a Cambios
}

// Ventana de confirmación antes de salir (el botón está pegado al menú de usuario y se podía pulsar sin querer)
function confirmarCerrarSesion() {
    const cancelar = el("button", { type: "button", class: "btn-secundario", text: "Cancelar", onclick: () => cerrarModal() });
    const salir = el("button", { type: "button", class: "btn-peligro", text: "Cerrar sesión" });
    const icono = el("div", { class: "dialogo-icono", "aria-hidden": "true" });
    icono.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    const fondo = abrirModal(
        el("div", { class: "dialogo-salir" },
            icono,
            el("h3", { text: "¿Cerrar sesión?" }),
            el("p", { class: "dialogo-texto", text: "Tendrás que volver a entrar con tus iniciales y tu PIN." }),
            el("div", { class: "modal-acciones modal-acciones-columna" }, salir, cancelar)
        )
    );
    fondo.classList.add("modal-centrado");
    fondo.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });
    salir.addEventListener("click", () => { salir.disabled = true; salir.textContent = "Saliendo…"; cerrarSesion(); });
    cancelar.focus();   // lo más seguro por defecto: no salir
}

async function cerrarSesion() {
    if (typeof olvidarPushAlCerrarSesion === "function") await olvidarPushAlCerrarSesion();   // este móvil deja de recibir avisos de esta cuenta
    await cerrarSesionSupabase();
    location.reload();
}

// App instalable: el service worker solo guarda los archivos de la propia web para abrirla más rápido.
// Los datos siempre se piden a Supabase.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker no registrado:", err));
    });
}
