from run import *
import json
exec(open('t12.py').read().split("with sync_playwright() as p:")[0].replace("from run import *",""))
def nombres(pg): return [t.replace('\n',' | ') for t in pg.locator('summary').all_inner_texts()]
with sync_playwright() as p:
    # 1) Pantalla de acceso: recordatorio del PIN
    b,pg,errs=nueva(p,ADM,DB); pg.evaluate("mostrarPantallaLogin()"); pg.wait_for_selector('#inputPin')
    print('1 PIN placeholder:', pg.get_attribute('#inputPin','placeholder'), '| maxlength:', pg.get_attribute('#inputPin','maxlength'), '| ayuda:', pg.locator('.campo-ayuda').inner_text()); pg.screenshot(path='/tmp/t13_login.png'); b.close()
    # 2) Admin: dos categorías, subgrupos, crear / renombrar / borrar y asignar
    b,pg,errs=nueva(p,ADM,DB)
    pg.click('#infoUsuario'); pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo')
    print('2 categorías:', nombres(pg)); 
    pg.locator('summary', has_text='jornada partida').first.click()
    print('  tras abrir jornada partida:', nombres(pg))
    pg.fill('.admin-form-subgrupo input', 'Mantenimiento'); pg.click('text=Crear subgrupo'); pg.wait_for_timeout(600)
    print('  tras crear:', nombres(pg), '| aviso:', pg.locator('#adminAviso').inner_text())
    pg.fill('.admin-form-subgrupo input', 'mantenimiento'); pg.click('text=Crear subgrupo'); pg.wait_for_timeout(400); print('  repetido:', pg.locator('#adminAviso').inner_text())
    # asignar a Partida Uno el subgrupo nuevo
    abre(pg,'jornada partida','Sin subgrupo')
    pg.locator('.admin-fila', has_text='Partida Uno').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-formulario')
    print('  select: grupos', pg.locator('.admin-formulario select optgroup').evaluate_all("els=>els.map(e=>e.label+': '+[...e.querySelectorAll('option')].map(o=>o.textContent).join(', '))"))
    pg.locator('.admin-formulario select').first.select_option(label='Mantenimiento'); pg.click('text=Guardar cambios'); pg.wait_for_timeout(600)
    print('  db colectivo Partida Uno:', pg.evaluate("window.__db.empleados.find(e=>e.id=='e-jp').colectivo"), '| nombres:', nombres(pg))
    # borrar con empleados -> error; renombrar; mover de vuelta y borrar
    abre(pg,'jornada partida','Mantenimiento')
    pg.once('dialog', lambda d: d.accept()); pg.locator('.admin-subdesplegable', has_text='Mantenimiento').locator('text=Borrar subgrupo').click(); pg.wait_for_timeout(500); print('  borrar con empleados:', pg.locator('#adminAviso').inner_text())
    pg.once('dialog', lambda d: d.accept('Mantenimiento general')); pg.locator('.admin-subdesplegable', has_text='Mantenimiento').locator('text=Cambiar nombre').click(); pg.wait_for_timeout(600)
    print('  renombrado:', [n for n in nombres(pg) if 'Manten' in n], '| aviso:', pg.locator('#adminAviso').inner_text())
    pg.locator('.admin-fila', has_text='Partida Uno').locator('text=Editar').first.click(); pg.wait_for_selector('.admin-formulario')
    pg.locator('.admin-formulario select').first.select_option(label='Sin subgrupo'); pg.click('text=Guardar cambios'); pg.wait_for_timeout(600)
    abre(pg,'jornada partida','Mantenimiento general')
    pg.once('dialog', lambda d: d.accept()); pg.locator('.admin-subdesplegable', has_text='Mantenimiento general').locator('text=Borrar subgrupo').click(); pg.wait_for_timeout(600)
    print('  borrado:', [n for n in nombres(pg) if 'Manten' in n], '| colectivos db:', pg.evaluate("window.__db.colectivos.map(c=>c.codigo)"))
    # 3) Solapes del colectivo
    abre(pg,'Personal a turnos','Jefes')
    print('3 solapes jefes:', pg.locator('input[aria-label="Solapes al año de Jefes de Turno"]').input_value(), '| en correturnos hay campo:', pg.locator('input[aria-label="Solapes al año de Correturnos"]').count())
    pg.locator('input[aria-label="Solapes al año de Jefes de Turno"]').fill('4'); pg.locator('.admin-subdesplegable', has_text='Jefes').locator('text=Guardar').first.click(); pg.wait_for_timeout(400)
    print('  db dias_solape jefes:', pg.evaluate("window.__db.colectivos.find(c=>c.codigo=='jefes').dias_solape"), '| aviso:', pg.locator('#adminAviso').inner_text())
    pg.screenshot(path='/tmp/t13_admin.png'); dbf=pg.evaluate("window.__db"); b.close()
    # 4) Resumen con solapes: jefe con 2 solapes puestos
    dbf['excepciones'].append({'empleado_id':'e-jefe','fecha':'2026-06-10','codigo':'S'}); dbf['excepciones'].append({'empleado_id':'e-jefe','fecha':'2026-06-11','codigo':'S'})
    b,pg,errs=nueva(p,JEF,dbf); print('4 resumen jefe:', resumen(pg), '| subtítulo:', pg.locator('.hoy-resumen-caja .hoy-subtitulo').inner_text()); pg.screenshot(path='/tmp/t13_resumen.png'); b.close()
    dbf['colectivos'][0]['dias_solape']=0
    b,pg,errs=nueva(p,JEF,dbf); print('  con 0 solapes:', [t for t in resumen(pg) if 'Solapes' in t]); b.close()
    b,pg,errs=nueva(p,CTA,dbf); print('  correturno (sin solapes):', [t for t in resumen(pg) if 'Solapes' in t]); b.close()
