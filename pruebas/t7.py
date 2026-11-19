from run import *
import json
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
def nueva(p, user, db, hoy='2026-11-16T10:00:00'):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    return b,pg,errs
A={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}; B={'iniciales':'JE2','rol':'empleado','empleadoId':'e-jefe2'}
with sync_playwright() as p:
    b,pg,errs=nueva(p,A,None)
    # multi día: 21 y 22 nov (M,M) + 1 dic en otro mes
    pg.click('[data-fecha="2026-11-21"]'); pg.click('text=Cambio de varios días'); pg.wait_for_timeout(200)
    print('barra:', pg.locator('#barraCambio').inner_text().replace('\n',' | '))
    pg.click('[data-fecha="2026-11-22"]'); pg.click('[data-fecha="2026-11-16"]'); pg.wait_for_timeout(100)  # hoy no vale
    print('toast:', pg.locator('#toast, .toast').first.inner_text() if pg.locator('#toast, .toast').count() else None)
    pg.click('[data-fecha="2026-11-19"]')  # F  -> sí cambiable (F)
    print('contador:', pg.locator('#contadorCambio').inner_text(), '| sel:', pg.locator('.dia-calendario.seleccionado').count())
    pg.click('#btnSiguienteMes') if pg.locator('#btnSiguienteMes').count() else pg.locator('.btn-icono').nth(1).click()
    pg.wait_for_timeout(300); print('mes:', pg.locator('#tituloMes').inner_text())
    pg.click('[data-fecha="2026-12-01"]'); print('contador:', pg.locator('#contadorCambio').inner_text())
    pg.screenshot(path='multi_sel.png')
    pg.click('#btnContinuarCambio'); pg.wait_for_selector('.modal-hoja')
    print('filas:', pg.locator('.fila-cambio').count(), '| todos:', pg.locator('select[aria-label="Pedir todos los días a"] option').all_inner_texts())
    print('opciones por fila:', [pg.locator('.fila-cambio select').nth(i).locator('option').all_inner_texts() for i in range(pg.locator('.fila-cambio').count())])
    pg.screenshot(path='multi_modal.png')
    pg.click('text=Enviar solicitud'); pg.wait_for_timeout(500)
    print('barra tras enviar:', pg.locator('#barraCambio').count(), '| solicitudes:', pg.evaluate("window.__db.cambios_solicitudes.map(s=>s.destinatario_id+':'+s.primer_dia).join(';')"), '| días:', pg.evaluate("window.__db.cambios_dias.length"))
    db1=pg.evaluate("window.__db")
    # A cancela una
    pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.pestanas-cambios'); pg.click('text=Mis solicitudes'); print('mis solicitudes:', pg.locator('.tarjeta-cambio').all_inner_texts())
    pg.click('.tarjeta-cambio >> nth=0'); print('botones A:', pg.locator('button.btn-peligro').all_inner_texts())
    pg.once('dialog', lambda d: d.accept()); pg.click('text=Cancelar mi solicitud'); pg.wait_for_timeout(500)
    print('estado tras cancelar:', pg.locator('.estado-cambio').first.inner_text(), '|', pg.locator('.admin-nota').last.inner_text())
    print(errs); b.close()

    # B rechaza la primera, y comprobación de "obsoleto" con una nueva
    b,pg,errs=nueva(p,B,db1)
    pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio')
    print('B recibidas:', pg.locator('.tarjeta-cambio').all_inner_texts())
    pg.click('.tarjeta-cambio >> nth=0'); pg.wait_for_selector('.tabla-cambio'); print('B filas:', pg.locator('.tabla-cambio-fila').count())
    pg.once('dialog', lambda d: d.accept()); pg.click('text=Rechazar'); pg.wait_for_timeout(500)
    print('B tras rechazar:', pg.locator('.estado-cambio').first.inner_text(), '| excepciones:', pg.evaluate("window.__db.excepciones.length"))
    db2=pg.evaluate("window.__db"); print(errs); b.close()

    # obsoleto: A pide, luego cambia a mano su turno, B ve aviso y no puede aceptar
    b,pg,errs=nueva(p,A,db2)
    pg.click('[data-fecha="2026-11-24"]'); pg.click('text=Solicitar cambio'); pg.wait_for_selector('.modal-hoja'); pg.click('text=Enviar solicitud'); pg.wait_for_timeout(400)
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); pg.locator('#panelDetalleDia .opcion-turno', has_text='Vacaciones').click(); pg.wait_for_timeout(300)
    db3=pg.evaluate("window.__db"); b.close()
    b,pg,errs=nueva(p,B,db3)
    pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio'); pg.locator('.tarjeta-cambio', has_text='Pendiente').first.click(); pg.wait_for_selector('.tabla-cambio')
    print('obsoleto:', pg.locator('.avisos-cambio').inner_text().replace('\n',' '), '| aceptar disabled:', pg.locator('text=Aceptar el cambio').is_disabled()); b.close()

    # caducidad: llega el día del cambio
    b,pg,errs=nueva(p,B,db3,hoy='2026-11-24T08:00:00')
    pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio'); print('caducadas:', pg.locator('.estado-cambio').all_inner_texts()); b.close()
