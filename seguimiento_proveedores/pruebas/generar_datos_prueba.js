// Genera la carpeta datos_prueba/ con la misma estructura que la carpeta de OneDrive:
//   datos_prueba/config.xlsx
//   datos_prueba/oc_abiertas/OC_ddmmaaaa.txt        (listado de OC abiertas de Siesa, Latin-1 con tabuladores)
//   datos_prueba/explosiones/ABASTECIMIENTO_ddmmaaaa.xlsx
//   datos_prueba/respuestas/  y  datos_prueba/depuracion/
// Todos los datos son ficticios. Uso: npm run datos
const fs = require('fs');
const path = require('path');
const { abrirPagina, construirLibros, RAIZ } = require('./comun');

(async () => {
  const { browser, page } = await abrirPagina();
  const libros = await construirLibros(page);
  await browser.close();
  const dir = path.join(RAIZ, 'datos_prueba');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const d of ['explosiones', 'oc_abiertas', 'respuestas', 'depuracion']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  for (const d of ['respuestas', 'depuracion']) fs.writeFileSync(path.join(dir, d, '.gitkeep'), '');
  // En datos_prueba solo va el primer corte de OC; el segundo se usa en las pruebas para simular recepciones.
  for (const [nombre, b64] of Object.entries(libros)){
    if (nombre === 'OC_09112026.txt') continue;
    const sub = nombre.startsWith('ABASTECIMIENTO') ? 'explosiones' : nombre.startsWith('OC_') ? 'oc_abiertas' : '';
    const destino = path.join(dir, sub, nombre);
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    console.log('escrito', path.relative(RAIZ, destino));
  }
})().catch(e => { console.error(e); process.exit(1); });
