// Progresión semanal del plan.
// La rutina guarda la tabla: routine.progression = [{ targets: ['3x8', '3x10', '3x12'] }, …]
// (un elemento por semana; cada posición de targets es una progresión: 1, 2, 3…).
// Cada ejercicio indica qué progresión sigue: item.prog (1, 2, 3…; sin número = 1).
// item.prog = 0: no sigue la tabla, usa siempre su objetivo fijo item.target (ej. la zona media, "3x10").
// La semana de cada rutina avanza con las veces que la terminaste; pasada la última, queda en la última.

import { state } from './store.js';

export const FIXED = 0;

export function hasProgression(routine) {
  return Boolean(routine?.progression?.length);
}

export function progCount(routine) {
  return Math.max(0, ...(routine?.progression || []).map((w) => w.targets.length));
}

// Progresión que sigue el ejercicio: 1, 2, 3… o FIXED.
export function itemProg(item) {
  return item.prog === FIXED ? FIXED : item.prog || 1;
}

// Semana que toca para esta rutina (1…N). Solo cuentan los entrenamientos terminados.
export function currentWeek(routine) {
  if (!hasProgression(routine)) return null;
  const done = state.sessions.filter((s) => s.routineId === routine.id && s.finished).length;
  return Math.min(done + 1, routine.progression.length);
}

// Objetivo del ejercicio en esa semana ("3x10"). Sin tabla o con objetivo fijo, el objetivo escrito.
export function itemTarget(routine, item, week) {
  const prog = itemProg(item);
  if (!hasProgression(routine) || !week || prog === FIXED) return item.target || '';
  const targets = routine.progression[week - 1]?.targets || [];
  return targets[prog - 1] || item.target || '';
}
