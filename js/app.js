// Punto de entrada: login, navegación por pestañas y re-dibujado al cambiar los datos.

import { state, onChange, isLoaded } from './store.js';
import { watchAuth, login } from './db.js';
import * as train from './views/train.js';
import * as plan from './views/plan.js';
import * as progress from './views/progress.js';
import * as more from './views/more.js';

const VIEWS = { entrenar: train, plan, progreso: progress, mas: more };

const viewEl = document.getElementById('view');
const navEl = document.getElementById('nav');
let current = null; // { name, arg }

function parseHash() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: VIEWS[name] ? name : 'entrenar', arg: arg ? decodeURIComponent(arg) : null };
}

function render(force = false) {
  if (!state.authReady) return;
  if (!state.user) {
    navEl.hidden = true;
    current = null;
    viewEl.innerHTML = `
      <div class="login">
        <div class="login-logo">🏋️</div>
        <h1>Mi Gimnasio</h1>
        <p class="muted">Registrá tus entrenamientos y mirá tu evolución.</p>
        <button class="btn btn-primary btn-lg" id="login-btn">Entrar con Google</button>
      </div>`;
    document.getElementById('login-btn').onclick = login;
    return;
  }
  navEl.hidden = false;
  if (!isLoaded()) {
    viewEl.innerHTML = '<div class="loading">Cargando…</div>';
    return;
  }
  const next = parseHash();
  const changed = force || !current || current.name !== next.name || current.arg !== next.arg;
  navEl.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.view === next.name));
  if (changed) {
    current?.view?.leave?.();
    current = { ...next, view: VIEWS[next.name] };
    current.view.render(freshPage(), next.arg);
    window.scrollTo(0, 0);
  } else if (current.view.onData) {
    current.view.onData(viewEl.firstElementChild, next.arg);
  } else {
    const y = window.scrollY;
    current.view.render(freshPage(), next.arg);
    window.scrollTo(0, y);
  }
}

// Cada dibujado completo usa un elemento nuevo, así no se acumulan listeners.
function freshPage() {
  const page = document.createElement('div');
  page.className = 'page';
  viewEl.replaceChildren(page);
  return page;
}

window.addEventListener('hashchange', () => render());
onChange(() => render());
watchAuth();

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW', err));
}
