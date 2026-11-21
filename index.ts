// Función de Supabase "enviar-push": manda los avisos al móvil de cada persona.
// La llama la base de datos (con un secreto) cuando hay una solicitud o un mensaje nuevo,
// y la propia app con el botón "Enviar aviso de prueba" (con la sesión del usuario).
// Se despliega SIN verificación JWT (los avisos de la base de datos no llevan sesión): ver PUSH-CONFIGURAR.md.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRETO = Deno.env.get("WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:Jares@bbe.es",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Aviso = { titulo: string; cuerpo: string; tag: string; url: string };

function fechaTexto(iso: string): string {
    return new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
}

async function mandar(subs: { id: string; endpoint: string; p256dh: string; auth: string }[], aviso: Aviso): Promise<number> {
    let enviados = 0;
    await Promise.all(subs.map(async (s) => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify(aviso),
                { TTL: 60 * 60 * 24, urgency: "high" },
            );
            enviados++;
        } catch (e) {
            const codigo = (e as { statusCode?: number }).statusCode;
            if (codigo === 404 || codigo === 410) {
                await admin.from("push_suscripciones").delete().eq("id", s.id);   // el dispositivo ya no existe
            } else {
                console.error("No se pudo enviar un aviso:", codigo, (e as Error).message);
            }
        }
    }));
    return enviados;
}

async function avisarEmpleado(empleadoId: string, campo: "avisar_cambios" | "avisar_mensajes", aviso: Aviso) {
    const { data } = await admin.from("push_suscripciones")
        .select("id, endpoint, p256dh, auth").eq("empleado_id", empleadoId).eq(campo, true);
    return mandar(data ?? [], aviso);
}

async function nombres(ids: string[]): Promise<Record<string, string>> {
    const { data } = await admin.from("empleados").select("id, nombre").in("id", ids);
    return Object.fromEntries((data ?? []).map((e) => [e.id, e.nombre as string]));
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("ok");
    let cuerpo: { tipo?: string; id?: string };
    try { cuerpo = await req.json(); } catch { return new Response("json no válido", { status: 400 }); }

    // Aviso de prueba: lo pide una persona con sesión y solo llega a sus propios dispositivos
    if (cuerpo.tipo === "prueba") {
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
        const { data: u } = await admin.auth.getUser(token);
        if (!u?.user) return new Response("no autorizado", { status: 401 });
        const { data: subs } = await admin.from("push_suscripciones").select("id, endpoint, p256dh, auth").eq("user_id", u.user.id);
        const n = await mandar(subs ?? [], { titulo: "Calendario BBE", cuerpo: "Los avisos funcionan correctamente.", tag: "prueba", url: "./" });
        return Response.json({ ok: true, enviados: n });
    }

    // Avisos de la base de datos: solo con el secreto
    if (!SECRETO || req.headers.get("x-secret") !== SECRETO) return new Response("no autorizado", { status: 401 });
    if (!cuerpo.id) return new Response("falta id", { status: 400 });

    const url = "./?ir=cambios";

    if (cuerpo.tipo === "mensaje") {
        const { data: m } = await admin.from("cambios_mensajes").select("id, solicitud_id, autor_id, creado_en").eq("id", cuerpo.id).maybeSingle();
        if (!m) return Response.json({ ok: true, enviados: 0 });
        const { data: s } = await admin.from("cambios_solicitudes").select("id, solicitante_id, destinatario_id, creada_en, estado").eq("id", m.solicitud_id).maybeSingle();
        if (!s || s.estado !== "pendiente") return Response.json({ ok: true, enviados: 0 });
        // El mensaje que acompaña a la solicitud ya va dentro del aviso de "solicitud nueva"
        if (m.autor_id === s.solicitante_id && Math.abs(new Date(m.creado_en).getTime() - new Date(s.creada_en).getTime()) < 5000) {
            return Response.json({ ok: true, enviados: 0 });
        }
        const destino = m.autor_id === s.solicitante_id ? s.destinatario_id : s.solicitante_id;
        const n = await nombres([m.autor_id]);
        const enviados = await avisarEmpleado(destino, "avisar_mensajes", {
            titulo: "Mensaje nuevo", cuerpo: `${n[m.autor_id] ?? "Un compañero"} ha escrito en vuestra solicitud de cambio.`, tag: "msg-" + s.id, url,
        });
        return Response.json({ ok: true, enviados });
    }

    const { data: s } = await admin.from("cambios_solicitudes").select("id, solicitante_id, destinatario_id, primer_dia, estado").eq("id", cuerpo.id).maybeSingle();
    if (!s) return Response.json({ ok: true, enviados: 0 });
    const n = await nombres([s.solicitante_id, s.destinatario_id]);
    const quienSol = n[s.solicitante_id] ?? "Un compañero";
    const quienDes = n[s.destinatario_id] ?? "Un compañero";
    const dia = fechaTexto(s.primer_dia);

    let enviados = 0;
    if (cuerpo.tipo === "solicitud_nueva") {
        enviados = await avisarEmpleado(s.destinatario_id, "avisar_cambios", {
            titulo: "Solicitud de cambio", cuerpo: `${quienSol} te propone un cambio de turno desde el ${dia}.`, tag: "cambio-" + s.id, url,
        });
    } else if (cuerpo.tipo === "solicitud_resuelta") {
        const aceptada = s.estado === "aceptada";
        enviados = await avisarEmpleado(s.solicitante_id, "avisar_cambios", {
            titulo: aceptada ? "Cambio aceptado" : "Cambio rechazado",
            cuerpo: `${quienDes} ha ${aceptada ? "aceptado" : "rechazado"} tu cambio del ${dia}.`, tag: "cambio-" + s.id, url,
        });
    } else if (cuerpo.tipo === "solicitud_cancelada") {
        enviados = await avisarEmpleado(s.destinatario_id, "avisar_cambios", {
            titulo: "Solicitud cancelada", cuerpo: `${quienSol} ha cancelado su solicitud de cambio del ${dia}.`, tag: "cambio-" + s.id, url,
        });
    }
    return Response.json({ ok: true, enviados });
});
