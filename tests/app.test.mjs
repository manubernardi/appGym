// Prueba de humo: carga todos los módulos y dibuja cada pantalla con datos de ejemplo.
// Atrapa errores de sintaxis, imports mal escritos y excepciones al renderizar
// (lo que deja la app trabada en "cargando").

import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import './support/env.mjs';
import { FakeElement } from './support/env.mjs';
import { load, routine, session, sets } from './support/fixtures.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const jsFiles = (dir) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.js')).map((f) => `${dir}${f}`);
const APP_JS = [...jsFiles('js/'), ...jsFiles('js/views/')];

const { state } = await import('../js/store.js');

before(() => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T12:00:00') });
  const d1 = routine('d1', 'Día 1', {
    items: [{ exerciseId: 'ci', prog: 0, target: '10 min' }, { exerciseId: 'pb', prog: 1 }, { exerciseId: 'pm', prog: 2 }, { exerciseId: 'pl', prog: 0, target: '3x30' }],
  });
  const d2 = routine('d2', 'Día 2', { items: [{ exerciseId: 'sq', prog: 1 }] });
  const free = { id: 'r3', name: 'Sin tabla', createdAt: '2026-10-01T10:00:00.000Z', items: [{ exerciseId: 'fx', target: '3x12' }] };
  load(state, {
    routines: [d1, d2, free, routine('old', 'Viejo', { archived: true })],
    sessions: [
      session('d1', '2026-10-06', [{ exerciseId: 'pb', sets: sets([40, 10]) }, { exerciseId: 'ci', sets: sets([2, 10]) }], { duration: 3000 }),
      session('d1', '2026-10-13', [{ exerciseId: 'pb', sets: sets([45, 8]) }, { exerciseId: 'pl', sets: sets([null, 30]) }]),
      session('d2', '2026-10-14', [{ exerciseId: 'sq', sets: sets([60, 8]) }], { finished: false }),
    ],
  });
  state.bodyweight = [{ id: 'b1', date: '2026-10-01', kg: 80 }, { id: 'b2', date: '2026-10-14', kg: 79.5 }];
});
after(() => mock.timers.reset());

test('todos los módulos cargan', async () => {
  for (const file of APP_JS) await import(new URL(file, root).href);
});

for (const name of ['train', 'plan', 'more']) {
  test(`pantalla ${name}`, async () => {
    const view = await import(`../js/views/${name}.js`);
    const page = new FakeElement();
    view.render(page);
    assert.ok(page.innerHTML.length > 0);
  });
}

test('Plan muestra la semana y lo que quedó sin entrenar', async () => {
  const page = new FakeElement();
  (await import('../js/views/plan.js')).render(page);
  assert.match(page.innerHTML, /Semana <strong>2<\/strong> de 4/);
  assert.match(page.innerHTML, /sin entrenar: 1/); // Día 2 no se terminó en la semana 1
});

test('Progreso: todas las pestañas', async () => {
  const progress = await import('../js/views/progress.js');
  const page = new FakeElement();
  progress.render(page);
  const tabs = page.querySelectorAll('[data-tab]').map((b) => b.dataset.tab);
  assert.deepEqual(tabs, ['mes', 'semana', 'ejercicio', 'records', 'peso']);
  for (const tab of tabs) {
    page.querySelectorAll('[data-tab]').find((b) => b.dataset.tab === tab).onclick();
    assert.match(page.innerHTML, new RegExp(`tab active" data-tab="${tab}"`));
    assert.ok(page.querySelector('.tab-body').innerHTML.length > 0, `pestaña ${tab} vacía`);
  }
  progress.leave();
});

test('sw.js guarda en caché todos los archivos de la app', () => {
  const sw = read('sw.js');
  for (const file of [...APP_JS, 'index.html', 'css/styles.css', 'manifest.webmanifest']) {
    assert.ok(sw.includes(`'./${file}'`), `falta './${file}' en APP_FILES de sw.js`);
  }
});

test('index.html carga app.js como módulo', () => {
  assert.match(read('index.html'), /<script type="module" src="(\.\/)?js\/app\.js"><\/script>/);
});
