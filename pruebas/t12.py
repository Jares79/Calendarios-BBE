from run import *
import json
def nueva(p, user, db, hoy='2026-11-16T10:00:00', vp=(390,780)):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(600)
    return b,pg,errs
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
ADM={'iniciales':'ADM','rol':'administrador','empleadoId':'e-jefe'}
JEF={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}; JE2={'iniciales':'JE2','rol':'empleado','empleadoId':'e-jefe2'}
CTA={'iniciales':'CTA','rol':'empleado','empleadoId':'e-ct'}; JP={'iniciales':'JPA','rol':'empleado','empleadoId':'e-jp'}
HT=[{'anio':2026,'codigo':c,'horas':h} for c,h in [('M',8),('T',8),('N',8),('P',8),('I',7),('S',8),('V',8),('E',0),('J',8),('LD',8)]]
DB={'horas_turno':HT,'config_horas':[{'anio':2026,'horas_dia_exceso':8,'dias_vacaciones':23,'dias_ld':2}],'horas_anuales':[{'empleado_id':'e-jefe','anio':2026,'horas':1700}],
    'excepciones':[{'empleado_id':'e-jefe','fecha':'2026-03-10','codigo':'V'},{'empleado_id':'e-jefe','fecha':'2026-03-11','codigo':'V'},{'empleado_id':'e-jefe','fecha':'2026-04-01','codigo':'LD'},{'empleado_id':'e-jefe','fecha':'2026-05-04','codigo':'E'}]}
def abre(pg, grupo, sub):
    g=pg.locator('summary', has_text=grupo).first
    if not g.evaluate("e=>e.parentElement.open"): g.click()
    sg=pg.locator('.admin-subdesplegable > summary', has_text=sub).first
    if not sg.evaluate("e=>e.parentElement.open"): sg.click()
def abrir(pg):
    if pg.locator('.hoy-resumen-caja').is_hidden(): pg.click('.hoy-desplegable'); pg.wait_for_timeout(300)
def resumen(pg):
    abrir(pg); return [t.replace('\n',' ') for t in pg.locator('.hoy-resumen-caja .mini-dato').all_inner_texts()]
