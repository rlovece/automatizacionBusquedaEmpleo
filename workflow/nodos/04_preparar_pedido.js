// Arma un pedido a Gemini (Interactions API) por cada fuente: un mail de alertas o el listado de la búsqueda web.
// El HTML del mail se pasa a texto dejando los links entre corchetes,
// para que el modelo pueda devolver el link de cada aviso. Los datos de la persona se tapan antes de mandarlo.

const cfg = $('Configuración').first().json;

function decodificar(texto) {
  return texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlATexto(html) {
  const texto = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, contenido) => {
      const etiqueta = contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return ` ${etiqueta} [${href}] `;
    })
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodificar(texto)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// Reemplaza cada dato de la persona (sin distinguir mayúsculas) por [dato oculto].
const aOcultar = [...cfg.datos_a_ocultar, cfg.mail_resumen]
  .map((dato) => String(dato || '').trim())
  .filter((dato) => dato.length >= 3)
  .map((dato) => new RegExp(dato.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
const ocultar = (texto) => aOcultar.reduce((t, patron) => t.replace(patron, '[dato oculto]'), texto);

const idsCv = cfg.cvs.map((cv) => cv.id);
const listaCvs = cfg.cvs.map((cv) => `- id "${cv.id}": ${cv.nombre}. Sirve para: ${cv.apunta_a}`).join('\n');

const esquema = {
  type: 'object',
  properties: {
    avisos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          empresa: { type: 'string' },
          localidad: { type: 'string' },
          link: { type: 'string' },
          resumen: { type: 'string' },
          cv_sugerido: { type: 'string', enum: [...idsCv, 'ninguno'] },
          puntaje: { type: 'integer' },
          motivo: { type: 'string' },
          faltantes: { type: 'string' },
          alerta_estafa: { type: 'boolean' },
          motivo_estafa: { type: 'string' },
          mail_contacto: { type: 'string' },
        },
        required: ['titulo', 'empresa', 'localidad', 'link', 'resumen', 'cv_sugerido', 'puntaje',
          'motivo', 'faltantes', 'alerta_estafa', 'motivo_estafa', 'mail_contacto'],
      },
    },
  },
  required: ['avisos'],
};

// Los errores de la búsqueda web no se mandan a Gemini: los anota el nodo "Filtrar y armar resumen".
const pedidos = $input.all().filter((item) => item.json.origen !== 'web_error').map((item) => {
  const mail = item.json;
  const remitente = mail.from?.value?.[0]?.address || mail.from?.text || '';
  const cuerpo = ocultar(mail.html ? htmlATexto(mail.html) : (mail.text || ''));
  const asunto = ocultar(mail.subject || '');

  const body = {
    model: cfg.modelo,
    input: `${cfg.instrucciones}\n\n`
      + `PERFIL DE LA PERSONA\n${cfg.perfil}\n\nCV DISPONIBLES\n${listaCvs}\n\n`
      + `FUENTE\nDe: ${remitente}\nAsunto: ${asunto}\n\n${cuerpo}`,
    response_format: { type: 'text', mime_type: 'application/json', schema: esquema },
  };
  if (cfg.razonamiento) body.generation_config = { thinking_level: cfg.razonamiento };

  return {
    json: {
      origen: mail.origen,
      mail_id: mail.id,
      remitente,
      asunto,
      body,
    },
  };
});

// Sin nada para mandar, sale un ítem de aviso: "¿Hay algo para Gemini?" saltea la llamada
// y el resumen igual avisa si la búsqueda web falló.
return pedidos.length ? pedidos : [{ json: { sin_pedidos: true } }];
