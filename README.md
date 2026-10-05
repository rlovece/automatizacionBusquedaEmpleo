# Búsqueda de empleo: el último clic

Un flujo de n8n que junta avisos de empleo de dos fuentes y usa la API de Gemini para evaluarlos:

- **Las alertas que los portales mandan por mail** (Computrabajo, Bumeran, ZonaJobs, Indeed). Se leen cada 3 horas, de 7 a 22.
- **Una búsqueda web en la localidad de la persona**, más una lista de páginas fijas: la bolsa de empleo del municipio, clasificados, la búsqueda de un portal ya filtrada por zona. Corre 2 veces por día: a las 7 y a las 16.

Descarta lo que no sirve y las posibles estafas, puntúa cada aviso contra el perfil y, si hay algo nuevo, le manda a la persona un mail corto con los mejores. Cada aviso va con el CV que conviene usar y el link para postularse.

**La postulación la hace la persona**: abre el link y aprieta "Postularme". El flujo no entra a los portales ni guarda contraseñas.

## Cómo funciona

```
Cada 3 horas (7, 10, 13, 16, 19 y 22)
  → Configuración              perfil, CV, localidad, páginas, umbral, modelos
  → Preparar búsqueda web      ¿esta hora está en busqueda_web.horas? (7 y 16)
  → ¿Toca buscar en la web?
       sí → Gemini: buscar en la web   google_search + url_context, devuelve un listado en texto
  → Buscar alertas en Gmail    label:alertas-empleo de los últimos 3 días
  → Leer mails ya leídos       pestaña "Mails" de la hoja
  → Juntar fuentes             los mails no leídos + el listado web
  → Preparar pedido a Gemini   un pedido por fuente, con los datos de la persona tapados
  → Gemini: leer y puntuar     extrae los avisos y los puntúa (JSON con esquema)
  → Leer respuesta             un ítem por aviso; los fallos quedan marcados
  → Leer postulaciones         pestaña "Postulaciones": a quién ya se le escribió (fase 2)
  → Leer historial             pestaña "Avisos": lo que ya se vio
  → Filtrar y armar resumen    saca los repetidos, las estafas y lo que no llega al umbral
       ├→ Postulaciones a mandar → Leer CV → ¿Envío automático?
       │     ├ sí → Enviar postulación / no → Crear borrador de postulación   (Gmail)
       │     → Resultado de postulaciones → Guardar postulaciones           (pestaña "Postulaciones")
       ├→ Sólo si hay algo  → Completar resumen → Enviar resumen   (Gmail)
       ├→ Filas a guardar   → Guardar avisos        (pestaña "Avisos")
       └→ Mails a guardar   → Guardar mails leídos  (pestaña "Mails")
```

- **Cada mail de alertas se lee una sola vez.** Queda anotado en la pestaña "Mails", así la corrida siguiente no lo vuelve a mandar a Gemini.
- **Sin repetidos.** Cada aviso se identifica por título, empresa y localidad. Si ya está en la pestaña "Avisos", no vuelve a aparecer, venga por mail o por la web.
- **Si una fuente falla**, el mail no se anota como leído y se reintenta en la corrida siguiente. Al pie del mail a la persona sale una nota técnica.
- **Sólo llega un mail si hay algo nuevo.** Para recibirlo también cuando no hay avisos, poner `avisar_si_no_hay: true`.
- **Todo queda en la hoja**, también lo descartado y el motivo. Sirve para ajustar el umbral y el perfil.

## Qué esperar de la búsqueda web

- **Suma sobre todo fuentes locales** que no mandan alertas: el municipio, los clasificados del diario de la zona, comercios y empresas que publican en su propio sitio. Para los portales grandes, las alertas por mail llegan antes que los buscadores.
- **Algunos sitios bloquean la lectura automática** de sus páginas, y las páginas con muro de pago no se pueden leer. Si una página de la lista nunca da resultados, conviene sacarla o reemplazarla por otra.
- **Encuentra menos que una persona buscando a mano**, pero no se cansa. Al principio conviene revisar en la hoja qué trae y ajustar la lista de páginas y las instrucciones de búsqueda (`INSTRUCCIONES_BUSQUEDA` en la Configuración).

