# Fase 17: avisos push (con interruptor en Ajustes) y páginas legales. El navegador y Google/Apple se simulan.
from run import *
import json
VAPID='BNsGWA1JERZ_wKcTLIDWWUZeeq4Tdj7pBYI1yTrrKVWfh74eN6mtbCuFg-Z0Ecle2DoXnFvnozc6da_gF2X4_lQ'
JEF={'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'}
FAKE_SW="""
(()=>{ const reg={pushManager:{_sub:null, async getSubscription(){return this._sub},
  async subscribe(o){ window.__subOpts={ult:o.applicationServerKey.length, visible:o.userVisibleOnly}; const pm=this;
    this._sub={endpoint:'https://push.example.net/send/abc123', toJSON(){return {endpoint:this.endpoint, keys:{p256dh:'BPublicKeyFake1234567890', auth:'authFake1234'}}}, async unsubscribe(){ pm._sub=null; window.__baja=(window.__baja||0)+1; return true;}}; return this._sub; }}};
  Object.defineProperty(navigator.serviceWorker,'ready',{get:()=>Promise.resolve(reg)});
  window.__PERM = window.__BLOQUEADO ? 'denied' : 'default';
  Object.defineProperty(Notification,'permission',{get:()=>window.__PERM, configurable:true});
  Notification.requestPermission = async()=>{ window.__PERM = window.__DENEGAR ? 'denied' : 'granted'; return window.__PERM; };
})();"""
def nueva(p, user, vapid=True, denegar=False, ua=None, url='http://127.0.0.1:8765/index.html', bloqueado=False, espera='.dia-calendario'):
    b=p.chromium.launch(); kw={'viewport':{'width':390,'height':780},'timezone_id':'Europe/Madrid'}
    if ua: kw['user_agent']=ua; kw['has_touch']=True; kw['is_mobile']=True
    ctx=b.new_context(**kw)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript')); pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user)+(f';window.__PUSH_VAPID="{VAPID}"' if vapid else '')+(';window.__DENEGAR=1' if denegar else '')+(';window.__BLOQUEADO=1' if bloqueado else '')+';'+FAKE_SW)
    pg.clock.install(time='2026-11-16T10:00:00'); pg.goto(url); pg.wait_for_selector(espera); pg.wait_for_timeout(500)
    return b,pg,errs
