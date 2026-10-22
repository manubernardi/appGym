// Datos del entorno de prueba (scripts/seed-data.mjs): que sigan mostrando lo que se quiere probar.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';
import { load } from './support/fixtures.mjs';

const { state } = await import('../js/store.js');
const { CATALOG } = await import('../js/data.js');
const { planInfo, stalledExercises } = await import('../js/analysis.js');
const { seedData } = await import('../scripts/seed-data.mjs');
const { DEV_USERS } = await import('../js/dev.js');

const TODAY = '2026-10-21'; // miércoles
afterEach(() => mock.timers.reset());

function loadProfile(profile) {
  mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T12:00:00`) });
  const d = seedData(profile, new Date(`${TODAY}T12:00:00`));
  load(state, { routines: d.routines, sessions: d.sessions, exercises: [...CATALOG, ...d.exercises] });
  state.bodyweight = d.bodyweight;
  return d;
}

test('cada usuario de prueba tiene un perfil con datos', () => {
  for (const u of DEV_USERS) assert.ok(seedData(u.profile), u.email);
});

test('full: plan en la semana 3, con un ejercicio estancado y sin fechas futuras', () => {
  const d = loadProfile('full');
  const p = planInfo();
  assert.equal(p.week, 3);
  assert.equal(p.finished, false);
  assert.ok(stalledExercises().some((s) => s.ex.id === 'base-curl-con-barra'));
  assert.ok(d.sessions.every((s) => s.date <= TODAY));
  assert.ok(d.bodyweight.length > 20);
});

test('finished: el plan terminó hace menos de 3 semanas (aparece el aviso)', () => {
  loadProfile('finished');
  const p = planInfo();
  assert.equal(p.finished, true);
  assert.ok(p.end >= '2026-10-01');
});

test('empty: sin datos', () => {
  const d = seedData('empty');
  assert.equal(d.sessions.length + d.routines.length + d.bodyweight.length, 0);
});

test('los ejercicios de los datos de prueba existen (catálogo o propios)', () => {
  const d = seedData('full', new Date(`${TODAY}T12:00:00`));
  const ids = new Set([...CATALOG.map((e) => e.id), ...d.exercises.map((e) => e.id)]);
  for (const s of d.sessions) for (const en of s.entries) assert.ok(ids.has(en.exerciseId), en.exerciseId);
  for (const r of d.routines) for (const it of r.items) assert.ok(ids.has(it.exerciseId), it.exerciseId);
});
