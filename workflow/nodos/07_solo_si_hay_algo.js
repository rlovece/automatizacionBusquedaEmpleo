// Corta la rama del mail si no hay nada que avisar.
return $input.first().json.enviar ? $input.all() : [];
