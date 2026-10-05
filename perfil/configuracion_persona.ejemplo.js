// Plantilla de los datos de la persona. Copiar como perfil/configuracion_persona.js y completar.
// configuracion_persona.js no va a ningún repo; este archivo sí, porque es un ejemplo inventado.
// herramientas/armar_workflow.mjs toma el bloque "Persona" de ese archivo y lo pone en la Configuración.
//
// Lo que está en PERFIL, CVS y LOCALIDAD viaja a la API de Gemini: ahí no va el nombre, el mail,
// el teléfono ni el DNI. Lo que está en PERSONA se usa sólo en n8n.

// ─── Persona: desde acá ───────────────────────────────────────────────────────
// Ejemplo inventado. Los datos reales van en perfil/configuracion_persona.js, con este mismo formato.
const PERFIL = `
Vive en: Morón.
Hasta dónde puede viajar: Morón y alrededores, en transporte público.
Movilidad propia y carnet: no tiene auto ni carnet; viaja en colectivo y en tren.
Estudios: secundario técnico completo, con orientación en informática.
Certificaciones: un curso de redes.
Situación actual: trabaja medio tiempo en un local de computación.
Experiencia:
- Local de computación, 6 años: armado y reparación de PC y notebooks, instalación de redes hogareñas, atención al público y manejo de caja.
- Depósito de una distribuidora: preparación de pedidos y control de stock.
- Mantenimiento de los equipos de una escuela.
Habilidades: reparación de PC y notebooks, redes, diagnóstico de fallas, atención al público, caja, control de stock.
Disponibilidad horaria: flexible. Le sirve tiempo completo o medio tiempo, según el sueldo y el horario.
Busca: empleo en relación de dependencia, mejor con obra social. Primero en soporte técnico o reparación de PC; también en mantenimiento, atención al público o depósito.
Evitar: venta puerta a puerta.
`.trim();

// Cada CV tiene un id corto (el modelo devuelve ese id) y los puestos a los que apunta.
const CVS = [
  {
    id: 'tecnico',
    nombre: 'CV Técnico',
    apunta_a: 'soporte técnico, reparación de PC y notebooks, redes, ayudante de técnico',
  },
  {
    id: 'mantenimiento',
    nombre: 'CV Mantenimiento',
    apunta_a: 'mantenimiento de equipos e instalaciones; encargado de mantenimiento',
  },
  {
    id: 'atencion',
    nombre: 'CV Atención',
    apunta_a: 'atención al público, mostrador, vendedor en casas de computación o electrónica, cajero',
  },
  {
    id: 'operario',
    nombre: 'CV Depósito y logística',
    apunta_a: 'depósito, preparación de pedidos, control de stock, logística',
  },
];

// Dónde se busca en la web.
const LOCALIDAD = {
  ciudad: 'Morón',
  provincia: 'Buenos Aires',
  alrededores: 'Haedo, Castelar',
};

// Páginas que se revisan en cada búsqueda web, además de lo que aparezca buscando (hasta 20).
// Los portales grandes pueden bloquear la lectura automática: si nunca traen nada, sacarlos.
const PAGINAS = [
  'https://ejemplo.gob.ar/empleo',
];

// Lo que se usa sólo en n8n y nunca viaja a Gemini.
const PERSONA = {
  // Quien recibe los avisos y cómo se lo saluda.
  nombre: 'Juan',
  mail_resumen: 'juan.perez@gmail.com',

  // Datos de la persona que pueden aparecer en los mails de alerta ("Hola Juan Pérez", su mail).
  // Se reemplazan por [dato oculto] antes de mandar el mail a Gemini. El nombre de pila solo
  // no se tapa: no identifica a nadie y taparlo rompería direcciones como "San Juan".
  datos_a_ocultar: ['Juan Pérez', 'Juan Perez', 'juan.perez', '11 5555-1234', '1155551234'],

  // Fase 2: el PDF de cada CV, en la carpeta montada en el contenedor, y el texto del mensaje.
  archivos_cv: {
    tecnico: 'CV_Tecnico.pdf',
    mantenimiento: 'CV_Mantenimiento.pdf',
    atencion: 'CV_Atencion.pdf',
    operario: 'CV_Deposito.pdf',
  },
  // La frase del medio del mensaje, según el CV que se adjunta.
  frases_cv: {
    tecnico: 'Tengo 6 años de experiencia en reparación de PC y notebooks y en redes, con diagnóstico de fallas y atención al público.',
    mantenimiento: 'Tengo experiencia en mantenimiento de equipos y en instalación de redes.',
    atencion: 'Tengo 6 años de experiencia en atención al público y caja.',
    operario: 'Tengo experiencia en depósito, preparación de pedidos y control de stock.',
  },
  cierre: 'Vivo en Morón. Quedo a disposición para una entrevista.',
  firma: 'Juan Pérez\n11 5555-1234',
};
// ─── Persona: hasta acá ───────────────────────────────────────────────────────
