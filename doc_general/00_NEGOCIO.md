# La búsqueda de empleo, completa
### Documento maestro · versión 1 · 30 de septiembre de 2026

> Éste es el documento de referencia de **qué problema resuelve el proyecto, para quién y con qué reglas**. Si hay contradicción con otro documento **en esos temas**, manda éste.
> Lo que manda en otros temas: **cómo se instala y se opera** está en el `README.md`.
>
> Este documento no nombra a la persona ni repite sus datos: se puede leer sin abrir `perfil/`.

---

## 1. La idea en una frase

**Una máquina que hace todo el trabajo de buscar empleo menos el último clic: junta los avisos, descarta lo que no sirve y las estafas, elige el CV y deja el link listo. Postularse lo decide y lo hace la persona.**

Está armada para alguien con oficio y poco tiempo frente a la computadora. La búsqueda la hace la máquina; la persona sólo lee un mail corto.

---

## 2. El problema que resuelve

Una persona con años de oficio se queda sin trabajo y, mientras busca empleo, sigue haciendo changas para llegar a fin de mes. **No tiene horas para sentarse a buscar**, y buscar bien hoy es un trabajo en sí mismo.

**El problema no es que falten avisos: es que están dispersos, mezclados y llenos de ruido.** Eso cuesta en cinco lugares:

| Dónde duele | Qué pasa hoy |
|---|---|
| **📬 Las alertas** | Cuatro portales (Computrabajo, Bumeran, ZonaJobs, Indeed) mandan alertas por mail. Se repiten entre sí, se acumulan y la mitad no tiene que ver con el perfil |
| **🏘️ Lo local** | Los avisos de la zona (el municipio, los clasificados, el comercio que pide "mandar CV") no llegan por ninguna alerta. Hay que salir a buscarlos |
| **🎯 Qué CV usar** | Un mismo perfil sirve para soporte técnico, mantenimiento, atención al público o depósito. Con un solo CV, se pierde fuerza en tres de los cuatro |
| **⚠️ Las estafas** | Cursos pagos, kits, multinivel, "sólo WhatsApp". Quien busca con urgencia es justo el blanco |
| **⏱️ El tiempo** | Los avisos buenos se llenan rápido. Revisar a la noche, cuando se puede, a veces ya es tarde |

**Por qué no alcanza con las alertas de los portales:** filtran por palabra clave, no por perfil. No saben qué rubros la persona prefiere evitar, que un monotributo sin obra social le conviene menos o que un sueldo muy por debajo del objetivo no vale el viaje. Y no ven nada de lo que se publica fuera de ellos.

---

## 3. Por qué "el último clic"

La decisión que ordena todo el proyecto: **se automatiza juntar, leer y preparar; no se automatiza postularse.**

| | Automatizar hasta el final | El último clic |
|---|---|---|
| Contraseñas de los portales | Hay que guardarlas | **No se guardan** |
| Riesgo de bloqueo de la cuenta | Alto: los portales detectan bots | Ninguno: la máquina no entra a los portales |
| Una postulación mal hecha | Sale sola, a nombre de la persona | La persona la ve antes |
| Quién decide | La máquina | **La persona** |

El único envío que la máquina puede hacer sola es el de la **fase 2** (sección 6), y arranca apagado.

---

## 4. Qué hace, exactamente

### Las dos fuentes

| Fuente | Qué trae | Cada cuánto |
|---|---|---|
| **Alertas por mail** | Lo que mandan los cuatro portales a un Gmail con la etiqueta `alertas-empleo` | Cada 3 horas, de 7 a 22 |
| **Búsqueda web** | Una lista de páginas fijas (bolsa de empleo del municipio, clasificados, búsquedas de portales filtradas por zona) más lo que Gemini encuentra buscando en Google | 2 veces por día, a las 7 y a las 16 |

### Lo que pasa con cada aviso

1. **Gemini lo lee y lo puntúa de 0 a 100** contra el perfil: tareas, requisitos excluyentes, zona, sueldo y lo que hay que evitar.
2. **Elige cuál de los 4 CV conviene** (en el ejemplo: Técnico, Mantenimiento, Atención y Depósito), o ninguno.
3. **Marca si tiene señales de estafa** y cuál vio.
4. **La máquina descarta** los repetidos (por título, empresa y localidad, vengan de donde vengan), las estafas y lo que no llega al umbral (60).
5. **Si hay algo nuevo, llega un mail** con hasta 8 avisos: por qué le conviene, qué CV usar y el link para postularse.
6. **Todo queda en una Google Sheet**, también lo descartado y el motivo. Es lo que permite ajustar el perfil y el umbral.

### Lo que la persona hace

Lee el mail, abre el link y aprieta "Postularme". Nada más.

---

## 5. Las reglas que lo sostienen

### Los datos de la persona no viajan

Gemini se usa en el **nivel gratuito**, y en ese nivel Google puede usar lo que se le manda y leerlo una persona. Sus términos piden no mandar datos personales. Entonces:

- **El perfil no lleva nombre, mail, teléfono, DNI ni nombres de empleadores.** Sólo zona, experiencia, habilidades y lo que busca.
- **Los CV no viajan.** Gemini recibe sólo su id y a qué puestos apuntan.
- **Los mails de alerta se tapan antes de mandarse:** nombre, mails y teléfonos se reemplazan por `[dato oculto]`.
- **El mensaje de postulación no pasa por Gemini.** Es una plantilla fija.

