-- =====================================================================
-- Seguridad del login de Calendarios-BBE
-- Ejecutar en Supabase > SQL Editor, EN ESTE ORDEN y ANTES de subir el
-- nuevo js/usuarios.js. Asume la tabla "usuarios" con las columnas:
--   iniciales, pin, nombre, rol, empleado_asociado
-- =====================================================================

-- 1) Hash de los PINs ---------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

alter table public.usuarios add column if not exists pin_hash text;

update public.usuarios
   set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf'))
 where pin_hash is null and pin is not null;

-- 2) Bloquear lecturas directas con la clave pública --------------------
alter table public.usuarios enable row level security;
-- Sin policies de SELECT para anon/authenticated: nadie puede leer la tabla
-- directamente. Por si hubiera policies antiguas, listalas y borralas:
--   select policyname from pg_policies where tablename = 'usuarios';
--   drop policy "nombre_de_la_policy" on public.usuarios;
revoke all on public.usuarios from anon, authenticated;

-- 3) Control de intentos fallidos ---------------------------------------
create table if not exists public.login_intentos (
    iniciales    text primary key,
    fallos       int not null default 0,
    ultimo_fallo timestamptz
);
alter table public.login_intentos enable row level security;
revoke all on public.login_intentos from anon, authenticated;

-- 4) Función de login: el PIN se valida en el servidor ------------------
create or replace function public.login_usuario(p_iniciales text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_input     text := upper(trim(coalesce(p_iniciales, '')));
    v_familiar  boolean := right(v_input, 2) = '_F';
    v_iniciales text := case when right(v_input, 2) = '_F'
                             then left(v_input, length(v_input) - 2)
                             else v_input end;
    v_user      public.usuarios%rowtype;
    v_int       public.login_intentos%rowtype;
begin
    -- ¿Bloqueado? (5 fallos en los últimos 15 minutos)
    select * into v_int from public.login_intentos where iniciales = v_iniciales;
    if found and v_int.fallos >= 5 and v_int.ultimo_fallo > now() - interval '15 minutes' then
        return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
    end if;

    select * into v_user from public.usuarios where upper(iniciales) = v_iniciales;

    if not found or v_user.pin_hash is null
       or v_user.pin_hash <> extensions.crypt(trim(coalesce(p_pin, '')), v_user.pin_hash) then
        insert into public.login_intentos (iniciales, fallos, ultimo_fallo)
        values (v_iniciales, 1, now())
        on conflict (iniciales) do update
           set fallos = case when public.login_intentos.ultimo_fallo > now() - interval '15 minutes'
                             then public.login_intentos.fallos + 1 else 1 end,
               ultimo_fallo = now();
        -- Mismo mensaje exista o no el usuario (no se revela qué iniciales son válidas)
        return jsonb_build_object('ok', false, 'motivo', 'credenciales');
    end if;

    delete from public.login_intentos where iniciales = v_iniciales;

    return jsonb_build_object(
        'ok', true,
        'usuario', jsonb_build_object(
            'iniciales',        case when v_familiar then v_user.iniciales || '_F' else v_user.iniciales end,
            'nombre',           v_user.nombre,
            'rol',              case when v_familiar then 'familiar' else v_user.rol end,
            'empleadoAsociado', coalesce(v_user.empleado_asociado, v_user.nombre)
        )
    );
end;
$$;

revoke all on function public.login_usuario(text, text) from public;
grant execute on function public.login_usuario(text, text) to anon;

-- 5) Cuando hayas comprobado que el login nuevo funciona, borra los PINs
--    en texto plano (no lo hagas antes):
--   alter table public.usuarios drop column pin;
