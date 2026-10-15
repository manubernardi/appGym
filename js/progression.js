// Progresión semanal del plan.
// La rutina guarda la tabla: routine.progression = [{ targets: ['3x8', '3x10', '3x12'] }, …]
// (un elemento por semana; cada posición de targets es una progresión: 1, 2, 3…).
// Cada ejercicio indica qué progresión sigue: item.prog (1, 2, 3…; sin número = 1).
// item.prog = 0: no sigue la tabla, usa siempre su objetivo fijo item.target (ej. la zona media, "3x10").
// Las semanas son de calendario (lunes a domingo): la Semana 1 es la del primer entrenamiento del plan
// y cada lunes pasa a la siguiente, aunque no hayas hecho todos los días. Pasada la última, queda en la última.
// Una semana que terminó sin hacer esa rutina queda "sin entrenar" y se puede recuperar:
// si la semana actual ya está hecha, la próxima vez que hagas la rutina recupera la pendiente más vieja.

import { state } from './store.js';
import { exerciseCategory, CATEGORIES } from './data.js';
import { today, parseDate } from './ui.js';
import { weekStart } from './stats.js';

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

// Lunes de la Semana 1: la semana del primer entrenamiento terminado con alguna rutina del plan.
// Sin entrenamientos todavía, null (estás en la Semana 1).
function planStart(routine) {
  const ids = new Set(state.routines.filter((r) => !r.archived && hasProgression(r)).map((r) => r.id).concat(routine.id));
  const dates = state.sessions.filter((s) => s.finished && ids.has(s.routineId)).map((s) => s.date).sort();
  return dates.length ? weekStart(dates[0]) : null;
}

// Semana que toca: la actual si no está hecha; si ya está hecha, la pendiente más vieja; si no hay, otra vez la actual.
function weekToDo(now, done) {
  if (!done.has(now)) return now;
  for (let w = 1; w < now; w++) if (!done.has(w)) return w;
  return now;
}

// Estado de las semanas de una rutina: { week: la que toca, now: la de calendario, done: Set de hechas,
// missed: [sin entrenar] }. Las semanas hechas se reconstruyen repasando los entrenamientos terminados en orden.
export function weekStatus(routine) {
  if (!hasProgression(routine)) return null;
  const n = routine.progression.length;
  const start = planStart(routine);
  const calWeek = (date) => (start
    ? Math.min(n, Math.round((parseDate(weekStart(date)) - parseDate(start)) / (7 * 864e5)) + 1)
    : 1);
  const done = new Set();
  state.sessions
    .filter((s) => s.routineId === routine.id && s.finished)
    .sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')))
    .forEach((s) => done.add(weekToDo(calWeek(s.date), done)));
  const now = calWeek(today());
  const missed = [];
  for (let w = 1; w < now; w++) if (!done.has(w)) missed.push(w);
  return { week: weekToDo(now, done), now, done, missed };
}

// Semana que toca para esta rutina (1…N).
export function currentWeek(routine) {
  return weekStatus(routine)?.week ?? null;
}

// Categoría del ejercicio de una rutina: 'fuerza', 'core' (zona media) o 'cardio'.
// Cardio sale del grupo del ejercicio. Zona media: grupo Abdominales u objetivo Fijo en un plan con progresión
// (los Fijo son el circuito de zona media de la hoja). También sirve para los ejercicios nuevos de la foto.
export function itemCategory(routine, item) {
  const cat = exerciseCategory(state.exercises.get(item.exerciseId) || item.newExercise);
  if (cat === 'fuerza' && hasProgression(routine) && itemProg(item) === FIXED) return 'core';
  return cat;
}

// "5 de fuerza · 3 de zona media · 1 de cardio" (solo fuerza: "5 ejercicios").
export function itemsLabel(routine) {
  const items = routine?.items || [];
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, 0]));
  items.forEach((it) => { counts[itemCategory(routine, it)]++; });
  if (counts.fuerza === items.length) return `${items.length} ejercicio${items.length === 1 ? '' : 's'}`;
  return Object.entries(counts).filter(([, n]) => n)
    .map(([c, n]) => `${n} de ${CATEGORIES[c].toLowerCase()}`).join(' · ');
}

// Agrupa los elementos seguidos de la misma categoría: [{ cat, idx: [índices] }, …].
export function categoryRuns(list, catOf) {
  const runs = [];
  list.forEach((x, i) => {
    const cat = catOf(x);
    const last = runs[runs.length - 1];
    if (last?.cat === cat) last.idx.push(i);
    else runs.push({ cat, idx: [i] });
  });
  return runs;
}

// Objetivo del ejercicio en esa semana ("3x10"). Sin tabla o con objetivo fijo, el objetivo escrito.
export function itemTarget(routine, item, week) {
  const prog = itemProg(item);
  if (!hasProgression(routine) || !week || prog === FIXED) return item.target || '';
  const targets = routine.progression[week - 1]?.targets || [];
  return targets[prog - 1] || item.target || '';
}
