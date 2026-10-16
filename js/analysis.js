// Análisis de lo entrenado: reporte del plan, cumplimiento del objetivo, ejercicios estancados,
// balance muscular y fuerza relativa al peso corporal.

import { GROUPS, WEIGHT_TYPES, CARDIO } from './data.js';
import { state } from './store.js';
import { validSets, compareStrength, topSet, exerciseHistory, loggedExerciseIds, addDays } from './stats.js';
import { parseTarget } from './coach.js';
import { hasProgression, planStart, weekStatus } from './progression.js';
import { today, parseDate } from './ui.js';

const isCardio = (ex) => !ex || ex.primary === CARDIO || WEIGHT_TYPES[ex.type]?.cardio;
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

// --- Plan ---------------------------------------------------------------

// El plan actual: las rutinas activas con tabla de progresión. Empieza el lunes de la semana del primer
// entrenamiento y dura tantas semanas como la tabla. null si no hay plan con progresión.
// { routines, weeks, start, end, week, finished, planned, done, missed, sessions }
export function planInfo() {
  const routines = state.routines.filter((r) => !r.archived && hasProgression(r));
  if (!routines.length) return null;
  const weeks = Math.max(...routines.map((r) => r.progression.length));
  const start = planStart(routines[0]);
  const ids = new Set(routines.map((r) => r.id));
  if (!start) {
    return { routines, weeks, start: null, end: null, week: 1, finished: false, planned: routines.length * weeks, done: 0, missed: 0, sessions: [] };
  }
  const end = addDays(start, 7 * weeks - 1);
  const now = today();
  const week = Math.min(weeks, Math.floor(daysBetween(start, now) / 7) + 1);
  // Semanas hechas y sin entrenar por rutina (cuenta las recuperadas, como la pestaña Plan).
  const status = routines.map((r) => weekStatus(r));
  const done = status.reduce((t, st) => t + Math.min(st.done.size, weeks), 0);
  const missed = status.reduce((t, st) => t + st.missed.length, 0);
  const sessions = state.sessions
    .filter((s) => s.finished && ids.has(s.routineId) && s.date >= start && s.date <= end)
    .sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  return { routines, weeks, start, end, week, finished: now > end, planned: routines.length * weeks, done, missed, sessions };
}

// Cuánto cambió cada ejercicio entre la primera y la última vez dentro de esos entrenamientos (en orden de fecha).
// Mismo formato que el resumen del mes: { improved, same, worse, once } con { ex, first, last, firstDate, lastDate }.
export function strengthChange(sessions) {
  const perEx = new Map();
  for (const s of sessions) {
    for (const en of s.entries || []) {
      const ex = state.exercises.get(en.exerciseId);
      const top = ex && !isCardio(ex) ? topSet(ex, validSets(en)) : null;
      if (!top) continue;
      if (!perEx.has(ex.id)) perEx.set(ex.id, { ex, list: [] });
      perEx.get(ex.id).list.push({ date: s.date, top });
    }
  }
  const out = { improved: [], same: [], worse: [], once: [] };
  for (const { ex, list } of perEx.values()) {
    if (list.length < 2) { out.once.push({ ex }); continue; }
    const first = list[0];
    const last = list[list.length - 1];
    const dir = compareStrength(ex, first.top, last.top);
    const row = { ex, first: first.top, last: last.top, dir, firstDate: first.date, lastDate: last.date };
    (dir > 0 ? out.improved : dir < 0 ? out.worse : out.same).push(row);
  }
  return out;
}

// Récords (superar al anterior) entre from y to.
export function recordsBetween(from, to) {
  let n = 0;
  for (const id of loggedExerciseIds()) n += exerciseHistory(id).filter((h) => h.pr && h.date >= from && h.date <= to).length;
  return n;
}

// --- Cumplimiento del objetivo -----------------------------------------

// Cuántas de las series que pedía el plan llegaron al mínimo de reps del objetivo ("3x8-10": 3 series de 8 o más).
// Una serie que no hiciste cuenta como no cumplida. easy: series que pasaron el tope por 2 o más reps.
// { planned, hit, pct, easyPct, byExercise: [{ ex, planned, hit, pct, easy, done, easyPct }] }
export function targetCompliance(sessions) {
  const byEx = new Map();
  for (const s of sessions) {
    for (const en of s.entries || []) {
      const ex = state.exercises.get(en.exerciseId);
      const t = parseTarget(en.target);
      if (!t || isCardio(ex)) continue;
      const sets = validSets(en);
      const row = byEx.get(ex.id) || { ex, planned: 0, hit: 0, easy: 0, done: 0 };
      row.planned += t.sets;
      row.hit += Math.min(t.sets, sets.filter((x) => x.r >= t.low).length);
      row.easy += sets.filter((x) => x.r >= t.high + 2).length;
      row.done += sets.length;
      byEx.set(ex.id, row);
    }
  }
  const rows = [...byEx.values()].map((r) => ({ ...r, pct: r.hit / r.planned, easyPct: r.done ? r.easy / r.done : 0 }));
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const planned = sum('planned');
  return {
    planned, hit: sum('hit'),
    pct: planned ? sum('hit') / planned : null,
    easyPct: sum('done') ? sum('easy') / sum('done') : 0,
    byExercise: rows,
  };
}

// --- Estancamiento ------------------------------------------------------

