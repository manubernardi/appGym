// Mapa de músculos (js/bodymap.js): principal fuerte, secundarios claros.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/env.mjs';

const { bodyMapSvg, hasBodyMap } = await import('../js/bodymap.js');

const count = (svg, cls) => (svg.match(new RegExp(`class="${cls}"`, 'g')) || []).length;

test('bodyMapSvg: el principal en bm-2 y los secundarios en bm-1', () => {
  const svg = bodyMapSvg({ primary: 'Cuádriceps', secondary: ['Glúteos'] });
  assert.ok(count(svg, 'bm-2') > 0);
  assert.ok(count(svg, 'bm-1') > 0);
  const solo = bodyMapSvg({ primary: 'Cuádriceps', secondary: [] });
  assert.equal(count(solo, 'bm-1'), 0);
});

test('bodyMapSvg: si un grupo es principal y secundario, se pinta como principal', () => {
  const a = bodyMapSvg({ primary: 'Pecho', secondary: [] });
  const b = bodyMapSvg({ primary: 'Pecho', secondary: ['Pecho'] });
  assert.equal(a, b);
});

test('hasBodyMap: cardio y ejercicios sin grupo no tienen mapa', () => {
  assert.equal(hasBodyMap({ primary: 'Cardio' }), false);
  assert.equal(hasBodyMap(null), false);
  assert.equal(hasBodyMap({ primary: 'Espalda' }), true);
});
