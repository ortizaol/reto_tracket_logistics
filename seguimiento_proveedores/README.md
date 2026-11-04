# Seguimiento de entregas · Proveedores nacionales (Busscar de Colombia)

Herramienta web de **un solo archivo** (`seguimiento.html`): sin servidor ni instalación. Su única dependencia es SheetJS,
que se carga por CDN. Sirve para preguntar y registrar por WhatsApp las fechas de entrega de las OC nacionales.

> La **fuente de verdad de las fechas prometidas** son los archivos de seguimiento (`respuestas/`), no la explosión.
> La explosión de Siesa solo agrega líneas nuevas y cierra las recibidas, porque las entradas a almacén no se registran a diario.

## Estructura de carpetas en OneDrive

```
Seguimiento_Proveedores/            ← carpeta compartida (sincronizada con OneDrive)
├── seguimiento.html                ← la herramienta (abrir con Edge o Chrome)
├── config.xlsx                     ← solo lo edita el administrador (permiso de solo lectura para compradores)
├── explosiones/                    ← ABASTECIMIENTO_ddmmaaaa.xlsx (también se aceptan en la raíz)
└── respuestas/                     ← seguimiento_<comprador>_<aaaammdd_hhmm>.xlsx (uno por comprador y por día)
```

Opcional: si la red bloquea los CDN, copie `xlsx.full.min.js` (SheetJS) junto a `seguimiento.html`.

## Cómo lo usa el comprador

1. Abra `seguimiento.html` en **Edge o Chrome**, con WhatsApp Web abierto en el número corporativo de WhatsApp Business.
2. La primera vez: **Conectar carpeta** y elija `Seguimiento_Proveedores`. El navegador recuerda la carpeta; en adelante basta
   con **Reconectar** (un clic). La herramienta carga sola la explosión más reciente (por la fecha del nombre), `config.xlsx`
   y consolida todos los archivos de `respuestas/` (por línea gana el registro más reciente).
   *Sin Edge/Chrome:* use **Cargar archivos…** y seleccione la explosión, `config.xlsx` y los archivos de `respuestas/`.
3. Elija su nombre en **Comprador**.
4. **Gestión de hoy**: una tarjeta por proveedor con las líneas a preguntar, numeradas y ordenadas por urgencia.
   - **Abrir WhatsApp** abre el chat con el mensaje listo y registra la pregunta (fecha/hora y comprador).
   - Cuando el proveedor responda, copie su respuesta, péguela en **Pegar respuesta** y pulse **Interpretar**.
     Revise la vista previa (estado y fecha anterior → nueva, desfase contra la fecha requerida). Lo que esté en rojo se
     corrige con la lista y la fecha, o se marca «Sin cambio». Luego **Guardar respuesta**.
5. Al terminar: **Exportar mi seguimiento** (lo guarda en `respuestas/`; si no hay carpeta conectada, se descarga y hay
   que moverlo a `respuestas/`). La barra superior avisa si quedan cambios sin exportar.

Formatos de respuesta que entiende (mayúsculas, tildes y espacios dan igual):

| Respuesta | Significa |
|---|---|
| `1 SI` | la línea 1 mantiene su fecha |
| `1 NO 25/11` | la línea 1 cambia al 25/11 (cuenta como cambio de fecha) |
| `1 ENT` | la línea 1 ya se entregó (queda «entregado por confirmar» hasta que la explosión la muestre en 0) |
| `TODO SI` | se mantienen todas las líneas con fecha |
| `2 25/11` | fecha para una línea que no tenía fecha |

También acepta `d/m`, `dd-mm`, `dd/mm/aaaa`, `1 y 2 SI`, `1.` / `1)` y los encabezados que agrega WhatsApp al copiar.

### Qué se pregunta cada día
- Líneas con fecha requerida ≤ hoy + horizonte (4 semanas por defecto) y todas las vencidas.
- Sin fecha prometida: si nunca se preguntó, o recordatorio después de 24 h sin fecha.
- Con fecha prometida: en los hitos configurados (7, 2 y 0 días antes) si no hubo contacto desde el hito; vencidas cada 2 días.
- Nunca dos veces el mismo día. Un solo mensaje por proveedor.

### Estados de una línea (clave OC + línea)
`NUEVA → ESPERANDO_FECHA → CONFIRMADA → (SI) CONFIRMADA | (NO + fecha) CAMBIADA | (ENT) ENTREGADO_POR_CONFIRMAR → CERRADA`.
Si desaparece de la explosión sin ENT: `CERRADA_POR_EXPLOSION`. Si un «entregado» sigue pendiente más de 7 días: alerta
**Revisar con almacén**. Si una línea cerrada vuelve a aparecer pendiente, se reabre.

## Cómo se administra

Pestaña **Administrador** (PIN inicial `1234`; es solo un freno visual: la seguridad real es que únicamente el
administrador tenga permiso de escritura sobre `config.xlsx` en OneDrive).

- **Proveedores**: nombre exacto como sale en la explosión, alias, activo SI/NO, contacto, celular (10 dígitos), comprador, trato usted/tú.
  La herramienta indica si el nombre aparece en la explosión y lista los proveedores nacionales aún no configurados.
- **Reglas**: horizonte (3–6 semanas), días de repregunta, frecuencia de vencidas, horas para recordatorio, días para
  «revisar con almacén», tratamiento de duplicados (MAX/SUMA) y PIN.
- **Plantillas** (`primera_solicitud`, `repregunta`, `recordatorio`, `vencida`; versión usted y tú) con vista previa con datos reales.
  Campos: `{contacto}` `{comprador}` `{detalle}` `{n_lineas}` `{formato}`. El aviso «Este seguimiento no reemplaza la
  facturación en la plataforma de proveedores.» se agrega siempre si la plantilla no lo trae.
- **Exclusiones**: OC, ítems u OC|línea que no se deben preguntar.
- **Exportar config.xlsx** sobrescribe el archivo de la carpeta (o lo descarga). Mientras no se exporte, los cambios
  solo existen en ese navegador.

Si la explosión cambia de columnas, la herramienta muestra un **mapeo manual** y lo recuerda en ese navegador.

## Supuestos a validar en el piloto
- La OC trae el prefijo en el mismo campo (`OC-12345`, `OCI-…`). Si en Siesa el tipo de documento y el número vienen separados, hay que ajustar.
- Si no hay columna de línea, la clave es OC + ítem.
- Si la explosión repite OC + línea (p. ej., por varios requerimientos), se toma el **mayor** pendiente y la fecha requerida más temprana (regla `duplicados_pendiente`, cambiable a SUMA).
- El cierre automático usa la fecha del nombre de la explosión; una explosión más antigua que el seguimiento no cierra líneas.

## Pruebas (para quien mantenga la herramienta)
```
npm install     # instala SheetJS solo para las pruebas
npm run datos   # regenera datos_prueba/ (3 proveedores del piloto + 1 inactivo, datos ficticios)
npm test        # 86 verificaciones: intérprete, todos los estados, consolidación, cierres, tablero, interfaz
```
`datos_prueba/` sirve también para probar a mano: **Cargar archivos…** o **Conectar carpeta** sobre esa carpeta.
Para simular otra fecha: `seguimiento.html?hoy=2026-11-10`.

Historial de versiones: [CHANGELOG.md](CHANGELOG.md).
