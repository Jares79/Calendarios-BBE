-- =====================================================================
-- FASE 1 · PASO 1 de 2 · Estructura: sesiones reales, empleados y patrones
-- Ejecutar en Supabase > SQL Editor, de una sola vez (botón Run).
--
-- Es ADITIVO: no toca la tabla "usuarios" ni las funciones antiguas
-- (login_usuario, cambiar_pin, admin_resetear_pin), así que la versión
-- que haya publicada en main sigue funcionando mientras pruebas develop.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) Tablas ----------------------------------------------------------

create table if not exists public.colectivos (
    codigo      text primary key,                 -- 'jefes' | 'control' | 'campo'
    nombre      text not null,                    -- 'Jefes de Turno'
    icono       text not null default '👤',
    puesto      text not null,                    -- singular: 'Jefe de Turno'
    patron      text[] not null,                  -- una letra por día del ciclo
    dias_solape int  not null default 0,          -- días de solape (S) que le corresponden
    orden       int  not null default 0,
    constraint colectivos_patron_valido
        check (cardinality(patron) > 0 and patron <@ array['M','T','N','F','P','I','S'])
);

create table if not exists public.empleados (
    id         uuid primary key default gen_random_uuid(),
    iniciales  text not null,
    nombre     text not null,
    colectivo  text not null references public.colectivos(codigo) on update cascade,
    inicio     date not null,                     -- día en que empieza su ciclo de turnos
    orden      int  not null default 0,
    activo     boolean not null default true,
    created_at timestamptz not null default now()
);
create unique index if not exists empleados_iniciales_uq on public.empleados (upper(iniciales));

create table if not exists public.perfiles (
    id               uuid primary key references auth.users(id) on delete cascade,
    iniciales        text not null,               -- 'JAM' o 'JAM_F' (familiar)
    nombre           text not null,
    rol              text not null check (rol in ('administrador','supervisor','empleado','familiar')),
    empleado_id      uuid references public.empleados(id) on delete set null,
    debe_cambiar_pin boolean not null default true,
    activo           boolean not null default true
);
create unique index if not exists perfiles_iniciales_uq on public.perfiles (upper(iniciales));

-- 2) Datos iniciales (los de js/empleados.js y js/turnos.js) -----------

insert into public.colectivos (codigo, nombre, icono, puesto, patron, dias_solape, orden) values
  ('jefes',   'Jefes de Turno',       '👨‍✈️', 'Jefe de Turno',       array['F','P','M','M','T','T','N','N','F','F','F','I','M','M','T','T','N','N','F','F','F','P','P','P','P','I','F','F','P','P','P','P','I','F','F','F','M','M','T','T','N','N','F','F','F','P','M','M','T','T','N','N','F','F','F','F','M','M','T','T','N','N','F','F','F','P','M','M','T','T','N','N','F','F','F','F','M','M','T','T','N','N','F','F','P','P','P','P','I','F','F','P','P','P','P','I','F','F'], 3, 1),
  ('control', 'Operadores de Control','🎛️', 'Operador de Control', array['M','M','T','T','T','F','F','F','P','M','M','N','N','N','F','F','F','P','M','T','T','N','N','F','F','F','M','M','T','T','N','N','F','F','F','P','P','P','P','I','F','F','P','P','P','P','I','F','F'], 2, 2),
  ('campo',   'Operadores de Campo',  '🔧', 'Operador de Campo',   array['M','M','T','T','T','F','F','F','P','M','M','N','N','N','F','F','F','P','M','T','T','N','N','F','F','F','M','M','T','T','N','N','F','F','F','P','P','P','P','I','F','F','P','P','P','P','I','F','F'], 2, 3)
on conflict (codigo) do nothing;

