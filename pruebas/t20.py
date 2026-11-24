from run import *
# Fase 19: guardado en una sola operación (guardar_turnos), cambios de los compañeros en tiempo real,
# refresco al volver a la app y sugerencia de deshacer con datos frescos.
CT = {'iniciales': 'CTA', 'rol': 'empleado', 'empleadoId': 'e-ct'}
fallos = []
def comprobar(nombre, condicion, detalle=''):
    print(('  OK  ' if condicion else '  FALLO '), nombre, detalle if not condicion else '')
    if not condicion: fallos.append(nombre)

def hay(pg, clave): return pg.evaluate(f"excepciones.has('{clave}')")
def val(pg, clave): return pg.evaluate(f"excepciones.get('{clave}') ?? null")
def escrituras(pg): return pg.evaluate("window.__writes.map(w => w.join(':'))")
def guardar(pg, cambios): return pg.evaluate(f"guardarCambiosCalendario({json.dumps(cambios)})")
def toast(pg): return pg.evaluate("(document.querySelector('.toast, #toast, [role=status]')||{}).textContent || ''")

with sync_playwright() as p:
    print('1) Guardado en una sola operación')
    b, pg, errs = abrir(p, CT)
    pg.evaluate("window.__writes.length = 0; window.__db.horas_dia.push({empleado_id:'e-ct', fecha:'2026-11-20', horas:5}); horasDia.set('e-ct|2026-11-20', 5)")
    ok = guardar(pg, [{'fecha': '2026-11-20', 'codigo': 'V'}])
    ult = pg.evaluate("window.__ultimoGuardarTurnos")
    comprobar('quita el ajuste de horas en la misma llamada', '2026-11-20' in ult['horasBorrar'] and not pg.evaluate("window.__db.horas_dia.some(r => r.fecha==='2026-11-20')"), ult)
    comprobar('guarda y devuelve true', ok is True)
    comprobar('queda en la base', pg.evaluate("window.__db.excepciones.some(r => r.empleado_id==='e-ct' && r.fecha==='2026-11-20' && r.codigo==='V')"))
    w = escrituras(pg)
    comprobar('usa guardar_turnos', 'rpc:guardar_turnos' in w, w)
    comprobar('no escribe directamente en excepciones', not any(x.endswith(':excepciones') for x in w), w)

    ok = guardar(pg, [{'fecha': '2026-11-20', 'codigo': None}])
    comprobar('volver al turno del ciclo borra el cambio', ok is True and not hay(pg, 'e-ct|2026-11-20'))
    comprobar('sin errores de página', not [e for e in errs if 'ERR_FAILED' not in e], errs)
    b.close()

    print('2) Si el SQL de la fase 19 aún no está en Supabase, guarda por partes como antes')
    b, pg, errs = abrir(p, CT)
    pg.evaluate("window.__sinGuardarTurnos = true; window.__writes.length = 0")
    ok = guardar(pg, [{'fecha': '2026-11-22', 'codigo': 'E'}])
    w = escrituras(pg)
    comprobar('guarda igualmente', ok is True and pg.evaluate("window.__db.excepciones.some(r => r.fecha==='2026-11-22' && r.codigo==='E')"))
    comprobar('lo hace con upsert directo', 'upsert:excepciones' in w, w)
    b.close()

    print('3) Si el servidor falla, no cambia nada y la pantalla vuelve a como estaba')
    b, pg, errs = abrir(p, CT)
    pg.evaluate("window.__falloGuardarTurnos = true")
    ok = guardar(pg, [{'fecha': '2026-11-23', 'codigo': 'J'}])
    comprobar('devuelve false', ok is False)
    comprobar('la base no cambia', not pg.evaluate("window.__db.excepciones.some(r => r.fecha==='2026-11-23')"))
    comprobar('la memoria vuelve a como estaba', not hay(pg, 'e-ct|2026-11-23'))
    b.close()

    print('4) Rechazo por datos no válidos del servidor')
    b, pg, errs = abrir(p, CT)
    pg.evaluate("window.__falloGuardarTurnos = false")
    ok = guardar(pg, [{'fecha': '2026-11-23', 'codigo': 'J'}])
    comprobar('con datos buenos guarda', ok is True)
    b.close()

    print('5) Cambios de otros llegan en tiempo real')
    b, pg, errs = abrir(p, CT)
    pg.wait_for_timeout(300)
    pg.evaluate("window.__emitir('excepciones', {eventType:'INSERT', new:{empleado_id:'e-jefe', fecha:'2026-11-25', codigo:'V'}, old:{}})")
    comprobar('un compañero pone V y se ve en memoria', val(pg, 'e-jefe|2026-11-25') == 'V')
    pg.evaluate("window.__emitir('excepciones', {eventType:'DELETE', new:{}, old:{empleado_id:'e-jefe', fecha:'2026-11-25'}})")
    comprobar('lo quita y desaparece', not hay(pg, 'e-jefe|2026-11-25'))
    pg.evaluate("window.__emitir('excepciones', {eventType:'UPDATE', new:{empleado_id:'e-ct', fecha:'2026-11-26', codigo:'V'}, old:{}})")
    pg.wait_for_timeout(500)
    comprobar('cambio en mi propio calendario repinta el día', 'V' in pg.locator('[data-fecha="2026-11-26"]').inner_text(), pg.locator('[data-fecha="2026-11-26"]').inner_text())
    pg.evaluate("window.__emitir('marcas_dia', {eventType:'INSERT', new:{empleado_id:'e-ct', fecha:'2026-11-27', codigo:'D'}, old:{}})")
    comprobar('marcas de día también', pg.evaluate("marcasDia.get('e-ct|2026-11-27')") == 'D')
    b.close()

    print('6) Al volver a la app se lee de nuevo todo')
    b, pg, errs = abrir(p, CT)
    pg.wait_for_timeout(300)
    # Otro dispositivo cambia cosas mientras esta app estaba en segundo plano
    pg.evaluate("window.__db.excepciones.push({empleado_id:'e-ct', fecha:'2026-11-27', codigo:'LD'}); window.__db.excepciones = window.__db.excepciones.filter(r => r.fecha !== '2026-11-17')")
    pg.evaluate("ocultoDesde = Date.now() - 60000; Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(1500)
    comprobar('aparece lo nuevo', val(pg, 'e-ct|2026-11-27') == 'LD')
    comprobar('desaparece lo borrado', not hay(pg, 'e-ct|2026-11-17'))
    comprobar('se repinta', 'LD' in pg.locator('[data-fecha="2026-11-27"]').inner_text(), pg.locator('[data-fecha="2026-11-27"]').inner_text())
    # Si fue solo un momento (menos de 20 s), no se vuelve a leer
    pg.evaluate("window.__db.excepciones.push({empleado_id:'e-ct', fecha:'2026-11-28', codigo:'V'}); ocultoDesde = Date.now() - 3000; document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(1200)
    comprobar('un rato muy corto fuera no provoca lectura', not hay(pg, 'e-ct|2026-11-28'))
    # Reconexión de Realtime
    pg.evaluate("window.__reconectar()")
    pg.wait_for_timeout(1500)
    comprobar('al reconectar Realtime se recupera lo perdido', val(pg, 'e-ct|2026-11-28') == 'V')
    b.close()

    print('7) Una lectura del servidor no pisa lo que se está guardando')
    b, pg, errs = abrir(p, CT)
    pg.wait_for_timeout(300)
    # Un guardado propio en curso (se queda esperando hasta que el test lo libere)
    pg.evaluate("window.__db.excepciones.push({empleado_id:'e-ct', fecha:'2026-12-01', codigo:'V'}); window.__guardando = conEscrituraLocal(() => new Promise(r => window.__liberar = r)); refrescarDatos()")
    pg.wait_for_timeout(600)
    comprobar('mientras hay un guardado en curso no se aplica', not hay(pg, 'e-ct|2026-12-01'))
    pg.evaluate("window.__liberar()")
    try:
        pg.wait_for_function("excepciones.get('e-ct|2026-12-01') === 'V'", timeout=9000)
        comprobar('al terminar el guardado se vuelve a intentar y se aplica', True)
    except Exception as e:
        comprobar('al terminar el guardado se vuelve a intentar y se aplica', False, str(e)[:100])
    b.close()

    print('8) Sugerencia de deshacer con datos frescos (el compañero acaba de aceptar)')
    b, pg, errs = abrir(p, CT)
    pg.wait_for_timeout(300)
    # En el servidor ya consta el cambio con Jefe Uno, pero esta pantalla todavía no lo sabe
    pg.evaluate("""window.__db.excepciones.push({empleado_id:'e-ct', fecha:'2026-11-30', codigo:'M'});
        window.__db.cambios_hechos.push({empleado_id:'e-ct', fecha:'2026-11-30', con_empleado_id:'e-jefe', codigo_recibido:'M', codigo_cedido:'P'})""")
    comprobar('la pantalla aún no lo sabe', not hay(pg, 'e-ct|2026-11-30'))
    pg.evaluate("(() => { window.__resultado = null; guardarCambiosCalendario([{fecha:'2026-11-30', codigo:'T'}]).then(r => { window.__resultado = r; }); })()")
    try:
        pg.wait_for_selector('text=Esto afecta a otra persona', timeout=4000)
        comprobar('sale el aviso de que viene de un cambio', True)
        comprobar('ofrece pedir que lo deshaga', pg.locator('button', has_text='Pedir a').count() == 1)
        pg.click('button:has-text("Cancelar")')
    except Exception as e:
        comprobar('sale el aviso de que viene de un cambio', False, str(e)[:120])
    b.close()

print('\nRESULTADO:', 'TODO OK' if not fallos else 'FALLAN: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
