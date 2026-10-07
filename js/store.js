// Estado en memoria de la app. Firestore lo mantiene actualizado.

export const state = {
  authReady: false,
  user: null,
  loaded: {},
  exercises: new Map(), // id -> ejercicio
  routines: [],
  sessions: [],         // ordenadas de más nueva a más vieja
  bodyweight: [],       // ordenado por fecha ascendente
};

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
}

export function emit() {
  listeners.forEach((fn) => fn());
}

export function isLoaded() {
  return ['exercises', 'routines', 'sessions', 'bodyweight'].every((c) => state.loaded[c]);
}
