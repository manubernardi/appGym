// Estadísticas (js/stats.js): días del plan, músculos, fuerza del mes y récords.

import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';
import { load, routine, session, sets } from './support/fixtures.mjs';

const { state } = await import('../js/store.js');
const {
  weekPlan, planWeeks, musclesWorked, monthSummary, records, weekStart,
  exerciseHistory, trainingDays, weekStreak, weeklyVolume, movingAverage,
} = await import('../js/stats.js');

const at = (date) => mock.timers.enable({ apis: ['Date'], now: new Date(`${date}T12:00:00`) });
afterEach(() => mock.timers.reset());

const d1 = routine('d1', 'Día 1');
const d2 = routine('d2', 'Día 2');
const old = routine('old', 'Viejo', { archived: true, createdAt: '2026-08-01T10:00:00.000Z' });
const later = routine('d3', 'Día 3', { createdAt: '2026-10-20T10:00:00.000Z' });

const SESSIONS = [
  session('d1', '2026-10-06', [{ exerciseId: 'pb', sets: sets([40, 10], [42.5, 6]) }, { exerciseId: 'fx', sets: sets([null, 12]) }]),
  session('d2', '2026-10-08', [{ exerciseId: 'sq', sets: sets([60, 8]) }, { exerciseId: 'ci', sets: sets([2, 20]) }]),
  session('d1', '2026-10-13', [{ exerciseId: 'pb', sets: sets([47.5, 8]) }, { exerciseId: 'fx', sets: sets([null, 15]) }]),
  session(null, '2026-10-14', [{ exerciseId: 'sq', sets: sets([55, 8]) }]),
];

beforeEach(() => load(state, { routines: [d1, d2, old, later], sessions: SESSIONS }));

test('weekStart: lunes de la semana', () => {
  assert.equal(weekStart('2026-10-15'), '2026-10-12');
  assert.equal(weekStart('2026-10-12'), '2026-10-12');
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // domingo
});

test('weekPlan: días hechos, pendientes y entrenamientos fuera del plan', () => {
  const w = weekPlan('2026-10-12');
  assert.deepEqual(w.days.map((d) => [d.routine.id, d.dates]), [['d1', ['2026-10-13']], ['d2', []]]);
  assert.equal(w.done, 1);
  assert.deepEqual(w.extra.map((s) => s.date), ['2026-10-14']);
});

test('weekPlan: no cuenta rutinas archivadas sin hacer ni las creadas después', () => {
  const ids = weekPlan('2026-10-05').days.map((d) => d.routine.id);
  assert.deepEqual(ids, ['d1', 'd2']);
  assert.ok(weekPlan('2026-10-26').days.some((d) => d.routine.id === 'd3'));
});

test('planWeeks: semanas desde la primera con entrenamientos', () => {
  const weeks = planWeeks('2026-10-01', '2026-10-15');
  assert.deepEqual(weeks.map((w) => [w.from, w.done, w.days.length]), [['2026-10-05', 2, 2], ['2026-10-12', 1, 2]]);
});

test('musclesWorked: solo el grupo principal, días de la semana y última vez', () => {
  const m = musclesWorked('2026-10-12', '2026-10-18');
  assert.equal(m['Pecho'].days.size, 1);
  assert.equal(m['Cuádriceps'].last, '2026-10-14');
  assert.equal(m['Tríceps'].days.size, 0); // secundario de press banca: no cuenta
  assert.equal(m['Tríceps'].last, null);
  assert.ok(!('Cardio' in m));
});

test('monthSummary: fuerza por ejercicio con la serie más pesada', () => {
  at('2026-10-15');
  const m = monthSummary('2026-10');
  const rows = (list) => list.map((r) => [r.ex.id, r.first, r.last]);
  assert.deepEqual(rows(m.improved), [
    ['fx', { w: null, r: 12 }, { w: null, r: 15 }],
    ['pb', { w: 42.5, r: 6 }, { w: 47.5, r: 8 }],
  ]);
  assert.deepEqual(rows(m.worse), [['sq', { w: 60, r: 8 }, { w: 55, r: 8 }]]);
  assert.equal(m.sessionCount, 4);
  assert.equal(m.cardioMin, 20);
});

test('records: récord actual y el que superó', () => {
  const byId = Object.fromEntries(records().map((r) => [r.ex.id, r]));
  assert.deepEqual(byId.pb.best, { w: 47.5, r: 8 });
  assert.equal(byId.pb.date, '2026-10-13');
  assert.deepEqual(byId.pb.prev, { w: 42.5, r: 6 });
  assert.deepEqual(byId.sq.best, { w: 60, r: 8 }); // bajar el peso no es récord
  assert.equal(byId.sq.prev, null);
  assert.deepEqual(byId.fx.best, { w: null, r: 15 }); // sin peso: más reps
  assert.ok(!byId.ci); // cardio no tiene récords
});

test('records: a igual peso gana la de más reps', () => {
  state.sessions.unshift(session('d1', '2026-10-15', [{ exerciseId: 'pb', sets: sets([47.5, 9], [45, 12]) }]));
  const pb = records().find((r) => r.ex.id === 'pb');
  assert.deepEqual(pb.best, { w: 47.5, r: 9 });
  assert.deepEqual(pb.prev, { w: 47.5, r: 8 });
});

test('exerciseHistory: marca los récords sin contar la primera vez', () => {
  state.sessions.unshift(session('d1', '2026-10-15', [{ exerciseId: 'pb', sets: sets([45, 10]) }]));
  assert.deepEqual(exerciseHistory('pb').map((h) => [h.date, h.pr]), [
    ['2026-10-06', false], ['2026-10-13', true], ['2026-10-15', false],
  ]);
  assert.deepEqual(exerciseHistory('fx').map((h) => h.pr), [false, true]); // sin peso: por reps
});

test('trainingDays: series y nombres por día', () => {
  const days = trainingDays('2026-10-01', '2026-10-31');
  assert.deepEqual([...days.keys()].sort(), ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-14']);
  assert.deepEqual(days.get('2026-10-06'), { sets: 3, names: ['d1'] });
});

test('weekStreak: la semana en curso sin entrenar no corta la racha', () => {
  assert.equal(weekStreak('2026-10-14'), 2);
  assert.equal(weekStreak('2026-10-20'), 2);
  assert.equal(weekStreak('2026-10-27'), 0);
});

test('weeklyVolume: series y kg de fuerza por semana, sin cardio', () => {
  const v = weeklyVolume('2026-10-12', 3);
  assert.deepEqual(v.map((w) => w.from), ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(v.map((w) => w.sets), [0, 4, 3]);
  assert.equal(v[1].kg, 40 * 10 + 42.5 * 6 + 60 * 8);
});

test('movingAverage: media de los últimos 7 días', () => {
  const list = [{ date: '2026-10-01', kg: 80 }, { date: '2026-10-05', kg: 82 }, { date: '2026-10-09', kg: 78 }];
  assert.deepEqual(movingAverage(list), [80, 81, 80]);
});
