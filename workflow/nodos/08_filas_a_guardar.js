// Un ítem por aviso nuevo, para agregarlo a la hoja.
// Si una postulación por mail falló, el aviso no queda marcado como postulado.
let fallidas = new Set();
try {
  fallidas = new Set($('Resultado de postulaciones').all().map((i) => i.json)
    .filter((r) => String(r.resultado).startsWith('error')).map((r) => r.clave));
} catch (e) {
  // No hubo postulaciones en esta corrida.
}
return $input.first().json.filas.map((fila) => ({
  json: fallidas.has(fila.clave) ? { ...fila, postulado: '' } : fila,
}));
