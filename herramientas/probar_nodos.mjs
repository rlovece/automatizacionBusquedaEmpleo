// Corre los nodos de código con mails de alerta, una búsqueda web y respuestas de Gemini simulados,
// sin n8n ni API. Uso: node herramientas/probar_nodos.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let salidas = {};

// Imita $input y $('Nodo') de n8n. Pedir un nodo que no corrió tira error, como en n8n.
function correr(nombre, archivo, entrada) {
  const codigo = readFileSync(join(raiz, 'workflow', 'nodos', archivo), 'utf8');
  const envolver = (items) => ({ all: () => items, first: () => items[0] });
  const $ = (otro) => {
    if (!salidas[otro]) throw new Error(`El nodo "${otro}" no se ejecutó`);
    return envolver(salidas[otro]);
  };
  // El nodo Code de n8n no tiene URL entre sus globales: acá tampoco.
  const resultado = new Function('$input', '$', 'URL', codigo)(envolver(entrada), $, undefined);
  salidas[nombre] = resultado;
  return resultado;
}

const configurar = (cambios = {}) => {
  const [cfg] = correr('Configuración', '01_configuracion.js', [{ json: {} }]);
  Object.assign(cfg.json, cambios);
  cfg.json.busqueda_web.localidad = { ciudad: 'Morón', provincia: 'Buenos Aires', alrededores: 'Haedo, Castelar' };
  cfg.json.busqueda_web.paginas = ['https://ejemplo.gob.ar/empleo'];
  return cfg.json;
};

// Respuesta de la Interactions API con un texto final.
const respuestaGemini = (texto, extra = {}) => ({
  status: 'completed',
  steps: [
    { type: 'thought', summary: [] },
    { type: 'google_search_call', arguments: { queries: ['empleo técnico Morón'] } },
    { type: 'model_output', content: [{ type: 'text', text: texto }] },
  ],
  ...extra,
});

// ─── 1. Configuración y búsqueda web ───────────────────────────────────────────
const cfg = configurar({
  nombre: 'Juan',
  mail_resumen: 'juan.perez@gmail.com',
  datos_a_ocultar: ['Juan Pérez', 'Juan', '11 5555-1234'],
});
assert.equal(cfg.cvs.length, 4);
assert.doesNotMatch(cfg.perfil, /Nombre:/, 'el perfil que viaja a Gemini no lleva el nombre');

const [web] = correr('Preparar búsqueda web', '02_preparar_busqueda_web.js', [{ json: cfg }]);
const cuerpoWeb = web.json.body;
assert.equal(web.json.buscar, cfg.busqueda_web.horas.includes(web.json.hora));
assert.equal(cuerpoWeb.model, 'gemini-3.8-flash');
assert.deepEqual(cuerpoWeb.tools, [{ type: 'google_search' }, { type: 'url_context' }]);
assert.deepEqual(cuerpoWeb.generation_config, { thinking_level: 'low' });
assert.match(cuerpoWeb.input, /últimos 7 días/);
assert.match(cuerpoWeb.input, /https:\/\/ejemplo\.gob\.ar\/empleo/);
assert.match(cuerpoWeb.input, /Morón, Buenos Aires, Argentina\. También sirven: Haedo, Castelar/);
assert.doesNotMatch(cuerpoWeb.input, /Juan/);
// Las horas de la búsqueda web tienen que caer en horas en que corre el disparador.
const flujo = JSON.parse(readFileSync(join(raiz, 'workflow', 'busqueda_empleo_ultimo_clic.json'), 'utf8'));
const cron = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger').parameters.rule.interval[0].expression;
const [, desde, hasta, paso] = cron.match(/^0 (\d+)-(\d+)\/(\d+) \* \* \*$/).map(Number);
for (const h of cfg.busqueda_web.horas) {
  assert.ok(h >= desde && h <= hasta && (h - desde) % paso === 0, `la hora ${h} no coincide con el disparador (${cron})`);
}

