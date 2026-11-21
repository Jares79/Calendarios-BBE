from run import *
import json
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
U1={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}
with sync_playwright() as p:
    # ---- A solicita un día suelto
    b,pg,errs=abrir(p,U1)
    print('btnCambios visible:', pg.evaluate("document.getElementById('btnCambios').style.display!=='none'"))
    mis=[(d,txt(pg,d)) for d in ('2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21')]; print('A:',mis)
    pg.click('[data-fecha="2026-11-18"]'); print('ficha botones:', pg.locator('#panelDetalleDia button').all_inner_texts())
    pg.click('text=Solicitar cambio'); pg.wait_for_selector('.modal-hoja')
    print('opciones:', pg.locator('.fila-cambio select option').all_inner_texts())
    print('avisos:', pg.locator('.avisos-cambio').all_inner_texts())
    pg.fill('.modal-hoja textarea','¿Me cambias el día?'); pg.screenshot(path='modal1.png')
    pg.click('text=Enviar solicitud'); pg.wait_for_timeout(400)
    print('solicitudes db:', pg.evaluate("window.__db.cambios_solicitudes.map(s=>s.destinatario_id+' '+s.estado+' '+s.primer_dia).join(';')"), pg.evaluate("window.__db.cambios_dias.map(d=>d.fecha+d.codigo_solicitante+d.codigo_destinatario).join(',')"))
    db1=pg.evaluate("window.__db"); b.close()

    # ---- B (destinatario) ve globo, abre, escribe, acepta
    dest=pg_dest=None
    sol=db1['cambios_solicitudes'][0]; U2={'iniciales':'JE2','rol':'empleado','empleadoId':sol['destinatario_id']}
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(U2)+';window.__DB_INIT='+json.dumps(db1)); pg.clock.install(time='2026-11-16T10:00:00'); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    print('B globo cabecera:', pg.locator('#infoUsuario .globo').inner_text() if pg.locator('#infoUsuario .globo').count() else None)
    pg.click('#infoUsuario'); print('B globo menú:', pg.locator('#globoCambios').inner_text()); pg.click('#btnCambios'); pg.wait_for_selector('.tarjeta-cambio')
    print('B tarjetas:', pg.locator('.tarjeta-cambio').all_inner_texts()); pg.click('.tarjeta-cambio'); pg.wait_for_selector('.tabla-cambio')
    print('B detalle:', pg.locator('.tabla-cambio').inner_text().replace('\n',' | '), '| botones:', pg.locator('.acciones-cambio button').all_inner_texts())
    print('B globo tras abrir:', pg.locator('#infoUsuario .globo').count())
    pg.fill('.responder-cambio textarea','Vale, ¿de acuerdo?'); pg.click('text=Enviar mensaje'); pg.wait_for_selector('.burbuja.mia'); print('B hilo:', pg.locator('.burbuja').all_inner_texts())
    pg.screenshot(path='detalle_b.png')
    pg.once('dialog', lambda d: d.accept()); pg.click('text=Aceptar el cambio'); pg.wait_for_timeout(600)
    print('B estado:', pg.locator('.estado-cambio').first.inner_text(), '| excepciones db:', pg.evaluate("window.__db.excepciones.filter(e=>e.fecha=='2026-11-18').map(e=>e.empleado_id+e.codigo).join(',')"))
    db2=pg.evaluate("window.__db"); pg.click('text=Volver'); pg.wait_for_timeout(300)
    print('B ve su 18 nov:', txt(pg,'2026-11-18')); print([e for e in errs]); b.close()

    # ---- A vuelve a entrar: cambio aplicado, globo, y borrado a las 24h
    b,pg,errs=abrir(p,U1) if False else (None,None,None)
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(U1)+';window.__DB_INIT='+json.dumps(db2)); pg.clock.install(time='2026-11-16T10:00:00'); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    print('A 18 nov ahora:', txt(pg,'2026-11-18'), '| globo:', pg.locator('#infoUsuario .globo').inner_text())
    pg.clock.fast_forward(25*3600*1000); pg.wait_for_timeout(1500); pg.evaluate("tickCambios()"); pg.wait_for_timeout(500)
    print('tras 25h, solicitudes:', pg.evaluate("window.__db.cambios_solicitudes.length"), 'dias', pg.evaluate("window.__db.cambios_dias.length"), 'mensajes', pg.evaluate("window.__db.cambios_mensajes.length"))
    print([e for e in errs]); b.close()
