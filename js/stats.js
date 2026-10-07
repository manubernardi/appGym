// Cálculos de evolución: volumen/series por grupo, historial por ejercicio y récords.

import { GROUPS, WEIGHT_TYPES } from './data.js';
import { state } from './store.js';
import { parseDate, toISODate, monthName, fmtNum } from './ui.js';

// Una serie cuenta si tiene repeticiones.
export function validSets(entry) {
  return (entry.sets || []).filter((s) => s.r > 0);
}

// Fuerza estimada (1RM, fórmula de Epley).
export function e1rm(w, r) {
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

function setVolume(ex, s) {
  const type = WEIGHT_TYPES[ex.type] || WEIGHT_TYPES.maquina;
  if (type.bodyweight) return 0;
  return (s.w || 0) * s.r * type.factor;
}

// --- Períodos -----------------------------------------------------------

function weekStart(iso) {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function periodKey(kind, iso) {
  return kind === 'week' ? weekStart(iso) : iso.slice(0, 7);
}

// Últimos n períodos (del más viejo al actual).
export function lastPeriods(kind, n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    if (kind === 'week') {
      const x = new Date(d);
      x.setDate(x.getDate() - 7 * i);
      const key = weekStart(toISODate(x));
      const s = parseDate(key);
      out.push({ key, label: `${s.getDate()}/${s.getMonth() + 1}` });
    } else {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = toISODate(x).slice(0, 7);
      out.push({ key, label: monthName(x.getMonth()) + (x.getMonth() === 0 ? ` ${String(x.getFullYear()).slice(2)}` : '') });
    }
  }
  return out;
}

// --- Por grupo muscular -------------------------------------------------

function emptyGroupRow() {
  return { volP: 0, volS: 0, setsP: 0, setsS: 0, daysP: new Set(), daysAny: new Set() };
}

// Devuelve { [periodKey]: { [grupo]: {volP, volS, setsP, setsS, daysP, daysAny} } }
export function groupStatsByPeriod(kind) {
  const out = {};
  for (const session of state.sessions) {
    const pk = periodKey(kind, session.date);
    const period = out[pk] || (out[pk] = Object.fromEntries(GROUPS.map((g) => [g, emptyGroupRow()])));
    for (const entry of session.entries || []) {
      const ex = state.exercises.get(entry.exerciseId);
      if (!ex) continue;
      const sets = validSets(entry);
      if (!sets.length) continue;
      const vol = sets.reduce((acc, s) => acc + setVolume(ex, s), 0);
      const p = period[ex.primary];
      if (p) {
        p.volP += vol;
        p.setsP += sets.length;
        p.daysP.add(session.date);
        p.daysAny.add(session.date);
      }
      for (const g of ex.secondary || []) {
        const row = period[g];
        if (!row || g === ex.primary) continue;
        row.volS += vol;
        row.setsS += sets.length;
        row.daysAny.add(session.date);
      }
    }
  }
  return out;
}

export function emptyPeriod() {
  return Object.fromEntries(GROUPS.map((g) => [g, emptyGroupRow()]));
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
      if (validSets(entry).length) ids.add(entry.exerciseId);
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
      if (!ex) continue;
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
  const bw = ex && WEIGHT_TYPES[ex.type]?.bodyweight;
  return sets.map((s) => (s.w ? `${fmtNum(s.w, 2)}×${s.r}` : bw ? `${s.r} reps` : `—×${s.r}`)).join(' · ');
}
