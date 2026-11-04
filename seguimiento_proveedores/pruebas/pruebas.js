// Pruebas de extremo a extremo de seguimiento.html con datos ficticios.
// Cubre: lectura de explosión (filtros, duplicados, mapeo manual), config, qué preguntar hoy,
// mensajes, intérprete de respuestas, todos los estados, consolidación de archivos de seguimiento,
// cierre/reapertura por explosión, "revisar con almacén", tablero y exportaciones.
// Uso: npm test   (requiere: npm install; Chromium/Playwright preinstalado)
const fs = require('fs');
const path = require('path');
const { abrirPagina, construirLibros, RAIZ, PRAMEC, INTRALUM, VISEG, LAURA, ANDRES } = require('./comun');

let ok = 0, fallos = 0;
function check(nombre, cond, detalle){
  if (cond){ ok++; console.log('  ✓ ' + nombre); }
  else { fallos++; console.log('  ✗ ' + nombre + (detalle !== undefined ? '  → ' + JSON.stringify(detalle) : '')); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const { browser, page, errores } = await abrirPagina({ hoy: '2026-11-04' });
  const libros = await construirLibros(page);
  await page.evaluate(() => localStorage.clear());

  // Ayudantes dentro de la página
  await page.evaluate(() => {
    window.T = {
      archivo(nombre, b64, lm){ const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], nombre, { lastModified: lm || Date.now() }); },
      libros: {}, seguimientos: [],
      async cargar(explosiones){
        const c = { explosiones: explosiones.map(n => T.archivo(n, T.libros[n])), config: T.archivo('config.xlsx', T.libros['config.xlsx'], 1),
          seguimientos: T.seguimientos.map(s => T.archivo(s.nombre, s.b64)) };
        await App.procesar(c);
      },
      est(){ const o = {}; for (const [k, r] of Object.entries(App.S.seg)) o[k] = r.estado; return o; },
      reg(k){ return { ...App.S.seg[k] }; },
      hoyDe(prov){ const g = App.gestionHoy(true, false).find(x => x.proveedor === prov); return g ? g.hoy.map(r => r.clave) : []; },
      preguntar(prov){ const g = App.gestionHoy(true, false).find(x => x.proveedor === prov); const pl = App.plantillaPara(g.hoy);
        const msg = App.construirMensaje(prov, g.hoy, pl); App.registrarPregunta(prov, g.hoy, pl, msg); return { pl, msg, claves: g.hoy.map(r => r.clave) }; },
      responder(prov, texto, ajustes){
        const g = App.gestionHoy(true, true).find(x => x.proveedor === prov);
        const mapa = App.lineasDeMensaje(g.pregunta);
        const pv = App.previaRespuesta(texto, mapa);
        for (const [n, a] of Object.entries(ajustes || {})){ const f = pv.filas.find(x => x.n === +n); Object.assign(f, App.validarAccion(mapa[f.n - 1], a.accion, a.fecha || '')); }
        const errores = pv.filas.filter(f => f.error).map(f => ({ n: f.n, error: f.error }));
        if (!errores.length) pv.filas.forEach(f => App.aplicarAccion(mapa[f.n - 1], f, prov, texto));
        App.renderTodo();
        return { filas: pv.filas.map(f => ({ n: f.n, accion: f.accion, fecha: f.fecha, error: f.error })), errores, ignorado: pv.ignorado };
      }
    };
  });
  await page.evaluate(l => { T.libros = l; }, libros);

  /* ------------------------------------------------------------------ */
  console.log('\n1. Intérprete de respuestas (hoy = 04/11/2026)');
  const casos = [
    ['1 SI', 4, { a: { 1: ['SI', ''] } }],
    ['1 sí\n2 NO 25/11\n3 ent', 4, { a: { 1: ['SI', ''], 2: ['NO', '2026-11-25'], 3: ['ENT', ''] } }],
    ['TODO SI', 4, { todo: 'SI', a: {} }],
    ['Todos sí, excepto 2 no 30-11', 4, { todo: 'SI', a: { 2: ['NO', '2026-11-30'] } }],
    ['2 25/11', 4, { a: { 2: ['FECHA', '2026-11-25'] } }],
    ['1. 5/1', 4, { a: { 1: ['FECHA', '2027-01-05'] } }],
    ['1) NO 03/12/2026', 4, { a: { 1: ['NO', '2026-12-03'] } }],
    ['4 NO', 4, { e: [4] }],
    ['7 SI', 4, { fuera: [7], a: {} }],
    ['[4/11/26, 10:15 a. m.] Carlos Pramec: 1 SI 2 ENT', 4, { a: { 1: ['SI', ''], 2: ['ENT', ''] } }],
    ['4/11/26 10:15 - Carlos: 3 Entregado', 4, { a: { 3: ['ENT', ''] } }],
    ['1 y 2 SI', 4, { a: { 1: ['SI', ''], 2: ['SI', ''] } }],
    ['Buenos días. 1 31/02', 4, { e: [1] }],
    ['1 SI 25/11', 4, { a: { 1: ['FECHA', '2026-11-25'] } }],
    ['1 no 25/11 2 NO 26-11 3 si 4 ENT', 4, { a: { 1: ['NO', '2026-11-25'], 2: ['NO', '2026-11-26'], 3: ['SI', ''], 4: ['ENT', ''] } }],
    ['1:SI 2-SI', 4, { a: { 1: ['SI', ''], 2: ['SI', ''] } }],
    ['1 NO 25/11/26', 4, { a: { 1: ['NO', '2026-11-25'] } }],
    ['3', 4, { e: [3] }],
  ];
  for (const [txt, n, esp] of casos){
    const r = await page.evaluate(([t, n]) => App.interpretarRespuesta(t, n), [txt, n]);
    const a = {}; for (const [k, v] of Object.entries(r.acciones)) a[k] = [v.accion, v.fecha];
    let bien = true;
    if (esp.a && !eq(a, Object.fromEntries(Object.entries(esp.a).map(([k, v]) => [k, v])))) bien = false;
    if (esp.todo !== undefined && r.todo !== esp.todo) bien = false;
    if (esp.e && !esp.e.every(k => r.errores[k])) bien = false;
    if (esp.fuera && !eq(r.fueraDeRango, esp.fuera)) bien = false;
    check(`«${txt.replace(/\n/g, ' ⏎ ')}»`, bien, { acciones: a, todo: r.todo, errores: r.errores, fuera: r.fueraDeRango, ignorado: r.ignorado });
  }
  const ign = await page.evaluate(() => App.interpretarRespuesta('Buenos días, 1 SI gracias', 2).ignorado);
  check('texto libre se reporta como no interpretado', ign.includes('BUENOS') && ign.includes('GRACIAS'), ign);

  /* ------------------------------------------------------------------ */
  console.log('\n2. Carga de explosión 02/11 + config (día 04/11 09:00)');
  await page.evaluate(() => App.setAhora('2026-11-04T09:00:00'));
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_02112026.xlsx']));
  const st = await page.evaluate(() => App.S.explosion.stats);
  check('filtra OC nacionales con pendiente > 0', st.nacionales === 11 && st.oci === 1 && st.cero === 1 && st.duplicadas === 1, st);
  const i3 = await page.evaluate(() => T.reg('OC-2002|1'));
  check('duplicado OC+línea: pendiente MAX y fecha más temprana', i3.cantidad_pendiente === 80 && i3.fecha_requerida === '2026-11-15', i3);
  const cfg = await page.evaluate(() => ({ n: App.S.config.proveedores.length, trato: App.S.config.proveedores[1].trato, ex: App.S.config.exclusiones, r: App.R() }));
  check('config.xlsx leído (proveedores, trato, exclusiones, reglas)', cfg.n === 4 && cfg.trato === 'tu' && cfg.ex[0].valor === 'OC-3003' && cfg.r.horizonte_semanas === 4 && eq(cfg.r.dias_antes_repregunta, [7, 2, 0]), cfg);
  check('todas las líneas nuevas en estado NUEVA', Object.values(await page.evaluate(() => T.est())).every(e => e === 'NUEVA'));
  check('elige la explosión más reciente por nombre', await page.evaluate(() => App.elegirExplosion([{ name:'ABASTECIMIENTO_09112026.xlsx' }, { name:'ABASTECIMIENTO_17112026.xlsx' }, { name:'ABASTECIMIENTO_30102026.xlsx' }]).name) === 'ABASTECIMIENTO_17112026.xlsx');

  console.log('\n3. Qué preguntar hoy');
  check('Pramec: vencida primero, fuera de horizonte excluida', eq(await page.evaluate(p => T.hoyDe(p), PRAMEC), ['OC-1001|1', 'OC-1001|2', 'OC-1002|1']));
  check('Intralum: 3 líneas en horizonte', eq(await page.evaluate(p => T.hoyDe(p), INTRALUM), ['OC-2001|1', 'OC-2001|2', 'OC-2002|1']));
  check('Viseg: excluye OC-3003 (exclusiones)', eq(await page.evaluate(p => T.hoyDe(p), VISEG), ['OC-3001|1', 'OC-3002|1']));
  check('proveedor no activo no aparece', !(await page.evaluate(() => App.gestionHoy(true, false).some(g => /METALES/.test(g.proveedor)))));
  check('filtro por comprador (Andrés ve solo Viseg)', eq(await page.evaluate(a => { App.S.comprador = a; const r = App.gestionHoy(false, false).map(g => g.proveedor); return r; }, ANDRES), [VISEG]));

  console.log('\n4. Mensajes y registro de la pregunta');
  await page.evaluate(l => { App.S.comprador = l; }, LAURA);
  const mP = await page.evaluate(p => T.preguntar(p), PRAMEC);
  check('plantilla «vencida» cuando hay vencidas', mP.pl === 'vencida', mP.pl);
  check('mensaje incluye aviso de plataforma, detalle numerado y formato', mP.msg.includes('Este seguimiento no reemplaza la facturación en la plataforma de proveedores.') && mP.msg.includes('1) OC-1001 L1') && mP.msg.includes('dd/mm → fecha de entrega') && mP.msg.includes('Carlos (ficticio)'), mP.msg);
  const mI = await page.evaluate(p => T.preguntar(p), INTRALUM);
  check('plantilla «primera_solicitud» con trato tú', mI.pl === 'primera_solicitud' && /^Hola Diana/.test(mI.msg) && mI.msg.includes('Responde con'), mI.msg.slice(0, 80));
  await page.evaluate(a => { App.S.comprador = a; }, ANDRES);
  await page.evaluate(p => T.preguntar(p), VISEG);
  const r1 = await page.evaluate(() => T.reg('OC-1001|1'));
  check('NUEVA → ESPERANDO_FECHA, registra fecha/hora y comprador', r1.estado === 'ESPERANDO_FECHA' && r1.ultima_pregunta === '2026-11-04T09:00:00' && r1.preguntado_por === LAURA, r1);
  check('no se pregunta dos veces el mismo día', (await page.evaluate(p => T.hoyDe(p), PRAMEC)).length === 0 && /ya se preguntó hoy/.test(await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-1001|1']).motivo)));
  const ev = await page.evaluate(() => App.S.eventos.filter(e => e.tipo === 'PREGUNTA').map(e => [e.proveedor, e.comprador, e.lineas]));
  check('evento PREGUNTA guarda la numeración del mensaje', ev.length === 3 && ev[0][2] === 'OC-1001|1 ; OC-1001|2 ; OC-1002|1', ev);

  console.log('\n5. Respuestas (04/11 15:00)');
  await page.evaluate(() => App.setAhora('2026-11-04T15:00:00'));
  await page.evaluate(l => { App.S.comprador = l; }, LAURA);
  const rP = await page.evaluate(p => T.responder(p, '1 ENT\n2 6/11\n3 NO 25/11'), PRAMEC);
  check('respuesta Pramec sin errores', rP.errores.length === 0, rP);
  let e = await page.evaluate(() => T.est());
  check('ENT → ENTREGADO_POR_CONFIRMAR', e['OC-1001|1'] === 'ENTREGADO_POR_CONFIRMAR');
  check('fecha a línea sin fecha → CONFIRMADA', e['OC-1001|2'] === 'CONFIRMADA' && (await page.evaluate(() => T.reg('OC-1001|2').fecha_prometida)) === '2026-11-06');
  const p3 = await page.evaluate(() => ({ r: T.reg('OC-1002|1'), riesgo: App.enRiesgo(App.S.seg['OC-1002|1']) }));
  check('«NO fecha» en línea sin fecha se toma como primera fecha (no cuenta cambio) y marca riesgo', p3.r.estado === 'CONFIRMADA' && p3.r.contador_cambios === 0 && p3.riesgo, p3);
  const rI = await page.evaluate(p => T.responder(p, '1 10/11 2 SI'), INTRALUM);
  check('«SI» en línea sin fecha prometida se marca en rojo', rI.errores.length === 1 && rI.errores[0].n === 2, rI);
  const rI2 = await page.evaluate(p => T.responder(p, '1 10/11 2 SI', { 2: { accion: 'FECHA', fecha: '2026-11-12' } }), INTRALUM);
  check('corrección manual en la vista previa permite guardar', rI2.errores.length === 0 && (await page.evaluate(() => T.reg('OC-2001|2').fecha_prometida)) === '2026-11-12', rI2);
  check('línea sin respuesta queda ESPERANDO_FECHA', (await page.evaluate(() => T.est()))['OC-2002|1'] === 'ESPERANDO_FECHA');

  console.log('\n6. Día siguiente (05/11 10:00): recordatorios y repreguntas');
  await page.evaluate(() => App.setAhora('2026-11-05T10:00:00'));
  check('Viseg sin respuesta > 24 h → recordatorio', eq(await page.evaluate(p => T.hoyDe(p), VISEG), ['OC-3001|1', 'OC-3002|1']) && (await page.evaluate(p => App.plantillaPara(App.gestionHoy(true,false).find(g => g.proveedor === p).hoy), VISEG)) === 'recordatorio');
  check('Intralum: hito de 7 días de la línea prometida el 12/11 + recordatorio de la línea sin fecha', eq(await page.evaluate(p => T.hoyDe(p), INTRALUM), ['OC-2001|2', 'OC-2002|1']), await page.evaluate(p => T.hoyDe(p), INTRALUM));
  check('Intralum: línea prometida el 10/11 no se pregunta (hito de 7 días cubierto por la respuesta del 04/11)', !(await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-2001|1']).preguntar)));
  check('Pramec: confirmada hace 1 día no se repregunta (hito 2 días ya cubierto)', (await page.evaluate(p => T.hoyDe(p), PRAMEC)).length === 0, await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-1001|2'])));
  await page.evaluate(a => { App.S.comprador = a; }, ANDRES);
  await page.evaluate(p => T.preguntar(p), VISEG);
  await page.evaluate(l => { App.S.comprador = l; }, LAURA);
  await page.evaluate(p => T.preguntar(p), INTRALUM);

  console.log('\n7. 06/11 08:00: repregunta el día prometido y cambio de fecha');
  await page.evaluate(() => App.setAhora('2026-11-06T08:00:00'));
  check('Pramec: línea con entrega prometida hoy', eq(await page.evaluate(p => T.hoyDe(p), PRAMEC), ['OC-1001|2']) && /prometida hoy/.test(await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-1001|2']).motivo)));
  const mR = await page.evaluate(p => T.preguntar(p), PRAMEC);
  check('plantilla «repregunta» con opciones SI/NO', mR.pl === 'repregunta' && mR.msg.includes('1 SI → se mantiene') && mR.msg.includes('1 NO dd/mm'), mR.msg);
  await page.evaluate(() => App.setAhora('2026-11-06T11:30:00'));
  await page.evaluate(p => T.responder(p, '1 NO 10/11'), PRAMEC);
  const p2 = await page.evaluate(() => T.reg('OC-1001|2'));
  check('NO + fecha → CAMBIADA, contador 1, guarda fecha anterior', p2.estado === 'CAMBIADA' && p2.contador_cambios === 1 && p2.fecha_prometida_anterior === '2026-11-06' && p2.fecha_prometida === '2026-11-10', p2);

  console.log('\n8. 08/11 09:00: TODO SI y repreguntas por hitos');
  await page.evaluate(() => App.setAhora('2026-11-08T09:00:00'));
  check('Intralum: hito 2 días (I1) y recordatorio (I3); I2 ya preguntada tras su hito', eq(await page.evaluate(p => T.hoyDe(p), INTRALUM), ['OC-2001|1', 'OC-2002|1']), await page.evaluate(() => ['OC-2001|1','OC-2001|2','OC-2002|1'].map(k => App.evaluarLinea(App.S.seg[k]))));
  await page.evaluate(p => T.preguntar(p), INTRALUM);
  const rT = await page.evaluate(p => T.responder(p, 'Hola, todo sí. 2 20/11'), INTRALUM);
  e = await page.evaluate(() => T.est());
  check('TODO SI mantiene las que tienen fecha y la 3 recibe fecha', rT.errores.length === 0 && e['OC-2001|1'] === 'CONFIRMADA' && e['OC-2002|1'] === 'CONFIRMADA' && (await page.evaluate(() => T.reg('OC-2002|1').fecha_prometida)) === '2026-11-20', rT);
  check('Pramec: cambiada a 10/11 → hito 2 días hoy', eq(await page.evaluate(p => T.hoyDe(p), PRAMEC), ['OC-1001|2']));
  await page.evaluate(p => T.preguntar(p), PRAMEC);
  await page.evaluate(p => T.responder(p, '1 ent'), PRAMEC);
  check('segunda ENT de Pramec', (await page.evaluate(() => T.est()))['OC-1001|2'] === 'ENTREGADO_POR_CONFIRMAR');

  console.log('\n9. Vencidas cada N días');
  // Viseg nunca respondió; V1 requerida 06/11 → vencida sin fecha
  await page.evaluate(() => App.setAhora('2026-11-12T09:00:00'));
  // Damos a Viseg una fecha prometida pasada para probar la frecuencia de vencidas
  await page.evaluate(a => { App.S.comprador = a; const r = App.S.seg['OC-3001|1']; r.fecha_prometida = '2026-11-10'; r.estado = 'CONFIRMADA'; r.ultima_respuesta = '2026-11-08T10:00:00'; r.ultima_pregunta = '2026-11-08T09:00:00'; }, ANDRES);
  const v1 = await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-3001|1']));
  check('vencida hace 2 días con último contacto hace 4 → preguntar', v1.preguntar && /vencida/.test(v1.motivo), v1);
  await page.evaluate(() => { App.S.seg['OC-3001|1'].ultima_pregunta = '2026-11-11T09:00:00'; });
  const v1b = await page.evaluate(() => App.evaluarLinea(App.S.seg['OC-3001|1']));
  check('vencida preguntada ayer (frecuencia 2) → no preguntar', !v1b.preguntar, v1b);
  await page.evaluate(() => { const r = App.S.seg['OC-3001|1']; r.fecha_prometida = ''; r.estado = 'ESPERANDO_FECHA'; r.ultima_respuesta = ''; });

  console.log('\n10. Exportar seguimiento y consolidar archivos');
  await page.evaluate(l => { App.S.comprador = l; }, LAURA);
  const exp = await page.evaluate(() => { const d = App.datosMiSeguimiento(); const b64 = XLSX.write(App.libroSeguimiento(d.lineas, d.eventos), { bookType:'xlsx', type:'base64' }); return { b64, n: d.lineas.length, ev: d.eventos.length, provs: [...new Set(d.lineas.map(r => r.proveedor))] }; });
  // Incluye las líneas de Laura y todo lo modificado en este navegador desde la última exportación (aquí también Viseg).
  check('exporta las líneas de Laura (Pramec + Intralum), lo modificado sin exportar y los eventos', exp.n >= 8 && exp.provs.includes(PRAMEC) && exp.provs.includes(INTRALUM) && exp.ev > 0, { n: exp.n, provs: exp.provs, ev: exp.ev });
  const rt = await page.evaluate(b64 => { const wb = XLSX.read(b64, { type:'base64' }); const d = App.leerSeguimiento(wb); const r = d.lineas.find(x => x.clave === 'OC-1001|2'); return { r, ev: d.eventos.length, orig: App.S.seg['OC-1001|2'] }; }, exp.b64);
  const campos = ['estado','fecha_prometida','fecha_prometida_anterior','contador_cambios','ultima_pregunta','ultima_respuesta','fecha_entregado','actualizado','fecha_requerida'];
  check('ida y vuelta Excel conserva estados, fechas y horas', campos.every(c => rt.r[c] === rt.orig[c]), campos.map(c => [c, rt.r[c], rt.orig[c]]));
  const expA = await page.evaluate(a => { App.S.comprador = a; const d = App.datosMiSeguimiento(); return XLSX.write(App.libroSeguimiento(d.lineas, d.eventos), { bookType:'xlsx', type:'base64' }); }, ANDRES);
  // Archivo "viejo" de otro día con un estado anterior para OC-1001|2: no debe ganar.
  const viejo = await page.evaluate(() => { const r = { ...App.S.seg['OC-1001|2'], estado:'CONFIRMADA', fecha_prometida:'2026-11-06', actualizado:'2026-11-04T15:00:00' }; return XLSX.write(App.libroSeguimiento([r], []), { bookType:'xlsx', type:'base64' }); });
  // Archivo de otro comprador más reciente para OC-1002|1: debe ganar.
  const nuevo = await page.evaluate(() => { const r = { ...App.S.seg['OC-1002|1'], estado:'CAMBIADA', fecha_prometida:'2026-11-28', fecha_prometida_anterior:'2026-11-25', contador_cambios:1, actualizado:'2026-11-12T08:00:00' }; return XLSX.write(App.libroSeguimiento([r], []), { bookType:'xlsx', type:'base64' }); });
  await page.evaluate(([a, b, c, d]) => {
    localStorage.clear(); App.S.modificadas.clear();
    T.seguimientos = [
      { nombre:'seguimiento_ZZ_20261104_1500.xlsx', b64:c },               // viejo (nombre posterior a propósito)
      { nombre:'seguimiento_LAURA_GOMEZ_PRUEBA_20261112_0900.xlsx', b64:a },
      { nombre:'seguimiento_ANDRES_RUIZ_PRUEBA_20261112_0900.xlsx', b64:b },
      { nombre:'seguimiento_OTRO_20261112_0800.xlsx', b64:d }];
  }, [exp.b64, expA, viejo, nuevo]);
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_02112026.xlsx']));
  e = await page.evaluate(() => T.est());
  check('consolidación sin trabajo local reconstruye los estados', e['OC-1001|1'] === 'ENTREGADO_POR_CONFIRMAR' && e['OC-2001|2'] === 'CONFIRMADA' && e['OC-3001|1'] === 'ESPERANDO_FECHA', e);
  check('gana el registro más reciente aunque el archivo viejo se lea después', e['OC-1001|2'] === 'ENTREGADO_POR_CONFIRMAR', await page.evaluate(() => T.reg('OC-1001|2')));
  check('registro más reciente de otro archivo gana (OC-1002|1 CAMBIADA 28/11)', e['OC-1002|1'] === 'CAMBIADA' && (await page.evaluate(() => T.reg('OC-1002|1').fecha_prometida)) === '2026-11-28');
  const nEv = await page.evaluate(() => App.S.eventos.length);
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_02112026.xlsx']));
  check('eventos sin duplicar al recargar', nEv === await page.evaluate(() => App.S.eventos.length), nEv);

  console.log('\n11. Explosión 09/11: cierres y líneas nuevas');
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_02112026.xlsx', 'ABASTECIMIENTO_09112026.xlsx']));
  e = await page.evaluate(() => T.est());
  check('usa la explosión más reciente', (await page.evaluate(() => App.S.explosion.nombre)) === 'ABASTECIMIENTO_09112026.xlsx');
  check('ENTREGADO_POR_CONFIRMAR y pendiente 0 → CERRADA', e['OC-1001|1'] === 'CERRADA', e['OC-1001|1']);
  check('desaparece sin ENT → CERRADA_POR_EXPLOSION', e['OC-2001|2'] === 'CERRADA_POR_EXPLOSION', e['OC-2001|2']);
  check('línea nueva → NUEVA', e['OC-3004|1'] === 'NUEVA');
  check('ENT hace 1 día y sigue pendiente: aún no «revisar con almacén»', !(await page.evaluate(() => App.revisarAlmacen(App.S.seg['OC-1001|2']))));
  const ce = await page.evaluate(() => App.S.eventos.filter(e => e.tipo === 'CIERRE').length);
  check('eventos de cierre registrados', ce >= 2, ce);

  console.log('\n12. Explosión 17/11: reapertura y revisar con almacén; explosión vieja no cierra');
  await page.evaluate(() => App.setAhora('2026-11-17T09:00:00'));
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_09112026.xlsx', 'ABASTECIMIENTO_17112026.xlsx']));
  e = await page.evaluate(() => T.est());
  check('ENT hace 9 días (> 7) y sigue pendiente → revisar con almacén', await page.evaluate(() => App.revisarAlmacen(App.S.seg['OC-1001|2'])));
  check('línea cerrada que reaparece → reabierta CONFIRMADA (tenía fecha)', e['OC-2001|2'] === 'CONFIRMADA', e['OC-2001|2']);
  check('V1 recibido sin ENT → CERRADA_POR_EXPLOSION', e['OC-3001|1'] === 'CERRADA_POR_EXPLOSION');
  await page.evaluate(([a, v]) => { App.S.comprador = a; T.preguntar(v); }, [ANDRES, VISEG]);
  check('OC-3004|1 (nueva) preguntada', (await page.evaluate(() => T.est()))['OC-3004|1'] === 'ESPERANDO_FECHA');
  const viejas = await page.evaluate(async () => { await T.cargar(['ABASTECIMIENTO_02112026.xlsx']); return { av: App.S.avisos.join(' '), e: T.est()['OC-3004|1'] }; });
  check('explosión más antigua que el seguimiento no cierra líneas vistas después', viejas.e === 'ESPERANDO_FECHA' && /más antigua/.test(viejas.av), viejas);
  await page.evaluate(() => T.cargar(['ABASTECIMIENTO_17112026.xlsx']));

  console.log('\n13. Mapeo manual de columnas');
  const mp = await page.evaluate(() => {
    const ws = XLSX.utils.aoa_to_sheet([['Nro Documento','Proveedor','Ítem','Descripción','Cant Penditiente - Inventario','Fecha Entrega'], ['OC-1','PRAMEC SAS','X1','Algo',3,'20/11/2026']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'h');
    const a = App.leerExplosion(wb, {});
    const b = App.leerExplosion(wb, { oc:'Nro Documento', linea:'__NINGUNA__', unidad:'__NINGUNA__', comprador:'__NINGUNA__' });
    return { a: { necesita: a.necesitaMapeo, faltan: a.faltan }, b: { ok: b.ok, l: b.ok && Object.values(b.lineas)[0] } };
  });
  check('detecta columnas faltantes y pide mapeo', mp.a.necesita && mp.a.faltan.includes('oc'), mp.a);
  check('con el mapeo recordado lee la explosión (clave OC+ítem, fecha texto)', mp.b.ok && mp.b.l.clave === 'OC-1|X1' && mp.b.l.fecha_requerida === '2026-11-20', mp.b);

  console.log('\n14. Config y tablero');
  const rc = await page.evaluate(() => { const wb = XLSX.read(XLSX.write(App.libroConfig(App.S.config), { bookType:'xlsx', type:'array' }), { type:'array' }); const c = App.leerConfig(wb); return { igual: JSON.stringify(c.proveedores) === JSON.stringify(App.S.config.proveedores) && JSON.stringify(c.plantillas) === JSON.stringify(App.S.config.plantillas), c: c.proveedores[1] }; });
  check('config.xlsx ida y vuelta', rc.igual, rc.c);
  const tb = await page.evaluate(() => { const m = App.metricasProveedores(); return { m: m.map(x => ({ a: x.alias, preg: x.preguntas, resp: x.respondidas, pct: x.pctResp, dias: x.diasResp && Math.round(x.diasResp * 100) / 100, riesgo: x.riesgo, cambios: x.cambios, epc: x.epc, alm: x.almacen })) }; });
  const pr = tb.m.find(x => x.a === 'Pramec'), vi = tb.m.find(x => x.a === 'Viseg'), it = tb.m.find(x => x.a === 'Intralum');
  check('tablero Pramec: 3 mensajes, 3 respondidos, 2 cambios (1 + 1 del otro archivo), 1 entregado por confirmar, 1 revisar almacén', pr.preg === 3 && pr.resp === 3 && pr.cambios === 2 && pr.epc === 1 && pr.alm === 1, pr);
  check('tablero Viseg: 0 % de respuesta', vi.preg === 3 && vi.resp === 0 && vi.pct === 0, vi);
  check('tablero Intralum: días promedio de respuesta calculados', it.dias != null && it.dias > 0, it);
  const rl = await page.evaluate(() => App.lineasRiesgo().map(r => r.clave));
  check('riesgo de faltante ordenado por desfase (OC-1002|1 +8, OC-2002|1 +5)', eq(rl, ['OC-1002|1', 'OC-2002|1']), rl);
  const xt = await page.evaluate(() => App.libroTablero().SheetNames);
  check('exportación del tablero con 4 hojas', eq(xt, ['resumen_proveedores', 'riesgo_faltante', 'cambios_por_linea', 'detalle_lineas']), xt);

  console.log('\n15. Interfaz (sin errores de JavaScript) y botón WhatsApp');
  await page.evaluate(l => { App.S.comprador = l; localStorage.setItem('segprov.comprador', JSON.stringify(l)); }, ANDRES);
  await page.evaluate(() => { App.setAhora('2026-11-19T09:00:00'); App.S.tab = 'hoy'; App.renderTodo(); window.__abiertas = []; window.open = u => { window.__abiertas.push(u); return null; }; });
  const capt = path.join(RAIZ, 'pruebas', 'capturas'); fs.mkdirSync(capt, { recursive: true });
  await page.screenshot({ path: path.join(capt, '1_gestion_hoy.png'), fullPage: true });
  const btn = await page.$('[data-prov] button[data-acc=wa]');
  check('hay tarjeta con botón «Abrir WhatsApp»', !!btn);
  if (btn){
    await btn.click();
    const url = await page.evaluate(() => window.__abiertas[0]);
    const txt = decodeURIComponent((url || '').split('?text=')[1] || '');
    check('abre https://wa.me/57<celular>?text=… con el mensaje', /^https:\/\/wa\.me\/573000000003\?text=/.test(url || '') && txt.includes('plataforma de proveedores'), url && url.slice(0, 60));
  }
  await page.fill('[data-prov] textarea', '1 SI 2 NO');
  await page.click('[data-prov] button[data-acc=interpretar]');
  await page.waitForSelector('tr.err');
  check('vista previa marca en rojo lo no entendido', (await page.$$('tr.err')).length >= 1);
  await page.screenshot({ path: path.join(capt, '2_vista_previa.png'), fullPage: true });
  for (const t of ['lineas', 'tablero']){ await page.click(`#tabs button[data-tab=${t}]`); await page.screenshot({ path: path.join(capt, `3_${t}.png`), fullPage: true }); }
  await page.click('#tabs button[data-tab=tablero]'); await page.click('[data-tv=riesgo]'); await page.screenshot({ path: path.join(capt, '4_riesgo.png'), fullPage: true });
  await page.click('#tabs button[data-tab=admin]'); await page.fill('#admPin', '1234'); await page.click('#admEntrar');
  check('modo administrador se desbloquea con PIN', !!(await page.$('#admExportar')));
  await page.selectOption('#pvProv', INTRALUM); await page.selectOption('#pvPl', 'repregunta');
  check('vista previa de plantilla con datos reales', /Hola Diana/.test(await page.textContent('#pvMsg')) && /OC-20/.test(await page.textContent('#pvMsg')));
  await page.screenshot({ path: path.join(capt, '5_admin.png'), fullPage: true });
  check('sin errores de JavaScript en la página', errores.length === 0, errores);

  await browser.close();
  console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
