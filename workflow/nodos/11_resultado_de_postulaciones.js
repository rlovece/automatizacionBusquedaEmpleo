// Una fila por postulación para la pestaña "Postulaciones", con lo que respondió Gmail.
// Los nodos de Gmail y de lectura del CV siguen ante un error, así que acá llega un ítem por postulación, en orden.

const postulaciones = $('Postulaciones a mandar').all().map((i) => i.json);
const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

function mensajeDeError(error) {
  return typeof error === 'string' ? error : (error.message || JSON.stringify(error));
}

return $input.all().map((item, i) => {
  const p = postulaciones[i] || {};
  const r = item.json;
  let resultado = p.modo === 'automatico' ? 'enviado' : 'borrador creado';
  if (r.error) resultado = `error: ${mensajeDeError(r.error)}`;
  else if (!r.id) resultado = 'error: Gmail no devolvió el id del mensaje';
  return {
    json: {
      fecha: ahora,
      clave: p.clave,
      titulo: p.titulo,
      empresa: p.empresa,
      mail_destino: p.para,
      cv: p.cv,
      resultado,
    },
  };
});
