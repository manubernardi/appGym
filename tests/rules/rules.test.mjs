// Reglas de Firestore (firestore.rules) contra el emulador.
// Correr con: npm run test:rules  (levanta el emulador, hace falta Java).
// Los documentos de ejemplo tienen la misma forma que guarda la app (ver js/views/*.js).

import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-appgym',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const me = () => env.authenticatedContext('ana').firestore();
const ref = (db, path) => doc(db, `users/ana/${path}`);
const big = (n) => 'x'.repeat(n);
const many = (n, item = {}) => Array.from({ length: n }, () => item);

// Como los guarda la app.
const EXERCISE = { name: 'Press banca plano', type: 'barra', primary: 'Pecho', secondary: ['Tríceps', 'Hombros'], createdAt: '2026-10-07T20:00:00.000Z' };
const ROUTINE = {
  name: 'Día 1', archived: false, createdAt: '2026-10-08T10:00:00.000Z',
  items: [{ exerciseId: 'abc', target: '', prog: 1 }, { exerciseId: 'def', target: '3x10', prog: 0 }],
  progression: [{ targets: ['3x8', '4x6'] }, { targets: ['3x10', '4x8'] }],
};
const SESSION = {
  date: '2026-10-15', routineId: 'r1', routineName: 'Día 1', week: 2, finished: false,
  createdAt: '2026-10-15T18:00:00.000Z', startedAt: '2026-10-15T18:00:00.000Z',
  entries: [{ exerciseId: 'abc', name: 'Press banca plano', target: '3x8', circuit: false, sets: [{ w: 40, r: 8 }, { w: null, r: null }] }],
};
const BODYWEIGHT = { date: '2026-10-15', kg: 79.5, createdAt: '2026-10-15T08:00:00.000Z' };

// --- Lo que hace la app tiene que andar ---------------------------------

test('la app puede guardar, leer y borrar sus datos', async () => {
  const db = me();
  await assertSucceeds(setDoc(doc(db, 'users/ana'), { seeded: true, cardioSeeded: true, createdAt: '2026-10-07T20:00:00.000Z' }));
  await assertSucceeds(setDoc(doc(db, 'users/ana'), { cardioSeeded: true }, { merge: true }));
  await assertSucceeds(setDoc(ref(db, 'exercises/e1'), EXERCISE));
  await assertSucceeds(setDoc(ref(db, 'exercises/e2'), { name: 'Cinta', type: 'cardio', primary: 'Cardio', secondary: [], createdAt: 'x' }));
  await assertSucceeds(setDoc(ref(db, 'routines/r1'), ROUTINE));
  await assertSucceeds(setDoc(ref(db, 'routines/r2'), { name: 'Copia', items: [], archived: false, createdAt: 'x' })); // sin tabla
  await assertSucceeds(setDoc(ref(db, 'sessions/s1'), SESSION));
  await assertSucceeds(setDoc(ref(db, 'sessions/s1'), { ...SESSION, finished: true, duration: 3120 }));
  await assertSucceeds(setDoc(ref(db, 'sessions/s2'), { ...SESSION, routineId: null, routineName: 'Entrenamiento libre', week: null }));
  await assertSucceeds(setDoc(ref(db, 'sessions/s3'), { date: '2026-10-01', entries: [] })); // entrenamientos viejos con menos campos
  await assertSucceeds(setDoc(ref(db, 'bodyweight/b1'), BODYWEIGHT));
  await assertSucceeds(getDoc(ref(db, 'sessions/s1')));
  await assertSucceeds(deleteDoc(ref(db, 'sessions/s1')));
  await assertSucceeds(deleteDoc(ref(db, 'bodyweight/b1')));
});

test('los ids automáticos de Firestore entran', async () => {
  const db = me();
  await assertSucceeds(setDoc(doc(collection(db, 'users/ana/sessions')), SESSION));
});

// --- Otros usuarios -----------------------------------------------------

test('nadie puede leer ni escribir los datos de otro', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/ana/sessions/s1'), SESSION));
  const other = env.authenticatedContext('beto').firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(other, 'users/ana/sessions/s1')));
  await assertFails(setDoc(doc(other, 'users/ana/sessions/s2'), SESSION));
  await assertFails(deleteDoc(doc(other, 'users/ana/sessions/s1')));
  await assertFails(getDoc(doc(anon, 'users/ana/sessions/s1')));
});

// --- Validaciones -------------------------------------------------------

test('no se pueden inventar colecciones ni anidar más', async () => {
  const db = me();
  await assertFails(setDoc(ref(db, 'basura/x'), { a: 1 }));
  await assertFails(setDoc(ref(db, 'sessions/s1/mas/x'), { a: 1 }));
  await assertFails(setDoc(doc(db, 'otra/x'), { a: 1 }));
});

test('documento del usuario: solo sus marcas', async () => {
  await assertFails(setDoc(doc(me(), 'users/ana'), { seeded: true, basura: big(1000) }));
  await assertFails(setDoc(doc(me(), 'users/ana'), { seeded: 'si' }));
});

test('ejercicios: nombre, tipo y grupos válidos', async () => {
  const db = me();
  await assertFails(setDoc(ref(db, 'exercises/e1'), { ...EXERCISE, name: '' }));
  await assertFails(setDoc(ref(db, 'exercises/e1'), { ...EXERCISE, name: big(101) }));
  await assertFails(setDoc(ref(db, 'exercises/e1'), { ...EXERCISE, type: 'cohete' }));
  await assertFails(setDoc(ref(db, 'exercises/e1'), { ...EXERCISE, secondary: many(13, 'Pecho') }));
  await assertFails(setDoc(ref(db, 'exercises/e1'), { type: 'barra', primary: 'Pecho' })); // sin nombre
});

test('rutinas: límites de ejercicios y semanas', async () => {
  const db = me();
  await assertFails(setDoc(ref(db, 'routines/r1'), { ...ROUTINE, items: many(61) }));
  await assertFails(setDoc(ref(db, 'routines/r1'), { ...ROUTINE, progression: many(31) }));
  await assertFails(setDoc(ref(db, 'routines/r1'), { ...ROUTINE, archived: 'no' }));
  await assertFails(setDoc(ref(db, 'routines/r1'), { ...ROUTINE, name: big(101) }));
});

test('entrenamientos: fecha, ejercicios y duración válidos', async () => {
  const db = me();
  await assertFails(setDoc(ref(db, 'sessions/s1'), { ...SESSION, date: 'ayer' }));
  await assertFails(setDoc(ref(db, 'sessions/s1'), { ...SESSION, entries: many(61) }));
  await assertFails(setDoc(ref(db, 'sessions/s1'), { ...SESSION, duration: -5 }));
  await assertFails(setDoc(ref(db, 'sessions/s1'), { ...SESSION, week: 'dos' }));
  const { entries: _e, ...noEntries } = SESSION;
  await assertFails(setDoc(ref(db, 'sessions/s1'), noEntries));
});

test('peso corporal: número razonable', async () => {
  const db = me();
  await assertFails(setDoc(ref(db, 'bodyweight/b1'), { ...BODYWEIGHT, kg: 5000 }));
  await assertFails(setDoc(ref(db, 'bodyweight/b1'), { ...BODYWEIGHT, kg: '80' }));
});

test('no se pueden agregar campos sin límite', async () => {
  const extra = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, big(100)]));
  await assertFails(setDoc(ref(me(), 'sessions/s1'), { ...SESSION, ...extra }));
  await assertFails(setDoc(ref(me(), 'bodyweight/b1'), { ...BODYWEIGHT, notas: 'x', otra: 'y' }));
});
