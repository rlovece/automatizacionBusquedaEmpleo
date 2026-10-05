// Arma workflow/busqueda_empleo_ultimo_clic.json a partir de los nodos de código en workflow/nodos/.
// Uso: node herramientas/armar_workflow.mjs
//
// El JSON lleva los datos de la persona (de perfil/configuracion_persona.js): no va a ningún repo.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const codigo = (archivo) => readFileSync(join(raiz, 'workflow', 'nodos', archivo), 'utf8');

// La Configuración con los datos de la persona: el bloque "Persona" de 01_configuracion.js es un
// ejemplo inventado, y se reemplaza por perfil/configuracion_persona.js si está. Si no, sale el ejemplo.
const bloquePersona = /\/\/ ─── Persona: desde acá[\s\S]*?\/\/ ─── Persona: hasta acá[^\n]*/;
const archivoPersona = join(raiz, 'perfil', 'configuracion_persona.js');
function configuracion() {
  const base = codigo('01_configuracion.js');
  if (!bloquePersona.test(base)) throw new Error('01_configuracion.js no tiene el bloque "Persona"');
  if (!existsSync(archivoPersona)) {
    console.log('Ojo: no está perfil/configuracion_persona.js. El workflow sale con la persona de ejemplo.');
    return base;
  }
  const persona = readFileSync(archivoPersona, 'utf8').match(bloquePersona);
  if (!persona) throw new Error('perfil/configuracion_persona.js no tiene el bloque "Persona"');
  return base.replace(bloquePersona, () => persona[0]);
}

const hoja = (pestania) => ({
  documentId: { __rl: true, value: '', mode: 'list' },
  sheetName: { __rl: true, value: pestania, mode: 'name' },
});

const nodo = (name, type, typeVersion, [x, y], parameters, settings = {}) => ({
  id: crypto.randomUUID(),
  name,
  type,
  typeVersion,
  position: [x * 220, y * 200],
  parameters,
  ...settings,
});

const code = (name, archivo, posicion) =>
  nodo(name, 'n8n-nodes-base.code', 2, posicion, { jsCode: codigo(archivo) });

