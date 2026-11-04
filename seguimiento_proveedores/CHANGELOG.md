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

## v0.2 — Gestión de hoy, WhatsApp e intérprete de respuestas
- Reglas de "qué preguntar hoy": horizonte (fecha requerida ≤ hoy + N semanas) más vencidas; sin fecha prometida → primera solicitud o recordatorio tras N horas; con fecha → repregunta en los hitos configurados (7, 2, 0 días) y vencidas cada N días; nunca dos veces el mismo día.
  Los hitos se evalúan como "¿hubo contacto después del hito?", para no perder la repregunta si la herramienta no se abre justo ese día.
- Tarjeta por proveedor con líneas numeradas y ordenadas por urgencia; un solo mensaje por proveedor con la plantilla según el estado de sus líneas (vencida > primera solicitud > recordatorio > repregunta) y el aviso obligatorio de la plataforma de proveedores.
- Botón "Abrir WhatsApp" (wa.me/57…) y "Copiar mensaje"; al enviar se registra fecha/hora, comprador y la numeración del mensaje (evento PREGUNTA), porque la respuesta puede llegar otro día.
- Intérprete de respuestas tolerante ("1 SI", "1 NO 25/11", "1 ENT", "TODO SI", "2 25/11", sí/si, d/m, dd-mm, dd/mm/aaaa, prefijos de WhatsApp) con vista previa editable: estado y fecha anterior → nueva, desfase contra la requerida y filas en rojo que bloquean el guardado.
- Exportar mi seguimiento → `respuestas/seguimiento_<comprador>_<aaaammdd_hhmm>.xlsx` (hojas `lineas` y `eventos`), directo a la carpeta si está conectada.
- **Motivo:** el comprador necesita un flujo de un clic por proveedor y registrar la respuesta sin digitar; la numeración guardada evita errores al cruzar la respuesta con las líneas.

## v0.3 — Modo administrador
- Pestaña "Administrador" con PIN (freno visual; la seguridad real son los permisos de OneDrive sobre `config.xlsx`).
- Edición de proveedores (alias, activo, contacto, celular, comprador, trato usted/tú) con verificación de que el nombre exista en la explosión y lista de proveedores nacionales aún no configurados.
- Edición de reglas, plantillas (usted/tú) con vista previa del mensaje usando líneas reales del proveedor, y exclusiones (OC / ítem / línea).
- Exportar `config.xlsx` (escribe en la carpeta si está conectada; si no, descarga). Los cambios no exportados se guardan en el navegador y se señalan.
- **Motivo:** el administrador debe poder ampliar el piloto y ajustar mensajes sin tocar el HTML ni editar Excel a mano.