Queda una zona gris, y está escrita: una descripción de experiencia y zona sin nombre es difícil de vincular con alguien, pero no imposible. La salida, si molesta, es el nivel pago, sin cambiar el flujo.

### Ninguna afirmación inventada

- Gemini **copia** el título, la empresa, la localidad y el link; si algo no figura, lo deja vacío.
- El mail de contacto se copia **tal como aparece**, nunca se deduce del nombre de la empresa.
- La búsqueda web tiene la misma regla: sólo lo que vio en las páginas.

### Nada se pierde en silencio

- Cada mail de alertas se lee **una sola vez**, y queda anotado.
- Si una fuente falla, el mail **no** se anota como leído: se reintenta en la corrida siguiente, y el resumen lo avisa al pie.
- Si la computadora está apagada a la hora de una corrida, las alertas no se pierden: se buscan las de los últimos 3 días.

---

## 6. La fase 2: postular por mail

Algunos avisos (clasificados, el municipio, bolsas de escuelas técnicas y gremios) no tienen botón: piden **mandar el CV a una dirección de mail**. Para esos, la máquina arma el mail desde el Gmail de la persona, con el CV sugerido adjunto.

| Modo | Qué pasa |
|---|---|
| `apagado` | La máquina no postula. **Así arranca** |
| `borrador` | El mail queda en Borradores del Gmail de la persona, que lo revisa y lo envía. **El modo decidido para empezar** |
| `automatico` | Sale solo, con copia oculta. No se puede deshacer |

**Qué avisos califican**, todo junto: un mail de contacto válido (no automático, no de un portal, no de la persona), sin alerta de estafa, con CV sugerido, con puntaje de al menos 75, sin haberle escrito antes a esa dirección por ese aviso, y dentro de los topes (3 por corrida, 5 por día).

**Por qué el mínimo es 75 y no 60:** un aviso que entra al mail cuesta un vistazo; una postulación sale a nombre de alguien.

---

## 7. Lo que cuesta

| Concepto | Costo |
|---|---|
| n8n autoalojado en Docker | Gratis |
| Gemini, nivel gratuito | Gratis, con límites de pedidos por día y por minuto |
| Uso esperado | Unos 10 a 15 pedidos por día, en general dentro del nivel gratuito |
| Gmail, Sheets y el cliente OAuth de Google Cloud | Gratis |

**El costo real es otro:** mientras corre en esta computadora, tiene que estar prendida con Docker abierto. Para no depender de eso, el mismo `docker-compose.yml` sirve en un servidor.

⚠️ El costo de la búsqueda en Google con el modelo actual de la búsqueda web (`gemini-3.8-flash`) **no está confirmado**: el modelo original dejó de estar disponible para cuentas nuevas el 28/09/2026. Hay que mirarlo en AI Studio.

---

## 8. Los riesgos y qué se hace con cada uno

| Riesgo | Probabilidad | Qué se hace |
|---|---|---|
| Un aviso inventado o con el link mal | Media | Gemini copia, no redacta. El link va tal cual vino. Todo queda en la hoja para revisar |
| Una estafa que pasa el filtro | Media | La persona postula a mano y ve el aviso antes. El resumen dice cuántos se descartaron por estafa |
| Un dato personal que llega a Gemini | Baja | La lista de datos a tapar se revisa en la primera corrida. El perfil está escrito sin datos |
| Una postulación automática mal dirigida | Baja | Modo borrador para empezar, mínimo de 75, topes por día y registro de cada intento |
| El modelo deja de estar disponible | **Ya pasó** | Los modelos están en la Configuración y se cambian sin tocar el flujo |
| Algunos sitios bloquean la lectura automática | Alta | La lista de páginas se ajusta mirando qué trae cada una |
| La conexión de Google vence | Alta | Mientras la app de Google Cloud esté "en prueba", vence cada 7 días y hay que reconectar |
| La computadora apagada | Media | Se pierde esa corrida, no las alertas |

---

## 9. Lo que NO hace

Cada una de estas cosas parece razonable, y cada una rompe la regla del último clic o la de los datos.

- **No entra a los portales** ni guarda contraseñas.
- **No aprieta "Postularme"** en ningún portal.
- **No le manda a Gemini** el nombre, los CV ni la firma de la persona.
- **No inventa** mails de contacto, links ni empresas.
- **No postula por mail** si no puede leer el registro de postulaciones: podría repetir un envío.
- **No prende el envío automático** sin que la persona lo haya aceptado.

---

## 10. Qué es y qué no es todavía

**Hoy es una herramienta para una persona**, no un negocio: no tiene modelo de cobro, ni usuarios más allá de ella, ni decisión tomada sobre si tenerlos. Lo que sí está pensado desde el diseño es que sea **reusable**: todo lo que cambia de una persona a otra (perfil, CV, localidad, páginas, umbral, a quién le llega) está en un solo nodo, la Configuración.

Si algún día se quisiera llevar a más personas, hay decisiones que no están tomadas y **no son de este documento**:

- Si se usa, a quién y en qué condiciones.
- El nivel de Gemini: con datos de muchas personas, el nivel gratuito deja de ser una zona gris.
- Dónde corre: una computadora prendida alcanza para una persona, no para diez.

---

*Documento relacionado: `README.md` (cómo funciona, puesta en marcha, datos personales y fase 2).*
