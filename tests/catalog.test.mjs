// Catálogo de ejercicios (js/data.js): el catálogo vive en el código y se une con los documentos del usuario.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG, mergeExercises, isCatalogId, normalize, WEIGHT_TYPES, EXERCISE_GROUPS } from '../js/data.js';

const own = (id, name, extra = {}) => ({ id, name, type: 'barra', primary: 'Pecho', secondary: [], createdAt: 'x', ...extra });

test('catálogo: ids únicos con prefijo base- y datos válidos', () => {
  const ids = CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(CATALOG.map((e) => normalize(e.name))).size, CATALOG.length, 'nombres repetidos');
  for (const e of CATALOG) {
    assert.ok(isCatalogId(e.id) && e.id.length <= 60, e.id);
    assert.ok(e.type in WEIGHT_TYPES, `${e.name}: tipo ${e.type}`);
    assert.ok(EXERCISE_GROUPS.includes(e.primary), `${e.name}: grupo ${e.primary}`);
    for (const g of e.secondary) assert.ok(EXERCISE_GROUPS.includes(g), `${e.name}: secundario ${g}`);
  }
});

test('catálogo: los ids no cambian (los entrenamientos los guardan)', () => {
  // Si este test falla porque cambiaste un id del catálogo: volvé a ponerlo como estaba.
  // Si agregaste uno nuevo, sumalo acá.
  const ids = new Set(CATALOG.map((e) => e.id));
  for (const id of ['base-press-banca-plano', 'base-sentadilla-con-barra', 'base-plancha', 'base-cinta', 'base-extension-de-triceps-sobre-la-cabeza']) {
    assert.ok(ids.has(id), id);
  }
  assert.equal(CATALOG.length, 70);
});

test('usuario nuevo (sin documentos): ve el catálogo completo, ordenado por nombre', () => {
  const ex = mergeExercises([]);
  assert.equal(ex.size, CATALOG.length);
  const names = [...ex.values()].map((e) => e.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'es')));
});

test('ejercicios propios se suman al catálogo', () => {
  const ex = mergeExercises([own('abc123', 'Press Arnold')]);
  assert.equal(ex.size, CATALOG.length + 1);
  assert.equal(ex.get('abc123').name, 'Press Arnold');
});

test('editar uno del catálogo lo reemplaza con la versión del usuario', () => {
  const ex = mergeExercises([own('base-pec-deck', 'Peck deck', { type: 'maquina' })]);
  assert.equal(ex.size, CATALOG.length);
  assert.equal(ex.get('base-pec-deck').name, 'Peck deck');
});

test('ocultar uno del catálogo lo saca de la lista', () => {
  const ex = mergeExercises([{ id: 'base-pec-deck', hidden: true }]);
  assert.equal(ex.size, CATALOG.length - 1);
  assert.ok(!ex.has('base-pec-deck'));
});

test('usuarios de antes (con la lista copiada): ven sus copias y no las del catálogo repetidas', () => {
  // Así quedaron los datos de quien entró antes de este cambio: los 70 con ids al azar.
  const copies = CATALOG.map((e, i) => ({ ...e, id: `rand${i}`, createdAt: 'x' }));
  const ex = mergeExercises(copies);
  assert.equal(ex.size, CATALOG.length);
  assert.ok([...ex.keys()].every((id) => !isCatalogId(id)));
  // Aunque la copia tenga otras mayúsculas o tildes.
  const one = mergeExercises([own('r1', 'PRESS BANCA PLANO'), own('r2', 'Eliptico', { type: 'cardio', primary: 'Cardio' })]);
  assert.ok(!one.has('base-press-banca-plano'));
  assert.ok(!one.has('base-eliptico'));
  assert.equal(one.size, CATALOG.length);
});

test('las reglas aceptan los ids del catálogo', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const max = Number(rules.match(/id\.size\(\) <= (\d+)/)[1]);
  assert.ok(Math.max(...CATALOG.map((e) => e.id.length)) <= max);
});
