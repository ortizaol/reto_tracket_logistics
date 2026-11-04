// Genera la carpeta datos_prueba/ con la misma estructura que la carpeta de OneDrive:
//   datos_prueba/config.xlsx
//   datos_prueba/explosiones/ABASTECIMIENTO_ddmmaaaa.xlsx (3 cortes)
//   datos_prueba/respuestas/
// Todos los datos son ficticios. Uso: npm run datos
const fs = require('fs');
const path = require('path');
const { abrirPagina, construirLibros, RAIZ } = require('./comun');

(async () => {
  const { browser, page } = await abrirPagina();
  const libros = await construirLibros(page);
  await browser.close();
  const dir = path.join(RAIZ, 'datos_prueba');
  fs.mkdirSync(path.join(dir, 'explosiones'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'respuestas'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'respuestas', '.gitkeep'), '');
  for (const [nombre, b64] of Object.entries(libros)){
    const destino = nombre.startsWith('ABASTECIMIENTO') ? path.join(dir, 'explosiones', nombre) : path.join(dir, nombre);
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    console.log('escrito', path.relative(RAIZ, destino));
  }
})().catch(e => { console.error(e); process.exit(1); });
