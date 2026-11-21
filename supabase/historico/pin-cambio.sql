-- =====================================================================
-- Cambio de PIN en el primer acceso + recuperación por el administrador
-- Ejecutar en Supabase > SQL Editor, después de seguridad.sql.
-- =====================================================================

-- 1) Marca "debe cambiar el PIN". Todos los usuarios actuales la tienen activada.
alter table public.usuarios
    add column if not exists debe_cambiar_pin boolean not null default true;

-- 2) login_usuario ahora también informa de si hay que cambiar el PIN
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
        return jsonb_build_object('ok', false, 'motivo', 'credenciales');
    end if;

    delete from public.login_intentos where iniciales = v_iniciales;

    return jsonb_build_object(
        'ok', true,
        'usuario', jsonb_build_object(
            'iniciales',        case when v_familiar then v_user.iniciales || '_F' else v_user.iniciales end,
            'nombre',           v_user.nombre,
            'rol',              case when v_familiar then 'familiar' else v_user.rol end,
            'empleadoAsociado', coalesce(v_user.empleado_asociado, v_user.nombre),
            'debeCambiarPin',   case when v_familiar then false else v_user.debe_cambiar_pin end
        )
    );
end;
$$;

revoke all on function public.login_usuario(text, text) from public;
grant execute on function public.login_usuario(text, text) to anon;

-- 3) Cambio de PIN (6 a 10 números). Comprueba el PIN actual con el mismo
--    control de intentos del login. Los accesos de familiar (_F) no pueden cambiarlo.
create or replace function public.cambiar_pin(p_iniciales text, p_pin_actual text, p_pin_nuevo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_input text := upper(trim(coalesce(p_iniciales, '')));
    v_nuevo text := trim(coalesce(p_pin_nuevo, ''));
    v_login jsonb;
begin
    if right(v_input, 2) = '_F' then
        return jsonb_build_object('ok', false, 'motivo', 'no_permitido');
    end if;

    if v_nuevo !~ '^[0-9]{6,10}$' then
        return jsonb_build_object('ok', false, 'motivo', 'formato');
    end if;

    if v_nuevo = trim(coalesce(p_pin_actual, '')) then
        return jsonb_build_object('ok', false, 'motivo', 'igual');
    end if;

    v_login := public.login_usuario(v_input, p_pin_actual);
    if not coalesce((v_login->>'ok')::boolean, false) then
        return v_login;
    end if;

    update public.usuarios
       set pin_hash = extensions.crypt(v_nuevo, extensions.gen_salt('bf')),
           debe_cambiar_pin = false
     where upper(iniciales) = v_input;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cambiar_pin(text, text, text) from public;
grant execute on function public.cambiar_pin(text, text, text) to anon;

-- 4) RECUPERAR UN PIN OLVIDADO (lo ejecuta el administrador cuando haga falta).
--    Cambia 'JAM' por las iniciales y 'PIN_TEMPORAL' por un PIN provisional de 6-10 números.
--    La persona entrará con ese PIN y la app le obligará a elegir uno nuevo.
--
-- update public.usuarios
--    set pin_hash = extensions.crypt('PIN_TEMPORAL', extensions.gen_salt('bf')),
--        debe_cambiar_pin = true
--  where upper(iniciales) = 'JAM';
-- delete from public.login_intentos where iniciales = 'JAM';

-- 5) Cuando hayas probado todo, borra los PINs antiguos en texto plano (irreversible):
--   alter table public.usuarios drop column pin;
