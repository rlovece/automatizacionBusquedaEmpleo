// Junta las fuentes de esta corrida: los mails de alertas que todavía no se leyeron
// y, si hubo búsqueda web, su listado como una fuente más.

const cfg = $('Configuración').first().json;
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

// Texto de una respuesta de la Interactions API: los bloques de texto de los pasos "model_output".
function textoDe(r) {
  const pasos = Array.isArray(r.steps) ? r.steps.filter((p) => p.type === 'model_output') : [];
  const texto = pasos
    .flatMap((p) => (Array.isArray(p.content) ? p.content : []))
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  return (texto || r.output_text || '').trim();
}

function mensajeDeError(error) {
  return typeof error === 'string' ? error : (error.message || JSON.stringify(error));
}

const yaLeidos = new Set($input.all().map((i) => String(i.json.mail_id || '')).filter(Boolean));
const fuentes = $('Buscar alertas en Gmail').all()
  .map((i) => i.json)
  .filter((mail) => mail.id && !yaLeidos.has(mail.id))
  .map((mail) => ({ json: { origen: 'gmail', ...mail } }));

// Si en esta corrida no tocó buscar en la web, el nodo no se ejecutó y no hay respuesta.
let respuesta = null;
try {
  respuesta = $('Gemini: buscar en la web').first().json;
} catch (e) {
  respuesta = null;
}

if (respuesta) {
  const texto = textoDe(respuesta);
  let error = '';
  if (respuesta.error) error = `La API respondió con error: ${mensajeDeError(respuesta.error)}`;
  else if (!texto) error = 'La búsqueda web no devolvió texto.';

  if (error) {
    fuentes.push({ json: { origen: 'web_error', detalle: error } });
  } else if (!/^sin avisos\.?$/i.test(texto)) {
    // status "incomplete" quiere decir que la respuesta quedó cortada: se usa lo que llegó.
    fuentes.push({
      json: {
        origen: 'web',
        id: `web-${ahora}`,
        subject: `Búsqueda web en ${cfg.busqueda_web.localidad.ciudad}`,
        from: { text: 'búsqueda web' },
        text: texto,
      },
    });
  }
}

return fuentes;
