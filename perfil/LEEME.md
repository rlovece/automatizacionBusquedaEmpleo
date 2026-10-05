# perfil/

Acá van los datos de la persona. Son datos de un tercero: no se suben a ningún repo. El `.gitignore` deja afuera todo menos las plantillas y los LEEME.

| Archivo | Qué es | ¿Va al repo? |
|---|---|---|
| `configuracion_persona.ejemplo.js` | La plantilla, con una persona inventada | Sí |
| `configuracion_persona.js` | La copia completada: perfil, CV, localidad, páginas, mail, datos a ocultar y firma. `herramientas/armar_workflow.mjs` la pone en lugar del ejemplo de `workflow/nodos/01_configuracion.js` | No |
| `cv/` | Los CV en PDF que se adjuntan al postular por mail (ver `cv/LEEME.md`) | Sólo el LEEME |

Para empezar:

```
cp perfil/configuracion_persona.ejemplo.js perfil/configuracion_persona.js
```

Sin `configuracion_persona.js`, el workflow se arma con la persona de ejemplo.
