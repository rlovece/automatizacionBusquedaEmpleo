// Un ítem por postulación por mail que toca en esta corrida. Sin postulaciones, la rama se corta acá.
return $input.first().json.postulaciones.map((p) => ({ json: p }));
