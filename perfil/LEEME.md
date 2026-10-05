# perfil/

Acá van los datos de la persona. Son datos de un tercero: no se suben a ningún repo. El `.gitignore` deja afuera todo menos este archivo.

| Archivo | Qué es |
|---|---|
| `configuracion_persona.js` | El bloque "Persona" de la Configuración: perfil, CV, localidad, páginas, mail, datos a ocultar y firma. `herramientas/armar_workflow.mjs` lo pone en lugar del ejemplo de `workflow/nodos/01_configuracion.js` |
| `preguntas_pendientes.md` | Notas propias: lo que falta definir y lo que ya se decidió |
| `cv/` | Los CV en Word y PDF, y los scripts que los arman |

En una copia nueva del repo, esta carpeta llega vacía: hay que traer los archivos a mano. Sin `configuracion_persona.js`, el workflow se arma con la persona de ejemplo.