## Archivos

| Archivo | Qué es |
|---|---|
| `workflow/busqueda_empleo_ultimo_clic.json` | El workflow para importar en n8n. **Se genera; no editarlo a mano.** Lleva los datos de la persona, así que no va al repo |
| `workflow/nodos/*.js` | El código de cada nodo Code. Acá se hacen los cambios. `01_configuracion.js` trae una persona de ejemplo inventada |
| `workflow/encabezados_pestania_*.csv` | La primera fila de cada pestaña de la Google Sheet: `Avisos`, `Mails` y `Postulaciones` |
| `herramientas/armar_workflow.mjs` | Arma el JSON a partir de `nodos/`, con los datos de `perfil/configuracion_persona.js` |
| `herramientas/probar_nodos.mjs` | Prueba los nodos con datos simulados y la persona de ejemplo, sin n8n ni API |
| `n8n/` | `docker-compose.yml` para levantar n8n y `.env` con su clave de cifrado (no va al repo; la plantilla es `.env.example`) |
| `perfil/` | Los CV, la configuración real y las notas de la persona (ver "Datos personales" y `perfil/LEEME.md`). No va al repo, salvo las plantillas |
| `perfil/configuracion_persona.ejemplo.js` | La plantilla de los datos de la persona, con una persona inventada. Se copia como `configuracion_persona.js` |

Después de cambiar algo en `nodos/`:

```
node herramientas/armar_workflow.mjs
node herramientas/probar_nodos.mjs
```

Una vez importado, n8n pasa a ser la fuente de verdad: si se edita la configuración en la interfaz de n8n, hay que copiarla de vuelta a `01_configuracion.js` o, si es un dato de la persona (perfil, CV, localidad, páginas, mail, datos a ocultar, firma), a `perfil/configuracion_persona.js`. Si no, ese cambio se pierde en la próxima importación.

## Para empezar

Hace falta Docker, Node.js 18 o más nuevo, una cuenta de Gmail, una Google Sheet y una clave de la API de Gemini.

```
cp n8n/.env.example n8n/.env                                          # y completar N8N_ENCRYPTION_KEY
cp perfil/configuracion_persona.ejemplo.js perfil/configuracion_persona.js   # y completar con la persona real
node herramientas/armar_workflow.mjs                                  # genera el workflow
node herramientas/probar_nodos.mjs                                    # prueba los nodos, sin n8n ni API
cd n8n && docker compose up -d                                        # n8n en http://localhost:5678
```

Sin `perfil/configuracion_persona.js` todo funciona con la persona de ejemplo, que alcanza para mirar el flujo y correr las pruebas. Los pasos completos están abajo.

## Puesta en marcha

### 1. Las alertas (del lado de la persona)

1. Una cuenta de Gmail para la búsqueda. Si es una dedicada, mejor: queda separada del mail personal.
2. Con ese mail, crear alertas en cada portal donde tenga cuenta, con las búsquedas de cada CV y su zona.
3. En Gmail, un filtro que ponga la etiqueta `alertas-empleo` a los mails de esos portales. Por ejemplo, `from:(computrabajo OR bumeran OR zonajobs OR indeed)`. Cuando lleguen las primeras alertas, revisar de qué direcciones vienen y ajustar el filtro.
4. Cargar en cada portal el CV que más use. Si el mail recomienda otro, hay que cambiarlo o adjuntarlo al postular.

### 2. La hoja

Crear una Google Sheet con tres pestañas, con estos nombres exactos:

- `Avisos`: en la primera fila, los encabezados de `workflow/encabezados_pestania_avisos.csv`. La columna `postulado` es para que la persona, o quien la ayude, marque a qué avisos se postuló. La fase 2 la completa sola cuando postula por mail.
- `Mails`: en la primera fila, los encabezados de `workflow/encabezados_pestania_mails.csv`.
- `Postulaciones`: en la primera fila, los encabezados de `workflow/encabezados_pestania_postulaciones.csv`. Hace falta antes de prender la fase 2: sin ella, el flujo no postula.

### 3. La clave de Gemini

