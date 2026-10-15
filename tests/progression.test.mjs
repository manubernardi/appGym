// Semanas del plan (js/progression.js): de calendario, con semanas sin entrenar y recuperación.

import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';
import { load, routine, session } from './support/fixtures.mjs';

const { state } = await import('../js/store.js');
const { weekStatus, currentWeek, itemTarget, FIXED } = await import('../js/progression.js');

// "Hoy" para la app (mediodía, para no depender del huso horario).
const at = (date) => mock.timers.enable({ apis: ['Date'], now: new Date(`${date}T12:00:00`) });
afterEach(() => mock.timers.reset());

const d1 = routine('d1', 'Día 1');
const d3 = routine('d3', 'Día 3');
// Semana 1 = lunes 5 oct 2026 (primer entrenamiento el jueves 8).
const first = session('d1', '2026-10-08');

beforeEach(() => load(state, { routines: [d1, d3], sessions: [first] }));

const status = (r) => {
  const s = weekStatus(r);
  return { week: s.week, now: s.now, done: [...s.done].sort(), missed: s.missed };
};

test('sin entrenamientos: semana 1', () => {
  at('2026-10-08');
  load(state, { routines: [d1, d3] });
  assert.deepEqual(status(d3), { week: 1, now: 1, done: [], missed: [] });
});

test('la semana 1 es la del primer entrenamiento del plan, para todas las rutinas', () => {
  at('2026-10-11'); // domingo
  assert.deepEqual(status(d1), { week: 1, now: 1, done: [1], missed: [] });
  assert.deepEqual(status(d3), { week: 1, now: 1, done: [], missed: [] });
});

test('el lunes pasa a la semana siguiente aunque falte un día, que queda sin entrenar', () => {
  at('2026-10-12');
  assert.deepEqual(status(d3), { week: 2, now: 2, done: [], missed: [1] });
  assert.deepEqual(status(d1), { week: 2, now: 2, done: [1], missed: [] });
});

test('con la semana actual hecha, la próxima vez recupera la pendiente más vieja', () => {
  at('2026-10-21'); // semana 3
  state.sessions.unshift(session('d3', '2026-10-19'));
  assert.deepEqual(status(d3), { week: 1, now: 3, done: [3], missed: [1, 2] });
  state.sessions.unshift(session('d3', '2026-10-20'));
  assert.deepEqual(status(d3), { week: 2, now: 3, done: [1, 3], missed: [2] });
});

test('sin pendientes, repetir la rutina usa la misma semana', () => {
  at('2026-10-10');
  state.sessions.unshift(session('d1', '2026-10-09'));
  assert.equal(currentWeek(d1), 1);
});

test('pasada la última semana de la tabla, queda en la última', () => {
  at('2026-12-01');
  assert.equal(weekStatus(d1).now, 4);
  assert.deepEqual(weekStatus(d3).missed, [1, 2, 3]);
});

test('los entrenamientos sin terminar no cuentan', () => {
  at('2026-10-10');
  state.sessions.unshift(session('d3', '2026-10-09', [], { finished: false }));
  assert.deepEqual(status(d3).done, []);
});

test('las rutinas archivadas no marcan el inicio del plan', () => {
  at('2026-10-14');
  const old = routine('old', 'Viejo', { archived: true });
  load(state, { routines: [d1, old], sessions: [session('old', '2026-09-01'), session('d1', '2026-10-13')] });
  assert.equal(weekStatus(d1).now, 1);
});

test('sin tabla de progresión no hay semanas', () => {
  const free = { id: 'x', name: 'Libre', items: [] };
  assert.equal(weekStatus(free), null);
  assert.equal(currentWeek(free), null);
});

test('itemTarget: objetivo de la tabla según semana y progresión, o el fijo', () => {
  assert.equal(itemTarget(d1, { prog: 1 }, 1), '3x7');
  assert.equal(itemTarget(d1, { prog: 2 }, 3), '4x7');
  assert.equal(itemTarget(d1, {}, 2), '3x8'); // sin número = progresión 1
  assert.equal(itemTarget(d1, { prog: FIXED, target: '3x10' }, 2), '3x10');
});
