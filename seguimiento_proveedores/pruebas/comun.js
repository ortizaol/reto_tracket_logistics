// Utilidades compartidas por el generador de datos y las pruebas.
// Abre seguimiento.html en Chromium (Playwright) sirviendo SheetJS desde node_modules,
// de modo que las pruebas no dependen de internet.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const HTML = path.join(RAIZ, 'seguimiento.html');
const XLSX_JS = require.resolve('xlsx/dist/xlsx.full.min.js', { paths: [RAIZ] });

async function abrirPagina({ hoy = '2026-11-05', ancho = 1366, alto = 900 } = {}){
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('pageerror', e => errores.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  const lib = fs.readFileSync(XLSX_JS);
  await page.route(/(cdn\.sheetjs\.com|cdnjs\.cloudflare\.com)\/.*xlsx\.full\.min\.js/, r => r.fulfill({ body: lib, contentType: 'application/javascript' }));
  await page.goto('file://' + HTML + (hoy ? '?hoy=' + hoy : ''));
  await page.waitForFunction(() => window.App && window.XLSX);
  return { browser, page, errores };
}

/* =========================================================================
   Datos ficticios de prueba (3 proveedores del piloto + 1 no activo)
   ========================================================================= */
const PRAMEC = 'PRAMEC SAS', INTRALUM = 'INDUSTRIA TRANSFORMADORA DE ALUMINIO S A S', VISEG = 'VIDRIOS DE SEGURIDAD S.A', METALES = 'METALES FICTICIOS SAS';
const COMP_A = 'COMPRADORA A (PRUEBA)', COMP_B = 'COMPRADORA B (PRUEBA)';

// Listado de OC abiertas, con las columnas reales de Siesa.
const ENC_OC = ['Fecha orden','Nro orden','Razón social proveedor','Bodega','Item','Desc. item','U.M.','Cant. ordenada','Cant. entrada','Cant. pendiente','Precio unit.','Estado','Fecha entrega','comprador','Nro solicitud','Notas movto.','Fecha actualización','Usuario actualización','Usuario anulación','Fecha cumplido','Usuario cumplido','Notas documento',''];
// [fechaOC, OC, proveedor, item, descripción, UM, pendiente, fechaEntrega, comprador, solicitud]
const OC_BASE = {
  // Pramec: ítem 0010001 en dos OC (FIFO con 3 necesidades); 0010003 sin necesidad
  P1: ['01/10/2026','OC-00051420',PRAMEC,'0010001','TORNILLO HEF 8X50 ZINCADO','Und','100,00','10/11/2026',COMP_A,'001-SC-00016001'],
  P2: ['01/10/2026','OC-00051420',PRAMEC,'0010002','TUERCA M8 AUTOFRENANTE','Und','200,00','10/11/2026',COMP_A,'001-SC-00016001'],
  P3: ['10/10/2026','OC-00051421',PRAMEC,'0010001','TORNILLO HEF 8X50 ZINCADO','Und','100,00','20/11/2026',COMP_A,'001-SC-00016050'],
  P4: ['15/10/2026','OC-00051422',PRAMEC,'0010003','SOPORTE ASIENTO PASAJERO','Und','40,00','25/11/2026',COMP_A,'001-SC-00016070'],
  // Intralum: necesidad vencida; misma OC+ítem con dos solicitudes
  I1: ['20/09/2026','OC-00052001',INTRALUM,'0020001','PERFIL VENTANA 6 M','m','300,00','25/10/2026',COMP_A,'001-SC-00015900'],
  I2: ['02/10/2026','OC-00052002',INTRALUM,'0020002','PERFIL MARCO VENTANA','m','150,00','12/11/2026',COMP_A,'001-SC-00016010'],
  I3: ['02/10/2026','OC-00052002',INTRALUM,'0020002','PERFIL MARCO VENTANA','m','50,00','19/11/2026',COMP_A,'001-SC-00016020'],
  // Viseg: una OC con varios ítems
  V1: ['05/10/2026','OC-00053001',VISEG,'0030001','VIDRIO PARABRISAS LAMINADO','Und','4,00','15/11/2026',COMP_B,'001-SC-00016100'],
  V2: ['05/10/2026','OC-00053001',VISEG,'0030002','VIDRIO LATERAL TEMPLADO','Und','12,00','15/11/2026',COMP_B,'001-SC-00016100'],
  V3: ['05/10/2026','OC-00053001',VISEG,'0030003','VIDRIO CLARABOYA','Und','2,00','15/11/2026',COMP_B,'001-SC-00016100'],
  V4: ['12/10/2026','OC-00053002',VISEG,'0030004','ESPEJO RETROVISOR','Und','6,00','28/11/2026',COMP_B,'001-SC-00016150'],
  // Proveedor no activo (sirve para el candado de OC ajena)
  M1: ['01/10/2026','OC-00054001',METALES,'0040001','LAMINA CR CAL 18','Kg','500,00','18/11/2026',COMP_B,'001-SC-00016200'],
  // Excluidas por prefijo
  X1: ['01/10/2026','OCI-00010520',PRAMEC,'0010009','PIEZA IMPORTADA','Und','5,00','10/12/2026',COMP_A,'001-OCI-10126'],
  X2: ['01/10/2026','OM-00001024',VISEG,'0030009','SERVICIO MAQUILA','Und','5,00','10/12/2026',COMP_B,'001-OMI-997'],
};
const LISTADOS = {
  'OC_04112026.txt': ['P1','P2','P3','P4','I1','I2','I3','V1','V2','V3','V4','M1','X1','X2'],
  'OC_09112026.txt': ['P2','P3','P4','I1','I2','I3','V1','V2','V4','M1','X1','X2'],   // P1 recibido; V3 desaparece
};
function textoListadoOC(claves){
  const filas = [ENC_OC.join('\t'), ['Gran total','','','','','','','1.234,00','0,00','1.234,00','','','','','','','','','','','','',''].join('\t')];
  for (const k of claves){
    const b = OC_BASE[k];
    filas.push([b[0], b[1], b[2], '001  ', b[3], b[4], b[5], b[6], '0,00', b[6], '1.000', 'Aprobado', b[7], b[8], b[9], 'CRONOGRAMA_PRUEBA', '01/10/2026 2:16 p. m.', 'usuario', '', '', '', '', ''].join('\t'));
  }
  return Buffer.from(filas.join('\r\n') + '\r\n', 'latin1');    // Siesa exporta en Latin-1
}
// Explosión: necesidades por OP con la OC amarrada (TD_FECHAS.Nro orden). Ítems sin ceros a la izquierda, como en el archivo real.
const ENC_EXP = ['Tipo Demanda','OP / DOC','EP','Item','Descripción','Und Inv','Cantidad Requerida','Cantidad Pendiente','Cant Penditiente - Inventario','Fecha Requerido','Fecha Planeación','Estado cobertura','TD_FECHAS.Nro orden','Proveedor'];
// [OP, item, pendiente-inventario, fechaPlaneacion, OC amarrada]
const NECESIDADES = [
  ['OP-1001','10001', 60,'2026-11-15','OC-00051420'],   // ítem en 2 OC, 3 necesidades
  ['OP-1002','10001', 80,'2026-11-20','OC-00051420'],
  ['OP-1002','10001', 40,'2026-11-20','OC-00051421'],
  ['OP-1003','10001', 50,'2026-11-30','OC-00051421'],
  ['OP-1001','10002',200,'2026-11-16','OC-00051420'],
  ['OP-0990','20001',300,'2026-10-28','OC-00052001'],   // necesidad vencida
  ['OP-1001','20002',120,'2026-11-12','OC-00052002'],   // misma OC+ítem, 2 solicitudes
  ['OP-1004','20002', 60,'2026-11-26','OC-00052002'],
  ['OP-1001','30001',  4,'2026-11-10','OC-00053001'],   // OC con varios ítems
  ['OP-1001','30002', 12,'2026-11-13','OC-00053001'],
  ['OP-1005','30003',  2,'2026-11-24','OC-00053001'],
  ['OP-1005','30004',  6,'2026-12-20','OC-00053002'],   // fuera del horizonte de 4 semanas
  ['OP-1001','40001',500,'2026-11-18','OC-00054001'],
  ['OP-1006','99999', 10,'2026-11-18','0'],              // necesidad sin OC (no afecta)
  ['OP-1007','10003',  0,'2026-11-18','OC-00051422'],   // pendiente-inventario 0: cubierta por inventario
];
const CONFIG = {
  proveedores: [
    { proveedor: PRAMEC, alias: 'Pramec', activo: 'SI', contacto: 'Carlos (ficticio)', celular: '3000000001', nombre_whatsapp: 'PRAMEC - Carlos', comprador: COMP_A, trato: 'usted' },
    { proveedor: INTRALUM, alias: 'Intralum', activo: 'SI', contacto: 'Diana (ficticia)', celular: '300 000 0002', nombre_whatsapp: 'INTRALUM - Diana', comprador: COMP_A, trato: 'tu' },
    { proveedor: VISEG, alias: 'Viseg', activo: 'SI', contacto: 'Jorge (ficticio)', celular: '+57 300 000 0003', nombre_whatsapp: 'VISEG - Jorge;Viseg Despachos', comprador: COMP_B, trato: 'usted' },
    { proveedor: METALES, alias: 'Metales', activo: 'NO', contacto: '', celular: '', nombre_whatsapp: '', comprador: COMP_B, trato: 'usted' },
  ],
  exclusiones: [],
};

/** Construye en la página los libros de prueba y devuelve {nombre: base64}. */
async function construirLibros(page){
  const libros = await page.evaluate(({ ENC_EXP, NECESIDADES, CONFIG }) => {
    const serial = iso => (Date.UTC(+iso.slice(0,4), +iso.slice(5,7)-1, +iso.slice(8,10)) - Date.UTC(1899,11,30)) / 864e5;
    const out = {};
    const aoa = [ENC_EXP];
    for (const [op, it, c, f, oc] of NECESIDADES) aoa.push(['OPFI', op, 'EP1', +it, 'ITEM ' + it, 'Und', c, c, c, serial(f) + 7, serial(f), c > 0 ? 'Transito' : 'Cubierto', oc, '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let r = 1; r < aoa.length; r++) for (const c of [9, 10]){ const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = 'dd/mm/yyyy'; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Explosión');
    out['ABASTECIMIENTO_04112026.xlsx'] = XLSX.write(wb, { bookType:'xlsx', type:'base64' });
    const base = JSON.parse(JSON.stringify(App.S.config));
    out['config.xlsx'] = XLSX.write(App.libroConfig({ ...base, proveedores: CONFIG.proveedores, exclusiones: CONFIG.exclusiones }), { bookType:'xlsx', type:'base64' });
    return out;
  }, { ENC_EXP, NECESIDADES, CONFIG });
  for (const [n, claves] of Object.entries(LISTADOS)) libros[n] = textoListadoOC(claves).toString('base64');
  return libros;
}

module.exports = { abrirPagina, construirLibros, RAIZ, OC_BASE, NECESIDADES, CONFIG, PRAMEC, INTRALUM, VISEG, METALES, COMP_A, COMP_B };
