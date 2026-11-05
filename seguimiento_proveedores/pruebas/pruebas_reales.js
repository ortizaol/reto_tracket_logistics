// Prueba con los archivos REALES de Siesa (no se versionan). Uso:
//   REAL_OC=/ruta/OC_31102026.txt REAL_EXPL=/ruta/ABASTECIMIENTO_31102026.xlsx node pruebas/pruebas_reales.js
// Filtra el análisis a los proveedores del piloto (PRAMEC, Intralum, Viseg).
const fs = require('fs');
const { abrirPagina } = require('./comun');
const PILOTO = ['PRAMEC SAS', 'INDUSTRIA TRANSFORMADORA DE ALUMINIO S A S', 'VIDRIOS DE SEGURIDAD S.A'];
let ok = 0, fallos = 0;
const check = (n, c, d) => { if (c){ ok++; console.log('  ✓ ' + n); } else { fallos++; console.log('  ✗ ' + n + (d !== undefined ? '  → ' + JSON.stringify(d) : '')); } };
(async () => {
  const { REAL_OC, REAL_EXPL } = process.env;
  if (!REAL_OC || !REAL_EXPL){ console.log('Defina REAL_OC y REAL_EXPL con las rutas de los archivos reales.'); process.exit(0); }
  const fecha = (/_(\d{8})/.exec(REAL_EXPL) || [])[1] || '31102026';
  const hoy = `${fecha.slice(4)}-${fecha.slice(2,4)}-${fecha.slice(0,2)}`;
  const { browser, page, errores } = await abrirPagina({ hoy });
  async function subir(v, ruta, nombre){
    const b64 = fs.readFileSync(ruta).toString('base64'); const N = 5e6;
    await page.evaluate(v => { window[v] = []; }, v);
    for (let i = 0; i < b64.length; i += N) await page.evaluate(([v, s]) => window[v].push(s), [v, b64.slice(i, i + N)]);
    await page.evaluate(([v, n]) => { const bin = atob(window[v].join('')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); window[v] = new File([u], n); }, [v, nombre]);
  }
  await subir('__oc', REAL_OC, require('path').basename(REAL_OC));
  await subir('__ex', REAL_EXPL, require('path').basename(REAL_EXPL));
  const r = await page.evaluate(async (PILOTO) => {
    localStorage.clear();
    let t = performance.now();
    await App.procesar({ ocs:[window.__oc], explosiones:[window.__ex], config:null, seguimientos:[] });
    const primera = Math.round(performance.now() - t);
    t = performance.now();
    await App.procesar({ ocs:[window.__oc], explosiones:[window.__ex], config:null, seguimientos:[] });
    const cache = Math.round(performance.now() - t);
    const out = { primera, cache, modo:App.S.explosion.modo, stats:App.S.ocs.stats, prov:{} };
    App.S.comprador = 'Prueba';
    for (const p of PILOTO){
      const ls = Object.values(App.S.seg).filter(r => r.proveedor === p);
      const g = App.gestionHoy(true, true).find(x => x.proveedor === p);
      const msg = g && g.envio.length ? App.construirMensaje(p, g.envio, App.plantillaPara(g.envio)) : '';
      let interp = null;
      if (g && g.envio.length){
        App.marcarDepuracion(p, 'prueba'); App.registrarPregunta(p, g.envio, 'vencida', msg);
        const ocs = [...new Set(g.envio.map(r => App.numOC(r.oc)))];
        const txt = `[11:59 p. m., ${App.hoy().split('-').reverse().map(Number).join('/')}] X: La ${ocs[0]} llega el 25 de noviembre` + (ocs[1] ? ` y la ${ocs[1]} ya la entregamos` : '');
        App.S.config.proveedores.find(c => c.proveedor === p).nombre_whatsapp = 'X';
        const a = App.analizarPegado(txt).paneles[0];
        interp = { bloqueos:a.bloqueos.length, filas:a.filas.length, ent:a.filas.filter(f => f.accion === 'ENT').length, oc0:g.envio.filter(r => App.numOC(r.oc) === ocs[0]).length, oc1:ocs[1] ? g.envio.filter(r => App.numOC(r.oc) === ocs[1]).length : 0 };
        App.S.config.proveedores.find(c => c.proveedor === p).nombre_whatsapp = '';
      }
      out.prov[p] = { lineas:ls.length, sinNecesidad:ls.filter(r => r.sinNecesidad).length, rojas:ls.filter(r => App.semaforo(r) === 'rojo').length,
        aPreguntar:g ? g.hoy.length : 0, envio:g ? g.envio.length : 0, ocsEnvio:g ? new Set(g.envio.map(r => r.oc)).size : 0, largo:msg.length, interp };
    }
    return out;
  }, PILOTO);
  console.log(`\nArchivos reales: primera carga ${r.primera} ms, con índice en caché ${r.cache} ms · modo ${r.modo} · ${r.stats.abiertas} líneas OC- abiertas`);
  check('la explosión real trae amarre por OC', r.modo === 'amarre');
  check('la segunda carga usa el índice en caché (< 2 s)', r.cache < 2000, r.cache);
  for (const [p, x] of Object.entries(r.prov)){
    console.log(`  ${p}: ${x.lineas} líneas · ${x.sinNecesidad} sin necesidad · ${x.rojas} en rojo · ${x.aPreguntar} a preguntar · mensaje ${x.envio} líneas / ${x.ocsEnvio} OC / ${x.largo} caracteres`);
    check(`${p}: mensaje con máximo 15 líneas y 6 OC`, x.envio <= 15 && x.ocsEnvio <= 6, x);
    check(`${p}: mensaje bajo 3.500 caracteres`, x.largo < 3500, x.largo);
    if (x.interp) check(`${p}: respuesta con OC reales interpretada sin bloqueos`, x.interp.bloqueos === 0 && x.interp.filas === x.interp.oc0 + x.interp.oc1 && x.interp.ent === x.interp.oc1, x.interp);
  }
  check('sin errores de JavaScript', errores.length === 0, errores);
  await browser.close();
  console.log(`\nResultado: ${ok} correctas, ${fallos} fallidas`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
