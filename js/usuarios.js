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
