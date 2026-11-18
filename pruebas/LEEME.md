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
Los tests de la fase 4 (marcas en el mes, año, semanas) se hicieron a mano y no están como script.
