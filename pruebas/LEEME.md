# Banco de pruebas (Playwright + Supabase simulado)

Prueba la app en un Chromium sin cabeza con un Supabase falso en memoria (`fake-supabase.js`), sin internet.
Requiere Python con `playwright` (`pip install playwright`, `playwright install chromium`). Desde esta carpeta: `python3 t11.py`.

- `run.py`: servidor local de la carpeta del proyecto y utilidades (reloj fijo en el 16-11-2026).
- `fake-supabase.js`: tablas y funciones (`rpc`) simuladas. Imita la lógica del SQL, **no lo ejecuta**: el SQL real nunca se ha podido probar aquí.
- `t6.py`: solicitud de cambio entre dos jefes (A pide, B acepta, hilo de mensajes, borrado a las 24 h).
- `t7.py`: varios días, cancelar, rechazar, turnos cambiados (no se puede aceptar) y caducidad.
- `t9.py`: jefes que piden cambio a un correturno que sustituye.
- `t10.py`: avisos al tocar un cambio hecho (pedir deshacer) y aviso de turno ya cubierto.
- `t11.py`: marcas por persona, horas por año, horas en el editor y ajuste de horas de un día.
- `t12.py`: fase 10 (resumen principal, casilla de horas para correturnos, LD, horas anuales en Ajustes, baja B, LD, J y S con horas previstas, colores CT1-CT4, desplegable del resumen en móviles de distintos tamaños, empleados por colectivo).
- `t13.py`: fase 12 (PIN de 6 a 10 dígitos, categorías y subgrupos: crear/renombrar/borrar/asignar, solapes por colectivo y su resumen).
- `t14.py`: fase 13 (confirmación al salir y botón atrás: diálogo, menú, Horas, hoja del día, modo edición).
- `t15.py`: fase 14 (administrador sin ficha: inicio con el menú abierto, Horas, Volver, atrás).
- `t16.py`: fase 15 (editor de turnos, Mi año con letras, login, leyenda por persona, calendario anual por persona, Disponibilidades y CT).
Los tests de la fase 4 (marcas en el mes, año, semanas) se hicieron a mano y no están como script.
- `t19.py`: fase 18 (ver el calendario de otra persona: celda partida del mes, D de la otra persona sobre su turno, ficha del día, pantalla «Disponibilidades y CT» con el selector «Ver a:» y su incompatibilidad con las marcas).
- `t20.py`: fase 19 (guardado en una sola operación con `guardar_turnos` y vuelta al guardado por partes si falta el SQL, fallo del servidor, cambios de compañeros por Realtime, refresco al volver a la app y al reconectar, lecturas que no pisan un guardado en curso y sugerencia de deshacer con datos frescos). Devuelve código de salida 1 si algo falla. `t11.py` es una prueba antigua que ya no encaja con la pantalla de horas (falla antes de la fase 19).
