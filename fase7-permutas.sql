-- =====================================================================
-- FASE 7 · Registro de cambios hechos (para avisar si uno deshace por su cuenta un cambio de dos)
-- Ejecutar en Supabase > SQL Editor (botón Run), de una sola vez,
-- DESPUÉS de los scripts de las fases 5 y 6. Se puede repetir sin problema.
-- =====================================================================

-- Cada cambio aceptado deja una fila por persona y día (se conserva 30 días tras la fecha del cambio)
create table if not exists public.cambios_hechos (
    empleado_id      uuid not null references public.empleados(id) on delete cascade,
    fecha            date not null,
    con_empleado_id  uuid not null references public.empleados(id) on delete cascade,
    codigo_recibido  text not null,   -- turno que recibió ese día
    codigo_cedido    text not null,   -- turno que dio
    hecho_en         timestamptz not null default now(),
    primary key (empleado_id, fecha)
);

alter table public.cambios_hechos enable row level security;
revoke all on public.cambios_hechos from anon, authenticated;
grant select on public.cambios_hechos to authenticated;

drop policy if exists cambios_hechos_leer on public.cambios_hechos;
create policy cambios_hechos_leer on public.cambios_hechos
    for select to authenticated using (
        public.mi_rol() in ('administrador','supervisor','empleado')
        and empleado_id = public.mi_empleado()
    );

-- Aceptar o rechazar: igual que antes, y además anota (o borra, si es un deshacer) el cambio hecho
create or replace function public.responder_cambio(p_solicitud uuid, p_aceptar boolean)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    v_yo uuid := public.mi_empleado();
    v_s  public.cambios_solicitudes%rowtype;
    v_d  record;
begin
    select * into v_s from public.cambios_solicitudes where id = p_solicitud for update;
    if not found or v_yo is null or v_s.destinatario_id <> v_yo
       or public.mi_rol() not in ('administrador','supervisor','empleado') then
        return jsonb_build_object('ok', false, 'motivo', 'no_autorizado');
    end if;
    if v_s.estado <> 'pendiente' then
        return jsonb_build_object('ok', false, 'motivo', 'ya_cerrada');
    end if;
    if v_s.primer_dia <= public.hoy_es() then
        update public.cambios_solicitudes
           set estado = 'caducada', cerrada_en = now(), visto_solicitante = false, visto_destinatario = false
         where id = p_solicitud;
        return jsonb_build_object('ok', false, 'motivo', 'caducada');
    end if;

    if p_aceptar then
        for v_d in select * from public.cambios_dias where solicitud_id = p_solicitud loop
            insert into public.excepciones (empleado_id, fecha, codigo)
            values (v_s.solicitante_id, v_d.fecha, v_d.codigo_destinatario)
            on conflict (empleado_id, fecha) do update set codigo = excluded.codigo;

            insert into public.excepciones (empleado_id, fecha, codigo)
            values (v_s.destinatario_id, v_d.fecha, v_d.codigo_solicitante)
            on conflict (empleado_id, fecha) do update set codigo = excluded.codigo;

            -- Se anota el cambio en los dos (para avisar si luego uno lo toca por su cuenta).
            -- Si este cambio devuelve a cada uno el turno que cedió antes, es un "deshacer": se borra la anotación.
            if exists (
                select 1 from public.cambios_hechos h
                where h.empleado_id = v_s.solicitante_id and h.fecha = v_d.fecha
                  and h.con_empleado_id = v_s.destinatario_id and h.codigo_cedido = v_d.codigo_destinatario
            ) then
                delete from public.cambios_hechos
                 where fecha = v_d.fecha and empleado_id in (v_s.solicitante_id, v_s.destinatario_id);
            else
                insert into public.cambios_hechos (empleado_id, fecha, con_empleado_id, codigo_recibido, codigo_cedido)
                values (v_s.solicitante_id, v_d.fecha, v_s.destinatario_id, v_d.codigo_destinatario, v_d.codigo_solicitante)
                on conflict (empleado_id, fecha) do update
                   set con_empleado_id = excluded.con_empleado_id, codigo_recibido = excluded.codigo_recibido,
                       codigo_cedido = excluded.codigo_cedido, hecho_en = now();

                insert into public.cambios_hechos (empleado_id, fecha, con_empleado_id, codigo_recibido, codigo_cedido)
                values (v_s.destinatario_id, v_d.fecha, v_s.solicitante_id, v_d.codigo_solicitante, v_d.codigo_destinatario)
                on conflict (empleado_id, fecha) do update
                   set con_empleado_id = excluded.con_empleado_id, codigo_recibido = excluded.codigo_recibido,
                       codigo_cedido = excluded.codigo_cedido, hecho_en = now();
            end if;
        end loop;
    end if;

    update public.cambios_solicitudes
       set estado = case when p_aceptar then 'aceptada' else 'rechazada' end,
           cerrada_en = now(), visto_solicitante = false, visto_destinatario = true
     where id = p_solicitud;
    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.responder_cambio(uuid, boolean) from public, anon;
grant execute on function public.responder_cambio(uuid, boolean) to authenticated;

-- Limpieza: igual que antes, y borra las anotaciones de cambios de hace más de 30 días
create or replace function public.limpiar_cambios()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
    update public.cambios_solicitudes
       set estado = 'caducada', cerrada_en = now(), visto_solicitante = false, visto_destinatario = false
     where estado = 'pendiente' and primer_dia <= public.hoy_es();

    delete from public.cambios_solicitudes
     where cerrada_en is not null and cerrada_en < now() - interval '24 hours';

    delete from public.cambios_hechos where fecha < public.hoy_es() - 30;
end;
$$;

revoke all on function public.limpiar_cambios() from public, anon;
grant execute on function public.limpiar_cambios() to authenticated;
