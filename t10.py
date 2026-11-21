from run import *
import json
def nueva(p, user, db, hoy='2026-11-16T10:00:00'):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    return b,pg,errs
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
A={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}; B={'iniciales':'JE2','rol':'empleado','empleadoId':'e-jefe2'}; C={'iniciales':'CTA','rol':'empleado','empleadoId':'e-ct'}
def editar(pg, d, turno):
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click(f'[data-fecha="{d}"]'); pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text=turno).click(); pg.wait_for_timeout(300)
with sync_playwright() as p:
    # 1) A pide a B el 18; B acepta
    b,pg,errs=nueva(p,A,None); pg.click('[data-fecha="2026-11-18"]'); pg.click('text=Solicitar cambio'); pg.wait_for_selector('.modal-hoja'); pg.click('text=Enviar solicitud'); pg.wait_for_timeout(400); db=pg.evaluate("window.__db"); b.close()
    b,pg,errs=nueva(p,B,db); pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio'); pg.click('.tarjeta-cambio'); pg.wait_for_selector('.tabla-cambio')
    pg.once('dialog', lambda d: d.accept()); pg.click('text=Aceptar el cambio'); pg.wait_for_timeout(500); db=pg.evaluate("window.__db"); b.close()
    print('hechos tras aceptar:', [(h['empleado_id'],h['fecha'],h['codigo_recibido'],h['codigo_cedido']) for h in db['cambios_hechos']])
    # 2) A intenta poner V el 18 -> aviso; pide deshacer
    b,pg,errs=nueva(p,A,db); print('A 18 nov:', txt(pg,'2026-11-18'))
    editar(pg,'2026-11-18','Vacaciones'); print('modal:', pg.locator('.modal-hoja').inner_text().replace('\n',' | ')); pg.screenshot(path='aviso_deshacer.png')
    pg.click('text=Pedir a Jefe Dos que lo deshaga'); pg.wait_for_timeout(500)
    print('A 18 tras pedir (no se guardó V):', txt(pg,'2026-11-18'), '| solicitudes:', pg.evaluate("window.__db.cambios_solicitudes.map(s=>s.solicitante_id+'->'+s.destinatario_id+' '+s.estado).join(';')"), pg.evaluate("window.__db.cambios_dias.filter(d=>d.solicitud_id!==window.__db.cambios_solicitudes[0].id).map(d=>d.codigo_solicitante+d.codigo_destinatario).join(',')"), pg.evaluate("window.__db.cambios_mensajes.map(m=>m.texto).join('|')"))
    db=pg.evaluate("window.__db"); b.close()
    # 3) B acepta el deshacer
    b,pg,errs=nueva(p,B,db); pg.click('#infoUsuario'); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio'); pg.locator('.tarjeta-cambio', has_text='Pendiente').first.click(); pg.wait_for_selector('.tabla-cambio')
    pg.once('dialog', lambda d: d.accept()); pg.click('text=Aceptar el cambio'); pg.wait_for_timeout(500); db=pg.evaluate("window.__db"); print('hechos tras deshacer:', db['cambios_hechos'], '| exc 18:', [(e['empleado_id'],e['codigo']) for e in db['excepciones'] if e['fecha']=='2026-11-18']); b.close()
    b,pg,errs=nueva(p,A,db); editar(pg,'2026-11-18','Vacaciones'); print('A tras deshacer, modal:', pg.locator('.modal-hoja').count(), '| 18:', txt(pg,'2026-11-18')); b.close()
    # 4) cobertura: A pone M el 18 (Jefe Tres ya tiene M)
    b,pg,errs=nueva(p,A,None); editar(pg,'2026-11-18','Mañana'); print('cobertura:', pg.locator('.modal-hoja').inner_text().replace('\n',' | '))
    pg.click('text=Guardar igualmente'); pg.wait_for_timeout(300); print('guardado:', txt(pg,'2026-11-18'))
    b.close()
    b,pg,errs=nueva(p,A,None); editar(pg,'2026-11-18','Fiesta'); print('F -> modal:', pg.locator('.modal-hoja').count()); b.close()
    # Jefe Tres de vacaciones el 18: sin aviso
    d0=json.loads(json.dumps(db)); d0['excepciones']=[{'empleado_id':'e-jefe3','fecha':'2026-11-18','codigo':'V'}]
    b,pg,errs=nueva(p,A,d0); editar(pg,'2026-11-18','Mañana'); print('con hueco -> modal:', pg.locator('.modal-hoja').count(), '| 18:', txt(pg,'2026-11-18')); b.close()
    # 5) correturno
    b,pg,errs=nueva(p,C,None); editar(pg,'2026-11-18','Mañana'); print('CT sin hueco:', pg.locator('.modal-hoja').inner_text().replace('\n',' | ')); b.close()
    b,pg,errs=nueva(p,C,d0); editar(pg,'2026-11-18','Mañana'); print('CT con hueco -> modal:', pg.locator('.modal-hoja').count(), '| 18:', txt(pg,'2026-11-18')); print([e for e in errs if 'ERR_FAILED' not in e]); b.close()
