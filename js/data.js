// Datos fijos de la app: grupos musculares, tipos de peso y ejercicios iniciales.

export const GROUPS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps',
  'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Abdominales',
];

// Cardio no es un grupo muscular: no cuenta en las series por grupo ni en los récords de fuerza.
// Sus series se anotan como minutos (r) y km (w, opcional).
export const CARDIO = 'Cardio';
export const EXERCISE_GROUPS = [...GROUPS, CARDIO];

// factor: multiplicador del peso anotado al calcular volumen.
// bodyweight: no suma volumen (solo series/reps).
export const WEIGHT_TYPES = {
  barra:     { label: 'Barra (peso total)',        short: 'kg total', factor: 1 },
  mancuerna: { label: 'Mancuerna (peso de una)',   short: 'kg c/u',   factor: 2 },
  maquina:   { label: 'Máquina / polea',           short: 'kg',       factor: 1 },
  corporal:  { label: 'Sin peso (solo reps)',      short: 'kg extra', factor: 1, bodyweight: true },
  cardio:    { label: 'Cardio (minutos y km)',     short: 'km',       factor: 0, cardio: true },
};

// Fuerza, zona media (Abdominales) o cardio, según el grupo principal.
export function exerciseCategory(ex) {
  if (ex?.primary === CARDIO) return 'cardio';
  if (ex?.primary === 'Abdominales') return 'core';
  return 'fuerza';
}

export const CATEGORIES = { fuerza: 'Fuerza', core: 'Zona media', cardio: 'Cardio' };

