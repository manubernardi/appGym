// Entorno mínimo para cargar la app en Node: Firebase falso y un DOM de mentira.
// Importarlo antes que cualquier módulo de js/.

import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

// Objeto que acepta cualquier cosa: propiedades, llamadas y asignaciones. Para lo que los tests no miran.
export function anything() {
  return new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      if (k === 'then') return undefined; // que no parezca una promesa
      return anything();
    },
    apply: () => anything(),
    construct: () => anything(),
    set: () => true,
  });
}

// Elemento falso que guarda su innerHTML. querySelectorAll('[data-x]') devuelve un elemento por cada
// atributo data-x del HTML (con su dataset), así los tests pueden tocar botones como tabs o flechas.
export class FakeElement {
  constructor() {
    this.innerHTML = '';
    this.dataset = {};
    this.children = new Map();
    this.found = new Map();
    return new Proxy(this, {
      get: (t, k) => (k in t ? t[k] : anything()),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  }

  // Siempre el mismo hijo para el mismo selector (ej. '.tab-body').
  querySelector(sel) {
    if (!this.children.has(sel)) this.children.set(sel, new FakeElement());
    return this.children.get(sel);
  }

  // Mientras el HTML no cambie devuelve los mismos elementos, así un onclick que puso la app se puede tocar después.
  querySelectorAll(sel) {
    const m = sel.match(/^\[data-([\w-]+)\]$/);
    if (!m) return [];
    const cached = this.found.get(sel);
    if (cached?.html === this.innerHTML) return cached.list;
    const key = m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const list = [...this.innerHTML.matchAll(new RegExp(`data-${m[1]}(?:="([^"]*)")?`, 'g'))].map(([, v]) => {
      const el = new FakeElement();
      el.dataset[key] = v ?? '';
      return el;
    });
    this.found.set(sel, { html: this.innerHTML, list });
    return list;
  }

  addEventListener() {}
}

globalThis.document = anything();
globalThis.window = anything();
globalThis.localStorage = anything();
globalThis.getComputedStyle = () => anything();