insert into public.empleados (iniciales, nombre, colectivo, inicio, orden) values
  ('JAM', 'Javi', 'jefes', '2026-03-02', 1),
  ('BMT', 'Borja', 'jefes', '2026-02-02', 2),
  ('DPR', 'Peje', 'jefes', '2026-04-13', 3),
  ('GET', 'Gari', 'jefes', '2026-03-16', 4),
  ('DCG', 'Dani', 'jefes', '2026-02-16', 5),
  ('AIA', 'Asier', 'jefes', '2026-03-30', 6),
  ('DDP', 'David', 'jefes', '2026-01-19', 7),
  ('JAU', 'Aspi', 'control', '2025-01-13', 1),
  ('OCG', 'Lauki', 'control', '2025-01-06', 2),
  ('RAG', 'Alias', 'control', '2025-01-20', 3),
  ('PHL', 'Pedro', 'control', '2025-02-17', 4),
  ('DSV', 'Silva', 'control', '2025-02-03', 5),
  ('HGL', 'Hector', 'control', '2025-01-27', 6),
  ('JGP', 'Garces', 'control', '2025-02-10', 7),
  ('JAL', 'Josu', 'campo', '2025-01-13', 1),
  ('JIG', 'Jose', 'campo', '2025-01-06', 2),
  ('RJA', 'Jurado', 'campo', '2025-01-20', 3),
  ('OMT', 'Montejo', 'campo', '2025-02-17', 4),
  ('UOP', 'Urko', 'campo', '2025-02-03', 5),
  ('XGV', 'Xabi', 'campo', '2025-01-27', 6),
  ('AII', 'Alex', 'campo', '2025-02-10', 7)
on conflict do nothing;


-- 3) Funciones auxiliares de permisos ------------------------------------
-- Devuelven datos de QUIEN HACE LA PETICIÓN (el servidor lo sabe por su sesión).

create or replace function public.mi_rol()
returns text
language sql stable security definer
set search_path = public
as $$
    select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_empleado()
returns uuid
language sql stable security definer
set search_path = public
as $$
    select empleado_id from public.perfiles where id = auth.uid() and activo
$$;

revoke all on function public.mi_rol()      from public, anon;
revoke all on function public.mi_empleado() from public, anon;
grant execute on function public.mi_rol()      to authenticated;
grant execute on function public.mi_empleado() to authenticated;

-- 4) Seguridad por filas (RLS) ---------------------------------------------

alter table public.colectivos enable row level security;
alter table public.empleados  enable row level security;
alter table public.perfiles   enable row level security;

revoke all on public.colectivos, public.empleados, public.perfiles from anon, authenticated;
grant select on public.colectivos, public.empleados, public.perfiles to authenticated;
grant update on public.colectivos, public.empleados                  to authenticated;

drop policy if exists colectivos_leer   on public.colectivos;
drop policy if exists colectivos_editar on public.colectivos;
create policy colectivos_leer on public.colectivos
    for select to authenticated using (public.mi_rol() is not null);
create policy colectivos_editar on public.colectivos
    for update to authenticated
    using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

-- Un familiar solo ve a su empleado. El administrador ve también los dados de baja.
drop policy if exists empleados_leer   on public.empleados;
drop policy if exists empleados_editar on public.empleados;
create policy empleados_leer on public.empleados
    for select to authenticated using (
        public.mi_rol() = 'administrador'
        or (public.mi_rol() is not null and activo
            and (public.mi_rol() <> 'familiar' or id = public.mi_empleado()))
    );
create policy empleados_editar on public.empleados
    for update to authenticated
    using (public.mi_rol() = 'administrador') with check (public.mi_rol() = 'administrador');

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
    for select to authenticated using (id = auth.uid() or public.mi_rol() = 'administrador');
-- Los perfiles solo se crean y modifican con las funciones de abajo (no hay policies de escritura).

-- 5) Lo que necesita la app al entrar -----------------------------------------

create or replace function public.mi_perfil()
returns jsonb
language sql stable security definer
set search_path = public
as $$
    select jsonb_build_object(
        'iniciales',       p.iniciales,
        'nombre',          p.nombre,
        'rol',             p.rol,
        'empleadoId',      p.empleado_id,
        'empleadoNombre',  e.nombre,
        'debeCambiarPin',  p.debe_cambiar_pin
    )
    from public.perfiles p
    left join public.empleados e on e.id = p.empleado_id
    where p.id = auth.uid() and p.activo
$$;

-- La app llama a esto después de cambiar la contraseña (PIN) con Supabase Auth.
create or replace function public.pin_cambiado()
returns void
language sql security definer
set search_path = public
as $$
    update public.perfiles set debe_cambiar_pin = false where id = auth.uid() and activo
$$;

