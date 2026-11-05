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

## v0.4 — Tablero
- Indicadores por proveedor: % de respuesta (mensaje respondido antes del siguiente mensaje), días promedio de respuesta, líneas sin fecha y vencidas, líneas en riesgo de faltante (en rojo), cambios de fecha totales / líneas con cambios / máximo por línea, entregados por confirmar y "revisar con almacén".
- Vista "Riesgo de faltante": líneas abiertas con fecha prometida posterior a la requerida, ordenadas por días de desfase.
- Vista "Cambios de fecha por línea" con historial de fechas (de los eventos).
- Exportación del tablero a Excel (resumen, riesgo, cambios y detalle de líneas) con fechas reales de Excel.
- **Motivo:** medir la confiabilidad de cada proveedor y priorizar dónde intervenir antes de que el faltante llegue a la línea de producción.

## v0.5 — Datos de prueba, pruebas automatizadas y ajustes
- `datos_prueba/` con datos ficticios: 3 explosiones (02/11, 09/11, 17/11) de los 3 proveedores del piloto + 1 no activo, OCI, pendiente 0, duplicados y una exclusión; `config.xlsx` de ejemplo.
- `pruebas/pruebas.js` (86 verificaciones en Chromium): intérprete de respuestas, todas las transiciones de estado, reglas de qué preguntar por día, consolidación de archivos de varios compradores, cierres/reapertura por explosión, "revisar con almacén", mapeo manual, tablero, exportaciones de ida y vuelta y la interfaz (botón WhatsApp, vista previa en rojo, PIN).
- SheetJS: primero el CDN oficial (0.20.3, corrige vulnerabilidades de 0.18.5), luego cdnjs 0.18.5 y por último copia local.
- Vista previa: una fila con error ya no muestra el estado resultante (antes sugería "→ Confirmada").
- README con uso para comprador, administración y estructura de carpetas en OneDrive.
- **Motivo:** asegurar el comportamiento antes del piloto y dejar una forma reproducible de verificar cada mejora.

## v0.6 — Rediseño: OC abiertas como base, mensajes por OC, lenguaje natural y candados contra cruces

### Bloque 1 · Fuentes y fecha requerida desde planeación
- La base del seguimiento pasa a ser el **listado de OC abiertas de Siesa** (`oc_abiertas/OC_ddmmaaaa.txt`, texto con tabuladores en Latin-1; también .xlsx/.csv). Clave interna: **OC | ítem | Nro solicitud** (el listado no trae número de línea y OC + ítem se repite).
- Prefijos que entran: parámetro `prefijos_oc` (por defecto `OC-`); `OCI-` siempre excluido.
- **Fecha requerida = Fecha Planeación de la explosión.** La explosión real trae `TD_FECHAS.Nro orden`: cada necesidad ya viene amarrada a una OC, así que se usa ese amarre (OC + ítem). Si varias líneas comparten OC + ítem, FIFO entre ellas. Si la explosión no trae esa columna, FIFO por ítem (necesidades por fecha de planeación vs. OC por fecha de OC).
- Sin colchón: si la planeación ya pasó, la requerida es hoy. Líneas sin necesidad → "Sin necesidad en planeación" (no se preguntan; visibles en tablero y en Todas las líneas).
- Semáforo interno: verde (prometida ≤ requerida), rojo (prometida > requerida, o requerida vencida sin fecha), gris (sin fecha aún).
- Cierre de líneas según el listado de OC (ya no según la explosión): ENTREGADO → CERRADA; desaparece sin aviso → CERRADA_SIESA.
- Explosión de 26 MB / 170.000 filas: se guarda un índice compacto en el navegador; la primera lectura tarda ~9 s y las siguientes ~0,2 s.
- Cabecera con "OC abiertas: fecha · Explosión: fecha" y alerta si alguno tiene más de `dias_alerta_archivos` (4) días.
- **Motivo:** el listado de OC es lo que el proveedor debe entregar; la explosión dice cuándo se necesita. Usar el amarre de planeación evita inventar prioridades.

### Bloque 2 · Mensaje agrupado por OC
- Mensaje por proveedor agrupado por OC (número corto: `OC 51420`), con líneas numeradas dentro de cada OC: `• Ítem 1 · Descripción (código Siesa) · 500 und · Requerida 18 nov · Confirmada: 20 nov | Sin confirmar`.
- Fechas en palabras ("hoy", "20 nov"); la fecha de planeación se muestra como "Requerida". Descripción recortada a ~30 caracteres.
- Tope por mensaje: `max_lineas_mensaje` (15) y `max_oc_mensaje` (6), las más urgentes primero; el resto queda para el siguiente envío (se indica en la tarjeta).
- Plantillas nuevas con `{proveedor}` y `{ejemplos}`: ejemplos de respuesta en lenguaje natural armados con los números reales de OC del mensaje.
- **Motivo:** el proveedor piensa en OC, no en líneas sueltas; un mensaje corto, ordenado por urgencia y con ejemplos reales responde más rápido y con menos ambigüedad.

### Bloque 3 · Intérprete de respuestas en lenguaje natural (reglas, sin IA)
- Referencias por OC ("OC 51420", "la 51420", con o sin ceros) y por ítem ("ítem 2", "el 18", "ítems 1 y 3", o el código Siesa). Solo OC → todos sus ítems del mensaje; ítem → solo ese ítem. Precedencia: ítem > OC > "todo"; a igual nivel gana la última mención.
- Mantener: "todo igual", "todo bien", "ok", "se mantienen", "sí", "confirmado", "sin novedad". Entregado: "ya la entregamos", "entregada", "ya llegó"; "despachada / en camino" = entregado por confirmar con nota.
- Fechas: 25/11, 25-11, "25 de noviembre", "25 nov", "el 25" (mes actual o siguiente), "mañana", "hoy", días de la semana. Fechas vagas ("la próxima semana", "en 15 días", "apenas salga") → amarillo, el comprador elige la fecha.
- Frases con varias órdenes ("la 51420 llega el 25 y la 51425 ya la entregamos") y excepciones ("todo igual excepto la 51425 que llega el 28").
- "Todo igual" en una línea que nunca tuvo fecha → amarillo con la requerida propuesta (no se asume).
- **Candado:** una OC o un ítem que pertenece a otro proveedor bloquea la respuesta completa.
- **Motivo:** los proveedores no van a responder con un formato rígido; reglas explícitas (sin IA) dan resultados predecibles y explicables, y lo que no es seguro queda en amarillo o rojo para el comprador.