En Google AI Studio (aistudio.google.com), crear una clave de API. En la página de límites (aistudio.google.com/rate-limit) confirmar que los dos modelos de la Configuración estén disponibles en el nivel gratuito, y cuántos pedidos por día y por minuto permiten:

- `gemini-3.8-flash` para la búsqueda web (`gemini-2.5-flash` dejó de estar disponible para cuentas nuevas en septiembre de 2026);
- `gemini-3.5-flash` para leer y puntuar.

Si alguno ya no está, se cambia por otro de la misma familia en la Configuración.

### 4. n8n

**En esta computadora, con Docker.** Todo está en `n8n/`:

```
cd n8n
docker compose up -d      # levanta n8n en http://localhost:5678
docker compose down       # lo para; los datos quedan en el volumen de Docker
```

- `n8n/docker-compose.yml` es la configuración. El mismo archivo sirve para un servidor.
- `n8n/.env` tiene la clave con la que n8n cifra las credenciales. **No se sube a ningún repo.** Para migrar a un servidor, hay que copiarlo tal cual; si se pierde, se vuelven a cargar las credenciales.
- Los workflows, las credenciales y las ejecuciones viven en el volumen `n8n_n8n_empleo_datos` de Docker, no en la carpeta del proyecto.
- **Mientras corre acá, la computadora tiene que estar prendida con Docker Desktop abierto.** Si está apagada a la hora de una corrida, esa corrida se pierde. Las alertas no: las lee la corrida siguiente, porque se buscan las de los últimos 3 días.
- Para importar el workflow desde la línea de comandos, la primera vez y después de cambiar `nodos/`:

  ```
  node herramientas/armar_workflow.mjs
  docker exec n8n_empleo n8n import:workflow --input=/files/workflow/busqueda_empleo_ultimo_clic.json
  ```

  Ojo: reimportar reemplaza el workflow entero, y hay que volver a asignar las credenciales y a completar la Configuración. Una vez que está andando, conviene hacer los cambios directo en la interfaz, o exportar el workflow vivo (`n8n export:workflow --id=BusquedaEmpleo01`), cambiarle sólo los nodos nuevos o modificados, conservando `credentials` y `documentId`, e importar ese archivo.

**Primera vez:** abrir http://localhost:5678 y crear la cuenta de dueña (mail y contraseña). Queda sólo en esta instancia.

**Conectar Google en un n8n propio.** A diferencia de n8n Cloud, hace falta un cliente OAuth propio. Se crea una vez y sirve para Gmail y Sheets:

1. En console.cloud.google.com, crear un proyecto.
2. En *APIs y servicios → Biblioteca*, habilitar **Gmail API** y **Google Sheets API**. Para elegir la hoja de una lista en n8n, habilitar también **Google Drive API**.
3. En *Pantalla de consentimiento de OAuth*: tipo **Externo**, y en *Usuarios de prueba* agregar la cuenta de Gmail de la búsqueda y la dueña de la hoja. Mientras la app esté "en prueba", Google vence la conexión cada 7 días y hay que reconectar; publicarla evita eso, pero para esta escala se puede empezar así.
4. En *Credenciales → Crear credenciales → ID de cliente de OAuth*: tipo **Aplicación web**, con este URI de redireccionamiento autorizado: `http://localhost:5678/rest/oauth2-credential/callback`. En un servidor cambia por la dirección del servidor.
5. Copiar el ID y el secreto del cliente en las credenciales de n8n de Gmail y de Sheets, y apretar *Sign in with Google*.

**Otras opciones:** n8n Cloud es lo más simple, porque conectar Google es un clic, pero tiene abono mensual. Un servidor propio (un VPS con Docker, Railway, Render) usa el mismo `docker-compose.yml`.

- **Credenciales** (Credentials → New):
  - *Gmail OAuth2*, con la cuenta del paso 1.
  - *Google Sheets OAuth2*, con la cuenta dueña de la hoja.
  - *Header Auth* para Gemini: nombre `x-goog-api-key`, valor la clave del paso 3.
