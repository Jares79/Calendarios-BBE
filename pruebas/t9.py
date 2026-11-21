from run import *
import json
with sync_playwright() as p:
    b,pg,errs=abrir(p,{'iniciales':'JEF','rol':'empleado','empleadoId':'e-jefe'})
    for d in ('2026-11-17','2026-11-18','2026-11-24'):
        pg.click(f'[data-fecha="{d}"]'); 
        if pg.locator('text=Solicitar cambio').count()==0: print(d,'sin botón'); pg.keyboard.press('Escape'); continue
        pg.click('text=Solicitar cambio'); pg.wait_for_selector('.modal-hoja')
        print(d,'grupos:',pg.locator('.fila-cambio select optgroup').evaluate_all('e=>e.map(x=>x.label+": "+[...x.querySelectorAll("option")].map(o=>o.textContent).join(" / "))'))
        if d=='2026-11-17':
            pg.select_option('.fila-cambio select', label='Corre Uno · Mañana'); pg.click('text=Enviar solicitud'); pg.wait_for_timeout(400)
            print('db:', pg.evaluate("window.__db.cambios_solicitudes.map(s=>s.solicitante_id+'->'+s.destinatario_id).join(';')"), pg.evaluate("window.__db.cambios_dias.map(x=>x.codigo_solicitante+x.codigo_destinatario).join(',')"))
        else: pg.click('text=Cancelar')
    print([e for e in errs if 'ERR_FAILED' not in e]); b.close()
