// Configuración de la búsqueda. Es lo único que hay que tocar para adaptar
// el flujo a otra persona: perfil, CV, localidad, páginas, umbral y a quién le llega el resumen.
//
// Los datos de la persona no están acá: viven en perfil/configuracion_persona.js, que no va a
// ningún repo. Al armar el workflow, herramientas/armar_workflow.mjs reemplaza el bloque
// "Persona" de este archivo por ese. Lo que queda acá es un ejemplo inventado, que usan las pruebas.
//
// Todo lo que está en PERFIL, CVS y LOCALIDAD viaja a la API de Gemini. En el nivel gratuito,
// Google puede usar ese contenido y leerlo una persona (ver "Datos personales" en el README):
// ahí no va el nombre, el mail, el teléfono ni el DNI.

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

const INSTRUCCIONES_BUSQUEDA = `
Buscás avisos de empleo vigentes para una persona. Te paso su perfil, los puestos a los que apunta,
la zona y una lista de páginas para revisar.

1. Revisá cada página de la lista, con una búsqueda por página como mucho.
2. La mayor parte de las búsquedas, fuera de los portales de empleo (Computrabajo, Bumeran, ZonaJobs, Indeed, LinkedIn):
   sus avisos ya le llegan a la persona por mail. Buscá donde publican las empresas y comercios de la zona:
   clasificados de diarios locales, bolsas de trabajo de cámaras, sindicatos, universidades y municipios,
   la sección "trabajá con nosotros" de empresas de la zona y avisos que piden mandar el CV por mail.
   Combiná los puestos con frases como "enviar CV", "se busca", "busco" o "se necesita" y el nombre de la ciudad.
3. Quedate sólo con avisos publicados en los últimos DIAS días. Si un aviso no muestra la fecha, incluilo y aclaralo.
4. No inventes avisos ni links: anotá sólo lo que viste en las páginas o en los resultados de búsqueda.

Respondé con una lista en texto. Por cada aviso: título, empresa, localidad, fecha de publicación si figura,
tareas y requisitos en una línea, el mail al que pide mandar el CV si figura (copiado tal cual),
y el link exacto al aviso entre corchetes, así: [https://…].
Si no encontrás ninguno, respondé "Sin avisos".
`.trim();

const INSTRUCCIONES = `
Ayudás a una persona a buscar trabajo. Te paso una fuente de avisos (un mail de alertas de un portal
como Computrabajo, Bumeran, ZonaJobs o Indeed, o un listado armado con una búsqueda web),
el perfil de la persona y los CV que tiene armados.

1. Encontrá cada aviso de empleo que aparezca en la fuente. Ignorá publicidad, cursos, notas y el pie del mail.
2. De cada aviso copiá el título, la empresa, la localidad y el link al aviso tal como aparece
   entre corchetes. No inventes datos: si algo no figura, dejalo vacío.
3. "resumen": en una línea, qué tareas son y qué piden.
4. "cv_sugerido": el id del CV que conviene usar, o "ninguno" si el aviso no tiene que ver con el perfil.
5. "puntaje" de 0 a 100 según qué tan bien encaja:
   - las tareas coinciden con su experiencia y habilidades;
   - un requisito excluyente que no cumple (título, carnet, años de experiencia) baja mucho el puntaje;
   - la zona tiene que quedar dentro de lo que puede viajar;
   - lo que el perfil dice que hay que evitar baja el puntaje a menos de 30;
   - si el aviso publica un sueldo claramente por debajo del objetivo del perfil (en proporción, si es medio tiempo),
     baja el puntaje y lo anotás en "faltantes". Si no publica sueldo, no lo penalices;
   - relación de dependencia y obra social suman; que pida monotributo resta un poco.
6. "motivo": una frase corta, en lenguaje simple y hablándole de vos a la persona, que explique por qué le conviene o no.
7. "faltantes": requisitos del aviso que no cumple o que no se sabe si cumple. Vacío si no hay.
8. "alerta_estafa": true si el aviso tiene señales de estafa: pide pagar algo (curso, kit, inscripción,
   uniforme), promete ganancias altas sin experiencia, es multinivel o paga por reclutar gente,
   da sólo un WhatsApp o Telegram sin empresa identificable, o pide DNI o datos bancarios antes de una entrevista.
   "motivo_estafa" explica cuál señal viste; vacío si no hay alerta.
9. "mail_contacto": si el aviso pide mandar el CV a una dirección de mail, copiala tal como aparece.
   Si no hay, dejalo vacío. No la inventes ni la deduzcas del nombre de la empresa o de su sitio.

Si la fuente no tiene avisos, devolvé la lista vacía.
`.trim();

return [{
  json: {
    // Quien recibe los avisos, cómo se lo saluda y qué se tapa antes de mandar a Gemini.
    nombre: PERSONA.nombre,
    mail_resumen: PERSONA.mail_resumen,
    datos_a_ocultar: PERSONA.datos_a_ocultar,

    // Etiqueta de Gmail donde un filtro deja las alertas de los portales.
    etiqueta_gmail: 'alertas-empleo',

    // Modelo que lee y puntúa. Cualquier modelo de Gemini con salida estructurada sirve.
    modelo: 'gemini-3.5-flash',
    razonamiento: 'low',

    // Búsqueda web con Google Search y lectura de páginas (URL context).
    // Las horas tienen que coincidir con las del disparador: 7, 10, 13, 16, 19 y 22.
    // gemini-2.5-flash ya no está disponible para cuentas nuevas (la API responde 404 y sugiere
    // gemini-3.8-flash, 28/09/2026). Confirmar en AI Studio cuánto cuesta la búsqueda en Google con este modelo.
    busqueda_web: {
      horas: [7, 16],
      modelo: 'gemini-3.8-flash',
      razonamiento: 'low',
      dias: 7,
      localidad: LOCALIDAD,
      paginas: PAGINAS,
      instrucciones: INSTRUCCIONES_BUSQUEDA,
    },

    // Puntaje mínimo para que un aviso entre al mail, y cuántos como máximo por corrida.
    umbral: 60,
    max_avisos: 8,

    // Si es true, también llega un mail cuando no hay avisos nuevos (sirve para saber que anda).
    avisar_si_no_hay: false,

    // Fase 2: postular por mail a los avisos que piden mandar el CV a una dirección.
    // Nada de este bloque viaja a Gemini: el mensaje se arma acá, con una plantilla fija.
    postular_por_mail: {
      // 'apagado': el flujo no postula.
      // 'borrador': deja el mail con el CV adjunto en Borradores de su Gmail; la persona lo revisa y lo envía.
      // 'automatico': lo manda solo, con copia oculta a mail_resumen. No se puede deshacer.
      modo: 'apagado',
      // Más alto que umbral: sólo se postula a lo que encaja bien.
      puntaje_minimo: 75,
      max_por_corrida: 3,
      max_por_dia: 5,
      // Carpeta montada en el contenedor (docker-compose.yml) y el PDF de cada CV.
      carpeta_cv: '/files/cv',
      archivos_cv: PERSONA.archivos_cv,
      frases_cv: PERSONA.frases_cv,
      cierre: PERSONA.cierre,
      firma: PERSONA.firma,
    },

    perfil: PERFIL,
    cvs: CVS,
    instrucciones: INSTRUCCIONES,
  },
}];
