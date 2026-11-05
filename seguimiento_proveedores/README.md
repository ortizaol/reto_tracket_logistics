# Seguimiento de entregas · Proveedores nacionales (Busscar de Colombia)

Herramienta web de **un solo archivo** (`seguimiento.html`): sin servidor ni instalación. Su única dependencia es SheetJS,
que se carga por CDN. Sirve para preguntar por WhatsApp las fechas de entrega de las OC nacionales y registrar las respuestas.

- **Base del seguimiento:** el listado de **OC abiertas** de Siesa (lo que el proveedor debe entregar).
- **Fecha requerida:** la **Fecha Planeación** de la explosión de abastecimiento (cuándo se necesita en planta), sin colchón.
- **Fuente de verdad de las fechas prometidas:** los archivos de seguimiento en `respuestas/`.

Paso a paso para compradores (para principiantes): [INSTRUCTIVO.md](INSTRUCTIVO.md). Historial: [CHANGELOG.md](CHANGELOG.md).

## Estructura de carpetas en OneDrive

```
Seguimiento_Proveedores/          ← carpeta compartida (sincronizada con OneDrive)
├── seguimiento.html              ← la herramienta (abrir con Edge o Chrome)
├── config.xlsx                   ← solo lo edita el administrador (compradores: solo lectura)
├── oc_abiertas/                  ← OC_ddmmaaaa.txt   (listado de OC abiertas exportado de Siesa)
├── explosiones/                  ← ABASTECIMIENTO_ddmmaaaa.xlsx (también .csv o .zip con el .csv)
├── respuestas/                   ← seguimiento_<comprador>_<aaaammdd>.xlsx (se guardan solos)
└── depuracion/                   ← depuracion_<proveedor>_<aaaammdd>.xlsx (Excel para conciliar por llamada)
```

La herramienta toma siempre el archivo **más reciente por la fecha del nombre**. Si el listado de OC o la explosión tienen
más de 4 días, muestra una alerta roja. Si la red bloquea los CDN, copie `xlsx.full.min.js` (SheetJS) junto al HTML.

## Cómo se calcula la fecha requerida

1. Del listado de OC abiertas entran las líneas con prefijo `OC-` (parámetro `prefijos_oc`; `OCI-` nunca) y cantidad pendiente > 0.
   Clave interna: **OC | ítem | Nro solicitud** (Siesa no trae número de línea).
2. La explosión trae `TD_FECHAS.Nro orden`: **cada necesidad viene amarrada a una OC**. La fecha requerida de una línea es la
   Fecha Planeación de la primera necesidad pendiente (`Cant Penditiente - Inventario` > 0) que cubre esa OC + ítem.
   Si varias líneas comparten OC + ítem (distinta solicitud), se reparten en orden FIFO por fecha de entrega.
3. Si la explosión no trae la columna de OC, se usa FIFO por ítem: necesidades por fecha de planeación contra OC por fecha de OC.
4. Si la planeación ya pasó, la requerida es **hoy**. Línea sin necesidad → **Sin necesidad en planeación** (no se pregunta;
   candidata a aplazar o cancelar, visible en el tablero).
5. Semáforo: 🟢 prometida ≤ requerida · 🔴 prometida > requerida, o requerida vencida sin fecha (llamar) · ⚪ aún sin fecha.

La explosión real (~26 MB, 170.000 filas) tarda unos 10 s la primera vez; después se usa un índice guardado en el navegador (0,2 s).

## Cómo trabaja el comprador (resumen)

1. Abrir `seguimiento.html` en Edge/Chrome → **Conectar carpeta** (la primera vez) o **Reconectar** → elegir su nombre en **Comprador**.
2. **Depuración inicial** (una vez por proveedor, antes del primer WhatsApp): descargar el Excel, conciliar por llamada
   (ENTREGADO / NUEVA FECHA / CANCELAR) y cargarlo.
3. **Abrir WhatsApp** en cada tarjeta: el mensaje va agrupado por OC, con máximo 15 líneas y 6 OC (las más urgentes).
   Si quedan líneas, la tarjeta ofrece el siguiente envío.
4. Cuando el proveedor responda: en WhatsApp Web **seleccionar los mensajes** (flecha ⌄ → «Seleccionar mensajes») → Ctrl+C →
   pegar en **Pegar respuestas de WhatsApp** → **Analizar respuestas** → revisar → **Confirmar respuesta de <PROVEEDOR>**.
5. Todo se guarda solo en `respuestas/`. Si se equivocó: **Deshacer última respuesta** en la tarjeta del proveedor.