- **Importar** `workflow/busqueda_empleo_ultimo_clic.json` (Workflows → Import from file) y asignar las credenciales: Gmail en "Buscar alertas en Gmail", "Enviar resumen", "Enviar postulación" y "Crear borrador de postulación"; Sheets en los seis nodos de la hoja; Header Auth en los dos nodos "Gemini: …".
- En los seis nodos de la hoja, elegir el documento de la lista. Las pestañas ya vienen puestas por nombre.
- La **Configuración** sale con los datos de `perfil/configuracion_persona.js`. Para otra persona, copiar el bloque "Persona" de `01_configuracion.js` a ese archivo, completarlo y volver a armar el workflow.

### 5. Probar

1. Esperar a que haya algunas alertas con la etiqueta.
2. Poner `mail_resumen` con un mail propio. Para forzar la búsqueda web en la prueba, agregar la hora actual a `busqueda_web.horas`. Después correr el workflow a mano (Execute workflow).
3. Revisar el mail, la hoja y, en la ejecución de n8n, qué devolvió "Gemini: buscar en la web" y qué le llegó a "Gemini: leer y puntuar". ¿Los avisos son de la zona y recientes? ¿Los puntajes tienen sentido? ¿El CV sugerido es el correcto? ¿Quedó algún dato de la persona sin tapar? Ajustar el perfil, las páginas, `umbral`, `datos_a_ocultar` o las instrucciones hasta que acierte.
4. Volver `busqueda_web.horas` a `[7, 16]`, poner el mail de la persona y activar el workflow.

**Está probado contra la API real, en un n8n autoalojado:** la fase 1 tuvo corridas reales y la fase 2 se probó en modo borrador. Igual, las APIs cambian. Si "Leer respuesta" dice que la respuesta no tiene texto, es que cambió la forma de la respuesta de la Interactions API de Gemini (`steps`, `model_output`): hay que mirar la respuesta cruda en n8n y ajustar la función `textoDe` de `03_juntar_fuentes.js` y `05_leer_respuesta.js`. Lo mismo con los nodos de Gmail, Sheets e If: si alguno aparece con un parámetro vacío o en rojo, se completa en la interfaz.

## Costo

- **n8n**: gratis si es autoalojado; n8n Cloud tiene abono mensual.
- **Gemini, nivel gratuito**: no se paga. Tiene límites de pedidos por día y por minuto, y **Google usa lo que se manda** (ver "Datos personales"). Según la tabla de precios de Google, la búsqueda en Google sólo es gratis en este nivel con `gemini-2.5-flash` y `gemini-2.5-flash-lite`, hasta 500 pedidos por día. Este dato viene de un resumen de la página, no del texto literal, así que hay que confirmarlo en AI Studio.
- **Uso esperado**: 3 búsquedas web por día, más un pedido por cada mail de alertas nuevo y por cada listado web. Son unos 10 a 15 pedidos por día, en general dentro del nivel gratuito. Para no pasar el límite por minuto, los nodos de Gemini mandan un pedido cada 10 segundos y reintentan si la API responde que se pasó.
- **Si se pasa al nivel pago**, activando la facturación en AI Studio: el flujo no cambia y los datos dejan de usarse para mejorar productos de Google. Según la misma tabla, con los modelos Gemini 3 las primeras 5.000 búsquedas en Google por mes no se cobran. Con este volumen, el costo sería bajo, pero hay que confirmarlo con la tabla vigente.

## Datos personales

Los CV, el perfil y la hoja contienen datos de otra persona.

