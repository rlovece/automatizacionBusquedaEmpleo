// Decide si en esta corrida toca buscar en la web y arma el pedido a Gemini (Interactions API)
// con búsqueda en Google (google_search) y lectura de páginas (url_context).

const cfg = $('Configuración').first().json;
const web = cfg.busqueda_web;

const hora = Number(new Date().toLocaleString('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hourCycle: 'h23',
}));
const { ciudad, provincia, alrededores } = web.localidad;

const puestos = cfg.cvs.map((cv) => `- ${cv.apunta_a}`).join('\n');
// URL context lee hasta 20 URLs por pedido.
const paginas = web.paginas.length
  ? web.paginas.slice(0, 20).map((url) => `- ${url}`).join('\n')
  : '(no hay páginas fijas: sólo búsqueda)';

const body = {
  model: web.modelo,
  input: `${web.instrucciones.replace('DIAS', String(web.dias))}\n\n`
    + `PERFIL DE LA PERSONA\n${cfg.perfil}\n\n`
    + `PUESTOS QUE BUSCA\n${puestos}\n\n`
    + `ZONA\n${ciudad}, ${provincia}, Argentina. También sirven: ${alrededores}.\n\n`
    + `PÁGINAS PARA REVISAR\n${paginas}`,
  tools: [{ type: 'google_search' }, { type: 'url_context' }],
};
if (web.razonamiento) body.generation_config = { thinking_level: web.razonamiento };

return [{ json: { buscar: web.horas.includes(hora), hora, body } }];
