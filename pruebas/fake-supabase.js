// Supabase simulado en memoria para probar la app sin internet
(function () {
  const U = window.__USER || { iniciales: 'CTA', rol: 'empleado', empleadoId: 'e-ct' };
  const P = ['P','P','P','P','I','F','F'];
  const db = {
    colectivos: [
      { codigo:'jefes', nombre:'Jefes de Turno', icono:'J', puesto:'Jefe de Turno', patron:['M','M','T','T','N','N','F','F'], dias_solape:3, orden:1, tipo:'turnos' },
      { codigo:'correturnos', nombre:'Correturnos', icono:'C', puesto:'Correturno', patron:P, dias_solape:0, orden:4, tipo:'correturnos' },
      { codigo:'jornada', nombre:'Sin subgrupo', icono:'H', puesto:'Personal de jornada partida', patron:P, dias_solape:0, orden:5, tipo:'otro' }
    ],
    empleados: [
      { id:'e-jefe', iniciales:'JEF', nombre:'Jefe Uno', colectivo:'jefes', inicio:'2026-03-02', orden:1, activo:true, marcas:[] },
      { id:'e-jefe2', iniciales:'JE2', nombre:'Jefe Dos', colectivo:'jefes', inicio:'2026-03-04', orden:2, activo:true, marcas:[] },
      { id:'e-jefe3', iniciales:'JE3', nombre:'Jefe Tres', colectivo:'jefes', inicio:'2026-03-06', orden:3, activo:true, marcas:[] },
      { id:'e-ct', iniciales:'CTA', nombre:'Corre Uno', colectivo:'correturnos', inicio:'2026-01-05', orden:1, activo:true, marcas:['CTD','CT1','CT2','CT3','CT4','CTY'] },
      { id:'e-ct2', iniciales:'CTB', nombre:'Corre Dos', colectivo:'correturnos', inicio:'2026-01-05', orden:2, activo:true, marcas:['CTD','CT1','CT2','CT3','CT4','CTY'] },
      { id:'e-jp', iniciales:'JPA', nombre:'Partida Uno', colectivo:'jornada', inicio:'2026-01-05', orden:1, activo:true, marcas:['D'] }
    ],
    festivos: [ { fecha:'2026-12-08', nombre:'Inmaculada' }, { fecha:'2026-11-18', nombre:'Prueba' } ],
    intensivas: [ { id:'i1', desde:'2026-06-15', hasta:'2026-09-15', nota:null } ],
    excepciones: [ { empleado_id:'e-ct', fecha:'2026-11-17', codigo:'M' } ],
    semanas_especiales: [
      { empleado_id:'e-ct', semana:'2026-11-16', codigo:'CT2' },
      { empleado_id:'e-jp', semana:'2026-11-16', codigo:'D' }
    ],
    horas_turno: [], config_horas: [], horas_anuales: [], horas_dia: [],
    cambios_hechos: [],
    marcas_dia: [], cambios_solicitudes: [], cambios_dias: [], cambios_mensajes: [],
    perfiles: [ { id:'u1', iniciales:U.iniciales, rol:U.rol, empleado_id:U.empleadoId, activo:true } ]
  };
  if (window.__DB_INIT) Object.assign(db, window.__DB_INIT);
  window.__db = db; window.__writes = [];
  const ops = { eq:(a,b)=>a===b, gte:(a,b)=>a>=b, lte:(a,b)=>a<=b, in:(a,b)=>b.includes(a) };
  function qb(table) {
    let op='select', filters=[], orders=[], rng=null, payload=null, opts={}, sel=false;
    const run = () => {
      let rows = db[table];
      if (!rows) return { data:null, error:{ message:'relation does not exist' } };
      const match = r => filters.every(([k,f,v]) => ops[f](r[k], v));
      if (op==='upsert') {
        [].concat(payload).forEach(n => { const keys = opts.onConflict.split(',');
          const i = rows.findIndex(r => keys.every(k => r[k]===n[k])); if (i>=0) Object.assign(rows[i], n); else rows.push({...n}); });
        window.__writes.push(['upsert',table]); return { data:null, error:null };
      }
      if (op==='delete') { db[table] = rows.filter(r => !match(r)); window.__writes.push(['delete',table]); return { data:null, error:null }; }
      if (op==='insert') { rows.push(...[].concat(payload)); return { data:null, error:null }; }
      if (op==='update') { const t = rows.filter(match); t.forEach(r=>Object.assign(r,payload)); return { data:t, error:null }; }
      let out = rows.filter(match).slice();
      orders.forEach(k => out.sort((a,b)=> String(a[k]).localeCompare(String(b[k]))));
      if (rng) out = out.slice(rng[0], rng[1]+1);
      return { data: JSON.parse(JSON.stringify(out)), error:null };
    };
    const self = {
      select(){ sel=true; return self; }, order(k){ orders.push(k); return self; }, range(a,b){ rng=[a,b]; return self; },
      eq(k,v){ filters.push([k,'eq',v]); return self; }, gte(k,v){ filters.push([k,'gte',v]); return self; },
      lte(k,v){ filters.push([k,'lte',v]); return self; }, in(k,v){ filters.push([k,'in',v]); return self; },
      upsert(p,o){ op='upsert'; payload=p; opts=o||{}; return self; }, delete(){ op='delete'; return self; },
      insert(p){ op='insert'; payload=p; return self; }, update(p){ op='update'; payload=p; return self; },
      then(res, rej){ return Promise.resolve(run()).then(res, rej); }
    };
    return self;
  }
  const client = {
    from: qb,
    auth: { getSession: async()=>({ data:{ session:{ user:{id:'u1'} } } }), signOut: async()=>({}), onAuthStateChange(){} },
    rpc: async (name, a) => {
      a = a || {};
      const me = U.empleadoId, nowIso = new Date().toISOString(), hoy = nowIso.slice(0,10);
      const emp = id => db.empleados.find(e => e.id === id);
      const sol = id => db.cambios_solicitudes.find(s => s.id === id);
      const ok = (x) => ({ data: Object.assign({ ok:true }, x||{}), error:null });
      const no = (m) => ({ data:{ ok:false, motivo:m }, error:null });
      if (name==='mi_perfil') return { data:{ iniciales:U.iniciales, nombre:'Usuario', rol:U.rol, empleadoId:U.empleadoId, empleadoNombre:'X', debeCambiarPin:false, colores:{} }, error:null };
      window.__writes.push(['rpc', name]);
      if (name==='admin_editar_empleado') { const e = db.empleados.find(x=>x.id===a.p_id); if (!e) return no('no_encontrado'); if (!db.colectivos.some(c=>c.codigo===a.p_colectivo)) return no('datos_invalidos'); Object.assign(e, { nombre:a.p_nombre, iniciales:a.p_iniciales, colectivo:a.p_colectivo, inicio:a.p_inicio }); return ok(); }
      if (name==='admin_crear_subgrupo') { if (U.rol!=='administrador') return no('no_autorizado'); const n=(a.p_nombre||'').trim(); if(!n||n.length>40) return no('datos_invalidos'); if (db.colectivos.some(c=>c.nombre.toLowerCase()===n.toLowerCase())) return no('nombre_repetido'); const cod='sg'+(db.colectivos.length+1); db.colectivos.push({codigo:cod,nombre:n,icono:'👥',puesto:n,patron:db.colectivos.find(c=>c.codigo==='jornada').patron,dias_solape:0,orden:db.colectivos.length+1,tipo:'otro'}); return { data:{ok:true,codigo:cod}, error:null }; }
      if (name==='admin_renombrar_subgrupo') { const c=db.colectivos.find(x=>x.codigo===a.p_codigo); if(!c) return no('no_encontrado'); if(c.tipo==='turnos') return no('no_permitido'); const n=(a.p_nombre||'').trim(); if(!n) return no('datos_invalidos'); if (db.colectivos.some(x=>x.codigo!==c.codigo && x.nombre.toLowerCase()===n.toLowerCase())) return no('nombre_repetido'); c.nombre=n; return ok(); }
      if (name==='admin_borrar_subgrupo') { const c=db.colectivos.find(x=>x.codigo===a.p_codigo); if(!c) return no('no_encontrado'); if(c.tipo!=='otro'||c.codigo==='jornada') return no('no_permitido'); if (db.empleados.some(e=>e.colectivo===c.codigo)) return no('tiene_empleados'); db.colectivos=db.colectivos.filter(x=>x!==c); return ok(); }
      if (name==='admin_guardar_anual_ver') { if (U.rol!=='administrador') return no('no_autorizado'); const e = emp(a.p_empleado); if (!e) return no('no_encontrado'); e.anual_ver = a.p_ver; return ok(); }
      if (name==='admin_guardar_ver_horas') { if (U.rol!=='administrador') return no('no_autorizado'); const e = emp(a.p_empleado); if (!e) return no('no_encontrado'); e.ver_horas = a.p_ver; return ok(); }
      if (name==='admin_guardar_marcas') { if (U.rol!=='administrador') return no('no_autorizado'); const e = emp(a.p_empleado); e.marcas = a.p_marcas; return ok(); }
      if (name==='limpiar_cambios') {
        db.cambios_solicitudes.forEach(s => { if (s.estado==='pendiente' && s.primer_dia <= hoy) { s.estado='caducada'; s.cerrada_en=nowIso; s.visto_solicitante=false; s.visto_destinatario=false; } });
        const antes = db.cambios_solicitudes.length;
        db.cambios_solicitudes = db.cambios_solicitudes.filter(s => !(s.cerrada_en && Date.parse(s.cerrada_en) < Date.now() - 24*3600*1000));
        const vivos = new Set(db.cambios_solicitudes.map(s=>s.id));
        db.cambios_dias = db.cambios_dias.filter(d => vivos.has(d.solicitud_id)); db.cambios_mensajes = db.cambios_mensajes.filter(m => vivos.has(m.solicitud_id));
        return ok();
      }
      if (name==='crear_cambios') {
        const y = emp(me), d = emp(a.p_destinatario);
        if (!y || !d || y.id===d.id) return no('destinatario_invalido');
        const tur = c => db.colectivos.find(x=>x.codigo===c).tipo==='turnos';
        if (!((tur(y.colectivo) && y.colectivo===d.colectivo) || (db.colectivos.find(x=>x.codigo===y.colectivo).tipo==='correturnos' && tur(d.colectivo)) || (tur(y.colectivo) && db.colectivos.find(x=>x.codigo===d.colectivo).tipo==='correturnos'))) return no(tur(y.colectivo)||y.colectivo==='correturnos' ? 'destinatario_invalido' : 'colectivo_no_permitido');
        for (const x of a.p_dias) {
          if (tur(y.colectivo) && db.colectivos.find(x=>x.codigo===d.colectivo).tipo==='correturnos' && !['M','T','N'].includes(x.codigo_destinatario)) return no('datos_invalidos');
          if (x.fecha <= hoy) return no('fecha_pasada');
          if (db.cambios_solicitudes.some(s => s.estado==='pendiente' && db.cambios_dias.some(q => q.solicitud_id===s.id && q.fecha===x.fecha) && [s.solicitante_id,s.destinatario_id].some(i => i===y.id||i===d.id))) return no('ya_hay_solicitud');
        }
        const id = 'sol' + (db.cambios_solicitudes.length + 1 + Math.floor(Math.random()*1e6));
        db.cambios_solicitudes.push({ id, solicitante_id:me, destinatario_id:d.id, estado:'pendiente', primer_dia:a.p_dias.map(x=>x.fecha).sort()[0], visto_solicitante:true, visto_destinatario:false, creada_en:nowIso, cerrada_en:null });
        a.p_dias.forEach(x => db.cambios_dias.push({ solicitud_id:id, ...x }));
        if (a.p_mensaje) db.cambios_mensajes.push({ id:'m'+Math.random(), solicitud_id:id, autor_id:me, texto:a.p_mensaje, creado_en:nowIso });
        return ok({ id });
      }
      if (name==='enviar_mensaje_cambio') {
        const s = sol(a.p_solicitud); if (!s || ![s.solicitante_id,s.destinatario_id].includes(me)) return no('no_autorizado');
        if (s.estado!=='pendiente') return no('ya_cerrada');
        db.cambios_mensajes.push({ id:'m'+Math.random(), solicitud_id:s.id, autor_id:me, texto:a.p_texto, creado_en:nowIso });
        if (me===s.solicitante_id) s.visto_destinatario=false; else s.visto_solicitante=false; return ok();
      }
      if (name==='responder_cambio') {
        const s = sol(a.p_solicitud); if (!s || s.destinatario_id!==me) return no('no_autorizado');
        if (s.estado!=='pendiente') return no('ya_cerrada');
        if (s.primer_dia <= hoy) { s.estado='caducada'; s.cerrada_en=nowIso; return no('caducada'); }
        if (a.p_aceptar) db.cambios_dias.filter(d=>d.solicitud_id===s.id).forEach(d => {
          const put = (e,c) => { const r = db.excepciones.find(x=>x.empleado_id===e && x.fecha===d.fecha); if (r) r.codigo=c; else db.excepciones.push({ empleado_id:e, fecha:d.fecha, codigo:c }); };
          put(s.solicitante_id, d.codigo_destinatario); put(s.destinatario_id, d.codigo_solicitante);
          const h = db.cambios_hechos;
          if (h.some(x => x.empleado_id===s.solicitante_id && x.fecha===d.fecha && x.con_empleado_id===s.destinatario_id && x.codigo_cedido===d.codigo_destinatario)) {
            db.cambios_hechos = h.filter(x => !(x.fecha===d.fecha && [s.solicitante_id,s.destinatario_id].includes(x.empleado_id)));
          } else {
            db.cambios_hechos = h.filter(x => !(x.fecha===d.fecha && [s.solicitante_id,s.destinatario_id].includes(x.empleado_id)));
            db.cambios_hechos.push({ empleado_id:s.solicitante_id, fecha:d.fecha, con_empleado_id:s.destinatario_id, codigo_recibido:d.codigo_destinatario, codigo_cedido:d.codigo_solicitante });
            db.cambios_hechos.push({ empleado_id:s.destinatario_id, fecha:d.fecha, con_empleado_id:s.solicitante_id, codigo_recibido:d.codigo_solicitante, codigo_cedido:d.codigo_destinatario });
          } });
        s.estado = a.p_aceptar ? 'aceptada' : 'rechazada'; s.cerrada_en = nowIso; s.visto_solicitante=false; s.visto_destinatario=true; return ok();
      }
      if (name==='cancelar_cambio') {
        const s = sol(a.p_solicitud); if (!s || s.solicitante_id!==me) return no('no_autorizado');
        if (s.estado!=='pendiente') return no('ya_cerrada');
        s.estado='cancelada'; s.cerrada_en=nowIso; s.visto_destinatario=false; return ok();
      }
      if (name==='marcar_visto_cambio') { const s = sol(a.p_solicitud); if (s) { if (s.solicitante_id===me) s.visto_solicitante=true; if (s.destinatario_id===me) s.visto_destinatario=true; } return { data:null, error:null }; }
      return ok();
    }
  };
  window.supabase = { createClient: () => client };
})();