with sync_playwright() as p:
    # 1) Resumen principal para un jefe (turnos): 5 tarjetas
    b,pg,errs=nueva(p,JEF,DB)
    print('1 jefe: cerrado por defecto =', pg.locator('.hoy-resumen-caja').is_hidden(), '| aria:', pg.get_attribute('.hoy-desplegable','aria-expanded'), '| pastilla:', pg.locator('.hoy-desplegar').inner_text(), '| no hay próximos días =', pg.locator('.hoy-proximos').count()==0)
    pg.screenshot(path='/tmp/t12_cerrado.png')
    print('  tarjetas:', resumen(pg))
    pg.screenshot(path='/tmp/t12_jefe.png'); print('  alto calendario celdas:', pg.evaluate("getComputedStyle(document.getElementById('miCalendario')).getPropertyValue('--alto-celda')"), '| clases body:', pg.evaluate("document.body.className")); b.close()
    # 2) Correturno sin flag: solo vacaciones y LD; con flag: todo
    b,pg,errs=nueva(p,CTA,DB); print('2 correturno sin flag:', resumen(pg)); b.close()
    db2=json.loads(json.dumps(DB)); db2['empleados']=None
    b,pg,errs=nueva(p,ADM,DB)
    # admin: ficha del correturno con casilla
    pg.click('#infoUsuario'); pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo')
    print('3a desplegables:', pg.locator('.admin-desplegable').count(), '| abiertos al entrar:', pg.locator('.admin-desplegable[open]').count(), '| resúmenes:', pg.locator('.admin-desplegable > summary').all_inner_texts())
    abre(pg,'jornada partida','Correturnos')
    pg.locator('.admin-fila', has_text='Corre Uno').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-formulario')
    print('3 casilla ver horas visible en correturno:', pg.locator('.admin-formulario .admin-check', has_text='resumen de horas').is_visible())
    pg.locator('.admin-formulario .admin-check', has_text='resumen de horas').locator('input').check(); pg.click('text=Guardar cambios'); pg.wait_for_timeout(500)
    print('  db ver_horas:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-ct').ver_horas"))
    print('  correturnos sigue abierto tras guardar:', pg.locator('.admin-desplegable[open]').count())
    abre(pg,'Personal a turnos','Jefes')
    pg.locator('.admin-fila', has_text='Jefe Dos').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-formulario')
    print('  casilla en jefe visible:', pg.locator('.admin-formulario .admin-check', has_text='resumen de horas').is_visible())
    abre(pg,'jornada partida','Sin subgrupo')
    pg.locator('.admin-fila', has_text='Partida Uno').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-formulario')
    print('  casilla en jornada partida visible:', pg.locator('.admin-formulario .admin-check', has_text='resumen de horas').is_visible())
    pg.locator('.admin-formulario .admin-check', has_text='resumen de horas').locator('input').check(); pg.click('text=Guardar cambios'); pg.wait_for_timeout(500)
    print('  db ver_horas jornada:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jp').ver_horas"))
    dbf=pg.evaluate("window.__db"); b.close()
    b,pg,errs=nueva(p,CTA,dbf); print('  correturno con flag:', resumen(pg)); b.close()
    b,pg,errs=nueva(p,JP,dbf); print('  jornada partida con flag:', resumen(pg)); b.close()
    # 4) Admin: horas y convenio sin horas anuales y con LD
    b,pg,errs=nueva(p,ADM,DB); pg.click('#infoUsuario'); pg.click('#btnAdminHoras'); pg.wait_for_selector('.fila-horas')
    print('4 inputs horas anuales en admin:', pg.locator('input[aria-label^="Horas anuales de"]').count(), '| LD input:', pg.locator('input[aria-label="Días de libre disposición al año"]').input_value())
    pg.locator('input[aria-label="Días de libre disposición al año"]').fill('3'); pg.click('text=Guardar 2026'); pg.wait_for_timeout(300)
    print('  config db:', pg.evaluate("window.__db.config_horas"))
    dbc=pg.evaluate("window.__db"); b.close()
    b,pg,errs=nueva(p,JEF,dbc); print('  jefe ve LD:', [t for t in resumen(pg) if 'Libre' in t]); b.close()
    # 5) Ajustes: cada usuario pone sus horas anuales
    b,pg,errs=nueva(p,JE2,DB); pg.click('#infoUsuario'); pg.click('#btnAjustes'); pg.wait_for_selector('.ajustes-horas input')
    print('5 ajustes: input vacío =', pg.locator('.ajustes-horas input').input_value()=='' )
    pg.locator('.ajustes-horas input').fill('1650'); pg.click('text=Guardar mis horas de 2026'); pg.wait_for_timeout(300)
    print('  db anuales:', pg.evaluate("window.__db.horas_anuales"), '| aviso:', pg.locator('.ajustes-horas .admin-aviso-corto').inner_text())
    pg.click('text=Volver'); pg.wait_for_timeout(500); print('  resumen tras volver:', resumen(pg)); b.close()
    b,pg,errs=nueva(p,JP,DB); pg.click('#infoUsuario'); pg.click('#btnAjustes'); pg.wait_for_timeout(500); print('  jornada partida (sin flag) en ajustes: horas anuales =', pg.locator('.ajustes-horas input').count()); b.close()
    # 6) Baja B
    b,pg,errs=nueva(p,JEF,DB)
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); pg.wait_for_selector('.opcion-horas')
    print('6 rejilla incluye B:', pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text='Baja').inner_text().replace('\n','|'))
    antes=txt(pg,'2026-11-24'); print('  24 antes:', antes)
    pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text='Baja').click(); pg.wait_for_timeout(500)
    print('  24 después:', txt(pg,'2026-11-24'), '| excepciones:', pg.evaluate("window.__db.excepciones.filter(e=>e.fecha=='2026-11-24')"), '| horas_dia:', pg.evaluate("window.__db.horas_dia"))
    print('  color baja:', pg.evaluate("getComputedStyle(document.querySelector('[data-fecha=\"2026-11-24\"]')).backgroundColor"))
    pg.click('text=Listo'); pg.click('#infoUsuario'); pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen')
    print('  resumen Horas:', [t.replace('\n',' ') for t in pg.locator('.dato-resumen').all_inner_texts()][:3], '| Bajas:', [t.replace('\n',' ') for t in pg.locator('.dato-resumen').all_inner_texts() if 'Bajas' in t])
    # baja sobre un turno puesto a mano con horas distintas: se conservan
    b.close()
    db3=json.loads(json.dumps(DB)); db3['excepciones'].append({'empleado_id':'e-jefe','fecha':'2026-11-25','codigo':'S'})
    b,pg,errs=nueva(p,JEF,db3)
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-25"]'); pg.wait_for_selector('.opcion-horas')
    print('  25 antes:', txt(pg,'2026-11-25'), pg.locator('.seccion-horas-actual').inner_text())
    pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text='Baja').click(); pg.wait_for_timeout(500)
    print('  25 con B | horas_dia:', pg.evaluate("window.__db.horas_dia"))
    b.close()
    # 6b) LD, J y S a mano suman las horas previstas; sobre un turno de 7 h (I) las conservan
    for cod,txtb in [('Libre','LD'),('Permiso','J'),('Solape','S')]:
        dbx=json.loads(json.dumps(DB)); dbx['excepciones'].append({'empleado_id':'e-jefe','fecha':'2026-11-25','codigo':'I'})
        b,pg,errs=nueva(p,JEF,dbx)
        pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-25"]'); pg.wait_for_selector('.opcion-horas')
        op=pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno', has_text=cod)
        if op.count()==0: print('6b no encuentro', cod); b.close(); continue
        etq=op.first.inner_text().replace('\n','|'); op.first.click(); pg.wait_for_timeout(500)
        print('6b', txtb, '| rejilla:', etq, '| celda:', txt(pg,'2026-11-25'), '| horas_dia:', pg.evaluate("window.__db.horas_dia"), '| computa:', pg.evaluate("horasDeDia(buscarEmpleadoPorId('e-jefe'),'2026-11-25','%s')" % txtb))
        b.close()
    # día sin ajuste previo: LD pasa a sumar las horas del ciclo (N, 8 h); un día F del ciclo suma 0
    b,pg,errs=nueva(p,JEF,DB)
    print('6c horas LD sobre ciclo:', pg.evaluate("[horasDeDia(buscarEmpleadoPorId('e-jefe'),'2026-11-25','LD'), horasDeDia(buscarEmpleadoPorId('e-jefe'),'2026-11-27','LD'), horasDelCiclo('2026-11-27',buscarEmpleadoPorId('e-jefe')).codigo]"))
    b.close()
    b,pg,errs=nueva(p,ADM,DB); pg.click('#infoUsuario'); pg.click('#btnAdminHoras'); pg.wait_for_selector('.fila-horas')
    print('6d filas de turnos en Horas y convenio:', [t.split('\n')[0] for t in pg.locator('.fila-horas-nombre').all_inner_texts()][:12]); b.close()
    # 7) Aviso de cobertura: Jefe Dos tiene B su día de mañana; Jefe Tres no recibe aviso al ponerse ese turno
    b,pg,errs=nueva(p,JEF,DB)
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario')
    print('7 (sin fallos de página):', [e for e in errs if 'ERR_FAILED' not in e]); b.close()
    # 8) Colores CT
    b,pg,errs=nueva(p,CTA,DB)
    get=lambda c: pg.evaluate(f"getComputedStyle(document.documentElement).getPropertyValue('--{c}-bg').trim()")
    print('8 colores:', {c:get(c) for c in ['ct1','ct2','ct3','ct4','ctd','cty']})
    pg.click('#infoUsuario'); pg.click('#btnEditarColores'); pg.wait_for_selector('.paleta')
    pg.locator('.ficha-turno', has_text='CT2').click(); print('  nota CT2:', pg.locator('.nota-colores ~ .admin-nota').first.inner_text())
    pg.locator('.muestra').nth(5).click(); pg.wait_for_timeout(700)
    print('  tras elegir color para CT2:', {c:get(c) for c in ['ct1','ct2','ct3']})
    pg.locator('.ficha-turno', has_text='CT1').click(); pg.locator('.muestra').nth(20).click(); pg.wait_for_timeout(700)
    print('  tras cambiar CT1:', {c:get(c) for c in ['ct1','ct2','ct3','ct4']}); b.close()
    # 9) Móviles pequeños: ¿se ve el resumen?
    for vp in [(360,740),(390,844),(412,915),(375,667),(320,568)]:
        b,pg,errs=nueva(p,JEF,DB,vp=vp)
        cerrado=pg.evaluate("document.documentElement.scrollHeight-window.innerHeight")
        print('9', vp, 'barra visible:', pg.locator('.hoy-desplegable').is_visible(), '| cerrado: body', pg.evaluate("document.body.className"), 'sobra', cerrado)
        pg.click('.hoy-desplegable'); pg.wait_for_timeout(300)
        print('   abierto: resumen visible', pg.locator('.hoy-resumen-caja').is_visible(), 'tarjetas', pg.locator('.mini-dato').count(), '| sobra', pg.evaluate("document.documentElement.scrollHeight-window.innerHeight"))
        pg.reload(); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
        print('   tras recargar sigue abierto:', pg.locator('.hoy-resumen-caja').is_visible())
        if vp==(320,568): pg.screenshot(path='/tmp/t12_320.png')
        b.close()
