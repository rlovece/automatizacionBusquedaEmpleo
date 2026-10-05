// Un ítem por mail de alertas leído sin error, para no volver a procesarlo.
return $input.first().json.mails_leidos.map((fila) => ({ json: fila }));
