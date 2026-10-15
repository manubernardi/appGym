// Cálculos de evolución: series por grupo, resumen del mes, historial por ejercicio y récords.

import { GROUPS, WEIGHT_TYPES, CARDIO } from './data.js';
import { state } from './store.js';
import { parseDate, toISODate, fmtNum } from './ui.js';

// Una serie cuenta si tiene repeticiones.
export function validSets(entry) {
  return (entry.sets || []).filter((s) => s.r > 0);
}

// Cardio (minutos y km) no entra en récords ni en la evolución de fuerza.
const isCardio = (ex) => ex?.primary === CARDIO;

// Fuerza estimada (1RM, fórmula de Epley).
export function e1rm(w, r) {
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

// --- Fechas -------------------------------------------------------------

export function weekStart(iso) {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function sessionsBetween(from, to) {
  return state.sessions.filter((s) => s.date >= from && s.date <= to);
}

// --- Cumplimiento del plan ----------------------------------------------

// Días del plan en la semana que empieza el lunes `from`: las rutinas activas que ya existían esa semana
// y cualquier otra rutina que hayas hecho. days: [{ routine, dates }]; extra: entrenamientos libres.
export function weekPlan(from) {
  const to = addDays(from, 6);
  const sessions = sessionsBetween(from, to);
  const routines = state.routines.filter((r) => sessions.some((s) => s.routineId === r.id)
    || (!r.archived && (r.createdAt || '').slice(0, 10) <= to));
  const days = routines.map((routine) => ({
    routine,
    dates: sessions.filter((s) => s.routineId === routine.id).map((s) => s.date).sort(),
  }));
  const extra = sessions.filter((s) => !routines.some((r) => r.id === s.routineId));
  return { from, to, days, done: days.filter((d) => d.dates.length).length, extra };
}

// Semanas (lunes a domingo) que tocan el período, desde la primera en que entrenaste.
export function planWeeks(from, to) {
  const first = state.sessions.length ? weekStart(state.sessions[state.sessions.length - 1].date) : to;
  const out = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) if (w >= first) out.push(weekPlan(w));
  return out;
}

// --- Músculos trabajados ------------------------------------------------

// Por grupo muscular (solo el principal de cada ejercicio): días que lo entrenaste entre from y to,
// y la última vez que lo entrenaste hasta `to`.
export function musclesWorked(from, to) {
  const out = Object.fromEntries(GROUPS.map((g) => [g, { days: new Set(), last: null }]));
  for (const s of state.sessions) {
    if (s.date > to) continue;
    for (const entry of s.entries || []) {
      const row = out[state.exercises.get(entry.exerciseId)?.primary];
      if (!row || !validSets(entry).length) continue;
      if (s.date >= from) row.days.add(s.date);
      if (!row.last || s.date > row.last) row.last = s.date;
    }
  }
  return out;
}

// --- Resumen del mes ----------------------------------------------------

// Más peso, o el mismo peso con más reps (sin peso: más reps). Sirve para récords y para comparar dos veces.
function beats(ex, a, b) {
  if (WEIGHT_TYPES[ex.type]?.bodyweight) return a.r > b.r;
  const aw = a.w || 0;
  const bw = b.w || 0;
  return aw > bw || (aw === bw && a.r > b.r);
}

function topSet(ex, sets) {
  let top = null;
  for (const s of sets) if (!top || beats(ex, s, top)) top = s;
  return top;
}

// monthKey: 'YYYY-MM'
export function monthSummary(monthKey) {
  const from = `${monthKey}-01`;
  const d = parseDate(from);
  const end = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const to = end < toISODate(new Date()) ? end : toISODate(new Date());
  const days = Math.max(1, Math.round((parseDate(to) - d) / 86400000) + 1);
  const weeks = Math.max(1, days / 7); // a principio de mes no se infla el promedio
  const sessions = sessionsBetween(from, to);

  // Sesiones de cada ejercicio en el mes (en orden de fecha) y lo previo al mes.
  const perEx = new Map();
  let cardioMin = 0;
  for (const s of [...sessions].reverse()) {
    for (const entry of s.entries || []) {
      const ex = state.exercises.get(entry.exerciseId);
      const sets = validSets(entry);
      if (!ex || !sets.length) continue;
      if (isCardio(ex)) { cardioMin += sets.reduce((t, x) => t + x.r, 0); continue; }
      if (!perEx.has(ex.id)) perEx.set(ex.id, { ex, sessions: [] });
      perEx.get(ex.id).sessions.push({ date: s.date, sets });
    }
  }
  const before = new Map();
  for (const s of state.sessions) {
    if (s.date >= from) continue;
    for (const entry of s.entries || []) {
      const ex = state.exercises.get(entry.exerciseId);
      if (!ex || !perEx.has(ex.id)) continue;
      const t = topSet(ex, validSets(entry));
      if (t && (!before.has(ex.id) || beats(ex, t, before.get(ex.id)))) before.set(ex.id, t);
    }
  }

  const newRecords = [];
  const improved = [];
  const same = [];
  const worse = [];
  const once = [];
  for (const { ex, sessions: list } of perEx.values()) {
    const prev = before.get(ex.id);
    let top = null;
    let topDate = null;
    for (const x of list) {
      const t = topSet(ex, x.sets);
      if (t && (!top || beats(ex, t, top))) { top = t; topDate = x.date; }
    }
    if (prev && top && beats(ex, top, prev)) newRecords.push({ ex, set: top, prev, date: topDate });

    if (list.length < 2) { once.push({ ex }); continue; }
    const first = topSet(ex, list[0].sets);
    const last = topSet(ex, list[list.length - 1].sets);
    const row = { ex, first, last, firstDate: list[0].date, lastDate: list[list.length - 1].date };
    (beats(ex, last, first) ? improved : beats(ex, first, last) ? worse : same).push(row);
  }
  const byName = (a, b) => a.ex.name.localeCompare(b.ex.name, 'es');
  [improved, same, worse].forEach((l) => l.sort(byName));

  return {
    from, to, weeks, inProgress: to !== end,
    sessionCount: sessions.length,
    cardioMin,
    // Tiempo entrenado (segundos), de los entrenamientos que tienen duración.
    trainedSec: sessions.reduce((t, s) => t + (s.duration || 0), 0),
    trainingDays: new Set(sessions.map((s) => s.date)).size,
    newRecords, improved, same, worse, once,
  };
}

// --- Por ejercicio ------------------------------------------------------

// Historial de un ejercicio, de más viejo a más nuevo.
export function exerciseHistory(exerciseId) {
  const out = [];
  for (const session of state.sessions) {
    for (const entry of session.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      const sets = validSets(entry);
      if (!sets.length) continue;
      out.push({
        date: session.date,
        sessionId: session.id,
        sets,
        maxW: Math.max(...sets.map((s) => s.w || 0)),
        maxReps: Math.max(...sets.map((s) => s.r)),
        bestE1rm: Math.max(...sets.map((s) => e1rm(s.w, s.r))),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Última vez que hiciste el ejercicio (sin contar la sesión actual).
export function lastTime(exerciseId, excludeSessionId) {
  for (const session of state.sessions) {
    if (session.id === excludeSessionId) continue;
    for (const entry of session.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      const sets = validSets(entry);
      if (sets.length) return { date: session.date, sets };
    }
  }
  return null;
}

// Ejercicios que tienen al menos un registro.
export function loggedExerciseIds() {
  const ids = new Set();
  for (const session of state.sessions) {
    for (const entry of session.entries || []) {
      if (validSets(entry).length && !isCardio(state.exercises.get(entry.exerciseId))) ids.add(entry.exerciseId);
    }
  }
  return ids;
}

// Récords personales por ejercicio.
export function records() {
  const out = new Map();
  for (const session of state.sessions) {
    for (const entry of session.entries || []) {
      const ex = state.exercises.get(entry.exerciseId);
      if (!ex || isCardio(ex)) continue;
      let rec = out.get(ex.id);
      if (!rec) {
        rec = { ex, maxW: null, bestE1rm: null, maxReps: null };
        out.set(ex.id, rec);
      }
      for (const s of validSets(entry)) {
        const w = s.w || 0;
        if (w > 0 && (!rec.maxW || w > rec.maxW.w || (w === rec.maxW.w && s.r > rec.maxW.r))) {
          rec.maxW = { w, r: s.r, date: session.date };
        }
        const e = e1rm(w, s.r);
        if (e > 0 && (!rec.bestE1rm || e > rec.bestE1rm.value)) {
          rec.bestE1rm = { value: e, w, r: s.r, date: session.date };
        }
        if (!rec.maxReps || s.r > rec.maxReps.r) {
          rec.maxReps = { w, r: s.r, date: session.date };
        }
      }
    }
  }
  return [...out.values()].filter((r) => r.maxReps);
}

export function fmtSets(sets, ex) {
  if (isCardio(ex)) return sets.map((s) => `${s.r} min` + (s.w ? ` · ${fmtNum(s.w, 2)} km` : '')).join(' + ');
  const bw = ex && WEIGHT_TYPES[ex.type]?.bodyweight;
  return sets.map((s) => (s.w ? `${fmtNum(s.w, 2)}×${s.r}` : bw ? `${s.r} reps` : `—×${s.r}`)).join(' · ');
}
