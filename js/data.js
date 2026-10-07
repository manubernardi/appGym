// Datos fijos de la app: grupos musculares, tipos de peso y ejercicios iniciales.

export const GROUPS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps',
  'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Abdominales',
];

// factor: multiplicador del peso anotado al calcular volumen.
// bodyweight: no suma volumen (solo series/reps).
export const WEIGHT_TYPES = {
  barra:     { label: 'Barra (peso total)',        short: 'kg total', factor: 1 },
  mancuerna: { label: 'Mancuerna (peso de una)',   short: 'kg c/u',   factor: 2 },
  maquina:   { label: 'Máquina / polea',           short: 'kg',       factor: 1 },
  corporal:  { label: 'Sin peso (solo reps)',      short: 'kg extra', factor: 1, bodyweight: true },
};

// [nombre, tipo, principal, secundarios]
const SEED = [
  // Pecho
  ['Press banca plano', 'barra', 'Pecho', ['Tríceps', 'Hombros']],
  ['Press banca inclinado', 'barra', 'Pecho', ['Hombros', 'Tríceps']],
  ['Press banca declinado', 'barra', 'Pecho', ['Tríceps']],
  ['Press plano con mancuernas', 'mancuerna', 'Pecho', ['Tríceps', 'Hombros']],
  ['Press inclinado con mancuernas', 'mancuerna', 'Pecho', ['Hombros', 'Tríceps']],
  ['Aperturas con mancuernas', 'mancuerna', 'Pecho', []],
  ['Cruce de poleas', 'maquina', 'Pecho', []],
  ['Pec deck', 'maquina', 'Pecho', []],
  ['Press de pecho en máquina', 'maquina', 'Pecho', ['Tríceps', 'Hombros']],
  ['Fondos en paralelas', 'corporal', 'Pecho', ['Tríceps', 'Hombros']],
  ['Flexiones de brazos', 'corporal', 'Pecho', ['Tríceps', 'Hombros']],
  // Espalda
  ['Dominadas', 'corporal', 'Espalda', ['Bíceps']],
  ['Jalón al pecho', 'maquina', 'Espalda', ['Bíceps']],
  ['Jalón agarre cerrado', 'maquina', 'Espalda', ['Bíceps']],
  ['Remo con barra', 'barra', 'Espalda', ['Bíceps']],
  ['Remo con mancuerna', 'mancuerna', 'Espalda', ['Bíceps']],
  ['Remo en polea baja', 'maquina', 'Espalda', ['Bíceps']],
  ['Remo en máquina', 'maquina', 'Espalda', ['Bíceps']],
  ['Pullover en polea', 'maquina', 'Espalda', []],
  ['Peso muerto', 'barra', 'Espalda', ['Isquiotibiales', 'Glúteos']],
  // Hombros
  ['Press militar con barra', 'barra', 'Hombros', ['Tríceps']],
  ['Press de hombros con mancuernas', 'mancuerna', 'Hombros', ['Tríceps']],
  ['Press de hombros en máquina', 'maquina', 'Hombros', ['Tríceps']],
  ['Elevaciones laterales', 'mancuerna', 'Hombros', []],
  ['Elevaciones laterales en polea', 'maquina', 'Hombros', []],
  ['Elevaciones frontales', 'mancuerna', 'Hombros', []],
  ['Pájaros (posterior)', 'mancuerna', 'Hombros', ['Espalda']],
  ['Face pull', 'maquina', 'Hombros', ['Espalda']],
  ['Remo al mentón', 'barra', 'Hombros', ['Bíceps']],
  // Bíceps
  ['Curl con barra', 'barra', 'Bíceps', []],
  ['Curl con mancuernas', 'mancuerna', 'Bíceps', []],
  ['Curl martillo', 'mancuerna', 'Bíceps', []],
  ['Curl en polea', 'maquina', 'Bíceps', []],
  ['Curl predicador', 'barra', 'Bíceps', []],
  ['Curl concentrado', 'mancuerna', 'Bíceps', []],
  // Tríceps
  ['Extensión de tríceps en polea', 'maquina', 'Tríceps', []],
  ['Extensión de tríceps con soga', 'maquina', 'Tríceps', []],
  ['Press francés', 'barra', 'Tríceps', []],
  ['Extensión de tríceps sobre la cabeza', 'mancuerna', 'Tríceps', []],
  ['Patada de tríceps', 'mancuerna', 'Tríceps', []],
  ['Press banca agarre cerrado', 'barra', 'Tríceps', ['Pecho']],
  // Cuádriceps
  ['Sentadilla con barra', 'barra', 'Cuádriceps', ['Glúteos', 'Isquiotibiales']],
  ['Prensa de piernas', 'maquina', 'Cuádriceps', ['Glúteos']],
  ['Sillón de cuádriceps', 'maquina', 'Cuádriceps', []],
  ['Sentadilla búlgara', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  ['Estocadas', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  ['Sentadilla hack', 'maquina', 'Cuádriceps', ['Glúteos']],
  ['Sentadilla goblet', 'mancuerna', 'Cuádriceps', ['Glúteos']],
  // Isquiotibiales
  ['Peso muerto rumano', 'barra', 'Isquiotibiales', ['Glúteos', 'Espalda']],
  ['Camilla de isquiotibiales', 'maquina', 'Isquiotibiales', []],
  ['Curl femoral sentado', 'maquina', 'Isquiotibiales', []],
  ['Buenos días', 'barra', 'Isquiotibiales', ['Glúteos', 'Espalda']],
  // Glúteos
  ['Hip thrust', 'barra', 'Glúteos', ['Isquiotibiales']],
  ['Patada de glúteo en polea', 'maquina', 'Glúteos', []],
  ['Abductores en máquina', 'maquina', 'Glúteos', []],
  // Gemelos
  ['Gemelos de pie', 'maquina', 'Gemelos', []],
  ['Gemelos sentado', 'maquina', 'Gemelos', []],
  ['Gemelos en prensa', 'maquina', 'Gemelos', []],
  // Abdominales
  ['Crunch abdominal', 'corporal', 'Abdominales', []],
  ['Plancha', 'corporal', 'Abdominales', []],
  ['Elevación de piernas', 'corporal', 'Abdominales', []],
  ['Crunch en polea', 'maquina', 'Abdominales', []],
  ['Rueda abdominal', 'corporal', 'Abdominales', []],
  ['Russian twist', 'corporal', 'Abdominales', []],
];

export const SEED_EXERCISES = SEED.map(([name, type, primary, secondary]) => ({
  name, type, primary, secondary,
}));
