from run import *
import json
def nueva(p, user, db, hoy='2026-11-16T10:00:00'):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    return b,pg,errs
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
ADM={'iniciales':'ADM','rol':'administrador','empleadoId':'e-jefe'}
JP={'iniciales':'JPA','rol':'empleado','empleadoId':'e-jp'}; CT={'iniciales':'CTA','rol':'empleado','empleadoId':'e-ct'}
with sync_playwright() as p:
    # 1) celdas: jefe sin partir; D partida
    b,pg,errs=nueva(p,ADM,None)
    print('jefe celdas partidas:', pg.locator('.con-marca').count())
    pg.click('#infoUsuario'); print('menú: Semanas=',pg.locator('#btnSemanas').count(),'| Horas visible=',pg.locator('#btnHoras').is_visible(),'| Horas y convenio=',pg.locator('#btnAdminHoras').is_visible())
    pg.click('#btnAjustes'); pg.wait_for_selector('.opciones-tema'); print('ajustes botones:', pg.locator('.opcion-tema').all_inner_texts(), '| Coincidencias en página:', pg.locator('text=Coincidencias').count())
    pg.click('text=Volver')
    # 2) admin: marcas por persona
    pg.click('#infoUsuario'); pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo'); pg.click('text=Disponibilidades y CT'); pg.wait_for_selector('summary'); [pg.locator('details:not([open]) > summary').first.click() for _ in range(8) if pg.locator('details:not([open]) > summary').count()]; pg.wait_for_selector('.fila-marcas')
    print('filas marcas:', pg.locator('.fila-marcas').count(), '| casillas por fila:', pg.locator('.fila-marcas').first.locator('input').count())
    fila=pg.locator('.fila-marcas', has_text='Jefe Uno'); fila.locator('input').nth(0).check()   # D
    pg.click('text=Guardar'); pg.wait_for_timeout(400); print('aviso:', pg.locator('.admin-aviso-corto').inner_text(), '| marcas db Jefe Uno:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jefe').marcas"))
    db1=pg.evaluate("window.__db"); b.close()
    # Jefe Uno ahora con D: celda partida y editor con D
    b,pg,errs=nueva(p,{'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'},db1)
    print('Jefe Uno celdas partidas:', pg.locator('.con-marca').count())
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); print('editor marcas Jefe Uno:', pg.locator('#panelDetalleDia .seccion-semana .opcion-letra').all_inner_texts())
    pg.locator('#panelDetalleDia .seccion-semana .opcion-turno', has_text='Disponible').click(); pg.wait_for_timeout(300); print('24:', txt(pg,'2026-11-24')); b.close()
    # editor de correturno: solo CT; jornada: solo D
    b,pg,errs=nueva(p,CT,None); pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); print('editor CT:', pg.locator('#panelDetalleDia .seccion-semana .opcion-letra').all_inner_texts()); b.close()
    b,pg,errs=nueva(p,JP,None); pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); print('editor jornada:', pg.locator('#panelDetalleDia .seccion-semana .opcion-letra').all_inner_texts(), '| leyenda D:', pg.locator('text=Disponible').count()); b.close()

    # 3) horas por año (admin)
    b,pg,errs=nueva(p,ADM,None)
    pg.click('#infoUsuario'); pg.click('#btnAdminHoras'); pg.wait_for_selector('.fila-horas')
    for i,h in enumerate(['8','8','8','8','7','8','8','0']): pg.locator('.admin-grupo').nth(0).locator('input[aria-label^="Horas de"]').nth(i).fill(h)
    pg.click('text=Guardar horas por turno de 2026'); pg.wait_for_timeout(300)
    pg.evaluate("window.__db.horas_anuales.push({empleado_id:'e-jefe',anio:2026,horas:1700})")   # desde la fase 10 las pone cada persona en Ajustes (ver t12.py)
    print('db 2026:', pg.evaluate("window.__db.horas_turno.length"), pg.evaluate("window.__db.horas_anuales.map(r=>r.anio+':'+r.horas).join(',')"))
    pg.locator('#resultado .fila-guardar select').first.select_option('2027'); pg.wait_for_timeout(300)
    print('2027 inputs vacíos tras cambiar año:', pg.locator('.admin-grupo').nth(0).locator('input').first.input_value())
    pg.click('text=Copiar los valores de 2026'); pg.wait_for_timeout(300); print('copiado M:', pg.locator('.admin-grupo').nth(0).locator('input').first.input_value(), '| aviso:', pg.locator('.avisos-cambio').inner_text()[:60])
    pg.click('text=Guardar horas por turno de 2027'); pg.wait_for_timeout(300); pg.evaluate("window.__db.horas_anuales.push({empleado_id:'e-jefe',anio:2027,horas:1690})")
    print('db:', pg.evaluate("window.__db.horas_anuales.map(r=>r.anio+':'+r.horas).join(',')"))
    db2=pg.evaluate("window.__db"); b.close()
    b,pg,errs=nueva(p,{'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'},db2)
    pg.click('#infoUsuario'); pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen')
    print('2026:', [t.replace('\n',' ') for t in pg.locator('.dato-resumen').all_inner_texts()][:3])
    pg.select_option('.resultado-acciones select','2027'); pg.wait_for_selector('.tarjetas-resumen'); pg.wait_for_timeout(300)
    print('2027:', [t.replace('\n',' ') for t in pg.locator('.dato-resumen').all_inner_texts()][:3], '| pestañas:', pg.locator('.pestana-cambios').count())
    # 4) horas en el editor y ajuste de un día
    pg.click('text=Volver'); pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); pg.wait_for_selector('.seccion-horas-actual')
    print('sección horas:', pg.locator('.seccion-horas-actual').inner_text(), '|', pg.locator('.seccion-horas button').all_inner_texts())
    pg.click('text=Igual que el turno del ciclo'); pg.wait_for_timeout(300); print('db horas_dia:', pg.evaluate("window.__db.horas_dia"))
    pg.click('[data-fecha="2026-11-24"]'); print('tras ajuste:', pg.locator('.seccion-horas-actual').inner_text()); pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text='Vacaciones').click(); pg.wait_for_timeout(400)
    print('db horas_dia tras cambiar turno:', pg.evaluate("window.__db.horas_dia"))
    print([e for e in errs if 'ERR_FAILED' not in e]); b.close()