**En el nivel gratuito de Gemini, Google usa lo que se manda y lo que responde para mejorar sus productos, y puede leerlo una persona.** Sus términos piden expresamente no mandar información personal, sensible o confidencial al nivel gratuito ([términos de la API de Gemini](https://ai.google.dev/gemini-api/terms)). Por eso el flujo manda lo mínimo:

- **El perfil no lleva nombre, mail, teléfono, DNI ni nombres de empleadores.** Sólo la zona, la experiencia, las habilidades y lo que busca.
- **Los CV no viajan.** Sólo su id y a qué puestos apuntan. Para postular por mail, n8n los lee de `perfil/cv/`, montada de sólo lectura en el contenedor, y los adjunta desde Gmail.
- **El mensaje de postulación no pasa por Gemini.** Es una plantilla fija de la Configuración, con la firma. De Gemini sólo viene el mail de contacto del aviso.
- **Los mails de alerta se tapan antes de mandarse**: todo lo que esté en `datos_a_ocultar`, más `mail_resumen`, se reemplaza por `[dato oculto]`. Conviene poner nombre, apellido, mails y teléfono tal como los escriben los portales, y revisar en la primera corrida que no quede nada.
- **El nombre para el saludo y el mail de destino se usan sólo en n8n.**

Igual queda una zona gris: una descripción de experiencia y zona, sin nombre, es difícil de vincular con alguien, pero no es cero. Si la persona o vos no están cómodas con eso, la salida es el nivel pago, sin cambiar nada del flujo.

Además:

- La persona tiene que estar de acuerdo con que sus datos pasen por n8n, Gemini y Google.
- `perfil/` no va a ningún repo: son datos de otra persona. El `.gitignore` la deja afuera, junto con `n8n/.env` y el workflow generado.
- La Configuración del workflow, en n8n y en el JSON generado, tiene el nombre, el mail y los datos a ocultar. Hay que tenerlo en cuenta si se exporta o se comparte el workflow.

## Fase 2: postular por mail

Algunos avisos (clasificados, portales municipales, bolsas de trabajo de escuelas técnicas y gremios) piden mandar el CV por mail. Para esos, el flujo arma el mail desde el Gmail de la persona, con el CV sugerido adjunto.

**Cómo se prende y se apaga:** en la Configuración (el nodo en n8n y `01_configuracion.js`), `postular_por_mail.modo`: `'apagado'` (así arranca, y el flujo hace lo mismo que antes), `'borrador'` o `'automatico'`.
Con `'borrador'` el mail queda en Borradores de su Gmail y lo envía la persona con un toque; con `'automatico'` sale solo y no se puede deshacer.

**Qué avisos califican**, todo junto:

- Gemini copió un mail de contacto del aviso (`mail_contacto`, sin inventarlo) y pasa la validación: dirección bien formada, que no sea automática (noreply, notificaciones, alertas), ni de un portal (Computrabajo, Bumeran, ZonaJobs, Indeed, LinkedIn…), ni de la persona.
- Sin alerta de estafa, con un CV sugerido y un puntaje de al menos `puntaje_minimo` (75; nunca menos que `umbral`).
- No se le escribió antes a esa dirección por ese aviso, según la pestaña `Postulaciones`.
- Dentro de los topes: `max_por_corrida` (3) y `max_por_dia` (5). Los errores no cuentan. Si hay más, van primero los de mayor puntaje.

**El mensaje** es una plantilla fija, sin Gemini: el asunto "Postulación: {título}", el aviso y la empresa, una frase según el CV (`frases_cv`), el cierre y la firma. Se manda con copia oculta a `mail_resumen`.

**Qué queda registrado:** cada intento en la pestaña `Postulaciones` (fecha, clave, título, empresa, mail de destino, CV y resultado: `borrador creado`, `enviado` o `error: …`), el aviso con `postulado` = "borrador (por mail)" o "sí (por mail)" en la pestaña `Avisos`, y un bloque en el mail de resumen con cada aviso y su mail de destino. Si un envío falla, el resumen lo dice y el aviso no queda marcado.

**Si no se puede leer la pestaña `Postulaciones`**, no se postula en esa corrida (podría repetirse un envío) y el resumen lo avisa en la nota técnica.

**Si está prendido y no sale ninguna**, el resumen dice por qué al pie, contando los avisos nuevos por motivo: sin mail de contacto (se postula desde el portal, que es lo más común), puntaje menor al mínimo, posible estafa, no encaja, ya se le escribió antes o sin cupo. Lo mismo queda en el campo `informe_postulaciones` de la salida de "Filtrar y armar resumen", para verlo en n8n.

**El orden importa:** la rama de postulaciones está más arriba en el lienzo que "Sólo si hay algo para mandar". Con `executionOrder: v1`, n8n la corre primero, y así "Completar resumen" ya sabe cómo salió cada envío. Si se mueven los nodos, mantener ese orden.

**Pendiente:** algunas oficinas de empleo piden datos extra en el asunto, como un número de pedido. La plantilla todavía no lo contempla.
