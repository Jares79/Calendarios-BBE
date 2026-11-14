-- =====================================================================
-- Reseteo de PIN por un administrador, desde el menú de la app
-- Ejecutar en Supabase > SQL Editor, después de pin-cambio.sql.
-- El servidor comprueba el PIN y el rol del administrador en cada llamada.
-- =====================================================================

create or replace function public.admin_resetear_pin(p_admin_iniciales text, p_admin_pin text, p_objetivo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_admin    text := upper(trim(coalesce(p_admin_iniciales, '')));
    v_objetivo text := upper(trim(coalesce(p_objetivo, '')));
    v_login    jsonb;
    v_temp     text;
    v_nombre   text;
begin
    -- Un acceso de familiar (_F) nunca puede administrar
    if right(v_admin, 2) = '_F' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    -- Verifica el PIN del administrador (con el mismo control de intentos del login)
    v_login := public.login_usuario(v_admin, p_admin_pin);
    if not coalesce((v_login->>'ok')::boolean, false) then
        return v_login;
    end if;
    if coalesce(v_login->'usuario'->>'rol', '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    -- El objetivo es siempre el empleado (si escriben _F se usa el empleado)
    if right(v_objetivo, 2) = '_F' then
        v_objetivo := left(v_objetivo, length(v_objetivo) - 2);
    end if;

    -- PIN provisional aleatorio de 6 cifras
    v_temp := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');

    update public.usuarios
       set pin_hash = extensions.crypt(v_temp, extensions.gen_salt('bf')),
           debe_cambiar_pin = true
     where upper(iniciales) = v_objetivo
    returning nombre into v_nombre;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    -- Desbloquea al usuario si estaba bloqueado por intentos fallidos
    delete from public.login_intentos where iniciales = v_objetivo;

    return jsonb_build_object('ok', true, 'iniciales', v_objetivo, 'nombre', v_nombre, 'pinTemporal', v_temp);
end;
$$;

revoke all on function public.admin_resetear_pin(text, text, text) from public;
grant execute on function public.admin_resetear_pin(text, text, text) to anon;
