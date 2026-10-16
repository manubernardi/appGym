// Ayuda al entrenar (js/coach.js): sugerencia de peso, récords en vivo y resumen.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';
import { load, routine, session, sets, EXERCISES } from './support/fixtures.mjs';

const { state } = await import('../js/store.js');
const { parseTarget, suggestion, recordBefore, isRecord, sessionSummary } = await import('../js/coach.js');

const ex = (id) => EXERCISES.find((e) => e.id === id);
const last = (...list) => ({ date: '2026-10-06', sets: list });

test('parseTarget: series y rango de reps', () => {
  assert.deepEqual(parseTarget('3x10'), { sets: 3, low: 10, high: 10 });
  assert.deepEqual(parseTarget('4 X 8-12'), { sets: 4, low: 8, high: 12 });
  assert.equal(parseTarget('al fallo'), null);
});

test('suggestion: completaste todo → sube un escalón y vuelve al mínimo del rango', () => {
  const s = suggestion(ex('pb'), '3x8-10', last({ w: 60, r: 10 }, { w: 60, r: 10 }, { w: 60, r: 10 }));
  assert.deepEqual([s.w, s.r, s.dir], [62.5, 8, 'up']);
});

test('suggestion: si hoy el plan pide más series que la última vez, cuenta lo que hiciste', () => {
  const s = suggestion(ex('pb'), '4x8', last(...sets([60, 10], [60, 10], [60, 10])));
  assert.deepEqual([s.w, s.r, s.dir], [62.5, 8, 'up']);
  const fallo = suggestion(ex('pb'), '3x10', last(...sets([60, 10], [60, 10], [55, 10])));
  assert.equal(fallo.dir, 'keep'); // la tercera la bajaste: todavía no
});

test('suggestion: mancuernas suben de a 1 kg hasta 10 y de a 2 después', () => {
  assert.equal(suggestion(ex('pm'), '3x10', last(...sets([8, 10], [8, 10], [8, 10]))).w, 9);
  assert.equal(suggestion(ex('pm'), '3x10', last(...sets([12, 10], [12, 10], [12, 10]))).w, 14);
});

test('suggestion: el RIR cambia cuánto subir', () => {
  const easy = suggestion(ex('pb'), '3x10', last(...[1, 2, 3].map(() => ({ w: 60, r: 10, rir: 4 }))));
  assert.equal(easy.w, 65); // sobraban reps: dos escalones
  const limit = suggestion(ex('pb'), '3x10', last({ w: 60, r: 10, rir: 2 }, { w: 60, r: 10, rir: 1 }, { w: 60, r: 10, rir: 0 }));
  assert.deepEqual([limit.w, limit.dir], [60, 'keep']); // al fallo: afirmar antes de subir
});

test('suggestion: en el rango mantiene; muy por debajo baja', () => {
  const keep = suggestion(ex('pb'), '3x10', last(...sets([60, 10], [60, 9], [60, 8])));
  assert.deepEqual([keep.w, keep.r, keep.dir], [60, 10, 'keep']);
  const down = suggestion(ex('pb'), '3x10', last(...sets([60, 7], [60, 6], [60, 8])));
  assert.deepEqual([down.w, down.dir], [57.5, 'down']);
});

test('suggestion: mira el peso más alto, no las series de aproximación', () => {
  const s = suggestion(ex('pb'), '2x10', last(...sets([40, 12], [60, 10], [60, 10])));
  assert.deepEqual([s.w, s.dir], [62.5, 'up']);
});

test('suggestion: sin objetivo, una rep más; sin última vez o en cardio, nada', () => {
  const s = suggestion(ex('pb'), '', last(...sets([60, 8], [60, 7])));
  assert.deepEqual([s.w, s.r, s.dir], [60, 9, 'keep']);
  assert.equal(suggestion(ex('pb'), '3x10', null), null);
  assert.equal(suggestion(ex('ci'), '1x30', last(...sets([3, 30]))), null);
});

test('suggestion: sin peso, completar todo sugiere sumar peso o reps', () => {
  const s = suggestion(ex('fx'), '3x12', last(...sets([null, 12], [null, 12], [null, 13])));
  assert.deepEqual([s.w, s.dir], [0, 'up']);
});

const S1 = session('d1', '2026-10-06', [{ exerciseId: 'pb', sets: sets([60, 8], [60, 8]) }]);
const S2 = session('d1', '2026-10-13', [{ exerciseId: 'pb', sets: sets([62.5, 8]) }, { exerciseId: 'sq', sets: sets([80, 5]) }]);

beforeEach(() => load(state, { routines: [routine('d1', 'Día 1')], sessions: [S1, S2] }));

test('recordBefore e isRecord: se compara contra los otros entrenamientos', () => {
  assert.deepEqual(recordBefore('pb', S2.id), { w: 60, r: 8 });
  assert.ok(isRecord(ex('pb'), { w: 60, r: 9 }, recordBefore('pb', S2.id)));
  assert.ok(!isRecord(ex('pb'), { w: 60, r: 8 }, recordBefore('pb', S2.id)));
  assert.ok(!isRecord(ex('sq'), { w: 80, r: 5 }, recordBefore('sq', S2.id))); // primera vez
});

test('sessionSummary: totales, récords y comparación', () => {
  const sum = sessionSummary(S2);
  assert.equal(sum.sets, 2);
  assert.equal(sum.kg, 62.5 * 8 + 80 * 5);
  assert.deepEqual(sum.records.map((r) => r.ex.id), ['pb']);
  assert.deepEqual(sum.compared.map((c) => [c.ex.id, c.dir]), [['pb', 1]]);
  assert.equal(sum.prevRoutine.id, S1.id);
});
