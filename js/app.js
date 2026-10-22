// Punto de entrada: login, navegación por pestañas y re-dibujado al cambiar los datos.

import { state, onChange, isLoaded } from './store.js';
import { watchAuth, login, devLogin } from './db.js';
import { DEV, DEV_USERS, DEV_PASSWORD } from './dev.js';
import { esc } from './ui.js';
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
        ${DEV ? `
          <p><strong>Entorno de prueba.</strong> Elegí un usuario:</p>
          <div class="dev-users">
            ${DEV_USERS.map((u) => `
              <button class="list-item dev-user" data-dev-user="${esc(u.email)}">
                <strong>${esc(u.name)}</strong><small class="muted">${esc(u.about)}</small>
              </button>`).join('')}
          </div>` : '<button class="btn btn-primary btn-lg" id="login-btn">Entrar con Google</button>'}
      </div>`;
    document.getElementById('login-btn')?.addEventListener('click', login);
    viewEl.querySelectorAll('[data-dev-user]').forEach((b) => {
      b.onclick = () => devLogin(b.dataset.devUser, DEV_PASSWORD);
    });
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

// En el entorno de prueba no se registra: guardaría el código y no verías los cambios al recargar.
if ('serviceWorker' in navigator && !DEV) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW', err));
}

// Franja fija para no confundir el entorno de prueba con la app real.
// ?como=<email> entra directo con ese usuario de prueba (ej. http://localhost:5050/?como=manu@prueba.com).
if (DEV) {
  document.body.classList.add('dev-env');
  document.body.insertAdjacentHTML('afterbegin', '<div class="dev-ribbon">ENTORNO DE PRUEBA · datos ficticios</div>');
  const como = new URLSearchParams(location.search).get('como');
  if (como) devLogin(como, DEV_PASSWORD);
}