// Llamado a la Interactions API de Gemini. La clave va en una credencial Header Auth (x-goog-api-key).
// Si la API falla (por ejemplo, 429 por el límite por minuto del nivel gratuito), n8n reintenta;
// si sigue fallando, el ítem sale con "error" y el nodo siguiente lo anota como fuente no leída.
const llamadaGemini = (name, posicion, timeout) => nodo(name, 'n8n-nodes-base.httpRequest', 4.2, posicion, {
  method: 'POST',
  url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json.body) }}',
  // Un pedido cada 10 segundos, para no pasar el límite por minuto.
  options: { timeout, batching: { batch: { batchSize: 1, batchInterval: 10000 } } },
}, { retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput' });

const nodes = [
  nodo('Cada 3 horas', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 1], {
    rule: { interval: [{ field: 'cronExpression', expression: '0 7-22/3 * * *' }] },
  }),
  nodo('Configuración', 'n8n-nodes-base.code', 2, [1, 1], { jsCode: configuracion() }),
  code('Preparar búsqueda web', '02_preparar_busqueda_web.js', [2, 1]),
  nodo('¿Toca buscar en la web?', 'n8n-nodes-base.if', 2.2, [3, 1], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: crypto.randomUUID(),
        leftValue: '={{ $json.buscar }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  }),
  llamadaGemini('Gemini: buscar en la web', [4, 0], 300000),
  nodo('Buscar alertas en Gmail', 'n8n-nodes-base.gmail', 2.1, [5, 1], {
    operation: 'getAll',
    limit: 50,
    simple: false,
    filters: { q: "={{ 'label:' + $('Configuración').first().json.etiqueta_gmail + ' newer_than:3d' }}" },
    options: {},
  }, { executeOnce: true, alwaysOutputData: true }),
  nodo('Leer mails ya leídos', 'n8n-nodes-base.googleSheets', 4.5, [6, 1], {
    operation: 'read', ...hoja('Mails'), options: {},
  }, { executeOnce: true, alwaysOutputData: true }),
  code('Juntar fuentes', '03_juntar_fuentes.js', [7, 1]),
  code('Preparar pedido a Gemini', '04_preparar_pedido.js', [8, 1]),
  nodo('¿Hay algo para Gemini?', 'n8n-nodes-base.if', 2.2, [8.5, 2], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: crypto.randomUUID(),
        leftValue: '={{ $json.sin_pedidos === true }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'false', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  }),
  llamadaGemini('Gemini: leer y puntuar', [9, 1], 180000),
  code('Leer respuesta', '05_leer_respuesta.js', [10, 1]),
  nodo('Leer historial', 'n8n-nodes-base.googleSheets', 4.5, [11, 1], {
    operation: 'read', ...hoja('Avisos'), options: {},
  }, { executeOnce: true, alwaysOutputData: true }),
  // Si la pestaña falla o no existe, el nodo sigue: con postular_por_mail apagado no se usa,
  // y prendido, "Filtrar y armar resumen" ve el error y no postula.
  nodo('Leer postulaciones', 'n8n-nodes-base.googleSheets', 4.5, [11, 2], {
    operation: 'read', ...hoja('Postulaciones'), options: {},
  }, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  code('Filtrar y armar resumen', '06_filtrar_y_armar_resumen.js', [12, 1]),

  // Postular por mail. Va más arriba en el lienzo que el resumen: con executionOrder v1,
  // n8n corre primero esta rama entera, y "Completar resumen" ya ve cómo salió cada envío.
  code('Postulaciones a mandar', '10_postulaciones_a_mandar.js', [13, -1]),
  nodo('Leer CV', 'n8n-nodes-base.readWriteFile', 1, [14, -1], {
    operation: 'read',
    fileSelector: '={{ $json.ruta_cv }}',
    options: { dataPropertyName: 'cv' },
  }, { onError: 'continueRegularOutput' }),
  nodo('¿Envío automático?', 'n8n-nodes-base.if', 2.2, [15, -1], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: crypto.randomUUID(),
        leftValue: "={{ $('Configuración').first().json.postular_por_mail.modo === 'automatico' }}",
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  }),
  nodo('Enviar postulación', 'n8n-nodes-base.gmail', 2.1, [16, -0.6], {
    sendTo: "={{ $('Postulaciones a mandar').item.json.para }}",
    subject: "={{ $('Postulaciones a mandar').item.json.asunto }}",
    emailType: 'text',
    message: "={{ $('Postulaciones a mandar').item.json.texto }}",
    options: {
      appendAttribution: false,
      bccList: "={{ $('Configuración').first().json.mail_resumen }}",
      attachmentsUi: { attachmentsBinary: [{ property: 'cv' }] },
    },
  }, { onError: 'continueRegularOutput' }),
  nodo('Crear borrador de postulación', 'n8n-nodes-base.gmail', 2.1, [16, -1.4], {
    resource: 'draft',
    operation: 'create',
    subject: "={{ $('Postulaciones a mandar').item.json.asunto }}",
    emailType: 'text',
    message: "={{ $('Postulaciones a mandar').item.json.texto }}",
    options: {
      sendTo: "={{ $('Postulaciones a mandar').item.json.para }}",
      bccList: "={{ $('Configuración').first().json.mail_resumen }}",
      attachmentsUi: { attachmentsBinary: [{ property: 'cv' }] },
    },
  }, { onError: 'continueRegularOutput' }),
  code('Resultado de postulaciones', '11_resultado_de_postulaciones.js', [17, -1]),
  nodo('Guardar postulaciones', 'n8n-nodes-base.googleSheets', 4.5, [18, -1], {
    operation: 'append',
    ...hoja('Postulaciones'),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
    options: {},
  }),

  code('Sólo si hay algo para mandar', '07_solo_si_hay_algo.js', [13, 0]),
  code('Completar resumen', '12_completar_resumen.js', [14, 0]),
  nodo('Enviar resumen', 'n8n-nodes-base.gmail', 2.1, [15, 0], {
    sendTo: '={{ $json.para }}',
    subject: '={{ $json.asunto }}',
    emailType: 'html',
    message: '={{ $json.html }}',
    options: { appendAttribution: false },
  }),
  code('Filas a guardar', '08_filas_a_guardar.js', [13, 1]),
  nodo('Guardar avisos', 'n8n-nodes-base.googleSheets', 4.5, [14, 1], {
    operation: 'append',
    ...hoja('Avisos'),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
    options: {},
  }),
  code('Mails a guardar', '09_mails_a_guardar.js', [13, 2]),
  nodo('Guardar mails leídos', 'n8n-nodes-base.googleSheets', 4.5, [14, 2], {
    operation: 'append',
    ...hoja('Mails'),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
    options: {},
  }),
];

// [origen, destino, salida del origen]. El nodo "if" tiene dos salidas: 0 = sí, 1 = no.
const cadena = [
  ['Cada 3 horas', 'Configuración'],
  ['Configuración', 'Preparar búsqueda web'],
  ['Preparar búsqueda web', '¿Toca buscar en la web?'],
  ['¿Toca buscar en la web?', 'Gemini: buscar en la web', 0],
  ['¿Toca buscar en la web?', 'Buscar alertas en Gmail', 1],
  ['Gemini: buscar en la web', 'Buscar alertas en Gmail'],
  ['Buscar alertas en Gmail', 'Leer mails ya leídos'],
  ['Leer mails ya leídos', 'Juntar fuentes'],
  ['Juntar fuentes', 'Preparar pedido a Gemini'],
  ['Preparar pedido a Gemini', '¿Hay algo para Gemini?'],
  ['¿Hay algo para Gemini?', 'Gemini: leer y puntuar', 0],
  ['¿Hay algo para Gemini?', 'Leer postulaciones', 1],
  ['Gemini: leer y puntuar', 'Leer respuesta'],
  ['Leer respuesta', 'Leer postulaciones'],
  ['Leer postulaciones', 'Leer historial'],
  ['Leer historial', 'Filtrar y armar resumen'],
  ['Filtrar y armar resumen', 'Postulaciones a mandar'],
  ['Filtrar y armar resumen', 'Sólo si hay algo para mandar'],
  ['Filtrar y armar resumen', 'Filas a guardar'],
  ['Filtrar y armar resumen', 'Mails a guardar'],
  ['Postulaciones a mandar', 'Leer CV'],
  ['Leer CV', '¿Envío automático?'],
  ['¿Envío automático?', 'Enviar postulación', 0],
  ['¿Envío automático?', 'Crear borrador de postulación', 1],
  ['Enviar postulación', 'Resultado de postulaciones'],
  ['Crear borrador de postulación', 'Resultado de postulaciones'],
  ['Resultado de postulaciones', 'Guardar postulaciones'],
  ['Sólo si hay algo para mandar', 'Completar resumen'],
  ['Completar resumen', 'Enviar resumen'],
  ['Filas a guardar', 'Guardar avisos'],
  ['Mails a guardar', 'Guardar mails leídos'],
];

const nombres = new Set(nodes.map((n) => n.name));
const connections = {};
for (const [de, a, salida = 0] of cadena) {
  if (!nombres.has(de) || !nombres.has(a)) throw new Error(`Conexión con un nodo que no existe: ${de} → ${a}`);
  connections[de] ??= { main: [] };
  while (connections[de].main.length <= salida) connections[de].main.push([]);
  connections[de].main[salida].push({ node: a, type: 'main', index: 0 });
}

// Id fijo: al volver a importar con "n8n import:workflow" se reemplaza el mismo workflow en vez de duplicarlo.
const workflow = {
  id: 'BusquedaEmpleo01',
  name: 'Búsqueda de empleo: último clic',
  active: false,
  nodes,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Argentina/Buenos_Aires' },
  pinData: {},
};

const destino = join(raiz, 'workflow', 'busqueda_empleo_ultimo_clic.json');
writeFileSync(destino, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Listo: ${destino} (${nodes.length} nodos)`);
