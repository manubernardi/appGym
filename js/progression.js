// Progresión semanal del plan.
// La rutina guarda la tabla: routine.progression = [{ targets: ['3x8', '3x10', '3x12'] }, …]
// (un elemento por semana; cada posición de targets es una progresión: 1, 2, 3…).
// Cada ejercicio indica qué progresión sigue: item.prog (1, 2, 3…; sin número = 1).
// La semana de cada rutina avanza con las veces que la hiciste; pasada la última, queda en la última.

import { state } from './store.js';

export function hasProgression(routine) {
  return Boolean(routine?.progression?.length);
}

export function progCount(routine) {
  return Math.max(0, ...(routine?.progression || []).map((w) => w.targets.length));
}

// Semana que toca para esta rutina (1…N). `exceptId`: sesión que no se cuenta (la que se está creando).
export function currentWeek(routine, exceptId = null) {
  if (!hasProgression(routine)) return null;
  const done = state.sessions.filter((s) => s.routineId === routine.id && s.id !== exceptId).length;
  return Math.min(done + 1, routine.progression.length);
}

// Objetivo del ejercicio en esa semana ("3x10"). Sin tabla, el objetivo fijo de siempre.
export function itemTarget(routine, item, week) {
  if (!hasProgression(routine) || !week) return item.target || '';
  const targets = routine.progression[week - 1]?.targets || [];
  return targets[(item.prog || 1) - 1] || item.target || '';
}
