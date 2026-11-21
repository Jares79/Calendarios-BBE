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

import json
def opciones_anual(pg): return pg.locator('#colectivoAnual option').all_inner_texts()
def leyenda(pg): return pg.locator('#leyenda li').all_inner_texts()
with sync_playwright() as p:
    # 1) Editor de turnos en móvil: todas las celdas iguales y sin horas
    b,pg,errs=nueva(p,JEF,DB)
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.click('[data-fecha="2026-11-24"]'); pg.wait_for_selector('.seccion-horas-actual')
    cajas=pg.locator('#panelDetalleDia .rejilla-turnos').first.locator('.opcion-turno').evaluate_all("e=>e.map(x=>{const r=x.getBoundingClientRect();return [x.querySelector('.opcion-letra').textContent, Math.round(r.width), Math.round(r.height)]})")
    print('1 celdas del editor (letra, ancho, alto):', cajas)
    print('  tamaños distintos:', len(set((w,h) for _,w,h in cajas)), '| textos de horas en celdas:', pg.locator('#panelDetalleDia .rejilla-turnos .opcion-horas').count())
    box=pg.locator('.seccion-horas-actual').bounding_box(); vh=pg.evaluate('window.innerHeight'); print('  sección de horas visible sin bajar:', box['y']+box['height']<=vh, '| y', round(box['y']), '/', vh)
    pg.screenshot(path='/tmp/t16_editor.png'); b.close()
    # 2) Mi año en escritorio: letra del turno
    b,pg,errs=nueva(p,JEF,DB,vp=(1280,800)); pg.click('#infoUsuario'); pg.click('#btnMiAnio'); pg.wait_for_selector('.cuadro-dia'); pg.wait_for_timeout(400)
    print('2 Mi año escritorio: letras visibles:', pg.locator('.cuadro-letra:visible').count(), '| muestra:', pg.locator('.cuadro-letra').evaluate_all("e=>e.slice(0,12).map(x=>x.textContent).join('')")); pg.screenshot(path='/tmp/t16_anio.png'); b.close()
    b,pg,errs=nueva(p,JEF,DB,vp=(390,780)); pg.click('#infoUsuario'); pg.click('#btnMiAnio'); pg.wait_for_selector('.cuadro-dia'); pg.wait_for_timeout(300)
    print('  Mi año móvil: letras visibles:', pg.locator('.cuadro-letra:visible').count()); b.close()
    # 3) Login sin casillas M T N F
    b,pg,errs=nueva(p,JEF,DB); pg.evaluate("mostrarPantallaLogin()"); pg.wait_for_selector('#inputPin'); print('3 login: casillas M T N F =', pg.locator('.acceso-ritmo').count()); b.close()
    # 4) Leyenda en escritorio, por persona
    for U,nom in [(JEF,'jefe'),(JP,'jornada partida'),(CTA,'correturno')]:
        b,pg,errs=nueva(p,U,DB,vp=(1280,800)); print('4', nom, '| leyenda:', [t.split('\n')[0] for t in leyenda(pg)]); b.close()
    # 5) Calendario anual: visibilidad por persona
    b,pg,errs=nueva(p,JEF,DB); pg.click('#infoUsuario'); pg.wait_for_timeout(300); print('5 Jefe Uno sin permisos:', opciones_anual(pg)); b.close()
    b,pg,errs=nueva(p,ADM,DB); pg.click('#infoUsuario'); pg.wait_for_timeout(300); print('  admin sin ficha ve:', opciones_anual(pg)); 
    pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo'); abre(pg,'Personal a turnos','Jefes')
    pg.locator('.admin-fila', has_text='Jefe Uno').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-anual')
    print('  ficha: casillas anual:', pg.locator('.admin-anual input').evaluate_all("e=>e.map(x=>x.getAttribute('aria-label')+(x.checked?' [x]':'')+(x.disabled?' (bloqueada)':''))"))
    pg.locator('.admin-anual input[aria-label="Ver Personal de jornada partida completo"]').check()
    pg.locator('.admin-anual input[aria-label="Ver Operadores de Control"]').check() if pg.locator('.admin-anual input[aria-label="Ver Operadores de Control"]').count() else None
    pg.click('text=Guardar cambios'); pg.wait_for_timeout(600)
    dbf=pg.evaluate("window.__db"); print('  db anual_ver Jefe Uno:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jefe').anual_ver")); b.close()
    b,pg,errs=nueva(p,JEF,dbf); pg.click('#infoUsuario'); pg.wait_for_timeout(300); print('  Jefe Uno con permisos:', opciones_anual(pg))
    b.close()
    # 6) Disponibilidades y CT desplegable
    b,pg,errs=nueva(p,ADM,DB); pg.click('#infoUsuario'); pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo'); pg.click('text=Disponibilidades y CT'); pg.wait_for_selector('summary')
    print('6 Disponibilidades y CT:', [t.replace('\n',' | ') for t in pg.locator('summary').all_inner_texts()], '| filas visibles al entrar:', pg.locator('.fila-marcas:visible').count()); b.close()
    print('errores:', [e for e in errs if 'ERR_FAILED' not in e])
