// Convierte cada respuesta de Gemini en un ítem por aviso.
// Las fuentes que fallaron salen como ítems de tipo "error" para avisarlas en el resumen.
// Un mail que falla no se anota como leído, así que se vuelve a procesar en la corrida siguiente.

const pedidos = $('Preparar pedido a Gemini').all();
const salida = [];

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

$input.all().forEach((item, i) => {
  const r = item.json;
  const pedido = pedidos[i]?.json || {};
  const origen = { mail_id: pedido.mail_id || '', remitente: pedido.remitente || '', asunto: pedido.asunto || '' };

  const fallo = (detalle) => salida.push({ json: { _tipo: 'error', ...origen, detalle } });

  if (r.error) return fallo(`La API respondió con error: ${mensajeDeError(r.error)}`);
  if (r.status === 'incomplete') return fallo('La respuesta quedó cortada: la fuente tenía demasiados avisos.');

  const texto = textoDe(r);
  if (!texto) return fallo('La respuesta de la API no tiene texto.');
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    return fallo('La respuesta no es un JSON válido.');
  }

  for (const aviso of datos.avisos || []) {
    salida.push({ json: { _tipo: 'aviso', ...origen, ...aviso } });
  }
});

return salida.length ? salida : [{ json: { _tipo: 'vacio' } }];
