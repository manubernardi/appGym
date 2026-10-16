// Ayuda mientras entrenás: qué peso usar hoy, qué serie sería récord y el resumen al terminar.

import { WEIGHT_TYPES } from './data.js';
import { state } from './store.js';
import { validSets, beats, topSet, lastTime } from './stats.js';
import { fmtNum } from './ui.js';

// "3x10" -> { sets: 3, low: 10, high: 10 }; "4x8-12" -> { sets: 4, low: 8, high: 12 }. Sin reps legibles, null.
export function parseTarget(target) {
  const m = /^\s*(\d+)\s*[x×*]\s*(\d+)(?:\s*(?:-|–|a)\s*(\d+))?/i.exec(target || '');
  if (!m) return null;
  const a = Number(m[2]);
  const b = m[3] ? Number(m[3]) : a;
  return { sets: Number(m[1]), low: Math.min(a, b), high: Math.max(a, b) };
}

// Cuánto subir o bajar: 2,5 kg en barra y máquina; las mancuernas van de a 1 kg hasta 10 y después de a 2.
export function weightStep(ex, w) {
  if (ex.type === 'mancuerna') return w >= 10 ? 2 : 1;
  return 2.5;
}

const kg = (w) => `${fmtNum(w, 2)} kg`;

// Peso y reps para hoy según la última vez y el objetivo de la semana (doble progresión).
// Se mira el peso más alto de la última vez y las series que hiciste con ese peso:
// - Llegaste al tope de reps en todas → subí un escalón (dos si te sobraban 3 o más reps; ninguno si llegaste al fallo).
// - Quedaste 2 o más reps por debajo del mínimo → bajá un escalón.
// - Si no, mismo peso y buscá llegar al tope.
// Sin objetivo, la meta es una rep más que la última vez. Sin última vez o en cardio, null.
// Devuelve { w, r, dir: 'up' | 'keep' | 'down', why }.
export function suggestion(ex, target, last) {
  const type = WEIGHT_TYPES[ex?.type];
  if (!type || type.cardio || !last) return null;
  const sets = last.sets.filter((s) => s.r > 0);
  if (!sets.length) return null;
  const t = parseTarget(target);
  const w = Math.max(...sets.map((s) => s.w || 0));
  const work = sets.filter((s) => (s.w || 0) === w);
  const best = Math.max(...work.map((s) => s.r));
  const withW = (txt) => (w ? `${txt} con ${kg(w)}` : txt);

  if (!t) {
    return { w, r: best + 1, dir: 'keep', why: withW(`La última vez llegaste a ${best} reps`) + ': buscá una más.' };
  }
  // Las series más livianas antes de la primera con el peso más alto son de aproximación y no cuentan.
  // Las más livianas después sí: bajaste el peso porque no llegabas.
  // Objetivo cumplido: todas las series que cuentan, con ese peso y llegando al tope de reps.
  // (Si la semana pasada el plan pedía menos series que hoy, alcanza con las que hiciste.)
  const warmups = sets.findIndex((s) => (s.w || 0) === w);
  const need = Math.min(t.sets, sets.length - warmups);
  const repsOk = work.every((s) => s.r >= t.high);
  const hit = work.length >= need && repsOk;
  const rirs = work.map((s) => s.rir).filter((n) => n != null);
  const minRir = rirs.length ? Math.min(...rirs) : null;
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;

  if (hit) {
    // Lo que hiciste de verdad: "3×10 con 60 kg" (series con ese peso × las reps de la más floja).
    const done = withW(`Hiciste ${work.length}×${Math.min(...work.map((x) => x.r))}`);
    if (minRir === 0) return { w, r: t.high, dir: 'keep', why: `${done}, pero al límite (RIR 0): afirmalo antes de subir.` };
    if (type.bodyweight && !w) return { w: 0, r: t.high, dir: 'up', why: `${done}: probá sumar peso o más reps.` };
    const jump = avgRir !== null && avgRir >= 3 ? 2 : 1;
    const next = w + weightStep(ex, w) * jump;
    return { w: next, r: t.low, dir: 'up', why: `${done}${jump > 1 ? ' y te sobraban reps: subí dos escalones' : ': ya podés subir'}.` };
  }
  const short = work.filter((s) => s.r <= t.low - 2).length > work.length / 2;
  if (short && w) {
    return { w: Math.max(0, w - weightStep(ex, w)), r: t.low, dir: 'down', why: `Con ${kg(w)} quedaste lejos de ${t.low} reps.` };
  }
  if (repsOk) {
    return { w, r: t.high, dir: 'keep', why: `Con ${kg(w)} hiciste ${work.length} de ${need} series: buscá hacerlas todas con ese peso.` };
  }
  return { w, r: t.high, dir: 'keep', why: withW(`La última vez llegaste a ${best} reps`) + `: mismo peso hasta hacer ${t.sets}×${t.high}.` };
}

// Mejor serie del ejercicio sin contar este entrenamiento: la que hay que superar para hacer récord.
export function recordBefore(exerciseId, excludeSessionId) {
  const ex = state.exercises.get(exerciseId);
  if (!ex || WEIGHT_TYPES[ex.type]?.cardio) return null;
  let best = null;
  for (const s of state.sessions) {
    if (s.id === excludeSessionId) continue;
    for (const en of s.entries || []) {
      if (en.exerciseId !== exerciseId) continue;
      const top = topSet(ex, validSets(en));
      if (top && (!best || beats(ex, top, best))) best = top;
    }
  }
  return best;
}

// La serie supera al récord anterior. La primera vez que hacés un ejercicio no cuenta como récord.
export function isRecord(ex, set, prev) {
  return Boolean(ex && prev && set.r > 0 && beats(ex, set, prev));
}

// Resumen de un entrenamiento terminado: totales, récords y comparación con la última vez de cada ejercicio
// y con la vez anterior que hiciste la misma rutina.
export function sessionSummary(session) {
  const out = { sets: 0, kg: 0, cardioMin: 0, exercises: 0, records: [], compared: [], prevRoutine: null };
  for (const en of session.entries || []) {
    const ex = state.exercises.get(en.exerciseId);
    const sets = validSets(en);
    if (!ex || !sets.length) continue;
    out.exercises++;
    const type = WEIGHT_TYPES[ex.type];
    if (type?.cardio) { out.cardioMin += sets.reduce((t, x) => t + x.r, 0); continue; }
    out.sets += sets.length;
    out.kg += sets.reduce((t, x) => t + (x.w || 0) * (type?.factor ?? 1) * x.r, 0);
    const top = topSet(ex, sets);
    const prev = recordBefore(ex.id, session.id);
    if (isRecord(ex, top, prev)) out.records.push({ ex, set: top, prev });
    const last = lastTime(ex.id, session.id);
    if (last) {
      const from = topSet(ex, last.sets);
      const dir = beats(ex, top, from) ? 1 : beats(ex, from, top) ? -1 : 0;
      out.compared.push({ ex, from, to: top, dir, fromDate: last.date });
    }
  }
  if (session.routineId) {
    out.prevRoutine = state.sessions.find((s) => s.id !== session.id && s.finished && s.routineId === session.routineId
      && (s.date + (s.createdAt || '')) < (session.date + (session.createdAt || ''))) || null;
  }
  return out;
}