// Catálogo de ejercicios: vive en el código, no en la base de datos. Cada usuario ve estos más los suyos
// (los que crea, y los del catálogo que edita u oculta, ver mergeExercises).
// [id, nombre, tipo, principal, secundarios]. El id NO se cambia nunca (los entrenamientos y rutinas lo guardan);
// el nombre, el tipo y los grupos sí se pueden corregir. Para agregar uno, inventale un id nuevo con el prefijo base-.
const CATALOG_ROWS = [
  // Pecho
  ['base-press-banca-plano', 'Press banca plano', 'barra', 'Pecho', ['Tríceps', 'Hombros']],
  ['base-press-banca-inclinado', 'Press banca inclinado', 'barra', 'Pecho', ['Hombros', 'Tríceps']],
  ['base-press-banca-declinado', 'Press banca declinado', 'barra', 'Pecho', ['Tríceps']],
  ['base-press-plano-con-mancuernas', 'Press plano con mancuernas', 'mancuerna', 'Pecho', ['Tríceps', 'Hombros']],
  ['base-press-inclinado-con-mancuernas', 'Press inclinado con mancuernas', 'mancuerna', 'Pecho', ['Hombros', 'Tríceps']],
  ['base-aperturas-con-mancuernas', 'Aperturas con mancuernas', 'mancuerna', 'Pecho', []],
  ['base-cruce-de-poleas', 'Cruce de poleas', 'maquina', 'Pecho', []],
  ['base-pec-deck', 'Pec deck', 'maquina', 'Pecho', []],
  ['base-press-de-pecho-en-maquina', 'Press de pecho en máquina', 'maquina', 'Pecho', ['Tríceps', 'Hombros']],
  ['base-fondos-en-paralelas', 'Fondos en paralelas', 'corporal', 'Pecho', ['Tríceps', 'Hombros']],
  ['base-flexiones-de-brazos', 'Flexiones de brazos', 'corporal', 'Pecho', ['Tríceps', 'Hombros']],
  // Espalda
  ['base-dominadas', 'Dominadas', 'corporal', 'Espalda', ['Bíceps']],
  ['base-jalon-al-pecho', 'Jalón al pecho', 'maquina', 'Espalda', ['Bíceps']],
  ['base-jalon-agarre-cerrado', 'Jalón agarre cerrado', 'maquina', 'Espalda', ['Bíceps']],
  ['base-remo-con-barra', 'Remo con barra', 'barra', 'Espalda', ['Bíceps']],
  ['base-remo-con-mancuerna', 'Remo con mancuerna', 'mancuerna', 'Espalda', ['Bíceps']],
  ['base-remo-en-polea-baja', 'Remo en polea baja', 'maquina', 'Espalda', ['Bíceps']],
  ['base-remo-en-maquina', 'Remo en máquina', 'maquina', 'Espalda', ['Bíceps']],
  ['base-pullover-en-polea', 'Pullover en polea', 'maquina', 'Espalda', []],
  ['base-peso-muerto', 'Peso muerto', 'barra', 'Espalda', ['Isquiotibiales', 'Glúteos']],
  // Hombros
  ['base-press-militar-con-barra', 'Press militar con barra', 'barra', 'Hombros', ['Tríceps']],
  ['base-press-de-hombros-con-mancuernas', 'Press de hombros con mancuernas', 'mancuerna', 'Hombros', ['Tríceps']],
  ['base-press-de-hombros-en-maquina', 'Press de hombros en máquina', 'maquina', 'Hombros', ['Tríceps']],
  ['base-elevaciones-laterales', 'Elevaciones laterales', 'mancuerna', 'Hombros', []],
  ['base-elevaciones-laterales-en-polea', 'Elevaciones laterales en polea', 'maquina', 'Hombros', []],
  ['base-elevaciones-frontales', 'Elevaciones frontales', 'mancuerna', 'Hombros', []],
  ['base-pajaros-posterior', 'Pájaros (posterior)', 'mancuerna', 'Hombros', ['Espalda']],
  ['base-face-pull', 'Face pull', 'maquina', 'Hombros', ['Espalda']],
  ['base-remo-al-menton', 'Remo al mentón', 'barra', 'Hombros', ['Bíceps']],
  // Bíceps
  ['base-curl-con-barra', 'Curl con barra', 'barra', 'Bíceps', []],
  ['base-curl-con-mancuernas', 'Curl con mancuernas', 'mancuerna', 'Bíceps', []],
  ['base-curl-martillo', 'Curl martillo', 'mancuerna', 'Bíceps', []],
  ['base-curl-en-polea', 'Curl en polea', 'maquina', 'Bíceps', []],
  ['base-curl-predicador', 'Curl predicador', 'barra', 'Bíceps', []],
  ['base-curl-concentrado', 'Curl concentrado', 'mancuerna', 'Bíceps', []],
  // Tríceps
  ['base-extension-de-triceps-en-polea', 'Extensión de tríceps en polea', 'maquina', 'Tríceps', []],
  ['base-extension-de-triceps-con-soga', 'Extensión de tríceps con soga', 'maquina', 'Tríceps', []],
  ['base-press-frances', 'Press francés', 'barra', 'Tríceps', []],
  ['base-extension-de-triceps-sobre-la-cabeza', 'Extensión de tríceps sobre la cabeza', 'mancuerna', 'Tríceps', []],
  ['base-patada-de-triceps', 'Patada de tríceps', 'mancuerna', 'Tríceps', []],
  ['base-press-banca-agarre-cerrado', 'Press banca agarre cerrado', 'barra', 'Tríceps', ['Pecho']],
  // Cuádriceps
  ['base-sentadilla-con-barra', 'Sentadilla con barra', 'barra', 'Cuádriceps', ['Glúteos', 'Isquiotibiales']],
  ['base-prensa-de-piernas', 'Prensa de piernas', 'maquina', 'Cuádriceps', ['Glúteos']],
  ['base-sillon-de-cuadriceps', 'Sillón de cuádriceps', 'maquina', 'Cuádriceps', []],
  ['base-sentadilla-bulgara', 'Sentadilla búlgara', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  ['base-estocadas', 'Estocadas', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  ['base-sentadilla-hack', 'Sentadilla hack', 'maquina', 'Cuádriceps', ['Glúteos']],
  ['base-sentadilla-goblet', 'Sentadilla goblet', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  // Isquiotibiales
  ['base-peso-muerto-rumano', 'Peso muerto rumano', 'barra', 'Isquiotibiales', ['Glúteos', 'Espalda']],
  ['base-camilla-de-isquiotibiales', 'Camilla de isquiotibiales', 'maquina', 'Isquiotibiales', []],
  ['base-curl-femoral-sentado', 'Curl femoral sentado', 'maquina', 'Isquiotibiales', []],
  ['base-buenos-dias', 'Buenos días', 'barra', 'Isquiotibiales', ['Glúteos', 'Espalda']],
  // Glúteos
  ['base-hip-thrust', 'Hip thrust', 'barra', 'Glúteos', ['Isquiotibiales']],
  ['base-patada-de-gluteo-en-polea', 'Patada de glúteo en polea', 'maquina', 'Glúteos', []],
  ['base-abductores-en-maquina', 'Abductores en máquina', 'maquina', 'Glúteos', []],
  // Gemelos
  ['base-gemelos-de-pie', 'Gemelos de pie', 'maquina', 'Gemelos', []],
  ['base-gemelos-sentado', 'Gemelos sentado', 'maquina', 'Gemelos', []],
  ['base-gemelos-en-prensa', 'Gemelos en prensa', 'maquina', 'Gemelos', []],
  // Abdominales
  ['base-crunch-abdominal', 'Crunch abdominal', 'corporal', 'Abdominales', []],
  ['base-plancha', 'Plancha', 'corporal', 'Abdominales', []],
  ['base-elevacion-de-piernas', 'Elevación de piernas', 'corporal', 'Abdominales', []],
  ['base-crunch-en-polea', 'Crunch en polea', 'maquina', 'Abdominales', []],
  ['base-rueda-abdominal', 'Rueda abdominal', 'corporal', 'Abdominales', []],
  ['base-russian-twist', 'Russian twist', 'corporal', 'Abdominales', []],
  // Cardio
  ['base-cinta', 'Cinta', 'cardio', CARDIO, []],
  ['base-bicicleta-fija', 'Bicicleta fija', 'cardio', CARDIO, []],
  ['base-eliptico', 'Elíptico', 'cardio', CARDIO, []],
  ['base-remo-ergometro', 'Remo ergómetro', 'cardio', CARDIO, []],
  ['base-escaladora', 'Escaladora', 'cardio', CARDIO, []],
  ['base-soga', 'Soga', 'cardio', CARDIO, []],
];

export const CATALOG = CATALOG_ROWS.map(([id, name, type, primary, secondary]) => ({ id, name, type, primary, secondary }));

export const isCatalogId = (id) => String(id).startsWith('base-');

// Para comparar nombres sin mayúsculas ni tildes.
export function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Ejercicios que ve el usuario: el catálogo más sus documentos de Firestore.
// - Documento con el id de uno del catálogo: lo reemplaza (lo editó), o lo oculta si tiene hidden: true (lo borró).
// - Documento con otro id: un ejercicio propio.
// Antes la lista inicial se copiaba a cada usuario con ids al azar: si tiene uno propio con el mismo nombre
// que uno del catálogo, se muestra solo el suyo (sus entrenamientos apuntan a ese).
// Devuelve un Map id → ejercicio ordenado por nombre.
export function mergeExercises(docs) {
  const out = new Map(CATALOG.map((e) => [e.id, e]));
  const own = new Set();
  for (const d of docs) {
    if (d.hidden) out.delete(d.id);
    else out.set(d.id, d);
    if (!d.hidden && !isCatalogId(d.id)) own.add(normalize(d.name || ''));
  }
  for (const e of CATALOG) if (out.get(e.id) === e && own.has(normalize(e.name))) out.delete(e.id);
  return new Map([...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((e) => [e.id, e]));
}
