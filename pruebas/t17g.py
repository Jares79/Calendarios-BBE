# Fase 16 (alternativa B): Google Calendar con botón de sincronizar en "Hoy", estrella y copia local. Google se simula.
from run import *
import json, re, urllib.parse
JEF={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}
GIS="""window.__gis={revocado:0,pedidos:[],rechazar:false};
window.google={accounts:{oauth2:{initTokenClient:(cfg)=>({requestAccessToken(o){window.__gis.pedidos.push(o.prompt);
  setTimeout(()=>window.__gis.rechazar?cfg.error_callback({type:'popup_closed'}):cfg.callback({access_token:'tok-'+window.__gis.pedidos.length,expires_in:3600,scope:cfg.scope}),10)}}),
  hasGrantedAllScopes:()=>true, revoke:(t,cb)=>{window.__gis.revocado++;cb&&cb({})}}}};"""
CALS={'items':[{'id':'jefe@gmail.com','summary':'Personal','primary':True},{'id':'fam@group','summary':'Familia','summaryOverride':'Mi familia'}]}
def eventos(version):
    ev={'jefe@gmail.com':[
      {'id':'a1','summary':'Dentista','start':{'dateTime':'2026-11-24T10:00:00+01:00'},'end':{'dateTime':'2026-11-24T11:00:00+01:00'}},
      {'id':'a2','summary':'Cumple <img src=x onerror=window.__xss=1>','start':{'date':'2026-11-20'},'end':{'date':'2026-11-21'}}],
     'fam@group':[{'id':'b1','summary':'Viaje','start':{'date':'2026-11-26'},'end':{'date':'2026-11-29'}}]}
    if version==2:   # el dentista se mueve de día y aparece uno nuevo
        ev['jefe@gmail.com'][0]={'id':'a1','summary':'Dentista','start':{'dateTime':'2026-11-25T12:30:00+01:00'},'end':{'dateTime':'2026-11-25T13:00:00+01:00'}}
    return ev
class Mundo:
    def __init__(self): self.version=1; self.fallo=None; self.llamadas=[]
def nueva(p, user, cliente=True, mundo=None, ctx=None, b=None):
    mundo=mundo or Mundo()
    if b is None: b=p.chromium.launch()
    if ctx is None: ctx=b.new_context(viewport={'width':390,'height':780}, timezone_id='Europe/Madrid')
    pg=ctx.new_page(); errs=[]; reqs=[]
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e))); pg.on('request', lambda r: reqs.append(r.url))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(body=GIS, content_type='application/javascript'))
    def api(r):
        u=r.request.url; auth=r.request.headers.get('authorization','')
        if mundo.fallo: return r.fulfill(status=mundo.fallo, body='{}')
        if not auth.startswith('Bearer tok-'): return r.fulfill(status=403, body='{}')
        if '/calendarList' in u: return r.fulfill(body=json.dumps(CALS), content_type='application/json')
        cid=urllib.parse.unquote(re.search(r'/calendars/([^/]+)/events',u).group(1)); mundo.llamadas.append(u)
        return r.fulfill(body=json.dumps({'items':eventos(mundo.version).get(cid,[])}), content_type='application/json')
    pg.route('https://www.googleapis.com/calendar/v3/**', api)
    pg.add_init_script('window.__USER='+json.dumps(user)+(';window.__GOOGLE_CLIENT_ID="cliente-prueba"' if cliente else '')); pg.clock.install(time='2026-11-16T10:00:00'); pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    return b,ctx,pg,errs,reqs,mundo
