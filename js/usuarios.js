// js/usuarios.js

// Asegúrate de incluir el script de Supabase en tu index.html si no lo tienes:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://ackvysmudvkywgxosvoc.supabase.co'; // Reemplaza con tu URL
const SUPABASE_ANON_KEY = 'sb_publishable_dGHi0h5wgEi2cSQL9RL1Pg_hVWob3X9'; // Reemplaza con tu ANON KEY

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function loginSupabase(inicialesInput, pinInput) {
    if (!supabaseClient) {
        console.error("Supabase no está inicializado.");
        return null;
    }

    const inputClean = inicialesInput.trim().toUpperCase();
    const pinClean = pinInput.trim();

    // Detectar si es familiar (termina en _F)
    const esFamiliar = inputClean.endsWith('_F');
    const inicialesReal = esFamiliar ? inputClean.replace('_F', '') : inputClean;

    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('iniciales', inicialesReal)
            .single();

        if (error || !data) {
            alert("Usuario no encontrado. Comprueba tus iniciales.");
            return null;
        }

        // Validar PIN
        if (data.pin !== pinClean) {
            alert("PIN incorrecto.");
            return null;
        }

        // Construir objeto de sesión con el rol adaptado (familiar = solo lectura)
        const usuarioSesion = {
            iniciales: esFamiliar ? `${data.iniciales}_F` : data.iniciales,
            nombre: data.nombre,
            rol: esFamiliar ? 'familiar' : data.rol,
            empleadoAsociado: data.empleado_asociado || data.nombre
        };

        return usuarioSesion;
    } catch (err) {
        console.error("Error en el login:", err);
        alert("Error de conexión con el servidor.");
        return null;
    }
}