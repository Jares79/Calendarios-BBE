from run import *
import json
# Fase 18: ver el calendario de otra persona (mitad de arriba de la celda del mes)
def nueva(p, user, db, vp=(390,780), hoy='2026-11-16T10:00:00'):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(600)
    return b,pg,errs
def txt(pg,d): return pg.locator(f'[data-fecha="{d}"]').inner_text().replace('\n','|')
ADM={'iniciales':'ADM','rol':'administrador','empleadoId':'e-jefe'}
JEF={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}
JP ={'iniciales':'JPA','rol':'empleado','empleadoId':'e-jp'}
EMP=[
 {'id':'e-jefe','iniciales':'JEF','nombre':'Jefe Uno','colectivo':'jefes','inicio':'2026-03-02','orden':1,'activo':True,'marcas':[],'ver_calendario_de':'e-jp'},
 {'id':'e-jefe2','iniciales':'JE2','nombre':'Jefe Dos','colectivo':'jefes','inicio':'2026-03-04','orden':2,'activo':True,'marcas':[]},
 {'id':'e-jp','iniciales':'JPA','nombre':'Partida Uno','colectivo':'jornada','inicio':'2026-01-05','orden':1,'activo':True,'marcas':['D']}]
DB={'empleados':EMP}
with sync_playwright() as p:
    # 1) El jefe que ve a Partida Uno: arriba lo de ella (D la semana del 16, su turno otras semanas), abajo lo suyo
    b,pg,errs=nueva(p,JEF,DB)
    print('1 semana con D (16-11):', txt(pg,'2026-11-17'), '| clases:', pg.locator('[data-fecha="2026-11-17"]').get_attribute('class'))
    print('  top class:', pg.locator('[data-fecha="2026-11-17"] .mitad-arriba').get_attribute('class'))
    print('  semana sin D (23-11):', txt(pg,'2026-11-24'), '| top class:', pg.locator('[data-fecha="2026-11-24"] .mitad-arriba').get_attribute('class'))
    print('  aria:', pg.locator('[data-fecha="2026-11-17"]').get_attribute('aria-label'))
    # 3) ficha del día
    pg.click('[data-fecha="2026-11-17"]'); pg.wait_for_selector('#panelDetalleDia')
    print('3 ficha:', pg.locator('#panelDetalleDia .detalle-linea').all_inner_texts()); pg.keyboard.press('Escape'); b.close()
    # Sin el ajuste, la celda es normal
    b,pg,errs=nueva(p,JP,DB); print('0 la otra persona (sin ajuste):', txt(pg,'2026-11-24'), '| con-marca por su D:', 'con-marca' in pg.locator('[data-fecha="2026-11-24"]').get_attribute('class')); b.close()
    # 2) Administrador: pantalla de marcas
    b,pg,errs=nueva(p,ADM,DB); pg.click('#infoUsuario'); pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo'); pg.click('text=Disponibilidades y CT'); pg.wait_for_selector('summary')
    for s in pg.locator('summary').all(): 
        if s.evaluate("e=>!e.parentElement.open"): s.click()
    fila=lambda n: pg.locator('.fila-marcas', has=pg.locator('strong', has_text=n))
    g=lambda f: f.locator('button.fila-marcas-guardar')
    print('2 botones Guardar por fila:', pg.locator('button.fila-marcas-guardar').count(), '| botón Guardar de abajo:', pg.locator('.fila-guardar').count(), '| todos desactivados al entrar:', pg.locator('button.fila-marcas-guardar:enabled').count()==0)
    f=fila('Jefe Uno'); print('  Jefe Uno: selector =', f.locator('select').input_value(), '| casillas deshabilitadas:', f.locator('input[type=checkbox]:disabled').count())
    f=fila('Jefe Dos'); print('  Jefe Dos: selector habilitado:', f.locator('select').is_enabled(), '| casillas habilitadas:', f.locator('input[type=checkbox]:enabled').count())
    f.locator('select').select_option(value='e-jp'); print('  al elegir persona -> casillas deshabilitadas:', f.locator('input[type=checkbox]:disabled').count(), '| su Guardar activo:', g(f).is_enabled(), '| el de Jefe Uno sigue desactivado:', g(fila('Jefe Uno')).is_disabled())
    f.locator('select').select_option(value=''); print('  al volver a "nadie" -> Guardar desactivado:', g(f).is_disabled())
    f.locator('input[type=checkbox]').first.check(); print('  al marcar D -> selector deshabilitado:', f.locator('select').is_disabled())
    f.locator('input[type=checkbox]').first.uncheck(); f.locator('select').select_option(value='e-jp')
    pg.screenshot(path='admin_fila_390.png')
    g(f).click(); pg.wait_for_timeout(400)
    print('  guardado:', g(f).inner_text(), '| desactivado:', g(f).is_disabled(), '| db Jefe Dos ve a:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jefe2').ver_calendario_de"))
    # Pasar de ver a marca en Jefe Uno (solo se guarda esa fila)
    f=fila('Jefe Uno'); f.locator('select').select_option(value=''); f.locator('input[type=checkbox]').first.check(); g(f).click(); pg.wait_for_timeout(400)
    print('  Jefe Uno pasa a D:', g(f).inner_text(), '| db:', pg.evaluate("[window.__db.empleados.find(e=>e.id=='e-jefe').ver_calendario_de, window.__db.empleados.find(e=>e.id=='e-jefe').marcas]"), '| Jefe Dos intacto:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jefe2').ver_calendario_de"))
    # Cambiar de nuevo tras guardar reactiva el botón
    f.locator('input[type=checkbox]').first.uncheck(); print('  tras un cambio nuevo, Guardar vuelve a activarse:', g(f).is_enabled(), '| texto:', g(f).inner_text())
    b.close()
    # Móvil estrecho y ordenador: la celda partida se ve bien
    for vp in [(360,640),(1200,800)]:
        b,pg,errs=nueva(p,JEF,DB,vp=vp); pg.screenshot(path=f'ver_otra_{vp[0]}.png'); b.close()
    print('errores:', [e for e in errs if 'ERR_FAILED' not in e])
