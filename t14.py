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

def est(pg): return pg.evaluate("estadoAtras()")
def vista(pg): return 'resultado' if pg.evaluate("document.body.classList.contains('vista-resultado')") else 'calendario'
with sync_playwright() as p:
    b,pg,errs=nueva(p,JEF,DB)
    url0=pg.url; print('0 inicio', est(pg), vista(pg))
    # 1) Salir pide confirmación
    pg.click('.cerrarSesion'); pg.wait_for_selector('.dialogo-salir')
    print('1 diálogo:', pg.locator('.dialogo-salir').inner_text().replace('\n',' | '), '| foco en:', pg.evaluate("document.activeElement.textContent"), '| menú abierto:', pg.locator('#panelUsuario').is_visible())
    pg.wait_for_timeout(500); pg.screenshot(path='/tmp/t14_dialogo.png'); print('  estado:', est(pg))
    pg.go_back(); pg.wait_for_timeout(300); print('  atrás cierra el diálogo:', pg.locator('.dialogo-salir').count()==0, '| misma página:', pg.url==url0, est(pg))
    pg.click('.cerrarSesion'); pg.wait_for_selector('.dialogo-salir'); pg.click('.dialogo-salir >> text=Cancelar'); pg.wait_for_timeout(500)
    print('  cancelar:', pg.locator('.dialogo-salir').count()==0, est(pg))
    pg.click('.cerrarSesion'); pg.wait_for_selector('.dialogo-salir'); pg.keyboard.press('Escape'); pg.wait_for_timeout(500); print('  Esc:', pg.locator('.dialogo-salir').count()==0, est(pg))
    pg.evaluate("window.__salio=false; window.cerrarSesion=async()=>{window.__salio=true}")
    pg.click('.cerrarSesion'); pg.wait_for_selector('.dialogo-salir'); pg.click('.dialogo-salir >> text=Cerrar sesión'); pg.wait_for_timeout(300); print('  confirmar llama a cerrarSesion:', pg.evaluate("window.__salio"))
    pg.click('.dialogo-salir >> text=Cancelar') if pg.locator('.dialogo-salir >> text=Cancelar').count() else None
    pg.wait_for_timeout(500)
    # 2) Menú -> pantalla de resultados -> atrás
    pg.click('#infoUsuario'); pg.wait_for_timeout(500); print('2 menú abierto:', est(pg))
    pg.go_back(); pg.wait_for_timeout(500); print('  atrás cierra el menú:', pg.locator('#panelUsuario').is_visible()==False, est(pg), pg.url==url0)
    pg.click('#infoUsuario'); pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen'); pg.wait_for_timeout(500); print('  Horas abierta:', vista(pg), est(pg))
    pg.go_back(); pg.wait_for_timeout(600); print('  atrás vuelve al calendario:', vista(pg), est(pg), '| misma página:', pg.url==url0)
    # 3) Cerrar con el botón Volver deja el historial a nivel
    pg.click('#infoUsuario'); pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen'); pg.wait_for_timeout(500)
    pg.click('text=Volver'); pg.wait_for_timeout(700); print('3 tras Volver:', vista(pg), est(pg), '| menú:', pg.locator('#panelUsuario').is_visible())
    # 4) Hoja de un día dentro de resultados / calendario
    pg.click('[data-fecha="2026-11-20"]'); pg.wait_for_selector('#panelDetalleDia'); pg.wait_for_timeout(500); print('4 hoja del día:', est(pg))
    pg.go_back(); pg.wait_for_timeout(500); print('  atrás cierra la hoja:', pg.locator('#panelDetalleDia').count()==0, est(pg))
    # 5) Modo edición: hoja + modo
    pg.click('#infoUsuario'); pg.click('#btnEditarCalendario'); pg.wait_for_timeout(500); print('5 modo edición:', est(pg), pg.evaluate("modoEdicion"))
    pg.click('[data-fecha="2026-11-24"]'); pg.wait_for_selector('#panelDetalleDia'); pg.wait_for_timeout(500); print('  con hoja:', est(pg))
    pg.go_back(); pg.wait_for_timeout(500); print('  atrás 1: hoja cerrada', pg.locator('#panelDetalleDia').count()==0, '| sigue en edición:', pg.evaluate("modoEdicion"), est(pg))
    pg.go_back(); pg.wait_for_timeout(500); print('  atrás 2: edición terminada:', pg.evaluate("modoEdicion")==False, est(pg), '| misma página:', pg.url==url0)
    # 6) Varias pantallas seguidas y Volver al final: nada queda colgado
    for i in range(3):
        pg.click('#infoUsuario'); pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen'); pg.wait_for_timeout(300); pg.click('text=Volver'); pg.wait_for_timeout(500)
    print('6 tras 3 aperturas/cierres:', est(pg), vista(pg), '| misma página:', pg.url==url0)
    print('errores de página:', [e for e in errs if 'ERR_FAILED' not in e])
    b.close()
