// Datos de ejemplo para los tests.

export const EXERCISES = [
  { id: 'pb', name: 'Press banca plano', type: 'barra', primary: 'Pecho', secondary: ['Tríceps'] },
  { id: 'pm', name: 'Press con mancuernas', type: 'mancuerna', primary: 'Pecho', secondary: [] },
  { id: 'sq', name: 'Sentadilla', type: 'barra', primary: 'Cuádriceps', secondary: ['Glúteos'] },
  { id: 'fx', name: 'Flexiones', type: 'corporal', primary: 'Pecho', secondary: [] },
  { id: 'pl', name: 'Plancha', type: 'corporal', primary: 'Abdominales', secondary: [] },
  { id: 'ci', name: 'Cinta', type: 'cardio', primary: 'Cardio', secondary: [] },
];

export const PROGRESSION = [1, 2, 3, 4].map((w) => ({ targets: [`3x${6 + w}`, `4x${4 + w}`] }));

export function routine(id, name, extra = {}) {
  return { id, name, createdAt: '2026-10-01T10:00:00.000Z', progression: PROGRESSION, items: [], ...extra };
}

let n = 0;
export function session(routineId, date, entries = [], extra = {}) {
  n++;
  return {
    id: `s${n}`, routineId, routineName: routineId || 'Entrenamiento libre',
    date, finished: true, createdAt: `${date}T10:00:${String(n % 60).padStart(2, '0')}.000Z`, entries, ...extra,
  };
}

export const sets = (...list) => list.map(([w, r]) => ({ w, r }));

// Carga los datos en el estado, con las sesiones de más nueva a más vieja (como las ordena db.js).
export function load(state, { routines = [], sessions = [], exercises = EXERCISES } = {}) {
  state.user = { uid: 'test' };
  state.exercises = new Map(exercises.map((e) => [e.id, e]));
  state.routines = routines;
  state.sessions = [...sessions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  state.bodyweight = [];
  state.loaded = { exercises: true, routines: true, sessions: true, bodyweight: true };
  state.authReady = true;
}