def cel(pg,f): return pg.locator(f'.dia-calendario[data-fecha="{f}"]')
def estrellas(pg): return pg.evaluate("[...document.querySelectorAll('.dia-calendario.con-google')].map(c=>c.dataset.fecha.slice(8))")
def vincular(pg):
    pg.evaluate("verAjustes()"); pg.wait_for_selector('.ajustes-google button'); pg.click('.ajustes-google button'); pg.wait_for_selector('.google-cal-fila')
    pg.locator('.google-cal-fila input').nth(1).check(); pg.click('.ajustes-google >> text=Guardar'); pg.wait_for_timeout(700)
    pg.click('.resultado-cabecera >> text=Volver'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
with sync_playwright() as p:
    # 1 Sin cliente configurado: nada de Google
    b,ctx,pg,errs,reqs,m=nueva(p,JEF,cliente=False); pg.evaluate("verAjustes()"); pg.wait_for_timeout(300)
    print('1 sin configurar: Ajustes:', pg.locator('.ajustes-google h3').count(), '| botón en Hoy:', pg.locator('.hoy-google').count(), '| peticiones a Google:', [r for r in reqs if 'accounts.google' in r or 'googleapis.com/calendar' in r]); b.close()
    # 2 Vincular desde Ajustes (el script se descarga por adelantado al abrir Ajustes)
    b,ctx,pg,errs,reqs,m=nueva(p,JEF); antes=any('gsi/client' in r for r in reqs)
    pg.evaluate("verAjustes()"); pg.wait_for_selector('.ajustes-google button'); pg.wait_for_timeout(200)
    print('2 script de Google antes de abrir Ajustes:', antes, '| al abrirlos:', any('gsi/client' in r for r in reqs), '| sin vincular, botón en Hoy:', pg.locator('.hoy-google').count())
    pg.click('.ajustes-google button'); pg.wait_for_selector('.google-cal-fila')
    print('3 calendarios:', pg.locator('.google-cal-fila span').all_inner_texts(), '| marcados:', pg.evaluate("[...document.querySelectorAll('.google-cal-fila input')].map(i=>i.checked)"), '| prompt:', pg.evaluate("window.__gis.pedidos"))
    pg.locator('.google-cal-fila input').nth(1).check(); pg.click('.ajustes-google >> text=Guardar'); pg.wait_for_timeout(700)
    print('4 guardado en el dispositivo:', pg.evaluate("localStorage.getItem('bbe-google-e-jefe')")); print('  peticiones de eventos (3 meses × 2 calendarios):', len(m.llamadas))
    pg.click('.resultado-cabecera >> text=Volver'); pg.wait_for_selector('.dia-calendario'); pg.wait_for_timeout(500)
    print('5 estrellas (días):', estrellas(pg), '| botón en Hoy:', pg.locator('.hoy-google .hoy-google-texto').inner_text())
    pg.screenshot(path='google_hoy.png', clip={'x':0,'y':60,'width':390,'height':520})
    cel(pg,'2026-11-24').click(); pg.wait_for_selector('.google-evento')
    print('6 ficha 24 SIN pulsar nada:', pg.locator('.google-evento').all_inner_texts(), '| pie:', pg.locator('.google-pie .google-estado').inner_text())
    pg.click('.btn-cerrar'); cel(pg,'2026-11-20').click(); pg.wait_for_selector('.google-evento')
    print('  ficha 20:', pg.locator('.google-evento').all_inner_texts(), '| XSS:', pg.evaluate("!!window.__xss"), '| html interpretado:', pg.locator('.google-titulo img').count())
    pg.click('.btn-cerrar'); cel(pg,'2026-11-27').click(); pg.wait_for_selector('.google-evento'); print('  ficha 27 (viaje 3 días):', pg.locator('.google-evento').all_inner_texts())
    pg.click('.btn-cerrar'); cel(pg,'2026-11-18').click(); pg.wait_for_selector('.google-vacio'); print('  ficha 18:', pg.locator('.google-vacio').inner_text())
    print('7 nada en Supabase:', 'Dentista' not in json.dumps(pg.evaluate("window.__db")), '| copia local:', 'Dentista' in (pg.evaluate("localStorage.getItem('bbe-google-e-jefe-ev')") or ''))
    pg.click('.btn-cerrar'); pg.evaluate("sessionStorage.clear()"); estado={k:pg.evaluate(f"localStorage.getItem('{k}')") for k in ['bbe-google-e-jefe','bbe-google-e-jefe-ev']}
    # 8 Recargar la app (mismo dispositivo): estrellas y eventos al instante, sin llamar a Google
    ctx2=b.new_context(viewport={'width':390,'height':780}, timezone_id='Europe/Madrid', storage_state=ctx.storage_state()); 
    b2,ctx2,pg2,errs2,reqs2,m2=nueva(p,JEF,b=b,ctx=ctx2); pg2.wait_for_timeout(400)
    print('8 tras reabrir: estrellas:', estrellas(pg2), '| peticiones de eventos a Google:', len(m2.llamadas), '| permisos pedidos:', pg2.evaluate("window.__gis.pedidos"), '| botón:', pg2.locator('.hoy-google .hoy-google-texto').inner_text())
    cel(pg2,'2026-11-24').click(); pg2.wait_for_selector('.google-evento'); print('  ficha 24 al abrir:', pg2.locator('.google-evento').all_inner_texts()[0].replace('\n',' '))
    # 9 Los eventos cambian en Google: se actualizan con el botón de la ficha y la ficha se repinta sola
    m2.version=2; pg2.click('.google-actualizar'); pg2.wait_for_timeout(700)
    print('9 tras Actualizar en la ficha: eventos del 24:', pg2.locator('.google-vacio').count() and pg2.locator('.google-vacio').inner_text(), '| estrellas:', estrellas(pg2), '| permisos:', pg2.evaluate("window.__gis.pedidos"))
    pg2.click('.btn-cerrar'); cel(pg2,'2026-11-25').click(); pg2.wait_for_selector('.google-evento'); print('  ficha 25 (evento movido):', pg2.locator('.google-evento').all_inner_texts()[0].replace('\n',' '))
    # 10 Botón en Hoy: mismo resultado y animación
    pg2.click('.btn-cerrar'); m2.version=1; n=len(m2.llamadas); pg2.click('.hoy-google'); pg2.wait_for_timeout(700)
    print('10 botón Hoy: llamadas nuevas:', len(m2.llamadas)-n, '| estrellas:', estrellas(pg2), '| etiqueta:', pg2.locator('.hoy-google .hoy-google-texto').inner_text(), '| permisos (no pide otro, sigue vigente):', pg2.evaluate("window.__gis.pedidos"))
    # 11 Cambiar de mes con permiso vigente: se carga solo
    n=len(m2.llamadas); pg2.evaluate("mesSiguiente()"); pg2.wait_for_timeout(600); pg2.evaluate("mesSiguiente()"); pg2.wait_for_timeout(600)
    print('11 dos meses adelante (uno ya sincronizado, otro nuevo): llamadas nuevas:', len(m2.llamadas)-n)
    pg2.evaluate("mesAnterior()"); pg2.evaluate("mesAnterior()"); pg2.wait_for_timeout(300)
    # 12 Mes sin sincronizar y sin permiso
    b3,ctx3,pg3,errs3,reqs3,m3=nueva(p,JEF,b=b,ctx=b.new_context(viewport={'width':390,'height':780}, timezone_id='Europe/Madrid', storage_state=ctx.storage_state()))
    pg3.evaluate("fechaCalendario=new Date(2027,5,1); verMiCalendario()"); pg3.wait_for_timeout(300); cel(pg3,'2027-06-10').click(); pg3.wait_for_selector('.google-ver')
    print('12 mes nunca sincronizado: aviso:', pg3.locator('.google-dia .google-estado').inner_text(), '| botón:', pg3.locator('.google-ver').inner_text())
    # 13 Cancelar la ventana de Google
    pg3.click('.btn-cerrar'); pg3.evaluate("window.__gis.rechazar=true"); pg3.evaluate("fechaCalendario=new Date(2026,10,1); verMiCalendario()"); pg3.wait_for_timeout(200); pg3.click('.hoy-google'); pg3.wait_for_timeout(500)
    print('13 ventana cancelada: toast:', pg3.locator('#toast').inner_text(), '| etiqueta:', pg3.locator('.hoy-google .hoy-google-texto').inner_text(), '| botón activo:', pg3.locator('.hoy-google').is_enabled())
    # 14 Google responde 401 con permiso
    pg3.evaluate("window.__gis.rechazar=false"); m3.fallo=401; pg3.click('.hoy-google'); pg3.wait_for_timeout(700)
    print('14 Google 401: toast:', pg3.locator('#toast').inner_text(), '| estrellas conservadas:', estrellas(pg3)); m3.fallo=None
    # 15 Desvincular borra también la copia local
    pg3.evaluate("verAjustes()"); pg3.wait_for_selector('.ajustes-google >> text=Desvincular'); pg3.click('.ajustes-google >> text=Desvincular'); pg3.wait_for_timeout(200)
    print('15 desvincular: config:', pg3.evaluate("localStorage.getItem('bbe-google-e-jefe')"), '| copia:', pg3.evaluate("localStorage.getItem('bbe-google-e-jefe-ev')"), '| revocado:', pg3.evaluate("window.__gis.revocado"))
    pg3.click('.resultado-cabecera >> text=Volver'); pg3.wait_for_selector('.dia-calendario'); pg3.wait_for_timeout(300)
    print('  estrellas:', estrellas(pg3), '| botón Hoy:', pg3.locator('.hoy-google').count(), '| estrellas en DOM:', pg3.locator('.estrella-google').count())
    print('errores:', errs+errs2+errs3); b.close()
    # 16 Familiar: nada
    b,ctx,pg,errs,reqs,m=nueva(p,{'iniciales':'JEF_F','rol':'familiar','empleadoId':'e-jefe'}); pg.evaluate("verAjustes()"); pg.wait_for_timeout(300)
    print('16 familiar: Ajustes:', pg.locator('.ajustes-google h3').count(), '| botón:', pg.locator('.hoy-google').count()); b.close()
