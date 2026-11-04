// Utilidades compartidas por el generador de datos y las pruebas.
// Abre seguimiento.html en Chromium (Playwright) sirviendo SheetJS desde node_modules,
// de modo que las pruebas no dependen de internet.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const HTML = path.join(RAIZ, 'seguimiento.html');
const XLSX_JS = require.resolve('xlsx/dist/xlsx.full.min.js', { paths: [RAIZ] });

async function abrirPagina({ hoy = '2026-11-04', ancho = 1366, alto = 900 } = {}){
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('pageerror', e => errores.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  const lib = fs.readFileSync(XLSX_JS);
  await page.route(/(cdn\.sheetjs\.com|cdnjs\.cloudflare\.com)\/.*xlsx\.full\.min\.js/, r => r.fulfill({ body: lib, contentType: 'application/javascript' }));
  await page.goto('file://' + HTML + '?hoy=' + hoy);
  await page.waitForFunction(() => window.App && window.XLSX);
  return { browser, page, errores };
}

/* ---- Datos ficticios de prueba (3 proveedores del piloto + 1 no activo) ---- */
// Columnas tal como podrían venir de Siesa (con el nombre literal "Cant Penditiente - Inventario").
const ENCABEZADOS = ['Bodega','Proveedor','Comprador','OC','Línea','Ítem','Descripción','U.M.','Cant OC','Cant Penditiente - Inventario','Fecha Entrega','Observación'];
const PRAMEC = 'PRAMEC SAS', INTRALUM = 'INDUSTRIA TRANSFORMADORA DE ALUMINIO S A S', VISEG = 'VIDRIOS DE SEGURIDAD S.A';
const LAURA = 'Laura Gómez (prueba)', ANDRES = 'Andrés Ruiz (prueba)';
// [proveedor, comprador, oc, linea, item, descripcion, um, cantOC, pendiente, fechaReq]
const BASE = {
  P1: [PRAMEC, LAURA, 'OC-1001', 1, 'PRM-100', 'SOPORTE ASIENTO PASAJERO', 'UN', 40, 40, '2026-10-28'],
  P2: [PRAMEC, LAURA, 'OC-1001', 2, 'PRM-101', 'BISAGRA PUERTA SERVICIO', 'UN', 120, 120, '2026-11-06'],
  P3: [PRAMEC, LAURA, 'OC-1002', 1, 'PRM-200', 'PLATINA 3/16 X 2"', 'KG', 15, 15, '2026-11-20'],
  P4: [PRAMEC, LAURA, 'OC-1003', 1, 'PRM-300', 'TAPA REGISTRO MOTOR', 'UN', 10, 10, '2026-12-20'],
  P5: [PRAMEC, LAURA, 'OC-1004', 1, 'PRM-400', 'GUARDAPOLVO (ya recibido)', 'UN', 8, 0, '2026-11-05'],
  PI: [PRAMEC, LAURA, 'OCI-9001', 1, 'IMP-001', 'PIEZA IMPORTADA', 'UN', 5, 5, '2026-11-10'],
  I1: [INTRALUM, LAURA, 'OC-2001', 1, 'INT-500', 'PERFIL VENTANA 6 M', 'UN', 300, 300, '2026-11-10'],
  I2: [INTRALUM, LAURA, 'OC-2001', 2, 'INT-501', 'PERFIL MARCO VENTANA', 'UN', 150, 150, '2026-11-12'],
  I3a:[INTRALUM, LAURA, 'OC-2002', 1, 'INT-600', 'MOLDURA INTERIOR', 'M', 80, 80, '2026-11-15'],
  I3b:[INTRALUM, LAURA, 'OC-2002', 1, 'INT-600', 'MOLDURA INTERIOR', 'M', 80, 50, '2026-11-18'],
  V1: [VISEG, ANDRES, 'OC-3001', 1, 'VIS-10', 'VIDRIO PARABRISAS', 'UN', 4, 4, '2026-11-06'],
  V2: [VISEG, ANDRES, 'OC-3002', 1, 'VIS-20', 'VIDRIO LATERAL TEMPLADO', 'UN', 12, 12, '2026-11-25'],
  V3: [VISEG, ANDRES, 'OC-3003', 1, 'VIS-30', 'VIDRIO CLARABOYA (excluida)', 'UN', 2, 2, '2026-11-09'],
  V4: [VISEG, ANDRES, 'OC-3004', 1, 'VIS-40', 'ESPEJO RETROVISOR', 'UN', 6, 6, '2026-11-20'],
  M1: ['METALES FICTICIOS SAS', ANDRES, 'OC-4001', 1, 'MET-1', 'LAMINA CR CAL 18', 'KG', 500, 500, '2026-11-08'],
};
const EXPLOSIONES = {
  'ABASTECIMIENTO_02112026.xlsx': ['P1','P2','P3','P4','P5','PI','I1','I2','I3a','I3b','V1','V2','V3','M1'],
  'ABASTECIMIENTO_09112026.xlsx': ['P2','P3','P4','I1','I3a','V1','V2','V3','V4','M1'],          // P1 recibido, I2 desaparece
  'ABASTECIMIENTO_17112026.xlsx': ['P2','P3','P4','I1','I2','I3a','V2','V3','V4','M1'],          // I2 reaparece, V1 recibido
};
const CONFIG = {
  proveedores: [
    { proveedor: PRAMEC, alias: 'Pramec', activo: 'SI', contacto: 'Carlos (ficticio)', celular: '3000000001', comprador: LAURA, trato: 'usted' },
    { proveedor: INTRALUM, alias: 'Intralum', activo: 'SI', contacto: 'Diana (ficticia)', celular: '300 000 0002', comprador: LAURA, trato: 'tu' },
    { proveedor: VISEG, alias: 'Viseg', activo: 'SI', contacto: 'Jorge (ficticio)', celular: '+57 300 000 0003', comprador: ANDRES, trato: 'usted' },
    { proveedor: 'METALES FICTICIOS SAS', alias: 'Metales', activo: 'NO', contacto: '', celular: '', comprador: ANDRES, trato: 'usted' },
  ],
  exclusiones: [{ tipo: 'OC', valor: 'OC-3003', motivo: 'Prueba: OC en negociación' }],
};

/** Construye en la página los libros de prueba y devuelve {nombre: base64}. */
async function construirLibros(page){
  return page.evaluate(({ ENCABEZADOS, BASE, EXPLOSIONES, CONFIG }) => {
    const serial = iso => (Date.UTC(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)) - Date.UTC(1899,11,30)) / 864e5;
    const out = {};
    for (const [nombre, claves] of Object.entries(EXPLOSIONES)){
      const f = nombre.slice(15, 23);
      const aoa = [['EXPLOSIÓN DE ABASTECIMIENTO - DATOS FICTICIOS DE PRUEBA'], ['Generado: ' + f.slice(0,2) + '/' + f.slice(2,4) + '/' + f.slice(4)], [], ENCABEZADOS];
      for (const k of claves){ const b = BASE[k]; aoa.push(['BOD-01', b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], serial(b[9]), '']); }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      for (let r = 4; r < aoa.length; r++){ const c = ws[XLSX.utils.encode_cell({ r, c:10 })]; if (c) c.z = 'dd/mm/yyyy'; }
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Explosion');
      out[nombre] = XLSX.write(wb, { bookType:'xlsx', type:'base64' });
    }
    const base = JSON.parse(JSON.stringify(App.S.config));
    out['config.xlsx'] = XLSX.write(App.libroConfig({ ...base, proveedores: CONFIG.proveedores, exclusiones: CONFIG.exclusiones }), { bookType:'xlsx', type:'base64' });
    return out;
  }, { ENCABEZADOS, BASE, EXPLOSIONES, CONFIG });
}

module.exports = { abrirPagina, construirLibros, RAIZ, BASE, CONFIG, PRAMEC, INTRALUM, VISEG, LAURA, ANDRES };
