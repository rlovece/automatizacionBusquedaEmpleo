# perfil/cv/

Acá van los CV en PDF. La carpeta se monta de sólo lectura en el contenedor de n8n (`/files/cv`) y el flujo los adjunta cuando postula por mail (fase 2). No viajan a Gemini y no se suben a ningún repo.

Los nombres de archivo tienen que coincidir con `archivos_cv` en `perfil/configuracion_persona.js`. Con la persona de ejemplo serían:

| Archivo | CV |
|---|---|
| `CV_Tecnico.pdf` | CV Técnico |
| `CV_Mantenimiento.pdf` | CV Mantenimiento |
| `CV_Atencion.pdf` | CV Atención |
| `CV_Deposito.pdf` | CV Depósito y logística |

Si la fase 2 está en `apagado`, la carpeta puede quedar vacía.