revoke all on function public.mi_perfil()    from public, anon;
revoke all on function public.pin_cambiado() from public, anon;
grant execute on function public.mi_perfil()    to authenticated;
grant execute on function public.pin_cambiado() to authenticated;

-- 6) Funciones internas (nadie puede llamarlas desde la app) ---------------------

-- Crea el usuario de Supabase Auth. El correo es ficticio (iniciales@calendario-bbe.app):
-- Auth exige uno, pero la app solo pide iniciales y PIN, y no se envía ningún correo.
create or replace function public._crear_auth_usuario(p_email text, p_hash text)
returns uuid
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_id uuid := gen_random_uuid();
begin
    insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        p_email, p_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
        id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
        gen_random_uuid(), v_id, v_id::text, 'email',
        jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        now(), now(), now()
    );

    return v_id;
end;
$$;

create or replace function public._pin_aleatorio()
returns text
language sql volatile
set search_path = public, extensions
as $$
    select lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;

-- Crea el acceso (usuario + perfil) de un empleado con un PIN provisional.
create or replace function public._crear_acceso(p_empleado_id uuid, p_rol text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_emp       public.empleados%rowtype;
    v_iniciales text;
    v_pin       text;
    v_id        uuid;
begin
    if p_rol not in ('administrador','supervisor','empleado','familiar') then
        return jsonb_build_object('ok', false, 'motivo', 'rol_invalido');
    end if;

    select * into v_emp from public.empleados where id = p_empleado_id;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    v_iniciales := upper(v_emp.iniciales) || case when p_rol = 'familiar' then '_F' else '' end;

    if exists (select 1 from public.perfiles where upper(iniciales) = v_iniciales)
       or (p_rol <> 'familiar' and exists (
              select 1 from public.perfiles where empleado_id = v_emp.id and rol <> 'familiar')) then
        return jsonb_build_object('ok', false, 'motivo', 'ya_existe');
    end if;

    v_pin := public._pin_aleatorio();
    v_id  := public._crear_auth_usuario(
                 lower(v_iniciales) || '@calendario-bbe.app',
                 extensions.crypt(v_pin, extensions.gen_salt('bf', 10)));

    insert into public.perfiles (id, iniciales, nombre, rol, empleado_id, debe_cambiar_pin)
    values (v_id, v_iniciales, v_emp.nombre, p_rol, v_emp.id, true);

    return jsonb_build_object('ok', true, 'iniciales', v_iniciales,
                              'nombre', v_emp.nombre, 'pinTemporal', v_pin);
end;
$$;

revoke all on function public._crear_auth_usuario(text, text) from public, anon, authenticated;
revoke all on function public._pin_aleatorio()                from public, anon, authenticated;
revoke all on function public._crear_acceso(uuid, text)       from public, anon, authenticated;

-- 7) Funciones del administrador (el servidor comprueba el rol en cada llamada) ---------

create or replace function public.admin_crear_empleado(
    p_iniciales text, p_nombre text, p_colectivo text, p_inicio date, p_rol text default 'empleado')
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_iniciales text := upper(trim(coalesce(p_iniciales, '')));
    v_nombre    text := trim(coalesce(p_nombre, ''));
    v_id        uuid;
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_iniciales !~ '^[A-Z]{2,8}$' or v_nombre = '' or length(v_nombre) > 40 or p_inicio is null
       or p_rol not in ('administrador','supervisor','empleado')
       or not exists (select 1 from public.colectivos where codigo = p_colectivo) then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;
    if exists (select 1 from public.empleados where upper(iniciales) = v_iniciales)
       or exists (select 1 from public.perfiles where upper(iniciales) = v_iniciales) then
        return jsonb_build_object('ok', false, 'motivo', 'iniciales_duplicadas');
    end if;

    insert into public.empleados (iniciales, nombre, colectivo, inicio, orden)
    values (v_iniciales, v_nombre, p_colectivo, p_inicio,
            coalesce((select max(orden) from public.empleados where colectivo = p_colectivo), 0) + 1)
    returning id into v_id;

    return public._crear_acceso(v_id, p_rol) || jsonb_build_object('empleadoId', v_id);
end;
$$;