def ajustes(pg): pg.evaluate("verAjustes()"); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b,pg,errs=nueva(p,JEF,vapid=False); ajustes(pg)
    print('1 sin clave VAPID: sección avisos:', pg.locator('.ajustes-push h3').count(), '| enlaces legales en Ajustes:', pg.locator('.ajustes-legal a').all_inner_texts()); b.close()
    b,pg,errs=nueva(p,JEF); ajustes(pg)
    print('2 configurado: título:', pg.locator('.ajustes-push h3').inner_text(), '| interruptor activado:', pg.locator('#pushInterruptor').is_checked(), '| detalle visible:', pg.locator('.push-detalle').is_visible())
    pg.check('#pushInterruptor'); pg.wait_for_timeout(500)
    db=pg.evaluate("window.__db.push_suscripciones")
    print('3 activar: filas en la base de datos:', len(db), '| endpoint:', db[0]['endpoint'] if db else None, '| clave del servidor (bytes):', pg.evaluate("window.__subOpts"), '| detalle visible:', pg.locator('.push-detalle').is_visible(), '| casillas:', pg.locator('#pushCambios').is_checked(), pg.locator('#pushMensajes').is_checked())
    pg.uncheck('#pushMensajes'); pg.wait_for_timeout(300)
    f=pg.evaluate("window.__db.push_suscripciones[0]"); print('4 desmarcar mensajes: cambios', f['avisar_cambios'], '| mensajes', f['avisar_mensajes'])
    pg.click('.push-probar'); pg.wait_for_timeout(300); print('5 aviso de prueba: función llamada:', pg.evaluate("window.__invocado"), '| toast:', pg.locator('#toast').inner_text())
    ajustes(pg); print('6 al volver a abrir Ajustes: interruptor', pg.locator('#pushInterruptor').is_checked(), '| mensajes', pg.locator('#pushMensajes').is_checked(), '(recuerda lo guardado)')
    pg.uncheck('#pushInterruptor'); pg.wait_for_timeout(400)
    print('7 desactivar: filas:', len(pg.evaluate("window.__db.push_suscripciones")), '| baja en el navegador:', pg.evaluate("window.__baja"), '| detalle oculto:', pg.locator('.push-detalle').is_hidden())
    pg.check('#pushInterruptor'); pg.wait_for_timeout(500); n1=len(pg.evaluate("window.__db.push_suscripciones"))
    pg.evaluate("olvidarPushAlCerrarSesion()"); pg.wait_for_timeout(300)
    print('8 cerrar sesión: activo antes:', n1, '| filas después:', len(pg.evaluate("window.__db.push_suscripciones")), '| bajas:', pg.evaluate("window.__baja"))
    print('errores:', errs); b.close()
    b,pg,errs=nueva(p,JEF,denegar=True); ajustes(pg); pg.click('#pushInterruptor'); pg.wait_for_timeout(500)
    print('9 permiso denegado: interruptor:', pg.locator('#pushInterruptor').is_checked(), '| filas:', len(pg.evaluate("window.__db.push_suscripciones")), '| toast:', pg.locator('#toast').inner_text()); b.close()
    b,pg,errs=nueva(p,JEF,bloqueado=True); ajustes(pg); pg.wait_for_timeout(300)
    print('9b bloqueado en el navegador: nota:', pg.locator('.push-estado').inner_text()[:60]); pg.click('#pushInterruptor'); pg.wait_for_timeout(400); print('   al intentar activar: toast:', pg.locator('#toast').inner_text()[:60], '| interruptor:', pg.locator('#pushInterruptor').is_checked()); b.close()
    b,pg,errs=nueva(p,JEF); pg.evaluate("window.__pushFallo=true"); ajustes(pg); pg.click('#pushInterruptor'); pg.wait_for_timeout(500)
    print('10 el servidor rechaza: interruptor:', pg.locator('#pushInterruptor').is_checked(), '| bajas del navegador:', pg.evaluate("window.__baja"), '| toast:', pg.locator('#toast').inner_text()); b.close()
    b,pg,errs=nueva(p,JEF,ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'); ajustes(pg)
    print('11 iPhone sin instalar:', pg.locator('.ajustes-push .admin-nota').inner_text()[:70], '| interruptor:', pg.locator('#pushInterruptor').count()); b.close()
    b,pg,errs=nueva(p,{'iniciales':'JEF_F','rol':'familiar','empleadoId':'e-jefe'}); ajustes(pg); print('12 familiar: sección avisos:', pg.locator('.ajustes-push h3').count()); b.close()
    b,pg,errs=nueva(p,JEF,url='http://127.0.0.1:8765/index.html?ir=cambios', espera='.resultado-cabecera'); pg.wait_for_timeout(300)
    print('13 abrir desde un aviso: vista:', pg.locator('.resultado-cabecera h2').first.inner_text() if pg.locator('.resultado-cabecera h2').count() else None, '| URL limpia:', pg.url.endswith('index.html'), '| errores:', errs); b.close()
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':780}); pg=ctx.new_page()
    for pag in ('privacidad.html','terminos.html'):
        r=pg.goto('http://127.0.0.1:8765/'+pag); print('14', pag, r.status, '|', pg.title(), '| contacto:', pg.locator('a[href^="mailto:"]').first.inner_text(), '| enlace cruzado:', pg.locator('a[href$=".html"]').count())
    pg.goto('http://127.0.0.1:8765/privacidad.html'); print('  desborda en horizontal:', pg.evaluate("document.documentElement.scrollWidth > innerWidth"), '| menciona Google, Supabase y uso limitado:', all(t in pg.content() for t in ('Google Calendar','Supabase','uso limitado')))
    pg.screenshot(path='legal_movil.png', full_page=False); b.close()