// Ejercicios con `min` entrenamientos seguidos o más sin superar su récord, que hiciste en los últimos 45 días.
// No cuenta los de zona media (se hacen siempre igual a propósito). Los más trabados primero.
// [{ ex, sessions, since, best }]
export function stalledExercises(min = 3) {
  const recent = addDays(today(), -45);
  const out = [];
  for (const id of loggedExerciseIds()) {
    const ex = state.exercises.get(id);
    if (!ex || ex.primary === 'Abdominales') continue;
    const hist = exerciseHistory(id);
    if (hist.length < min + 1 || hist[hist.length - 1].date < recent) continue;
    let lastPr = 0;
    hist.forEach((h, i) => { if (h.pr) lastPr = i; });
    const n = hist.length - 1 - lastPr;
    if (n >= min) out.push({ ex, sessions: n, since: hist[lastPr].date, best: topSet(ex, hist[lastPr].sets) });
  }
  return out.sort((a, b) => b.sessions - a.sessions);
}

// --- Balance muscular ---------------------------------------------------

export const PUSH = ['Pecho', 'Hombros', 'Tríceps'];
export const PULL = ['Espalda', 'Bíceps'];
export const LEGS = ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos'];

// Series por semana de cada grupo en los `days` días que terminan en `to`: el grupo principal cuenta la serie entera
// y cada secundario, media. Si empezaste hace menos, se promedia sobre lo que llevás (mínimo una semana).
// { weeks, groups: [{ group, sets }], push, pull, legs, upper }
export function muscleBalance(days = 28, to = today()) {
  const from = addDays(to, -(days - 1));
  const sets = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  let first = null;
  for (const s of state.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const en of s.entries || []) {
      const ex = state.exercises.get(en.exerciseId);
      const n = validSets(en).length;
      if (isCardio(ex) || !n) continue;
      if (!first || s.date < first) first = s.date;
      if (ex.primary in sets) sets[ex.primary] += n;
      for (const g of ex.secondary || []) if (g in sets && g !== ex.primary) sets[g] += n / 2;
    }
  }
  const weeks = first ? Math.max(1, Math.min(days, daysBetween(first, to) + 1) / 7) : days / 7;
  const per = (list) => list.reduce((t, g) => t + sets[g], 0) / weeks;
  return {
    weeks,
    groups: GROUPS.map((g) => ({ group: g, sets: sets[g] / weeks })),
    push: per(PUSH), pull: per(PULL), legs: per(LEGS), upper: per([...PUSH, ...PULL]),
  };
}

// --- Fuerza relativa ----------------------------------------------------

export const LEVELS = ['Principiante', 'Novato', 'Intermedio', 'Avanzado', 'Élite'];

// Referencias aproximadas de 1RM / peso corporal desde donde empieza cada nivel (hombres / mujeres).
const LIFTS = [
  { label: 'Sentadilla', ids: ['base-sentadilla-con-barra'], names: ['sentadilla', 'sentadilla con barra', 'sentadilla trasera'],
    m: [0.75, 1.25, 1.5, 2.25, 2.75], f: [0.5, 0.75, 1.25, 1.5, 2] },
  { label: 'Press banca', ids: ['base-press-banca-plano'], names: ['press banca', 'press banca plano', 'press de banca', 'press plano con barra'],
    m: [0.5, 0.75, 1, 1.5, 2], f: [0.25, 0.5, 0.75, 1, 1.5] },
  { label: 'Peso muerto', ids: ['base-peso-muerto'], names: ['peso muerto', 'peso muerto convencional'],
    m: [1, 1.5, 2, 2.5, 3], f: [0.5, 1, 1.25, 1.75, 2.5] },
  { label: 'Press militar', ids: ['base-press-militar-con-barra'], names: ['press militar', 'press militar con barra'],
    m: [0.35, 0.55, 0.8, 1.1, 1.4], f: [0.2, 0.35, 0.5, 0.75, 1] },
];

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function liftOf(ex) {
  return LIFTS.find((l) => l.ids.includes(ex.id) || l.names.includes(norm(ex.name))) || null;
}

// Mejor 1RM estimado de los últimos `days` días dividido el último peso corporal, para los ejercicios con barra.
// Los básicos (sentadilla, banca, peso muerto, militar) traen nivel y cuánto falta para el siguiente.
// { bw, rows: [{ ex, e1rm, ratio, lift?, level?, next?: { name, kg } }] } (bw null si no cargaste tu peso).
export function relativeStrength(sex = 'm', days = 120) {
  const bw = state.bodyweight[state.bodyweight.length - 1]?.kg || null;
  if (!bw) return { bw: null, rows: [] };
  const since = addDays(today(), -days);
  const rows = [];
  for (const id of loggedExerciseIds()) {
    const ex = state.exercises.get(id);
    if (ex?.type !== 'barra') continue;
    const best = Math.max(0, ...exerciseHistory(id).filter((h) => h.date >= since).map((h) => h.bestE1rm));
    if (!best) continue;
    const row = { ex, e1rm: best, ratio: best / bw };
    const lift = liftOf(ex);
    if (lift) {
      const th = lift[sex] || lift.m;
      const i = th.filter((x) => row.ratio >= x).length - 1;
      row.lift = lift.label;
      row.level = Math.max(0, i);
      row.below = i < 0; // todavía no llega a principiante
      row.next = i + 1 < th.length ? { name: LEVELS[i + 1], kg: Math.max(0, th[i + 1] * bw - best) } : null;
      row.thresholds = th;
    }
    rows.push(row);
  }
  rows.sort((a, b) => Number(Boolean(b.lift)) - Number(Boolean(a.lift)) || b.ratio - a.ratio);
  return { bw, rows };
}

