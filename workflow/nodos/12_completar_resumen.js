// Agrega al mail de la persona a qué avisos se postuló por mail y a qué dirección, así sabe qué salió a su nombre.
// La rama de postulaciones corre antes que esta (está más arriba en el lienzo). Si por algo no corrió,
// se listan las postulaciones que se iban a armar y se remite a la pestaña "Postulaciones".

const resumen = $input.first().json;
const cfg = $('Configuración').first().json;
const automatico = cfg.postular_por_mail?.modo === 'automatico';

function escapar(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let resultados = null;
try {
  resultados = $('Resultado de postulaciones').all().map((i) => i.json);
} catch (e) {
  resultados = null;
}

const planeadas = resumen.postulaciones || [];
if (!planeadas.length) return [{ json: resumen }];

const renglon = (p) => `<li>${escapar(p.titulo)}${p.empresa ? ` · ${escapar(p.empresa)}` : ''}`
  + ` → ${escapar(p.mail_destino || p.para)} (${escapar(p.cv)})</li>`;

let bloque;
if (!resultados) {
  bloque = `<p><b>Se armaron ${planeadas.length === 1 ? '1 postulación' : `${planeadas.length} postulaciones`} por mail.</b>`
    + ' Revisá en la pestaña Postulaciones cómo salieron.</p>'
    + `<ul>${planeadas.map(renglon).join('')}</ul>`;
} else {
  const bien = resultados.filter((r) => !String(r.resultado).startsWith('error'));
  const mal = resultados.filter((r) => String(r.resultado).startsWith('error'));
  const partes = [];
  if (bien.length && automatico) {
    partes.push(`<p><b>Te postulamos por mail a ${bien.length === 1 ? '1 aviso' : `${bien.length} avisos`}</b>,`
      + ` a tu nombre y con el CV adjunto. Te llegó una copia a tu casilla:</p><ul>${bien.map(renglon).join('')}</ul>`);
  } else if (bien.length) {
    partes.push(`<p><b>Te dejamos ${bien.length === 1 ? 'listo 1 mail' : `listos ${bien.length} mails`} para postularte</b>,`
      + ' con el CV adjunto, en Borradores de tu Gmail. Revisalos y apretá Enviar:</p>'
      + `<ul>${bien.map(renglon).join('')}</ul>`);
  }
  if (mal.length) {
    partes.push(`<p style="color:#9a5b00">No se ${mal.length === 1 ? 'pudo armar esta postulación' : 'pudieron armar estas postulaciones'};`
      + ` si te interesa${mal.length === 1 ? '' : 'n'}, mandá el CV a mano:</p><ul>${mal.map(renglon).join('')}</ul>`);
  }
  bloque = partes.join('');
}

return [{ json: { ...resumen, html: resumen.html_avisos + bloque + resumen.html_notas } }];
