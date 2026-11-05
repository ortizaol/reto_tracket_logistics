# Instructivo paso a paso · Seguimiento de entregas por WhatsApp

Para compradores. No hay que instalar nada. Se necesita: computador con **Edge o Chrome**, **WhatsApp Web** abierto con la
línea corporativa de WhatsApp Business, e internet.

---

## 0. Una sola vez: preparar los contactos de WhatsApp

La herramienta reconoce **quién** responde por el nombre del contacto o por su celular. Por eso:

1. En el celular de la línea corporativa, guarde cada contacto de proveedor con el formato **`PROVEEDOR - Nombre`**.
   Ejemplos: `PRAMEC - Carlos`, `INTRALUM - Diana`, `VISEG - Jorge`.
2. Envíe al administrador la lista de contactos (nombre exacto como quedó guardado y celular). Él los registra en
   `config.xlsx` (columnas **celular** y **nombre_whatsapp**).
3. Si un proveedor escribe desde un número que no está registrado, la herramienta **bloquea** la respuesta y le avisa.

---

## 1. Dejar los archivos nuevos de Siesa (2 veces por semana)

En la carpeta compartida de OneDrive `Seguimiento_Proveedores`:

| Archivo | Dónde va | Nombre |
|---|---|---|
| Listado de OC abiertas (exportado de Siesa como texto) | `oc_abiertas/` | `OC_ddmmaaaa.txt` (ej. `OC_31102026.txt`) |
| Explosión de abastecimiento | `explosiones/` | `ABASTECIMIENTO_ddmmaaaa.xlsx` |

No borre los anteriores si no quiere: la herramienta siempre usa el de **fecha más reciente en el nombre**.
Si alguno tiene más de 4 días, verá una **alerta roja**.

---

## 2. Abrir la herramienta

1. Abra `seguimiento.html` con Edge o Chrome (clic derecho → Abrir con → Microsoft Edge).
2. La primera vez: botón **Conectar carpeta** → elija `Seguimiento_Proveedores` → **Permitir** ver y editar.
   Las siguientes veces: botón **Reconectar «Seguimiento_Proveedores»** (un clic).
3. Arriba a la derecha, en **Comprador**, elija su nombre.
4. Verifique la franja gris: **OC abiertas: fecha · Explosión: fecha**. La primera carga de una explosión nueva tarda
   unos 10–30 segundos; es normal.
5. Si cargaron archivos nuevos mientras tenía la herramienta abierta: botón **Cargar nuevos archivos**.

---

## 3. Depuración inicial (una vez por proveedor, antes del primer WhatsApp)

El listado de Siesa trae líneas viejas o ya recibidas. Antes de escribirle al proveedor por primera vez:

1. En la tarjeta del proveedor (pestaña **Gestión de hoy**) pulse **Descargar Excel de depuración**.
   Queda en `depuracion/` (o en Descargas si no conectó la carpeta).
2. Ábralo y **llame al proveedor**. En la columna **ACCION** escriba por cada línea:
   - `ENTREGADO` → ya la entregó.
   - `NUEVA FECHA` → y ponga la fecha en **NUEVA_FECHA** (dd/mm/aaaa).
   - `CANCELAR` → hay que cancelarla en Siesa (no se le vuelve a preguntar).
   - Vacío → no cambia.
3. Guarde el Excel y pulse **Cargar Excel conciliado**. Revise el panel y pulse **Confirmar depuración de …**.
4. Si no hace falta depurar, use **Omitir depuración**.

---

## 4. Enviar el WhatsApp

1. Cada tarjeta muestra el **siguiente mensaje**: las líneas más urgentes agrupadas por OC (máximo 15 líneas y 6 OC).
   El punto de color es el semáforo: 🟢 a tiempo · 🔴 riesgo (o requerida vencida sin fecha: **llame**) · ⚪ sin fecha.
2. Pulse **Ver mensaje** si quiere revisarlo, y luego **Abrir WhatsApp**. Se abre el chat con el texto listo → **Enviar**.
3. Al pulsar el botón, la pregunta queda registrada. Si la tarjeta dice *«Quedan N líneas para el siguiente envío»*,
   vuelva a pulsar **Abrir WhatsApp** para mandar el siguiente bloque.

---

## 5. Registrar la respuesta (lo más importante)

1. En **WhatsApp Web**, abra el chat del proveedor.
2. Pase el mouse sobre su mensaje → flecha **⌄** → **Seleccionar mensajes**. Marque los mensajes de la respuesta
   (puede incluir los suyos: se ignoran solos).
3. Copie con **Ctrl+C**. *No* seleccione solo el texto del globo con el mouse: así no se copia quién lo envió y la
   herramienta lo bloquea.
4. En la herramienta, pegue en **Pegar respuestas de WhatsApp** (Ctrl+V) y pulse **Analizar respuestas**.
   Puede pegar respuestas de varios proveedores juntas: cada uno sale en su propio panel.
5. En el panel, revise el **nombre del proveedor en grande** y la tabla:
   - 🔴 **Rojo:** no se entendió → corrija con la lista **Acción** y la **Fecha**, o elija «Sin cambio».
   - 🟡 **Amarillo:** fecha vaga («la próxima semana») o «todo igual» en una línea sin fecha → elija la fecha o pulse **Aceptar**.
   - ⛔ **Bloqueado:** remitente desconocido, o el mensaje menciona una OC de **otro proveedor** → no pegó el chat correcto. Revise.
6. Pulse **Confirmar respuesta de <PROVEEDOR>**. Se guarda solo en `respuestas/`.
7. ¿Se equivocó? En la tarjeta del proveedor: **Deshacer última respuesta**.

---

## 6. Revisar

- **Todas las líneas:** buscar por OC, ítem o descripción; filtrar por estado (incluye «Sin necesidad en planeación»).
- **Tablero:** respuesta por proveedor, riesgo de faltante, cambios de fecha, sin necesidad, por cancelar, revisar con almacén.
  Botón **Exportar tablero a Excel**.

## Preguntas frecuentes

- **¿Tengo que exportar algo?** No, si conectó la carpeta: se guarda solo. La franja gris dice «Guardado automático hh:mm».
- **¿Por qué no aparece un proveedor?** Puede ser de otro comprador (marque «Ver proveedores de todos los compradores»)
  o no tener líneas para preguntar hoy.
- **¿Qué es la franja roja «FECHA SIMULADA»?** Alguien activó una fecha de prueba en el Administrador. Pida que la quiten:
  mientras esté activa no se guarda nada automáticamente.
