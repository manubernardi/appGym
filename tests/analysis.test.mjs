// Análisis (js/analysis.js): plan, cumplimiento, estancados, balance muscular y fuerza relativa.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';
import { load, routine, session, sets } from './support/fixtures.mjs';

const { state } = await import('../js/store.js');
const {
  planInfo, strengthChange, recordsBetween, targetCompliance, stalledExercises, muscleBalance, relativeStrength,
} = await import('../js/analysis.js');

const at = (date) => mock.timers.enable({ apis: ['Date'], now: new Date(`${date}T12:00:00`) });
afterEach(() => mock.timers.reset());

const d1 = routine('d1', 'Día 1');
const d2 = routine('d2', 'Día 2');
const pb = (target, ...list) => ({ exerciseId: 'pb', target, sets: sets(...list) });

test('planInfo: semanas, días hechos y si terminó', () => {
  at('2026-10-15');
  // Semana 1 = 5 oct. Día 1 hecho en las semanas 1 y 2; Día 2 solo en la 1.
  load(state, {
    routines: [d1, d2],
    sessions: [session('d1', '2026-10-06'), session('d2', '2026-10-08'), session('d1', '2026-10-13')],
  });
  const p = planInfo();
  assert.deepEqual([p.start, p.end, p.weeks, p.week, p.finished], ['2026-10-05', '2026-11-01', 4, 2, false]);
  assert.deepEqual([p.planned, p.done, p.missed], [8, 3, 0]);
  assert.equal(p.sessions.length, 3);
  mock.timers.reset();
  at('2026-11-03');
  assert.equal(planInfo().finished, true);
});

test('planInfo: sin rutinas con progresión no hay plan', () => {
  load(state, { routines: [routine('x', 'Libre', { progression: [] })] });
  assert.equal(planInfo(), null);
});

test('strengthChange y recordsBetween: primera contra última vez', () => {
  const list = [
    session('d1', '2026-10-06', [pb('3x10', [60, 10]), { exerciseId: 'sq', sets: sets([80, 8]) }]),
    session('d1', '2026-10-13', [pb('3x10', [62.5, 10]), { exerciseId: 'sq', sets: sets([75, 8]) }, { exerciseId: 'fx', sets: sets([null, 12]) }]),
  ];
  list[0].entries.push({ exerciseId: 'fx', sets: sets([null, 12]) });
  load(state, { routines: [d1], sessions: list });
  const c = strengthChange(list);
  assert.deepEqual(c.improved.map((r) => r.ex.id), ['pb']);
  assert.deepEqual(c.worse.map((r) => r.ex.id), ['sq']);
  assert.deepEqual(c.same.map((r) => r.ex.id), ['fx']);
  assert.equal(recordsBetween('2026-10-01', '2026-10-31'), 1);
});

test('targetCompliance: series que llegaron al mínimo; las que faltaron no cuentan', () => {
  const list = [
    session('d1', '2026-10-06', [pb('3x8-10', [60, 10], [60, 8], [60, 6])]), // 2 de 3
    session('d1', '2026-10-13', [pb('3x8-10', [60, 12], [60, 12])]), // 2 de 3 (faltó una), 2 fáciles
    session('d1', '2026-10-14', [{ exerciseId: 'ci', target: '1x30', sets: sets([3, 30]) }]), // cardio: no
  ];
  load(state, { sessions: list });
  const c = targetCompliance(list);
  assert.deepEqual([c.planned, c.hit], [6, 4]);
  assert.equal(c.byExercise[0].easy, 2);
});

test('stalledExercises: 3 entrenamientos seguidos sin récord', () => {
  at('2026-10-20');
  load(state, {
    sessions: [
      session('d1', '2026-09-29', [pb('', [60, 8])]),
      session('d1', '2026-10-02', [pb('', [62.5, 8])]), // récord
      session('d1', '2026-10-06', [pb('', [62.5, 7])]),
      session('d1', '2026-10-09', [pb('', [62.5, 8])]),
      session('d1', '2026-10-13', [pb('', [60, 8])]),
      session('d1', '2026-10-06', [{ exerciseId: 'sq', sets: sets([80, 5]) }]),
    ],
  });
  const st = stalledExercises();
  assert.deepEqual(st.map((s) => [s.ex.id, s.sessions, s.since]), [['pb', 3, '2026-10-02']]);
});

test('muscleBalance: secundarios como media serie, por semana', () => {
  at('2026-10-14');
  load(state, {
    sessions: [
      session('d1', '2026-10-01', [pb('', [60, 10], [60, 10])]), // 2 series: Pecho 2, Tríceps 1
      session('d1', '2026-10-08', [pb('', [60, 10], [60, 10])]),
    ],
  });
  const b = muscleBalance(28);
  const g = Object.fromEntries(b.groups.map((x) => [x.group, x.sets]));
  assert.equal(b.weeks, 2); // empezaste hace 14 días
  assert.equal(g['Pecho'], 2);
  assert.equal(g['Tríceps'], 1);
  assert.equal(b.pull, 0);
});

test('relativeStrength: 1RM / peso corporal y nivel en los básicos', () => {
  at('2026-10-14');
  load(state, {
    exercises: [
      { id: 'base-press-banca-plano', name: 'Press banca plano', type: 'barra', primary: 'Pecho' },
      { id: 'cu', name: 'Curl con barra', type: 'barra', primary: 'Bíceps' },
    ],
    sessions: [session('d1', '2026-10-10', [
      { exerciseId: 'base-press-banca-plano', sets: sets([80, 1]) },
      { exerciseId: 'cu', sets: sets([30, 1]) },
    ])],
  });
  assert.equal(relativeStrength().bw, null);
  state.bodyweight = [{ date: '2026-10-10', kg: 80 }];
  const r = relativeStrength();
  assert.equal(r.rows[0].lift, 'Press banca');
  assert.equal(r.rows[0].ratio, 1);
  assert.equal(r.rows[0].level, 2); // Intermedio (desde 1×)
  assert.deepEqual(r.rows[0].next, { name: 'Avanzado', kg: 40 });
  assert.equal(r.rows[1].lift, undefined); // curl: sin referencia
});
