-- =====================================================================
-- Administrador sin ficha de empleado
-- Deja al usuario ADMIN sin calendario y fuera de cualquier colectivo: se desvincula de su ficha de
-- empleado y esa ficha se borra (si nadie más la usa). El acceso, el PIN y el rol de administrador
-- NO cambian. Ejecutar una sola vez en Supabase > SQL Editor (Run). Si se repite no hace nada.
-- Si tu usuario administrador no se llama ADMIN, cambia 'ADMIN' en las dos primeras líneas del bloque.
-- =====================================================================
do $$
declare
    v_perfil public.perfiles%rowtype;
    v_emp    uuid;
begin
    select * into v_perfil from public.perfiles
     where upper(iniciales) = 'ADMIN' and rol = 'administrador';
    if not found then
        raise notice 'No hay ningún administrador con iniciales ADMIN: no se ha cambiado nada.';
        return;
    end if;
    if v_perfil.empleado_id is null then
        raise notice 'ADMIN ya no tiene ficha de empleado: no hay nada que hacer.';
        return;
    end if;

    v_emp := v_perfil.empleado_id;
    update public.perfiles set empleado_id = null where id = v_perfil.id;

    -- La ficha solo se borra si ningún otro acceso (por ejemplo uno familiar) depende de ella
    if not exists (select 1 from public.perfiles where empleado_id = v_emp) then
        delete from public.empleados where id = v_emp;
        raise notice 'ADMIN desvinculado y su ficha de empleado borrada.';
    else
        raise notice 'ADMIN desvinculado, pero su ficha se conserva porque otro acceso la usa.';
    end if;
end;
$$;
