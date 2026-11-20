# Google Calendar: puesta en marcha (una sola vez, la hace el administrador)

La app lee los calendarios de Google de cada persona directamente desde su móvil. Para que Google lo permita hace falta
un "ID de cliente" (es público, no es una contraseña). Es gratis y no hace falta tarjeta.

1. Entra en https://console.cloud.google.com con tu cuenta de Google y crea un proyecto nuevo (por ejemplo "Calendario BBE").
2. **APIs y servicios → Biblioteca** → busca **Google Calendar API** → *Habilitar*.
3. **Pantalla de consentimiento de OAuth** (ahora llamada "Google Auth Platform"):
   - Tipo de usuario: **Externo**. Nombre de la app: Calendario BBE. Correo de asistencia: el tuyo.
   - **Acceso a los datos (Data access)** → añadir estos dos permisos:
     `.../auth/calendar.calendarlist.readonly` y `.../auth/calendar.events.readonly` (solo lectura).
   - **Público (Audience)**: déjala en *Pruebas* y añade como "usuarios de prueba" el correo de Google de cada compañero
     que vaya a usarla (hasta 100). Quien no esté en la lista no podrá vincular.
4. **Clientes → Crear cliente → Aplicación web**:
   - **Orígenes de JavaScript autorizados**: la dirección de tu web (la de producción y la de cada rama de pruebas de Vercel
     que quieras probar), por ejemplo `https://tu-app.vercel.app` y `https://tu-app-git-fase16-google-tuusuario.vercel.app`.
   - No hace falta rellenar "URI de redireccionamiento".
5. Copia el **ID de cliente** (acaba en `.apps.googleusercontent.com`) y pégalo en `js/google.js`, en la línea
   `const GOOGLE_CLIENT_ID = "";`. Sube el cambio. Mientras esté vacío, la función no aparece en ningún sitio.

## Qué verá cada persona
- Ajustes → **Google Calendar** → *Vincular mi cuenta de Google* → elige su cuenta → marca qué calendarios quiere ver.
- Al ser una app en pruebas, Google enseña un aviso de "Google no ha verificado esta aplicación": se pulsa *Avanzado → Continuar*.
- Al abrir la app se ven los eventos de la última vez. El botón **⟳ Google** del recuadro «Hoy» los actualiza (el permiso de Google dura una hora).
- Los calendarios elegidos y una copia de los últimos eventos se guardan solo en ese dispositivo, nunca en Supabase.

## Límites que conviene saber
- Una cuenta de Google de empresa (Workspace) puede tener bloqueadas las apps externas; con cuentas personales (Gmail) no hay problema.
- En modo *Pruebas*, Google puede pedir volver a aceptar el permiso con cierta frecuencia (la consola avisa de la caducidad).
  Si molesta, se puede pasar la app a *En producción* sin verificar (con tope de 100 usuarios y el mismo aviso de "no verificada");
  verificarla del todo exige dominio propio, política de privacidad y un vídeo de demostración.
- Solo lectura: la app nunca crea, cambia ni borra nada en Google.
