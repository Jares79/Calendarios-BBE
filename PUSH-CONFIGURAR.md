# Avisos en el móvil (notificaciones push): puesta en marcha (una sola vez, la hace el administrador)

Qué avisa: solicitud de cambio nueva (a quien la recibe), cambio aceptado/rechazado (a quien lo pidió), solicitud cancelada, y mensajes
dentro de una solicitud. Cada persona puede activarlos o desactivarlos en **Ajustes → Avisos en el móvil**, y elegir si quiere avisos de
cambios, de mensajes o de los dos.

Cómo funciona: cuando pasa algo, la base de datos llama a una pequeña función de Supabase (`enviar-push`), que manda el aviso al móvil de la
persona. Todo va en el plan gratuito. Si algo de los avisos falla, **nunca** impide hacer un cambio de turno.

## 1. Base de datos
1. Supabase → **Database → Extensions** → activa **pg_net** (si no está ya).
2. **SQL Editor** → pega `supabase/fase17-push.sql` → **Run**. (Se puede repetir sin problema. `fase17-deshacer.sql` lo quita todo.)

## 2. Claves de los avisos (VAPID)
Necesitas un par de claves. En tu ordenador, con Node.js instalado, abre una terminal y ejecuta:

```
npx web-push generate-vapid-keys
```

Saldrán una **Public Key** (se puede enseñar) y una **Private Key** (**secreta**: no la pegues en el código, en el chat ni en GitHub).

## 3. Secretos de la función
Supabase → **Edge Functions → Secrets** (Manage secrets) → añade estos cuatro:

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la Public Key |
| `VAPID_PRIVATE_KEY` | la Private Key |
| `VAPID_SUBJECT` | `mailto:Jares@bbe.es` |
| `WEBHOOK_SECRET` | una frase larga inventada por ti (30 caracteres o más, sin espacios). Apúntala: la usas en el paso 5 |

## 4. La función
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**. Nombre: `enviar-push` (exactamente así).
2. Borra el código de ejemplo y pega el contenido de `supabase/functions/enviar-push/index.ts` → **Deploy**.
3. En la función, en sus ajustes (**Details/Settings**), **desactiva «Verify JWT»** (*Enforce JWT Verification*). Hace falta porque los avisos de la base de datos no llevan sesión; la función se protege con el `WEBHOOK_SECRET`.
   (Con la terminal sería: `supabase functions deploy enviar-push --no-verify-jwt`.)
4. Copia la dirección de la función: `https://TU-REF.supabase.co/functions/v1/enviar-push` (el *TU-REF* es el identificador de tu proyecto, el que sale en la dirección de Supabase).

## 5. Conectar la base de datos con la función
En el **SQL Editor** ejecuta esto, cambiando las dos cosas entre comillas:

```sql
update public.push_config
   set url = 'https://TU-REF.supabase.co/functions/v1/enviar-push',
       secreto = 'EL-MISMO-WEBHOOK_SECRET-DEL-PASO-3'
 where id = 1;
```

## 6. La clave pública en la app
En `js/push.js`, pon la **Public Key** entre las comillas de `const PUSH_VAPID_PUBLICA = "";` (igual que hiciste con el ID de Google). Sube el cambio. Mientras esté vacía, la sección no aparece en Ajustes.

## 7. Probarlo
1. Abre la app → **Ajustes → Avisos en el móvil** → activa **Recibir avisos en este dispositivo** y acepta el permiso del navegador.
2. Pulsa **Enviar aviso de prueba**: debe llegar una notificación «Los avisos funcionan correctamente».
3. Con dos cuentas (o con un compañero), crea una solicitud de cambio: la otra persona debe recibir el aviso. Al tocarlo se abre la app en **Cambios**.

## Cosas a tener en cuenta
- **iPhone:** los avisos solo funcionan con iOS 16.4 o superior y con la app **instalada** (Compartir → Añadir a pantalla de inicio) y abierta desde el icono. Si no, Ajustes lo explica.
- **Android:** funciona en Chrome, instalada o no.
- Cada persona puede tener hasta 5 dispositivos con avisos. Al **cerrar sesión**, ese móvil deja de recibir avisos de la cuenta.
- Un aviso puede enseñar en la pantalla bloqueada el nombre de un compañero y una fecha. Está dicho en la política de privacidad.
- **Si no llega nada:** (1) en Edge Functions → `enviar-push` → **Logs** mira si la función recibe llamadas; (2) en el SQL Editor, `select * from net._http_response order by created desc limit 5;` muestra la respuesta de la función a la base de datos (401 = el secreto del paso 5 no coincide; 500 = falta algún secreto del paso 3); (3) comprueba que el permiso de notificaciones del navegador no esté bloqueado.
