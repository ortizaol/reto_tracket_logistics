# CHANGELOG — Seguimiento de entregas de proveedores nacionales

Formato: cada versión explica **qué** cambió y **por qué**.

## v0.1 — Núcleo de datos
- Archivo único `seguimiento.html` (sin servidor; SheetJS por CDN con respaldo local `xlsx.full.min.js`).
- Carga por carpeta (File System Access API: Edge/Chrome recuerdan la carpeta) o por selección manual de archivos.
- Elige automáticamente la explosión más reciente por la fecha del nombre `ABASTECIMIENTO_ddmmaaaa.xlsx`.
- Lectura de la explosión: detecta la fila de encabezados y las columnas por nombre; si falta alguna, muestra un mapeo manual que se recuerda.
  Filtra OC nacionales (`OC-`, excluye `OCI-`) con `Cant Penditiente - Inventario` > 0.
- Lectura de `config.xlsx` (proveedores, reglas, plantillas, exclusiones) con configuración por defecto del piloto.
- Consolidación de los archivos de `respuestas/` + trabajo local: por línea (OC + línea) gana el registro más reciente.
- Conciliación con la explosión: líneas nuevas → NUEVA; ausentes → CERRADA (si estaban ENTREGADO_POR_CONFIRMAR) o CERRADA_POR_EXPLOSION; reapertura si vuelven a aparecer.
- **Motivo:** la explosión de Siesa no refleja a diario las entradas a almacén; la fuente de verdad de las fechas prometidas es el archivo de seguimiento y la explosión solo agrega y cierra líneas.
