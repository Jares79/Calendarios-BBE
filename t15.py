from run import *
import json
def nueva(p, user, db, hoy='2026-11-16T10:00:00', vp=(390,780)):
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__DB_INIT='+json.dumps(db) if db else '')); pg.clock.install(time=hoy); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector(ESPERA); pg.wait_for_timeout(600)
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
def vista(pg): return 'resultado' if pg.evaluate("document.body.classList.contains('vista-resultado')") else 'inicio'
ESPERA='#panelUsuario'
ADS={'iniciales':'ADMIN','rol':'administrador','empleadoId':None}
with sync_playwright() as p:
    b,pg,errs=nueva(p,ADS,DB)
    print('1 inicio:', 'calendario visible:', pg.locator('#cardCalendario').is_visible(), '| resumen hoy visible:', pg.locator('#resumenHoy').is_visible(), '| menú abierto:', pg.locator('#panelUsuario').is_visible(), '| cabecera:', pg.locator('#infoUsuario').inner_text().replace('\n',' '))
    print('  botones: Mi año', pg.locator('#btnMiAnio').is_visible(), '| Editar calendario', pg.locator('#btnEditarCalendario').is_visible(), '| Buscar', pg.locator('#btnToggleBusqueda').is_visible(), '| Anual', pg.locator('#btnToggleAnual').is_visible(), '| Horas', pg.locator('#btnHoras').is_visible(), '| Empleados', pg.locator('#btnAdminEmpleados').is_visible())
    pg.screenshot(path='/tmp/t15_inicio.png'); print('  estado atrás:', est(pg))
    pg.click('#infoUsuario'); pg.wait_for_timeout(300); print('2 tocar la cabecera no cierra el menú:', pg.locator('#panelUsuario').is_visible())
    # Horas del administrador sin ficha
    pg.click('#btnHoras'); pg.wait_for_selector('.tarjetas-resumen'); pg.wait_for_timeout(500)
    print('3 Horas:', vista(pg), '| tarjetas:', pg.locator('.dato-resumen').count(), '| persona elegida:', pg.locator('select[aria-label="Persona"]').input_value() != '', '| estado', est(pg))
    pg.click('text=Volver'); pg.wait_for_timeout(600); print('  Volver -> inicio:', vista(pg), '| menú abierto de nuevo:', pg.locator('#panelUsuario').is_visible(), '| calendario oculto:', not pg.locator('#cardCalendario').is_visible(), est(pg))
    # Empleados y accesos
    pg.click('#btnAdminEmpleados'); pg.wait_for_selector('.admin-grupo'); pg.wait_for_timeout(400); print('4 Empleados:', vista(pg), est(pg))
    pg.go_back(); pg.wait_for_timeout(600); print('  atrás -> inicio con menú:', vista(pg), pg.locator('#panelUsuario').is_visible(), est(pg))
    # Ajustes (sin horas anuales)
    pg.click('#btnAjustes'); pg.wait_for_timeout(600); print('5 Ajustes:', vista(pg), '| horas anuales en ajustes:', pg.locator('.ajustes-horas input').count())
    pg.click('text=Volver'); pg.wait_for_timeout(500)
    # Calendario anual
    pg.click('#btnToggleAnual'); pg.wait_for_timeout(500); print('6 anual abre sección:', pg.locator('#seccionAnual').is_visible() if pg.locator('#seccionAnual').count() else 'n/a')
    print('errores de página:', [e for e in errs if 'ERR_FAILED' not in e]); b.close()
    # Contraste: administrador CON ficha sigue igual
    ESPERA='.dia-calendario'
    b,pg,errs=nueva(p,{'iniciales':'JEF','rol':'administrador','empleadoId':'e-jefe'},DB)
    print('7 admin con ficha: calendario', pg.locator('#cardCalendario').is_visible(), '| menú cerrado', not pg.locator('#panelUsuario').is_visible(), '| Mi año', pg.locator('#btnMiAnio').is_visible() if pg.locator('#panelUsuario').is_visible() else 'menú cerrado'); b.close()
