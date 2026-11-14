// js/usuarios.js
// El PIN se valida en el servidor (función login_usuario, ver supabase/seguridad.sql).
// El navegador nunca lee la tabla "usuarios" ni recibe PINs.

const SUPABASE_URL = 'https://ackvysmudvkywgxosvoc.supabase.co';
// Clave publishable: puede ir en el cliente porque la seguridad la dan RLS y la función RPC.
const SUPABASE_ANON_KEY = 'sb_publishable_dGHi0h5wgEi2cSQL9RL1Pg_hVWob3X9';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function loginSupabase(inicialesInput, pinInput) {
    if (!supabaseClient) {
        console.error("Supabase no está inicializado.");
        alert("No se pudo conectar con el servidor.");
        return null;
    }

    try {
        const { data, error } = await supabaseClient.rpc('login_usuario', {
            p_iniciales: inicialesInput,
            p_pin: pinInput
        });

        if (error) {
            console.error("Error en el login:", error);
            alert("Error de conexión con el servidor.");
            return null;
        }

        if (!data || !data.ok) {
            if (data && data.motivo === 'bloqueado') {
                alert("Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.");
            } else {
                alert("Iniciales o PIN incorrectos.");
            }
            return null;
        }

        return data.usuario;
    } catch (err) {
        console.error("Error en el login:", err);
        alert("Error de conexión con el servidor.");
        return null;
    }
}


// Cambia el PIN del usuario. La comprobación del PIN actual y el guardado se hacen en el servidor.
// Devuelve { ok: true } o { ok: false, mensaje: "..." }
async function cambiarPinSupabase(inicialesInput, pinActual, pinNuevo) {
    if (!supabaseClient) {
        return { ok: false, mensaje: "No se pudo conectar con el servidor." };
    }

    try {
        const { data, error } = await supabaseClient.rpc('cambiar_pin', {
            p_iniciales: inicialesInput,
            p_pin_actual: pinActual,
            p_pin_nuevo: pinNuevo
        });

        if (error) {
            console.error("Error al cambiar el PIN:", error);
            return { ok: false, mensaje: "Error de conexión con el servidor." };
        }

        if (data && data.ok) {
            return { ok: true };
        }

        const motivo = data && data.motivo;
        const mensajes = {
            formato: "El PIN nuevo debe tener entre 6 y 10 números.",
            igual: "El PIN nuevo no puede ser igual al actual.",
            bloqueado: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.",
            credenciales: "No se pudo verificar tu PIN actual.",
            no_permitido: "Este tipo de acceso no puede cambiar el PIN."
        };
        return { ok: false, mensaje: mensajes[motivo] || "No se pudo cambiar el PIN." };
    } catch (err) {
        console.error("Error al cambiar el PIN:", err);
        return { ok: false, mensaje: "Error de conexión con el servidor." };
    }
}


// Solo administradores: genera un PIN provisional para otro usuario.
// El servidor comprueba el PIN y el rol del administrador; el navegador no decide nada.
// Devuelve { ok: true, iniciales, nombre, pinTemporal } o { ok: false, mensaje }
async function resetearPinSupabase(inicialesAdmin, pinAdmin, inicialesObjetivo) {
    if (!supabaseClient) {
        return { ok: false, mensaje: "No se pudo conectar con el servidor." };
    }

    try {
        const { data, error } = await supabaseClient.rpc('admin_resetear_pin', {
            p_admin_iniciales: inicialesAdmin,
            p_admin_pin: pinAdmin,
            p_objetivo: inicialesObjetivo
        });

        if (error) {
            console.error("Error al resetear el PIN:", error);
            return { ok: false, mensaje: "Error de conexión con el servidor." };
        }

        if (data && data.ok) {
            return { ok: true, iniciales: data.iniciales, nombre: data.nombre, pinTemporal: data.pinTemporal };
        }

        const mensajes = {
            credenciales: "Tu PIN de administrador no es correcto.",
            bloqueado: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.",
            no_autorizado: "No tienes permiso de administrador.",
            no_existe: "No existe ningún usuario con esas iniciales."
        };
        return { ok: false, mensaje: mensajes[data && data.motivo] || "No se pudo resetear el PIN." };
    } catch (err) {
        console.error("Error al resetear el PIN:", err);
        return { ok: false, mensaje: "Error de conexión con el servidor." };
    }
}
