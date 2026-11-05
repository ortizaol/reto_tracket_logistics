// Pruebas de extremo a extremo de seguimiento.html (v0.6) con datos ficticios.
// Cubre: listado de OC (Latin-1, prefijos), explosión con amarre y FIFO, fecha requerida, semáforo, mensaje por OC,
// intérprete en lenguaje natural, candados contra cruces, confirmación y deshacer, depuración inicial,
// guardado automático, fecha simulada, consolidación, cierres por listado, tablero e interfaz.
// Uso: npm test   (requiere: npm install; Chromium/Playwright preinstalado)
const fs = require('fs');
const path = require('path');
const { abrirPagina, construirLibros, RAIZ, PRAMEC, INTRALUM, VISEG, COMP_A, COMP_B } = require('./comun');

let ok = 0, fallos = 0;
function check(nombre, cond, detalle){
  if (cond){ ok++; console.log('  ✓ ' + nombre); }
  else { fallos++; console.log('  ✗ ' + nombre + (detalle !== undefined ? '  → ' + JSON.stringify(detalle) : '')); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const K = { P1:'OC-00051420|10001|001-SC-00016001', P2:'OC-00051420|10002|001-SC-00016001', P3:'OC-00051421|10001|001-SC-00016050', P4:'OC-00051422|10003|001-SC-00016070',
  I1:'OC-00052001|20001|001-SC-00015900', I2:'OC-00052002|20002|001-SC-00016010', I3:'OC-00052002|20002|001-SC-00016020',
  V1:'OC-00053001|30001|001-SC-00016100', V2:'OC-00053001|30002|001-SC-00016100', V3:'OC-00053001|30003|001-SC-00016100', V4:'OC-00053002|30004|001-SC-00016150' };

(async () => {
  const { browser, page, errores } = await abrirPagina({ hoy: '2026-11-05' });
  const libros = await construirLibros(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(([l, K]) => {
    window.K = K;
    window.T = {
      libros: l, seguimientos: [],
      archivo(nombre, b64, lm){ const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], nombre, { lastModified: lm || Date.now() }); },
      async cargar(ocs, exps){
        await App.procesar({ ocs: ocs.map(n => T.archivo(n, T.libros[n])), explosiones: (exps || ['ABASTECIMIENTO_04112026.xlsx']).map(n => T.archivo(n, T.libros[n])),
          config: T.archivo('config.xlsx', T.libros['config.xlsx'], 1), seguimientos: T.seguimientos.map(s => T.archivo(s.nombre, s.b64)) });
      },
      reg(k){ const r = App.S.seg[K[k] || k]; return r ? { ...r } : null; },
      est(k){ const r = App.S.seg[K[k] || k]; return r ? r.estado : null; },
      g(prov){ return App.gestionHoy(true, true).find(x => x.proveedor === prov); },
      preguntar(prov){ const g = T.g(prov); const pl = App.plantillaPara(g.envio); const msg = App.construirMensaje(prov, g.envio, pl); App.registrarPregunta(prov, g.envio, pl, msg); return { pl, msg, claves: g.envio.map(r => r.clave) }; },
      panel(a, prov){ return a.paneles.find(p => p.prov === prov); },
      resumen(p){ return p.filas.map(f => ({ k: Object.keys(K).find(x => K[x] === f.clave), a: f.accion, f: f.fecha, err: f.error || '', amar: !!f.revisar })); }
    };
  }, [libros, K]);

  /* ------------------------------------------------------------------ */
  console.log('\n1. Listado de OC abiertas (Latin-1, prefijos) y explosión con amarre');
  await page.evaluate(() => T.cargar(['OC_04112026.txt']));
  const st = await page.evaluate(() => ({ stats: App.S.ocs.stats, modo: App.S.explosion.modo, desc: T.reg('P1').descripcion, prov: T.reg('I1').proveedor }));
  check('lee el texto de Siesa: 12 líneas OC-, ignora «Gran total», excluye OCI- y OM-', st.stats.abiertas === 12 && st.stats.oci === 1 && st.stats.excluidasPrefijo === 1, st.stats);
  check('decodifica Latin-1 (tildes) y conserva nombres', st.prov === INTRALUM && st.desc === 'TORNILLO HEF 8X50 ZINCADO', st);
  check('explosión en modo amarre (TD_FECHAS.Nro orden)', st.modo === 'amarre', st.modo);
  const req = await page.evaluate(() => Object.fromEntries(['P1','P2','P3','P4','I1','I2','I3','V1','V2','V3','V4'].map(k => [k, T.reg(k).sinNecesidad ? 'SIN' : T.reg(k).fecha_requerida])));
  check('ítem en 2 OC con 3 necesidades: OC 51420 → 15/11, OC 51421 → 20/11', req.P1 === '2026-11-15' && req.P3 === '2026-11-20', req);
  check('misma OC + ítem con 2 solicitudes: FIFO por fecha de entrega (12/11 y 26/11)', req.I2 === '2026-11-12' && req.I3 === '2026-11-26', req);
  check('línea sin necesidad (pendiente-inventario 0) → «Sin necesidad en planeación»', req.P4 === 'SIN' && (await page.evaluate(() => App.estadoVisible(App.S.seg[K.P4]))) === 'SIN_NECESIDAD');
  const venc = await page.evaluate(() => ({ ef: App.reqEf(App.S.seg[K.I1]), sem: App.semaforo(App.S.seg[K.I1]), sem2: App.semaforo(App.S.seg[K.P1]) }));
  check('necesidad vencida → requerida = hoy y semáforo rojo; sin fecha a futuro → gris', venc.ef === '2026-11-05' && venc.sem === 'rojo' && venc.sem2 === 'gris', venc);
  const fifo = await page.evaluate(() => {
    const ex = { modo:'fifo', filas:[['', '10001', '2026-11-25', 30], ['', '10001', '2026-11-12', 30], ['', '10001', '2026-11-28', 150]] };
    const f = App.calcularFechasRequeridas(App.S.ocs.lineas, ex); return { P1: f[K.P1], P3: f[K.P3], P2: f[K.P2] };
  });
  check('modo FIFO (sin OC amarrada): necesidades por fecha vs OC por fecha de OC', fifo.P1 === '2026-11-12' && fifo.P3 === '2026-11-28' && fifo.P2 === null, fifo);
  const pref = await page.evaluate(async () => { App.S.config.reglas.prefijos_oc = 'OC-,OM-'; const n = App.procesarOC(await App.leerMatriz(T.archivo('OC_04112026.txt', T.libros['OC_04112026.txt']), []), {}).stats.abiertas; App.S.config.reglas.prefijos_oc = 'OC-'; return n; });
  check('prefijos configurables (OC-,OM- incluye la OM)', pref === 13, pref);
  const fuentes = await page.evaluate(() => document.querySelector('#estadoCarga').textContent);
  check('cabecera muestra «OC abiertas: 04/11/2026 · Explosión: 04/11/2026»', /OC abiertas: 04\/11\/2026/.test(fuentes) && /Explosión: 04\/11\/2026/.test(fuentes), fuentes.slice(0, 120));
  const alerta = await page.evaluate(() => { App.setAhora('2026-11-10T09:00:00'); const a = App.S && document.querySelector('#estadoCarga') && (App.renderTodo(), document.querySelector('#main').textContent); App.setAhora('2026-11-05T09:00:00'); App.renderTodo(); return /desactualizados/.test(a); });
  check('alerta si los archivos tienen más de 4 días', alerta);

  console.log('\n2. Mensaje por OC');
  await page.evaluate(c => { App.S.comprador = c; }, COMP_A);
  const gP = await page.evaluate(p => { const g = T.g(p); return { envio: g.envio.map(r => Object.keys(K).find(k => K[k] === r.clave)), dep: App.depuracionPendiente(p) }; }, PRAMEC);
  check('Pramec: líneas ordenadas por fecha requerida, sin la de «sin necesidad»', eq(gP.envio, ['P1', 'P2', 'P3']), gP);
  check('depuración inicial pendiente antes del primer envío', gP.dep === true);
  const msg = await page.evaluate(p => { const g = T.g(p); return App.construirMensaje(p, g.envio, App.plantillaPara(g.envio)); }, PRAMEC);
  check('agrupa por OC con número corto y numera ítems dentro de cada OC', /OC 51420\n• Ítem 1 · TORNILLO HEF 8X50 ZINCADO \(0010001\) · 100 und · Requerida 15 nov · Sin confirmar\n• Ítem 2 · TUERCA M8 AUTOFRENANTE \(0010002\)/.test(msg) && /OC 51421\n• Ítem 1 · TORNILLO/.test(msg), msg);
  check('ejemplos con números reales y aviso de la plataforma', /"La 51420 llega el/.test(msg) && /"El ítem 2 de la 51420/.test(msg) && msg.includes('Este seguimiento no reemplaza la facturación en la plataforma de proveedores.'), msg.slice(-300));
  const msgI = await page.evaluate(p => { const g = T.g(p); return App.construirMensaje(p, g.envio, App.plantillaPara(g.envio)); }, INTRALUM);
  check('Intralum (tú): vencida se muestra «Requerida hoy»; nunca dice «planeación»', /^Hola Diana/.test(msgI) && /Requerida hoy/.test(msgI) && !/planeaci/i.test(msgI), msgI.slice(0, 200));
  const tope = await page.evaluate(p => { App.S.config.reglas.max_lineas_mensaje = 2; const a = T.g(p); App.S.config.reglas.max_lineas_mensaje = 15; App.S.config.reglas.max_oc_mensaje = 1; const b = T.g(p); App.S.config.reglas.max_oc_mensaje = 6; return { a: [a.envio.length, a.resto], b: [b.envio.length, b.resto, [...new Set(b.envio.map(r => r.oc))].length] }; }, PRAMEC);
  check('tope de líneas (2) y de OC (1) por mensaje; el resto queda para el siguiente envío', eq(tope.a, [2, 1]) && eq(tope.b, [2, 1, 1]), tope);

  console.log('\n3. Depuración inicial (Viseg)');
  const dep = await page.evaluate(p => {
    const wb = App.libroDepuracion(p);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.depuracion, { header:1, raw:true });
    const fila = k => aoa.findIndex(r => r[12] === K[k]);
    aoa[fila('V3')][9] = 'CANCELAR'; aoa[fila('V3')][11] = 'Duplicada con OC 53002';
    aoa[fila('V2')][9] = 'nueva fecha'; aoa[fila('V2')][10] = '12/11/2026';
    aoa[fila('V4')][9] = 'ENTREGADO';
    const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(aoa), 'depuracion');
    const panel = App.analizarDepuracion(wb2, p);
    const filas = T.resumen(panel);
    const n = App.confirmarPanel(panel);
    const cruce = App.analizarDepuracion(wb2, 'PRAMEC SAS');
    return { lineas: aoa.length - 1, hojas: wb.SheetNames, filas, n, V3: T.est('V3'), V2: T.reg('V2').fecha_prometida, V4: T.est('V4'), pend: App.depuracionPendiente(p), cruce: cruce.bloqueos };
  }, VISEG);
  check('Excel de depuración con todas las líneas abiertas e instrucciones', dep.lineas === 4 && eq(dep.hojas, ['depuracion', 'instrucciones']), dep);
  check('ENTREGADO / NUEVA FECHA / CANCELAR aplicados', dep.n === 3 && dep.V3 === 'POR_CANCELAR' && dep.V2 === '2026-11-12' && dep.V4 === 'ENTREGADO_POR_CONFIRMAR', dep);
  check('depuración registrada: ya no está pendiente', dep.pend === false);
  check('candado: Excel de Viseg cargado en Pramec se bloquea', dep.cruce.length === 1 && /otro proveedor/.test(dep.cruce[0]), dep.cruce);
  await page.evaluate(([a, b]) => { App.marcarDepuracion(a, 'omitida (prueba)'); App.marcarDepuracion(b, 'omitida (prueba)'); }, [PRAMEC, INTRALUM]);

  console.log('\n4. Envío (05/11 09:00)');
  await page.evaluate(([pr, it, vi, a, b]) => {
    App.setAhora('2026-11-05T09:00:00'); App.S.comprador = a; T.preguntar(pr);
    App.setAhora('2026-11-05T09:05:00'); T.preguntar(it);
    App.setAhora('2026-11-05T09:10:00'); App.S.comprador = b; T.preguntar(vi);
  }, [PRAMEC, INTRALUM, VISEG, COMP_A, COMP_B]);
  const env = await page.evaluate(() => ({ P1: T.est('P1'), V3: App.evaluarLinea(App.S.seg[K.V3]).motivo, vig: App.mensajesVigentes('VIDRIOS DE SEGURIDAD S.A').length, envV: App.lineasDeMensaje(App.mensajesVigentes('VIDRIOS DE SEGURIDAD S.A')[0]).map(r => r.clave) }));
  check('NUEVA → ESPERANDO_FECHA al registrar la pregunta', env.P1 === 'ESPERANDO_FECHA');
  check('«Por cancelar» y «entregado» no se preguntan; V2 (fecha 12/11 de la depuración, hito de 7 días ya cubierto) tampoco: Viseg solo V1', eq(env.envV, [K.V1]) && /Por cancelar/.test(env.V3), env);

  console.log('\n5. Pegado general con varios proveedores (05/11 10:40)');
  await page.evaluate(() => App.setAhora('2026-11-05T10:40:00'));
  const PEGADO1 = `[8:30 a. m., 5/11/2026] PRAMEC - Carlos: hola, mensaje viejo: todo igual
[9:00 a. m., 5/11/2026] Compras Busscar: Buenos días Carlos, le escribe Compras Busscar...
[10:15 a. m., 5/11/2026] PRAMEC - Carlos: Buenos días. La 51420 llega el 18 de noviembre
y el ítem 1 de la 51421 ya lo entregamos
[10:20 a. m., 5/11/2026] INTRALUM - Diana: la 52001 la próxima semana, la 52002 el 20/11
[10:22 a. m., 5/11/2026] Viseg Despachos: Todo igual
[10:30 a. m., 5/11/2026] Pedro Desconocido: hola`;
  const a1 = await page.evaluate(t => { const a = App.analizarPegado(t); window.__a1 = a;
    return { general: a.general, paneles: a.paneles.map(p => ({ prov: p.prov || p.titulo, bloq: p.bloqueos, usados: p.usados ? p.usados.length : 0, viejos: p.viejos, por: p.por, filas: p.filas ? T.resumen(p) : [] })) }; }, PEGADO1);
  const pp = a1.paneles.find(p => p.prov === PRAMEC), pi = a1.paneles.find(p => p.prov === INTRALUM), pv = a1.paneles.find(p => p.prov === VISEG), pd = a1.paneles.find(p => p.prov === 'Pedro Desconocido');
  check('mensajes propios de Busscar ignorados', a1.general.some(g => /1 mensaje\(s\) propios/.test(g)), a1.general);
  check('un panel por proveedor (Pramec, Intralum, Viseg) + remitente desconocido', !!pp && !!pi && !!pv && !!pd, a1.paneles.map(p => p.prov));
  check('remitente desconocido → bloqueado con instrucción', pd && /no reconocido/.test(pd.bloq[0]), pd);
  check('Pramec: ignora el mensaje anterior a la pregunta y une el mensaje de dos renglones', pp.viejos === 1 && pp.usados === 1, pp);
  check('Pramec: «La 51420 llega el 18 de noviembre» aplica a sus 2 ítems; «ítem 1 de la 51421 ya lo entregamos» → entregado',
    eq(pp.filas.map(f => [f.k, f.a, f.f]).sort(), [['P1','FECHA','2026-11-18'], ['P2','FECHA','2026-11-18'], ['P3','ENT','']]), pp.filas);
  check('Intralum: fecha vaga → amarillo; «la 52002 el 20/11» → sus 2 líneas', pi.filas.find(f => f.k === 'I1').amar && pi.filas.filter(f => f.f === '2026-11-20').length === 2, pi.filas);
  check('Viseg identificado por su segundo nombre de WhatsApp; «Todo igual» sin fecha previa → amarillo con la requerida (10/11)', pv.por === 'nombre' && eq(pv.filas, [{ k:'V1', a:'FECHA', f:'2026-11-10', err:'', amar:true }]), pv);
  check('«Todo igual» solo afecta las líneas del mensaje (V2 no estaba)', !pv.filas.some(f => f.k === 'V2'));
  // Confirmaciones
  const conf = await page.evaluate(([pr, it, vi]) => {
    const a = window.__a1;
    const nP = App.confirmarPanel(T.panel(a, pr));
    const pI = T.panel(a, it); pI.filas.filter(f => f.revisar).forEach(f => { f.fecha = '2026-11-13'; f.revisar = false; });
    const nI = App.confirmarPanel(pI);
    return { nP, nI, P1: T.reg('P1'), P3: T.est('P3'), I1: T.reg('I1').fecha_prometida, riesgo: App.enRiesgo(App.S.seg[K.P1]), sem: App.semaforo(App.S.seg[K.P1]) };
  }, [PRAMEC, INTRALUM, VISEG]);
  check('confirmar Pramec: 3 líneas; P1 CONFIRMADA 18/11 (riesgo: requerida 15/11 → semáforo rojo)', conf.nP === 3 && conf.P1.estado === 'CONFIRMADA' && conf.P1.fecha_prometida === '2026-11-18' && conf.riesgo && conf.sem === 'rojo', conf);
  check('entregado → ENTREGADO_POR_CONFIRMAR', conf.P3 === 'ENTREGADO_POR_CONFIRMAR');
  check('Intralum: el comprador eligió la fecha vaga (13/11) antes de confirmar', conf.nI === 3 && conf.I1 === '2026-11-13', conf);

  console.log('\n6. Candados y casos especiales');
  await page.evaluate(() => App.setAhora('2026-11-05T11:00:00'));
  const cruce = await page.evaluate(() => App.analizarPegado('[11:00 a. m., 5/11/2026] PRAMEC - Carlos: la 54001 llega mañana').paneles[0]);
  check('OC de otro proveedor → panel BLOQUEADO (posible cruce)', cruce.bloqueado && /54001 es de METALES FICTICIOS SAS/.test(cruce.bloqueos[0]), cruce.bloqueos);
  const sinEnc = await page.evaluate(() => App.analizarPegado('La 51420 llega el 25'));
  check('pegado sin encabezado → bloqueado con instrucción de cómo copiar', sinEnc.paneles.length === 0 && /Seleccionar mensajes/.test(sinEnc.general[0]), sinEnc);
  const tel = await page.evaluate(() => { const p = App.analizarPegado('[11:05 a. m., 5/11/2026] +57 300 0000001: la 51420 se mantiene').paneles[0]; return { prov: p.prov, por: p.por, filas: T.resumen(p) }; });
  check('remitente por celular (+57 300 0000001) → Pramec', tel.prov === PRAMEC && tel.por === 'celular', tel);
  check('«se mantiene» sobre fecha confirmada → Se mantiene (SI)', tel.filas.length === 2 && tel.filas.every(f => f.a === 'SI'), tel.filas);
  const viejos = await page.evaluate(() => App.analizarPegado('[8:00 a. m., 5/11/2026] INTRALUM - Diana: todo igual').paneles[0]);
  check('mensajes anteriores a la última pregunta → no hay respuesta nueva', viejos.bloqueado && /anteriores a la última pregunta/.test(viejos.bloqueos[0]), viejos.bloqueos);
  const m24 = await page.evaluate(() => App.separarWhatsApp('[14:30, 5/11/2026] VISEG - Jorge: ok').mensajes[0]);
  check('encabezado en formato 24 h', m24 && m24.ts === '2026-11-05T14:30:00', m24);

  console.log('\n7. Deshacer');
  const des = await page.evaluate(p => { const antes = App.ultimoLote(p).eventos.length; const n = App.deshacerUltima(p); return { antes, n, P1: T.reg('P1'), P3: T.est('P3'), hist: App.S.eventos.filter(e => e.tipo === 'DESHACER').length, otro: App.ultimoLote(p) }; }, PRAMEC);
  check('deshacer la última respuesta de Pramec restaura las 3 líneas', des.n === 3 && des.P1.estado === 'ESPERANDO_FECHA' && des.P1.fecha_prometida === '' && des.P3 === 'ESPERANDO_FECHA', des);
  check('queda en el historial (eventos DESHACER) y no hay más lotes por deshacer', des.hist === 3 && des.otro === null, des.hist);
  const item = await page.evaluate(() => { const p = App.analizarPegado('[11:10 a. m., 5/11/2026] PRAMEC - Carlos: El ítem 2 llega el 21').paneles[0]; return T.resumen(p); });
  check('tras deshacer, el mensaje vuelve a estar vigente: «El ítem 2 llega el 21» → TUERCA (única OC con ítem 2)', eq(item, [{ k:'P2', a:'FECHA', f:'2026-11-21', err:'', amar:false }]), item);

  console.log('\n8. Guardado automático y fecha simulada');
  const auto = await page.evaluate(async c => {
    const archivos = {};
    const dir = n => ({ name:n, async getDirectoryHandle(x){ return dir(x); }, async getFileHandle(x){ return { async createWritable(){ let b; return { async write(d){ b = d; }, async close(){ archivos[n + '/' + x] = b; } }; } }; } });
    App.S.dirHandle = dir('raiz'); App.S.comprador = c;
    App.setAhora('2026-11-05T11:00:00');
    App.guardadoAutomatico(); await new Promise(r => setTimeout(r, 1200));
    const conSim = Object.keys(archivos).length;
    App.aplicarFechaSimulada('');
    App.guardadoAutomatico(); await new Promise(r => setTimeout(r, 1200));
    const nombres = Object.keys(archivos), b = archivos[nombres[0]];
    const d = b ? App.leerSeguimiento(XLSX.read(b, { type:'array' })) : null;
    App.S.dirHandle = null; App.setAhora('2026-11-05T11:00:00');
    return { conSim, nombres, lineas: d && d.lineas.length, eventos: d && d.eventos.length, pend: App.S.modificadas.size };
  }, COMP_A);
  check('con fecha simulada NO se guarda automáticamente', auto.conSim === 0, auto);
  check('sin fecha simulada guarda respuestas/seguimiento_<comprador>_<aaaammdd>.xlsx', auto.nombres.length === 1 && /^respuestas\/seguimiento_COMPRADORA_A_PRUEBA_\d{8}\.xlsx$/.test(auto.nombres[0]) && auto.lineas > 0 && auto.eventos > 0, auto);
  const sim = await page.evaluate(() => { App.aplicarFechaSimulada('2026-11-20'); App.renderTodo(); const t = document.querySelector('#estadoCarga').textContent, h = App.hoy(); App.aplicarFechaSimulada(''); App.setAhora('2026-11-05T11:00:00'); App.renderTodo(); return { t, h }; });
  check('fecha simulada desde el Administrador: cambia «hoy» y muestra la franja roja', sim.h === '2026-11-20' && /FECHA SIMULADA: 20\/11\/2026/.test(sim.t), sim);

  console.log('\n9. Consolidación y cierres por el listado de OC');
  const exp = await page.evaluate(([a, b]) => { const out = []; for (const c of [a, b]){ App.S.comprador = c; const d = App.datosMiSeguimiento(); out.push({ nombre:`seguimiento_${c.replace(/\W+/g, '_')}_20261105.xlsx`, b64: XLSX.write(App.libroSeguimiento(d.lineas, d.eventos), { bookType:'xlsx', type:'base64' }) }); } return out; }, [COMP_A, COMP_B]);
  await page.evaluate(e => { localStorage.clear(); App.S.modificadas.clear(); T.seguimientos = e; }, exp);
  await page.evaluate(() => T.cargar(['OC_04112026.txt']));
  const cons = await page.evaluate(() => ({ P2: T.reg('P2').estado, I1: T.reg('I1').fecha_prometida, V3: T.est('V3'), lote: App.ultimoLote('PRAMEC SAS'), dep: App.depuracionPendiente('VIDRIOS DE SEGURIDAD S.A') }));
  check('consolidación sin trabajo local reconstruye estados, deshacer y depuración', cons.P2 === 'ESPERANDO_FECHA' && cons.I1 === '2026-11-13' && cons.V3 === 'POR_CANCELAR' && cons.lote === null && cons.dep === false, cons);
  await page.evaluate(() => { App.setAhora('2026-11-09T09:00:00'); return T.cargar(['OC_04112026.txt', 'OC_09112026.txt']); });
  const cie = await page.evaluate(() => ({ nombre: App.S.ocs.nombre, P1: T.est('P1'), V3: T.est('V3'), P3: T.est('P3'), alm: App.revisarAlmacen(App.S.seg[K.V4]) }));
  check('usa el listado más reciente (09/11)', cie.nombre === 'OC_09112026.txt');
  check('línea que ya no está abierta → CERRADA_SIESA; «por cancelar» que desaparece → CERRADA_SIESA', cie.P1 === 'CERRADA_SIESA' && cie.V3 === 'CERRADA_SIESA', cie);
  check('entregado hace 5 días y sigue abierto: aún no «revisar con almacén»', cie.alm === false);
  T13 = await page.evaluate(() => { T.libros['OC_13112026.txt'] = T.libros['OC_09112026.txt']; App.setAhora('2026-11-13T09:00:00'); return T.cargar(['OC_13112026.txt']).then(() => App.revisarAlmacen(App.S.seg[K.V4])); });
  check('entregado hace 9 días (> 7) y sigue abierto → «revisar con almacén»', T13 === true);

  console.log('\n10. Tablero');
  const tb = await page.evaluate(() => { const m = App.metricasProveedores(); return Object.fromEntries(m.map(x => [x.alias, { preg:x.preguntas, resp:x.respondidas, sinNec:x.sinNecesidad, porCanc:x.porCancelar, epc:x.epc, alm:x.almacen, rojas:x.rojas }])); });
  check('Pramec: 1 línea sin necesidad en planeación; respuesta deshecha no cuenta', tb.Pramec.sinNec === 1 && tb.Pramec.resp === 0, tb.Pramec);
  check('Viseg: entregado por confirmar con «revisar con almacén»', tb.Viseg.epc === 1 && tb.Viseg.alm === 1, tb.Viseg);
  const hojas = await page.evaluate(() => App.libroTablero().SheetNames);
  check('exportación del tablero con 4 hojas', eq(hojas, ['resumen_proveedores', 'riesgo_faltante', 'cambios_por_linea', 'detalle_lineas']), hojas);

  console.log('\n11. Interfaz');
  await page.evaluate(() => { App.setAhora('2026-11-13T10:00:00'); window.__abiertas = []; window.open = u => { window.__abiertas.push(u); return null; }; App.S.comprador = 'COMPRADORA A (PRUEBA)'; App.S.tab = 'hoy'; App.renderTodo(); });
  const capt = path.join(RAIZ, 'pruebas', 'capturas'); fs.mkdirSync(capt, { recursive: true });
  await page.screenshot({ path: path.join(capt, '1_gestion_hoy.png'), fullPage: true });
  const btn = await page.$('[data-prov] button[data-acc=wa]:not([disabled])');
  check('tarjeta con botón «Abrir WhatsApp» habilitado', !!btn);
  if (btn){
    await btn.click();
    const url = await page.evaluate(() => window.__abiertas[0]);
    const txt = decodeURIComponent((url || '').split('?text=')[1] || '');
    check('abre https://wa.me/57<celular>?text=… con el mensaje por OC', /^https:\/\/wa\.me\/57300000000[12]\?text=/.test(url || '') && /OC 5\d{4}\n• Ítem 1/.test(txt), (url || '').slice(0, 60));
  }
  await page.evaluate(() => App.setAhora('2026-11-13T11:00:00'));
  await page.fill('#txtPegado', `[11:00 a. m., 13/11/2026] PRAMEC - Carlos: La 51420 llega la próxima semana\n[11:01 a. m., 13/11/2026] INTRALUM - Diana: la 54001 llega mañana\n[11:02 a. m., 13/11/2026] Pedro: hola`);
  await page.click('#btnAnalizar');
  await page.waitForSelector('.prov-grande');
  check('panel con el nombre del proveedor en grande y botón «Confirmar respuesta de …» deshabilitado si hay amarillo', !!(await page.$('button[data-acc=confirmar][disabled]')) && /PRAMEC SAS/.test(await page.textContent('.confirmar .prov-grande')));
  check('panel bloqueado para la OC ajena y el remitente desconocido', (await page.$$('.bloqueo')).length === 2);
  await page.screenshot({ path: path.join(capt, '2_pegado_y_candados.png'), fullPage: true });
  for (const t of ['lineas', 'tablero']){ await page.click(`#tabs button[data-tab=${t}]`); await page.screenshot({ path: path.join(capt, `3_${t}.png`), fullPage: true }); }
  await page.click('#tabs button[data-tab=admin]'); await page.fill('#admPin', '1234'); await page.click('#admEntrar');
  check('Administrador: fecha simulada, reglas nuevas y columna nombre_whatsapp', !!(await page.$('#admSim')) && !!(await page.$('[data-regla=max_lineas_mensaje]')) && !!(await page.$('[data-f=nombre_whatsapp]')));
  await page.screenshot({ path: path.join(capt, '4_admin.png'), fullPage: true });
  check('sin errores de JavaScript en la página', errores.length === 0, errores);

  await browser.close();
  console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
let T13;