// ─── 2. Juntar fuentes: dos mails (uno ya leído) y el listado web ─────────────
salidas['Buscar alertas en Gmail'] = [
  {
    json: {
      id: 'm1',
      subject: 'Juan, 5 nuevas ofertas para Técnico',
      from: { value: [{ address: 'alertas@computrabajo.com.ar' }] },
      html: `<html><head><style>.x{}</style></head><body>
        <p>Hola JUAN PÉREZ, estas ofertas son para juan.perez@gmail.com (tel. 11 5555-1234)</p>
        <table><tr><td><a href="https://ar.computrabajo.com/oferta/1"><b>Técnico en reparación de celulares</b></a></td></tr>
        <tr><td>ServiFix &amp; Cía - Morón</td></tr></table>
        <p><a href="https://ar.computrabajo.com/oferta/2">Revendedor desde casa</a> Ganá $$$</p></body></html>`,
    },
  },
  { json: { id: 'm0', subject: 'viejo', from: { value: [{ address: 'x@bumeran.com.ar' }] }, text: 'ya leído' } },
];
salidas['Gemini: buscar en la web'] = [{
  json: respuestaGemini('1. Técnico de heladeras, FríoSur, Castelar [https://www.clasificados.com.ar/aviso/9]'),
}];
const mailsYaLeidos = [{ json: { fecha: '2026-09-27', mail_id: 'm0', asunto: 'viejo' } }];
const fuentes = correr('Juntar fuentes', '03_juntar_fuentes.js', mailsYaLeidos);
assert.deepEqual(fuentes.map((f) => f.json.origen), ['gmail', 'web']);
assert.equal(fuentes[0].json.id, 'm1', 'el mail ya leído no se vuelve a procesar');
assert.match(fuentes[1].json.text, /Técnico de heladeras, FríoSur, Castelar \[https/);

// ─── 3. Pedidos a Gemini ───────────────────────────────────────────────────────
const pedidos = correr('Preparar pedido a Gemini', '04_preparar_pedido.js', fuentes);
assert.equal(pedidos.length, 2);
const entrada = pedidos[0].json.body.input;
assert.match(entrada, /Técnico en reparación de celulares \[https:\/\/ar\.computrabajo\.com\/oferta\/1\]/);
assert.match(entrada, /ServiFix & Cía - Morón/);
assert.doesNotMatch(entrada, /\.x\{\}/);
assert.doesNotMatch(entrada, /juan|pérez|5555/i, 'los datos de la persona no viajan a Gemini');
assert.match(entrada, /Hola \[dato oculto\], estas ofertas son para \[dato oculto\]/);
assert.doesNotMatch(entrada, /Saludos cordiales|Quedo a disposición/, 'la firma y el mensaje de postulación no viajan a Gemini');
assert.doesNotMatch(pedidos[0].json.asunto, /Juan/);
const formato = pedidos[0].json.body.response_format;
assert.equal(formato.mime_type, 'application/json');
assert.deepEqual(formato.schema.properties.avisos.items.properties.cv_sugerido.enum,
  ['tecnico', 'mantenimiento', 'atencion', 'operario', 'ninguno']);
assert.ok(formato.schema.properties.avisos.items.required.includes('mail_contacto'));
assert.match(entrada, /"mail_contacto": .*No la inventes ni la deduzcas/s);
assert.equal(pedidos[0].json.origen, 'gmail');
assert.equal(pedidos[1].json.origen, 'web');
assert.equal(pedidos[1].json.remitente, 'búsqueda web');

// ─── 4. Respuestas de Gemini: el mail sale bien, la web falla ─────────────────
const aviso = (extra) => ({
  titulo: 'Técnico en reparación de celulares', empresa: 'ServiFix', localidad: 'Morón',
  link: 'https://ar.computrabajo.com/oferta/1', resumen: 'Reparación de celulares', cv_sugerido: 'tecnico',
  puntaje: 85, motivo: 'Es justo lo que hacés.', faltantes: '', alerta_estafa: false, motivo_estafa: '', ...extra,
});
const respuestaMail = respuestaGemini(JSON.stringify({ avisos: [
  aviso(),
  aviso({ titulo: 'Revendedor desde casa', empresa: '', cv_sugerido: 'atencion', puntaje: 70, alerta_estafa: true, motivo_estafa: 'Pide comprar un kit' }),
  aviso({ titulo: 'Cadete en moto', cv_sugerido: 'deposito', puntaje: 40 }),
  aviso({ titulo: 'Técnico <script>', localidad: 'Haedo', puntaje: 75, link: 'javascript:alert(1)' }),
  aviso({ titulo: 'Ya visto', puntaje: 90 }),
  aviso({ titulo: 'Técnico de heladeras', empresa: 'FríoSur', localidad: 'Castelar', link: 'https://www.clasificados.com.ar/aviso/9', puntaje: 80 }),
] }));
const leidos = correr('Leer respuesta', '05_leer_respuesta.js', [
  { json: respuestaMail },
  { json: { error: { message: 'Resource has been exhausted (e.g. check quota).' } } },
]);
assert.equal(leidos.filter((l) => l.json._tipo === 'aviso').length, 6);
assert.equal(leidos.filter((l) => l.json._tipo === 'error').length, 1);

// Otras formas de fallar
const fallos = correr('Leer respuesta', '05_leer_respuesta.js', [
  { json: { error: 'The service was not able to process your request' } },
  { json: respuestaGemini('{"avisos": [', { status: 'incomplete' }) },
  { json: respuestaGemini('esto no es JSON') },
  { json: { status: 'completed', steps: [] } },
]).map((f) => f.json.detalle);
assert.deepEqual(fallos, [
  'La API respondió con error: The service was not able to process your request',
  'La respuesta quedó cortada: la fuente tenía demasiados avisos.',
  'La respuesta no es un JSON válido.',
  'La respuesta de la API no tiene texto.',
]);
salidas['Leer respuesta'] = leidos;

// ─── 5. Filtrar contra el historial y armar el mail ────────────────────────────
const historial = [{ json: { clave: 'ya visto|servifix|moron' } }];
const [resumen] = correr('Filtrar y armar resumen', '06_filtrar_y_armar_resumen.js', historial);
const r = resumen.json;
assert.equal(r.enviar, true);
assert.equal(r.asunto, '3 avisos nuevos de trabajo');
assert.equal(r.filas.length, 5, 'el ya visto no se vuelve a guardar');
const porTitulo = Object.fromEntries(r.filas.map((f) => [f.titulo, f]));
assert.equal(porTitulo['Revendedor desde casa'].estado, 'descartado: posible estafa');
assert.equal(porTitulo['Cadete en moto'].estado, 'descartado: bajo el umbral');
assert.equal(porTitulo['Técnico en reparación de celulares'].estado, 'en el resumen');
assert.equal(porTitulo['Técnico en reparación de celulares'].portal, 'computrabajo');
assert.equal(porTitulo['Técnico de heladeras'].portal, 'clasificados');
assert.doesNotMatch(r.html, /<script>/, 'el HTML del modelo se escapa');
assert.doesNotMatch(r.html, /javascript:/, 'sólo se enlazan links http');
assert.match(r.html, /Hola Juan!/, 'el saludo usa el nombre, que no pasó por Gemini');
assert.match(r.html, /no se pudo leer 1 fuente; se reintenta en la próxima corrida/);
assert.match(r.html, /Se descartó 1 aviso con señales de estafa/);
// El mail m1 se leyó bien y queda anotado. La fuente web falló y, de todos modos, no se anota nunca.
assert.deepEqual(r.mails_leidos.map((m) => m.mail_id), ['m1']);
assert.equal(correr('Mails a guardar', '09_mails_a_guardar.js', [resumen]).length, 1);

// ─── 6. Ramas finales ─────────────────────────────────────────────────────────
assert.equal(correr('Sólo si hay algo para mandar', '07_solo_si_hay_algo.js', [resumen]).length, 1);
assert.equal(correr('x', '07_solo_si_hay_algo.js', [{ json: { enviar: false } }]).length, 0);
assert.equal(correr('Filas a guardar', '08_filas_a_guardar.js', [resumen]).length, 5);

// Con postular_por_mail apagado, todo queda como antes de la fase 2.
assert.deepEqual(r.postulaciones, []);
assert.ok(r.filas.every((f) => f.postulado === ''));
assert.equal(r.html, r.html_avisos + r.html_notas);
assert.equal(correr('Postulaciones a mandar', '10_postulaciones_a_mandar.js', [resumen]).length, 0,
  'sin postulaciones, la rama de envío se corta');
const [completo] = correr('Completar resumen', '12_completar_resumen.js', [resumen]);
assert.equal(completo.json.html, r.html, 'sin postulaciones, el resumen no cambia');

const ejemplo = r;

// ─── 7. Corrida sin búsqueda web y con la web fallando ────────────────────────
salidas = {};
configurar();
salidas['Buscar alertas en Gmail'] = [{ json: {} }]; // Gmail sin mails: alwaysOutputData deja un ítem vacío
assert.equal(correr('Juntar fuentes', '03_juntar_fuentes.js', [{ json: {} }]).length, 0,
  'sin mails y sin búsqueda web no hay nada que procesar');

salidas['Gemini: buscar en la web'] = [{ json: { error: { message: 'API key not valid' } } }];
const conError = correr('Juntar fuentes', '03_juntar_fuentes.js', [{ json: {} }]);
assert.deepEqual(conError.map((f) => f.json.origen), ['web_error']);
assert.deepEqual(correr('Preparar pedido a Gemini', '04_preparar_pedido.js', conError).map((p) => p.json),
  [{ sin_pedidos: true }], 'el error de la web no se manda a Gemini, pero el flujo sigue');

// "¿Hay algo para Gemini?" saltea la llamada: "Leer respuesta" no corre y el resumen avisa el error.
const [soloError] = correr('Filtrar y armar resumen', '06_filtrar_y_armar_resumen.js', [{ json: {} }]);
assert.equal(soloError.json.enviar, true, 'si la web falló, llega el mail con la nota técnica');
assert.equal(soloError.json.asunto, 'Sin avisos nuevos');
assert.match(soloError.json.html, /no se pudo leer 1 fuente/);
assert.deepEqual(soloError.json.filas, []);
assert.deepEqual(soloError.json.mails_leidos, []);

salidas['Gemini: buscar en la web'] = [{ json: respuestaGemini('Sin avisos.') }];
assert.equal(correr('Juntar fuentes', '03_juntar_fuentes.js', [{ json: {} }]).length, 0);

// ─── 8. Fase 2: postular por mail ─────────────────────────────────────────────
// Corre "Filtrar y armar resumen" con estos avisos, las filas de la pestaña Postulaciones y el modo pedido.
function fase2({ modo = 'borrador', avisos, previas = [{ json: {} }], historial = [{ json: {} }] }) {
  salidas = {};
  const c = configurar({ nombre: 'Juan', mail_resumen: 'juan.perez@gmail.com', datos_a_ocultar: ['Juan Pérez', 'juanperez'] });
  c.postular_por_mail.modo = modo;
  salidas['Juntar fuentes'] = [];
  salidas['Preparar pedido a Gemini'] = [{ json: { origen: 'gmail', mail_id: 'm9', asunto: 'Alertas' } }];
  salidas['Leer respuesta'] = avisos.map((a) => ({
    json: { _tipo: 'aviso', mail_id: 'm9', remitente: 'alertas@computrabajo.com.ar', asunto: 'Alertas', ...a },
  }));
  if (previas) salidas['Leer postulaciones'] = previas;
  return correr('Filtrar y armar resumen', '06_filtrar_y_armar_resumen.js', historial)[0];
}
const conMail = (titulo, mail, extra = {}) => aviso({ titulo, empresa: `Empresa ${titulo}`, mail_contacto: mail, ...extra });
const hoyIso = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
const [ah, mh, dh] = hoyIso.split('-').map(Number);

// Cada condición, por separado. Sólo "Califica" cumple todas.
const casos = [
  conMail('Califica', ' RRHH@Lavamas.com.ar ', { puntaje: 90 }),
  conMail('Sin mail', '', { puntaje: 99 }),
  conMail('Mail roto', 'rrhh@lavamas', { puntaje: 98 }),
  conMail('Mail tapado', '[dato oculto]', { puntaje: 97 }),
  conMail('Automático', 'no-reply@empresa.com.ar', { puntaje: 96 }),
  conMail('Del portal', 'empleos@bumeran.com.ar', { puntaje: 95 }),
  conMail('De la persona', 'juanperez@hotmail.com', { puntaje: 94 }),
  conMail('Estafa', 'ventas@kits.com', { puntaje: 93, alerta_estafa: true, motivo_estafa: 'Pide comprar un kit' }),
  conMail('No encaja', 'rrhh@otra.com', { puntaje: 92, cv_sugerido: 'ninguno' }),
  conMail('Bajo el mínimo', 'rrhh@tibia.com', { puntaje: 70 }),
  conMail('Ya escrita', 'cv@frio.com', { puntaje: 91 }),
];
const claveYaEscrita = 'ya escrita|empresa ya escrita|moron';
const f2 = fase2({
  avisos: casos,
  previas: [{ json: { fecha: '2026-01-02 10:00:00', clave: claveYaEscrita, mail_destino: 'cv@frio.com', resultado: 'borrador creado' } }],
}).json;
assert.deepEqual(f2.postulaciones.map((p) => p.titulo), ['Califica']);
const p1 = f2.postulaciones[0];
assert.equal(p1.para, 'rrhh@lavamas.com.ar', 'el mail se limpia y va en minúsculas');
assert.equal(p1.asunto, 'Postulación: Califica');
assert.equal(p1.cv, 'CV Técnico');
assert.equal(p1.ruta_cv, '/files/cv/CV_Tecnico.pdf');
assert.equal(p1.modo, 'borrador');
assert.match(p1.texto, /^Buenos días:\n\nLes escribo por el aviso de Califica en Empresa Califica\. Les adjunto mi CV\./);
assert.match(p1.texto, /reparación de PC y notebooks y en redes/);
assert.match(p1.texto, /Saludos cordiales,\nJuan Pérez\n11 5555-1234$/);
const postulado = Object.fromEntries(f2.filas.map((f) => [f.titulo, f.postulado]));
assert.equal(postulado['Califica'], 'borrador (por mail)');
assert.ok(Object.entries(postulado).every(([t, v]) => t === 'Califica' || v === ''));
assert.equal(f2.enviar, true);

// La frase cambia con el CV, y sin empresa no queda "en".
const [pOperario] = fase2({ avisos: [conMail('Operario de depósito', 'rrhh@deposito.com', { empresa: '', cv_sugerido: 'operario' })] }).json.postulaciones;
assert.match(pOperario.texto, /aviso de Operario de depósito\. Les adjunto/);
assert.match(pOperario.texto, /preparación de pedidos y control de stock/);
assert.equal(pOperario.cv, 'CV Depósito y logística');

// Tope por corrida: de cuatro que califican, salen los tres de mayor puntaje.
const cuatro = [80, 95, 85, 90].map((p) => conMail(`Puesto ${p}`, `rrhh${p}@empresa.com`, { puntaje: p }));
assert.deepEqual(fase2({ avisos: cuatro }).json.postulaciones.map((p) => p.titulo), ['Puesto 95', 'Puesto 90', 'Puesto 85']);

// Tope por día: ya hay 4 de hoy (una con la fecha como la muestra la hoja), así que queda lugar para 1.
// Los errores y las de otro día no cuentan.
const deHoy = (fecha, resultado = 'borrador creado') => ({ json: { fecha, clave: 'x', mail_destino: 'a@b.com', resultado } });
const previasHoy = [
  deHoy(`${hoyIso} 08:00:00`), deHoy(`${hoyIso} 11:00:00`), deHoy(`${hoyIso} 14:00:00`), deHoy(`${dh}/${mh}/${ah} 17:00:00`),
  deHoy(`${hoyIso} 18:00:00`, 'error: Attachment not found'), deHoy('2026-01-01 10:00:00'),
];
assert.deepEqual(fase2({ avisos: cuatro, previas: previasHoy }).json.postulaciones.map((p) => p.titulo), ['Puesto 95']);
previasHoy.push(deHoy(`${hoyIso} 19:00:00`));
assert.deepEqual(fase2({ avisos: cuatro, previas: previasHoy }).json.postulaciones, [], 'con 5 en el día no se postula más');

// Interruptor apagado: no se postula ni se lee la pestaña Postulaciones.
const apagado = fase2({ modo: 'apagado', avisos: cuatro, previas: null }).json;
assert.deepEqual(apagado.postulaciones, []);
assert.ok(apagado.filas.every((f) => f.postulado === ''));
assert.doesNotMatch(apagado.html, /Postulaciones|postulamos|Borradores/);

// Un aviso con estafa y mail no se postula aunque tenga el puntaje más alto.
const estafa = fase2({ avisos: [conMail('Kit', 'ventas@kits.com', { puntaje: 100, alerta_estafa: true, motivo_estafa: 'Pide pagar' })] }).json;
assert.deepEqual(estafa.postulaciones, []);
assert.equal(estafa.filas[0].estado, 'descartado: posible estafa');
assert.equal(estafa.filas[0].postulado, '');

// Si no se pudo leer la pestaña Postulaciones, no se postula y el resumen lo avisa.
const sinPestania = fase2({ avisos: cuatro, previas: [{ json: { error: 'Sheet with name Postulaciones not found' } }] }).json;
assert.deepEqual(sinPestania.postulaciones, []);
assert.match(sinPestania.html, /no se pudo leer la pestaña Postulaciones/);

// Modo automático: la marca en la pestaña Avisos es "sí (por mail)".
const auto = fase2({ modo: 'automatico', avisos: [conMail('Califica', 'rrhh@lavamas.com.ar')] });
assert.equal(auto.json.filas[0].postulado, 'sí (por mail)');
assert.equal(auto.json.postulaciones[0].modo, 'automatico');

// Si está prendido y no sale ninguna, el mail y la salida del nodo dicen por qué.
const sinNinguna = fase2({ avisos: [
  aviso({ titulo: 'Sin mail A', mail_contacto: '' }), aviso({ titulo: 'Sin mail B', mail_contacto: 'alertas@bumeran.com.ar' }),
  conMail('Bajo', 'rrhh@bajo.com', { puntaje: 72 }), conMail('Kit', 'ventas@kits.com', { alerta_estafa: true }),
] }).json;
assert.deepEqual(sinNinguna.postulaciones, []);
assert.equal(sinNinguna.informe_postulaciones,
  'ninguna en esta corrida. De 4 avisos nuevos: 2 sin mail de contacto (se postula desde el portal), 1 posible estafa, 1 puntaje menor a 75.');
assert.match(sinNinguna.html, /Postulación por mail: ninguna en esta corrida/);
assert.match(fase2({ avisos: cuatro, previas: previasHoy }).json.informe_postulaciones, /tope de 5 por día/);
assert.equal(fase2({ avisos: [] }).json.informe_postulaciones, 'ninguna, porque no hubo avisos nuevos.');
assert.equal(apagado.informe_postulaciones, '', 'apagado no informa nada');
assert.equal(sinPestania.informe_postulaciones, '', 'el error de la pestaña ya tiene su propia nota');
assert.equal(fase2({ avisos: cuatro }).json.informe_postulaciones, '', 'si salió alguna, no hay informe');

// ─── 9. Rama de envío: resultado, hoja y resumen ──────────────────────────────
const dos = fase2({ avisos: [conMail('Técnico A', 'a@servi.com', { puntaje: 90 }), conMail('Técnico B', 'b@servi.com', { puntaje: 80 })] });
const aMandar = correr('Postulaciones a mandar', '10_postulaciones_a_mandar.js', [dos]);
assert.equal(aMandar.length, 2);
// Gmail: el primer borrador sale bien; el segundo falla (por ejemplo, no encontró el PDF).
const resultados = correr('Resultado de postulaciones', '11_resultado_de_postulaciones.js', [
  { json: { id: 'r-123', message: { id: 'm-1' } } },
  { json: { error: { message: 'Attachment not found' } } },
]).map((i) => i.json);
assert.deepEqual(resultados.map((x) => [x.titulo, x.mail_destino, x.cv, x.resultado]), [
  ['Técnico A', 'a@servi.com', 'CV Técnico', 'borrador creado'],
  ['Técnico B', 'b@servi.com', 'CV Técnico', 'error: Attachment not found'],
]);
const encabezado = readFileSync(join(raiz, 'workflow', 'encabezados_pestania_postulaciones.csv'), 'utf8').trim().split(',');
assert.deepEqual(Object.keys(resultados[0]), encabezado, 'las filas coinciden con el encabezado de la pestaña');

const filasDos = correr('Filas a guardar', '08_filas_a_guardar.js', [dos]).map((i) => i.json);
assert.deepEqual(filasDos.map((f) => f.postulado), ['borrador (por mail)', ''], 'si falló, el aviso no queda como postulado');

const [conPostulaciones] = correr('Completar resumen', '12_completar_resumen.js', [dos]);
const htmlPost = conPostulaciones.json.html;
assert.match(htmlPost, /Te dejamos listo 1 mail para postularte<\/b>, con el CV adjunto, en Borradores/);
assert.match(htmlPost, /Técnico A · Empresa Técnico A → a@servi\.com \(CV Técnico\)/);
assert.match(htmlPost, /No se pudo armar esta postulación; si te interesa, mandá el CV a mano/);
assert.ok(htmlPost.indexOf('Borradores') > htmlPost.indexOf('Encontramos'), 'va después de los avisos');

// En automático, el resumen dice que ya salió a su nombre.
salidas['Configuración'][0].json.postular_por_mail.modo = 'automatico';
assert.match(correr('Completar resumen', '12_completar_resumen.js', [dos])[0].json.html, /Te postulamos por mail a 1 aviso<\/b>, a tu nombre/);

// Si la rama de envío no llegó a correr, se listan igual y se remite a la hoja.
delete salidas['Resultado de postulaciones'];
assert.match(correr('Completar resumen', '12_completar_resumen.js', [dos])[0].json.html,
  /Se armaron 2 postulaciones por mail\.<\/b> Revisá en la pestaña Postulaciones/);

// Las conexiones de la rama en el workflow generado.
const conexiones = flujo.connections;
assert.deepEqual(conexiones['¿Envío automático?'].main.map((s) => s.map((c) => c.node)),
  [['Enviar postulación'], ['Crear borrador de postulación']]);
const posicion = (nombre) => flujo.nodes.find((n) => n.name === nombre).position;
assert.ok(posicion('Postulaciones a mandar')[1] < posicion('Sólo si hay algo para mandar')[1],
  'la rama de postulaciones va más arriba, para que corra antes que el resumen');
assert.equal(flujo.nodes.find((n) => n.name === 'Leer CV').parameters.options.dataPropertyName, 'cv');

console.log('Todas las pruebas pasaron.\n\nAsunto:', ejemplo.asunto, '\n', ejemplo.html);
console.log('\nPostulación de ejemplo:\nPara:', p1.para, '\nAsunto:', p1.asunto, '\n\n' + p1.texto);
