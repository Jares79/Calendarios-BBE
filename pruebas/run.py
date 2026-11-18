import sys, json, http.server, threading, functools
from playwright.sync_api import sync_playwright
import os
AQUI=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(AQUI)   # carpeta del proyecto
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
FAKE=open(os.path.join(AQUI,'fake-supabase.js')).read()

def abrir(p, user, viewport=(390,780), hoy='2026-11-16T10:00:00'):
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':viewport[0],'height':viewport[1]})
    pg=ctx.new_page()
    errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    pg.route('**/@supabase/supabase-js@2', lambda r: r.fulfill(body=FAKE, content_type='application/javascript'))
    pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.add_init_script('window.__USER='+json.dumps(user))
    pg.clock.install(time=hoy)
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.wait_for_selector('.dia-calendario', timeout=8000)
    return b,pg,errs