create or replace function public.admin_editar_empleado(
    p_id uuid, p_nombre text, p_iniciales text, p_colectivo text, p_inicio date,
    p_activo boolean, p_rol text default null)
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_emp       public.empleados%rowtype;
    v_iniciales text := upper(trim(coalesce(p_iniciales, '')));
    v_nombre    text := trim(coalesce(p_nombre, ''));
    v_perfil    record;
    v_nuevas    text;
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select * into v_emp from public.empleados where id = p_id;
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    if v_iniciales !~ '^[A-Z]{2,8}$' or v_nombre = '' or length(v_nombre) > 40 or p_inicio is null
       or p_activo is null
       or (p_rol is not null and p_rol not in ('administrador','supervisor','empleado'))
       or not exists (select 1 from public.colectivos where codigo = p_colectivo) then
        return jsonb_build_object('ok', false, 'motivo', 'datos_invalidos');
    end if;

    if v_iniciales <> upper(v_emp.iniciales) and (
           exists (select 1 from public.empleados where upper(iniciales) = v_iniciales)
        or exists (select 1 from public.perfiles  where upper(iniciales) in (v_iniciales, v_iniciales || '_F'))) then
        return jsonb_build_object('ok', false, 'motivo', 'iniciales_duplicadas');
    end if;

    -- El administrador no puede quitarse a sí mismo el acceso ni el rol
    if exists (select 1 from public.perfiles
                where empleado_id = p_id and id = auth.uid()
                  and (p_activo = false or (p_rol is not null and p_rol <> 'administrador'))) then
        return jsonb_build_object('ok', false, 'motivo', 'no_propio');
    end if;

    update public.empleados
       set nombre = v_nombre, iniciales = v_iniciales, colectivo = p_colectivo,
           inicio = p_inicio, activo = p_activo
     where id = p_id;

    for v_perfil in select id, rol from public.perfiles where empleado_id = p_id loop
        v_nuevas := v_iniciales || case when v_perfil.rol = 'familiar' then '_F' else '' end;

        update public.perfiles
           set iniciales = v_nuevas, nombre = v_nombre, activo = p_activo,
               rol = case when v_perfil.rol <> 'familiar' and p_rol is not null then p_rol else rol end
         where id = v_perfil.id;

        update auth.users
           set email = lower(v_nuevas) || '@calendario-bbe.app', updated_at = now()
         where id = v_perfil.id;
        update auth.identities
           set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(lower(v_nuevas) || '@calendario-bbe.app')),
               updated_at = now()
         where user_id = v_perfil.id and provider = 'email';

        if not p_activo then
            begin
                delete from auth.sessions where user_id = v_perfil.id;
            exception when others then null;
            end;
        end if;
    end loop;

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_crear_acceso(p_empleado_id uuid, p_rol text default 'empleado')
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    return public._crear_acceso(p_empleado_id, p_rol);
end;
$$;

create or replace function public.admin_resetear_acceso(p_objetivo text)
returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
    v_perfil public.perfiles%rowtype;
    v_pin    text;
begin
    if coalesce(public.mi_rol(), '') <> 'administrador' then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;

    select * into v_perfil from public.perfiles where upper(iniciales) = upper(trim(coalesce(p_objetivo, '')));
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    v_pin := public._pin_aleatorio();

    update auth.users
       set encrypted_password = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)), updated_at = now()
     where id = v_perfil.id;
    update public.perfiles set debe_cambiar_pin = true where id = v_perfil.id;

    begin
        delete from auth.sessions where user_id = v_perfil.id;   -- cierra sus sesiones abiertas
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'iniciales', v_perfil.iniciales,
                              'nombre', v_perfil.nombre, 'pinTemporal', v_pin);
end;
$$;

revoke all on function public.admin_crear_empleado(text, text, text, date, text)                       from public, anon;
revoke all on function public.admin_editar_empleado(uuid, text, text, text, date, boolean, text)       from public, anon;
revoke all on function public.admin_crear_acceso(uuid, text)                                           from public, anon;
revoke all on function public.admin_resetear_acceso(text)                                              from public, anon;
grant execute on function public.admin_crear_empleado(text, text, text, date, text)                    to authenticated;
grant execute on function public.admin_editar_empleado(uuid, text, text, text, date, boolean, text)    to authenticated;
grant execute on function public.admin_crear_acceso(uuid, text)                                        to authenticated;
grant execute on function public.admin_resetear_acceso(text)                                           to authenticated;