### Lo que entiende el intérprete (reglas, sin IA)

| El proveedor escribe | Resultado |
|---|---|
| «Todo igual», «ok», «se mantienen», «sí», «confirmado», «sin novedad» | Se mantienen las fechas (si una línea no tenía fecha → amarillo, se propone la requerida) |
| «La 51420 llega el 25 de noviembre» | Todas las líneas de la OC 51420 del mensaje → 25/11 |
| «El ítem 2 de la 51420 llega el 21» · «el ítem 18 llega el 21» | Solo ese ítem |
| «La 51425 ya la entregamos» · «entregada» · «ya llegó» | Entregado por confirmar (se cierra cuando Siesa ya no la muestre abierta) |
| «Despachada» · «en camino» | Entregado por confirmar, con nota |
| 25/11 · 25-11 · «25 nov» · «el 25» · «mañana» · «hoy» · «el viernes» | Fecha (sin año: la más cercana) |
| «La próxima semana» · «en 15 días» · «apenas salga» | **Amarillo**: el comprador elige la fecha |
| «Todo igual excepto la 51425 que llega el 28» | Excepciones y varias órdenes en una frase |

### Candados contra cruces de proveedor
- Un solo cuadro de pegado: el proveedor **no se elige**, se identifica por el **remitente** del mensaje copiado
  (celular, prioridad 1; `nombre_whatsapp` de config.xlsx, prioridad 2). Varios proveedores en un pegado → un panel por cada uno.
- Se ignoran los mensajes propios de Busscar (`nombre_cuenta_busscar`) y los anteriores a la última pregunta.
- **Bloquea:** pegado sin encabezado de WhatsApp, remitente desconocido, OC o ítem que pertenece a otro proveedor,
  Excel de depuración de otro proveedor.
- Confirmación con el nombre del proveedor en grande; deshabilitada mientras haya filas en rojo o amarillo.

## Cómo se administra

Pestaña **Administrador** (PIN inicial `1234`; es un freno visual: la seguridad real es que solo el administrador pueda
escribir `config.xlsx` en OneDrive).

- **Proveedores:** nombre exacto como en el listado de Siesa, alias, activo, contacto, **celular**, **nombre_whatsapp**
  (como aparece el contacto en WhatsApp Web, ej. `PRAMEC - Carlos`; varios separados por `;`), comprador y trato usted/tú.
- **Reglas:** `prefijos_oc`, horizonte (3–6 semanas), días de repregunta (7,2,0), frecuencia de vencidas, horas para recordatorio,
  días para «revisar con almacén», `max_lineas_mensaje` (15), `max_oc_mensaje` (6), `dias_alerta_archivos` (4),
  `nombre_cuenta_busscar`, `formato_fecha_whatsapp` (d/m) y PIN.
- **Plantillas** (primera solicitud, repregunta, recordatorio, vencida; usted y tú). Campos: `{contacto}` `{proveedor}`
  `{detalle}` `{ejemplos}` `{n_lineas}` `{n_oc}` `{comprador}`. El aviso de la plataforma de proveedores se agrega siempre.
- **Exclusiones** (OC, ítem o línea) y **fecha simulada** para pruebas (franja roja; apaga el guardado automático).
- **Exportar config.xlsx** para publicar los cambios.

## Supuestos a validar en el piloto
- El encabezado copiado de WhatsApp Web tiene la forma `[10:15 a. m., 5/11/2026] Nombre: texto`. **No se ha visto aún un
  pegado real**; si el formato difiere (p. ej. orden de fecha), se ajusta con `formato_fecha_whatsapp` o en código.
- Al copiar, los mensajes propios aparecen con el nombre configurado en `nombre_cuenta_busscar` (por defecto «Compras Busscar»).
- Las necesidades con `TD_FECHAS.Nro orden` de prefijo OC/OM/OCA/OCM cuentan para el amarre; las de OCI no.
- Una respuesta deshecha no cuenta como respondida en el tablero.

## Pruebas (para quien mantenga la herramienta)
```
npm install     # instala SheetJS solo para las pruebas
npm run datos   # regenera datos_prueba/ (datos ficticios con el formato real de Siesa)
npm test        # 60 verificaciones: fuentes, FIFO/amarre, mensaje, intérprete, candados, deshacer, depuración, guardado, interfaz
REAL_OC=… REAL_EXPL=… node pruebas/pruebas_reales.js   # mismos controles con los archivos reales (no se suben al repositorio)
```
