// js/usuarios.js
// Sesión con Supabase Auth. El navegador manda iniciales y PIN, y el servidor (Supabase)
// los comprueba y entrega una sesión firmada: desde ese momento cada petición lleva
// la identidad de la persona y es la base de datos la que decide qué puede ver o cambiar.
// El PIN no se guarda en ningún sitio del navegador.

const SUPABASE_URL = 'https://ackvysmudvkywgxosvoc.supabase.co';
// Clave publishable: puede ir en el cliente porque la seguridad la dan Auth y RLS.
const SUPABASE_ANON_KEY = 'sb_publishable_dGHi0h5wgEi2cSQL9RL1Pg_hVWob3X9';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Supabase Auth necesita un correo; se deriva de las iniciales y no se envía nada a él.
// Debe coincidir con el que crea el SQL (lower(iniciales) || '@calendario-bbe.app').
function emailDeIniciales(iniciales) {
    const limpio = String(iniciales || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    return limpio + '@calendario-bbe.app';
}

// Devuelve { estado: 'sin_sesion' } | { estado: 'error' } | { estado: 'ok', perfil }
async function obtenerPerfilActual() {
    if (!supabaseClient) return { estado: 'error' };
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return { estado: 'sin_sesion' };

        const { data, error } = await supabaseClient.rpc('mi_perfil');
        if (error) {
            console.error('Error al leer el perfil:', error);
            return { estado: 'error' };
        }
        if (!data) {
            // Sesión válida pero sin perfil activo (baja o cuenta sin configurar)
            await supabaseClient.auth.signOut();
            return { estado: 'sin_sesion' };
        }
        return { estado: 'ok', perfil: data };
    } catch (err) {
        console.error('Error al leer el perfil:', err);
        return { estado: 'error' };
    }
}

// Devuelve { ok: true, perfil } o { ok: false, motivo: 'credenciales' | 'demasiados' | 'sin_acceso' | 'conexion' }
async function loginSupabase(inicialesInput, pinInput) {
    if (!supabaseClient) return { ok: false, motivo: 'conexion' };
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: emailDeIniciales(inicialesInput),
            password: String(pinInput || '').trim()
        });
        if (error) {
            if (error.status === 429) return { ok: false, motivo: 'demasiados' };
            if (error.status === 400 || error.status === 422) return { ok: false, motivo: 'credenciales' };
            return { ok: false, motivo: 'conexion' };
        }

        const r = await obtenerPerfilActual();
        if (r.estado === 'ok') return { ok: true, perfil: r.perfil };
        if (r.estado === 'sin_sesion') return { ok: false, motivo: 'sin_acceso' };
        return { ok: false, motivo: 'conexion' };
    } catch (err) {
        console.error('Error en el login:', err);
        return { ok: false, motivo: 'conexion' };
    }
}

// Cambia el PIN de la persona que tiene la sesión abierta.
// Devuelve { ok: true } o { ok: false, mensaje }
async function cambiarPinSupabase(pinNuevo) {
    if (!supabaseClient) return { ok: false, mensaje: 'No se pudo conectar con el servidor.' };
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: pinNuevo });
        if (error) {
            console.error('Error al cambiar el PIN:', error);
            const msg = String(error.message || '').toLowerCase();
            if (msg.includes('different') || msg.includes('same')) {
                return { ok: false, mensaje: 'El PIN nuevo no puede ser igual al actual.' };
            }
            if (msg.includes('at least') || msg.includes('weak') || msg.includes('short')) {
                return { ok: false, mensaje: 'El servidor ha rechazado ese PIN por ser demasiado corto o débil.' };
            }
            return { ok: false, mensaje: 'No se pudo cambiar el PIN.' };
        }

        const r = await supabaseClient.rpc('pin_cambiado');
        if (r.error) {
            console.error('Error al registrar el cambio de PIN:', r.error);
            return { ok: false, mensaje: 'El PIN se cambió, pero no se pudo registrar. Vuelve a entrar con el PIN nuevo.' };
        }
        return { ok: true };
    } catch (err) {
        console.error('Error al cambiar el PIN:', err);
        return { ok: false, mensaje: 'Error de conexión con el servidor.' };
    }
}

async function cerrarSesionSupabase() {
    try {
        if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
    }
}
