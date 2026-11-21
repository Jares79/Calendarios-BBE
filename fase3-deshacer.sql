-- =====================================================================
-- FASE 3 · DESHACER (borra los cambios manuales, festivos, intensivas y colores)
-- =====================================================================
drop function if exists public.guardar_colores(jsonb);
drop table if exists public.excepciones;
drop table if exists public.festivos;
drop table if exists public.intensivas;
alter table public.perfiles drop column if exists colores;

-- Vuelve a la versión de mi_perfil() sin colores
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
