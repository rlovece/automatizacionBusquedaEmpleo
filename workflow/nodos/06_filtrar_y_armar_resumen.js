// Descarta lo que ya se vio (según la hoja), las posibles estafas y lo que no llega al umbral,
// y arma el mail con los mejores avisos. Devuelve un solo ítem con el mail, las filas de avisos,
// los mails de alertas que ya se leyeron bien (para no volver a procesarlos)
// y, si postular_por_mail no está apagado, las postulaciones por mail que tocan en esta corrida.

const cfg = $('Configuración').first().json;
const pedidos = $('Preparar pedido a Gemini').all().map((i) => i.json);
// Si no hubo nada para mandar, "Leer respuesta" no corrió.
let leidos = [];
try {
  leidos = $('Leer respuesta').all().map((i) => i.json);
} catch (e) {
  leidos = [];
}
const historial = $input.all().map((i) => i.json);

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function clave(aviso) {
  return [aviso.titulo, aviso.empresa, aviso.localidad].map(normalizar).join('|');
}

// El sitio del aviso: sale del link y, si no hay, de quien mandó la alerta.
// Sin new URL(): el nodo Code de n8n no tiene URL entre sus globales, y fallaba siempre.
function portal(aviso) {
  const deLink = String(aviso.link || '').match(/^https?:\/\/([^/?#:]+)/i);
  const dominio = (deLink ? deLink[1] : String(aviso.remitente || '').split('@')[1] || '').toLowerCase();
  const ignorar = ['www', 'ar', 'com', 'net', 'org', 'gob', 'gov', 'mail', 'email', 'mailing',
    'news', 'alertas', 'alerts', 'noreply', 'info', 'm', 'e'];
  return dominio.split('.').find((parte) => parte && !ignorar.includes(parte)) || dominio || 'web';
}

function escapar(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const vistos = new Set(historial.map((fila) => fila.clave).filter(Boolean));
const errores = leidos.filter((l) => l._tipo === 'error');
const erroresWeb = $('Juntar fuentes').all().map((i) => i.json).filter((f) => f.origen === 'web_error');
const totalErrores = errores.length + erroresWeb.length;
const nombresCv = Object.fromEntries(cfg.cvs.map((cv) => [cv.id, cv.nombre]));
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

// Avisos nuevos, sin repetir los que llegaron por más de una fuente en la misma corrida.
const nuevos = [];
for (const aviso of leidos.filter((l) => l._tipo === 'aviso')) {
  const k = clave(aviso);
  if (vistos.has(k)) continue;
  vistos.add(k);
  nuevos.push({ ...aviso, clave: k, portal: portal(aviso) });
}

const aptos = nuevos
  .filter((a) => !a.alerta_estafa && a.cv_sugerido !== 'ninguno' && a.puntaje >= cfg.umbral)
  .sort((a, b) => b.puntaje - a.puntaje);
const elegidos = aptos.slice(0, cfg.max_avisos);
const claveElegidos = new Set(elegidos.map((a) => a.clave));

// ─── Postular por mail ────────────────────────────────────────────────────────
const pxm = cfg.postular_por_mail || { modo: 'apagado' };
const postulando = pxm.modo === 'borrador' || pxm.modo === 'automatico';

// La dirección que copió Gemini, si es de contacto. Se descartan las de los portales,
// las automáticas y las de la persona (sus datos se tapan antes de Gemini, pero por las dudas).
const MAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const AUTOMATICA = /^(no-?reply|do-?not-?reply|no-?responder|noresponder|notificaciones|notifications?|alertas?|alerts?|mailer-daemon|postmaster|bounces?|newsletter)([._+-]|$)/;
const PORTALES = /(^|[.@])(computrabajo|bumeran|zonajobs|indeed|linkedin|laborum|jooble|glassdoor|getonbrd|empleosclarin)\./;
const propios = [...(cfg.datos_a_ocultar || []), cfg.mail_resumen]
  .map((dato) => String(dato || '').trim().toLowerCase())
  .filter((dato) => dato.length >= 3);
function mailDeContacto(texto) {
  const mail = String(texto || '').trim().replace(/^mailto:/i, '').toLowerCase();
  if (!MAIL.test(mail)) return '';
  const [usuario, dominio] = mail.split('@');
  if (AUTOMATICA.test(usuario) || PORTALES.test(`@${dominio}`)) return '';
  if (propios.some((dato) => mail.includes(dato))) return '';
  return mail;
}

// Lo que ya se mandó (o quedó en borrador) sale de la pestaña "Postulaciones".
// Si no se pudo leer, no se postula: sin historial podría repetirse un envío.
let previas = [];
let errorPostulaciones = false;
if (postulando) {
  try {
    previas = $('Leer postulaciones').all().map((i) => i.json);
  } catch (e) {
    errorPostulaciones = true;
  }
  if (previas.some((p) => p.error)) errorPostulaciones = true;
}
const valida = (p) => p.mail_destino && !String(p.resultado || '').startsWith('error');
const yaEscritas = new Set(previas.filter(valida).map((p) => `${p.mail_destino}|${p.clave}`));
// La fecha se guarda como 2026-09-28 10:00:00, pero si la hoja la pasa a formato local queda 28/9/2026.
const [anio, mes, dia] = ahora.slice(0, 10).split('-').map(Number);
function esDeHoy(fecha) {
  const iso = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const local = String(fecha || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (iso) return Number(iso[1]) === anio && Number(iso[2]) === mes && Number(iso[3]) === dia;
  if (local) return Number(local[3]) === anio && Number(local[2]) === mes && Number(local[1]) === dia;
  return false;
}
const hechasHoy = previas.filter((p) => valida(p) && esDeHoy(p.fecha)).length;
const cupo = postulando && !errorPostulaciones
  ? Math.max(0, Math.min(pxm.max_por_corrida, pxm.max_por_dia - hechasHoy))
  : 0;
// El mínimo propio nunca queda por debajo del umbral del resumen.
const minimo = Math.max(pxm.puntaje_minimo || 0, cfg.umbral);

const una = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const postulaciones = [];
// Por qué no se postuló a cada aviso: va al informe cuando la corrida no postula a nada.
const motivos = {};
const anotar = (motivo) => { motivos[motivo] = (motivos[motivo] || 0) + 1; };
for (const a of [...nuevos].sort((x, y) => y.puntaje - x.puntaje)) {
  const para = mailDeContacto(a.mail_contacto);
  const archivo = pxm.archivos_cv?.[a.cv_sugerido];
  if (a.alerta_estafa) { anotar('posible estafa'); continue; }
  if (a.cv_sugerido === 'ninguno') { anotar('no encaja'); continue; }
  if (!para) { anotar('sin mail de contacto (se postula desde el portal)'); continue; }
  if (a.puntaje < minimo) { anotar(`puntaje menor a ${minimo}`); continue; }
  if (!archivo) { anotar('sin CV configurado para ese tipo'); continue; }
  if (yaEscritas.has(`${para}|${a.clave}`)) { anotar('ya se le escribió antes'); continue; }
  if (postulaciones.length >= cupo) { anotar('sin cupo en esta corrida o en el día'); continue; }
  yaEscritas.add(`${para}|${a.clave}`);

  const titulo = una(a.titulo) || 'el puesto publicado';
  const empresa = una(a.empresa);
  postulaciones.push({
    modo: pxm.modo,
    clave: a.clave,
    titulo: a.titulo,
    empresa: a.empresa,
    para,
    cv: nombresCv[a.cv_sugerido] || a.cv_sugerido,
    ruta_cv: `${pxm.carpeta_cv}/${archivo}`,
    asunto: `Postulación: ${titulo}`,
    texto: [
      'Buenos días:',
      `Les escribo por el aviso de ${titulo}${empresa ? ` en ${empresa}` : ''}. Les adjunto mi CV.`,
      pxm.frases_cv?.[a.cv_sugerido],
      pxm.cierre,
      `Saludos cordiales,\n${pxm.firma}`,
    ].filter(Boolean).join('\n\n'),
  });
}
const clavePostulados = new Set(postulaciones.map((p) => p.clave));
const marcaPostulado = pxm.modo === 'automatico' ? 'sí (por mail)' : 'borrador (por mail)';

function estado(a) {
  if (a.alerta_estafa) return 'descartado: posible estafa';
  if (a.cv_sugerido === 'ninguno') return 'descartado: no encaja';
  if (a.puntaje < cfg.umbral) return 'descartado: bajo el umbral';
  return claveElegidos.has(a.clave) ? 'en el resumen' : 'fuera del resumen: tope por corrida';
}

const filas = nuevos.map((a) => ({
  fecha: ahora,
  clave: a.clave,
  titulo: a.titulo,
  empresa: a.empresa,
  localidad: a.localidad,
  portal: a.portal,
  link: a.link,
  cv_sugerido: a.cv_sugerido,
  puntaje: a.puntaje,
  motivo: a.motivo,
  faltantes: a.faltantes,
  motivo_estafa: a.motivo_estafa,
  estado: estado(a),
  postulado: clavePostulados.has(a.clave) ? marcaPostulado : '',
}));

// Mails de alertas leídos sin error. La búsqueda web no se anota: se repite en cada corrida.
const conError = new Set(errores.map((e) => e.mail_id));
const mailsLeidos = pedidos
  .filter((p) => p.origen === 'gmail' && !conError.has(p.mail_id))
  .map((p) => ({ fecha: ahora, mail_id: p.mail_id, asunto: p.asunto }));

// Mail para la persona.
const bloques = elegidos.map((a, n) => {
  const link = /^https?:\/\//i.test(a.link)
    ? `<a href="${escapar(a.link)}">Ver el aviso y postularme</a>`
    : '<i>No vino el link: buscalo por el título en el sitio.</i>';
  const lugar = [a.empresa, a.localidad].filter(Boolean).map(escapar).join(', ');
  return `
<p style="margin:0 0 18px">
  <b>${n + 1}. ${escapar(a.titulo)}</b>${lugar ? ` · ${lugar}` : ''}<br>
  Coincide ${a.puntaje} de 100 · Usá el <b>${escapar(nombresCv[a.cv_sugerido] || a.cv_sugerido)}</b> · ${escapar(a.portal)}<br>
  ${escapar(a.motivo)}<br>
  ${a.faltantes ? `<span style="color:#9a5b00">Ojo: ${escapar(a.faltantes)}</span><br>` : ''}
  ${link}
</p>`;
}).join('');

// Si está prendido y no salió ninguna, se dice por qué, en el mail y en la salida de este nodo.
const detalle = Object.entries(motivos).map(([motivo, n]) => `${n} ${motivo}`).join(', ');
let informePostulaciones = '';
if (postulando && !errorPostulaciones && !postulaciones.length) {
  if (!nuevos.length) informePostulaciones = 'ninguna, porque no hubo avisos nuevos.';
  else if (cupo === 0) informePostulaciones = `ninguna, porque ya se llegó al tope de ${pxm.max_por_dia} por día.`;
  else informePostulaciones = `ninguna en esta corrida. De ${cuantos(nuevos.length, 'aviso nuevo', 'avisos nuevos')}: ${detalle}.`;
}

const quedaron = aptos.length - elegidos.length;
const estafas = nuevos.filter((a) => a.alerta_estafa).length;
const notas = [
  quedaron > 0 ? `${quedaron === 1 ? 'Hubo 1 aviso más que también encaja; queda anotado' : `Hubo ${quedaron} avisos más que también encajan; quedan anotados`} en la planilla.` : '',
  estafas > 0 ? `${estafas === 1 ? 'Se descartó 1 aviso' : `Se descartaron ${estafas} avisos`} con señales de estafa.` : '',
  totalErrores > 0 ? `Nota técnica: ${totalErrores === 1 ? 'no se pudo leer 1 fuente; se reintenta' : `no se pudieron leer ${totalErrores} fuentes; se reintentan`} en la próxima corrida.` : '',
  errorPostulaciones ? 'Nota técnica: no se pudo leer la pestaña Postulaciones, así que en esta corrida no se postuló por mail.' : '',
  informePostulaciones ? `Postulación por mail: ${informePostulaciones}` : '',
].filter(Boolean);

const saludo = `Hola ${escapar(cfg.nombre)}!`;
const htmlAvisos = elegidos.length
  ? `<p>${saludo} Encontramos ${cuantos(elegidos.length, 'aviso nuevo', 'avisos nuevos')} para vos:</p>${bloques}`
  : `<p>${saludo} Por ahora no aparecieron avisos nuevos que encajen con lo que buscás.</p>`;
const htmlNotas = notas.length ? `<p style="color:#666;font-size:13px">${notas.join('<br>')}</p>` : '';

// "Completar resumen" agrega entre los dos el bloque de postulaciones, con el resultado de cada envío.
return [{
  json: {
    enviar: elegidos.length > 0 || totalErrores > 0 || errorPostulaciones || postulaciones.length > 0 || cfg.avisar_si_no_hay,
    para: cfg.mail_resumen,
    asunto: elegidos.length
      ? `${cuantos(elegidos.length, 'aviso nuevo', 'avisos nuevos')} de trabajo`
      : 'Sin avisos nuevos',
    html: htmlAvisos + htmlNotas,
    html_avisos: htmlAvisos,
    html_notas: htmlNotas,
    filas,
    mails_leidos: mailsLeidos,
    postulaciones,
    informe_postulaciones: informePostulaciones,
  },
}];
