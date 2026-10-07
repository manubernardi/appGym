// Pestaña "Entrenar": elegir rutina, cargar series (kg y reps) y ver lo que hiciste la última vez.
// #entrenar           -> entrenamiento en curso o inicio
// #entrenar/<id>      -> editar un entrenamiento guardado (desde el historial)

import { WEIGHT_TYPES } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, today, fmtDate, parseNum, openModal, confirmDialog, toast } from '../ui.js';
import { lastTime, fmtSets, validSets } from '../stats.js';
import { openExercisePicker } from './exercises.js';

let editing = null; // { session, fromHistory }
let saveTimer = null;

// "3x10", "4 X 8-12" -> 3 / 4. Si no se entiende, null.
export function parseSeries(target) {
  const m = /^\s*(\d+)\s*[x×*]/i.exec(target || '');
  return m ? Math.min(Number(m[1]), 12) : null;
}

function activeSession() {
  return state.sessions.find((s) => !s.finished);
}

export function render(container, arg) {
  flush();
  if (arg) {
    const s = state.sessions.find((x) => x.id === arg);
    if (!s) {
      editing = null;
      container.innerHTML = '<p class="muted center">No se encontró el entrenamiento.</p>';
      return;
    }
    editing = { session: structuredClone(s), fromHistory: true };
    renderEditor(container);
    return;
  }
  const active = activeSession();
  if (active) {
    if (editing?.session.id !== active.id) editing = { session: structuredClone(active), fromHistory: false };
    renderEditor(container);
  } else {
    editing = null;
    renderHome(container);
  }
}

// Cambios en los datos: si se está editando, se mantiene la copia local
// (para no perder lo que se está escribiendo).
export function onData(container, arg) {
  if (editing && state.sessions.some((s) => s.id === editing.session.id)) return;
  if (editing && !arg && !editing.fromHistory) {
    // Todavía no llegó a la caché local, o se borró desde otro dispositivo.
    return;
  }
  render(container, arg);
}

export function leave() {
  flush();
  editing = null;
}

// --- Inicio ------------------------------------------------------------

function renderHome(container) {
  const routines = state.routines.filter((r) => !r.archived);
  const recent = state.sessions.slice(0, 5);
  container.innerHTML = `
    <h1>¿Qué entrenás hoy?</h1>
    ${routines.length ? '' : `
      <div class="card empty">
        <p>Todavía no cargaste tu plan.</p>
        <a class="btn btn-primary" href="#plan">Cargar plan del mes</a>
      </div>`}
    <div class="routine-buttons">
      ${routines.map((r) => `
        <button class="routine-btn" data-routine="${r.id}">
          <strong>${esc(r.name)}</strong>
          <small>${(r.items || []).length} ejercicios${lastDoneLabel(r.id)}</small>
        </button>`).join('')}
      <button class="routine-btn routine-free" data-free>
        <strong>Entrenamiento libre</strong>
        <small>Agregás los ejercicios sobre la marcha</small>
      </button>
    </div>
    ${recent.length ? `
      <h2 class="section-title">Últimos entrenamientos</h2>
      <div class="card list">
        ${recent.map((s) => `
          <a class="list-item" href="#entrenar/${s.id}">
            <span>${esc(s.routineName || 'Entrenamiento')}</span>
            <small class="muted">${fmtDate(s.date, true)} · ${(s.entries || []).length} ej.</small>
          </a>`).join('')}
      </div>` : ''}`;

  container.querySelectorAll('[data-routine]').forEach((b) => {
    b.onclick = () => start(container, state.routines.find((r) => r.id === b.dataset.routine));
  });
  container.querySelector('[data-free]').onclick = () => start(container, null);
}

function lastDoneLabel(routineId) {
  const s = state.sessions.find((x) => x.routineId === routineId);
  return s ? ` · última: ${fmtDate(s.date)}` : '';
}

function start(container, routine) {
  const entries = (routine?.items || [])
    .filter((it) => state.exercises.has(it.exerciseId))
    .map((it) => newEntry(state.exercises.get(it.exerciseId), it.target));
  const session = {
    date: today(),
    routineId: routine?.id || null,
    routineName: routine?.name || 'Entrenamiento libre',
    finished: false,
    createdAt: new Date().toISOString(),
    entries,
  };
  session.id = save('sessions', session);
  editing = { session, fromHistory: false };
  renderEditor(container);
  window.scrollTo(0, 0);
}

function newEntry(ex, target = '') {
  const n = parseSeries(target) || 1;
  return {
    exerciseId: ex.id,
    name: ex.name,
    target: target || '',
    sets: Array.from({ length: n }, () => ({ w: null, r: null })),
  };
}

// --- Editor de sesión --------------------------------------------------

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 600);
}

function flush() {
  if (!saveTimer || !editing) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  save('sessions', editing.session);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

function renderEditor(container) {
  const s = editing.session;
  const hist = editing.fromHistory;
  container.innerHTML = `
    <div class="session-head">
      ${hist ? '<button class="icon-btn" data-back aria-label="Volver">←</button>' : ''}
      <div class="grow">
        <h1>${esc(s.routineName || 'Entrenamiento')}</h1>
        <input class="input date-input" type="date" value="${s.date}" data-date>
      </div>
      ${!hist ? '<span class="badge live">En curso</span>' : ''}
    </div>
    <div class="entries">
      ${s.entries.length ? s.entries.map((en, i) => entryCard(en, i, s.id)).join('')
        : '<p class="muted center">Agregá el primer ejercicio.</p>'}
    </div>
    <button class="btn btn-block" data-add>+ Agregar ejercicio</button>
    <div class="session-actions">
      ${hist
        ? '<button class="btn btn-primary btn-block" data-done>Guardar</button>'
        : '<button class="btn btn-primary btn-block btn-lg" data-finish>Terminar entrenamiento</button>'}
      <button class="btn btn-ghost-danger btn-block" data-discard>${hist ? 'Borrar entrenamiento' : 'Descartar entrenamiento'}</button>
    </div>`;

  container.querySelector('[data-date]').onchange = (e) => {
    if (!e.target.value) return;
    s.date = e.target.value;
    scheduleSave();
  };
  container.querySelector('[data-back]')?.addEventListener('click', () => history.back());
  container.querySelector('[data-add]').onclick = () => openExercisePicker((ex) => {
    s.entries.push(newEntry(ex));
    scheduleSave();
    renderEditor(container);
    const cards = container.querySelectorAll('.entry');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  container.querySelector('[data-finish]')?.addEventListener('click', () => finish(container));
  container.querySelector('[data-done]')?.addEventListener('click', () => {
    cleanup(s);
    saveTimer = 1; // fuerza el guardado
    flush();
    history.back();
  });
  container.querySelector('[data-discard]').onclick = async () => {
    const msg = hist ? '¿Borrar este entrenamiento? No se puede deshacer.' : '¿Descartar el entrenamiento en curso? Se pierde lo cargado.';
    if (!(await confirmDialog(msg, hist ? 'Borrar' : 'Descartar', true))) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    remove('sessions', s.id);
    editing = null;
    if (hist) history.back();
    else renderHome(container);
  };

  container.querySelector('.entries').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-f]');
    if (!inp) return;
    const { i, j, f } = inp.dataset;
    const val = parseNum(inp.value);
    s.entries[i].sets[j][f] = f === 'r' && val !== null ? Math.round(val) : val;
    scheduleSave();
  });
  container.querySelector('.entries').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.entry');
    const i = Number(card?.dataset.i);
    if (btn.hasAttribute('data-add-set')) {
      const sets = s.entries[i].sets;
      sets.push({ w: sets.length ? sets[sets.length - 1].w : null, r: null });
      scheduleSave();
      renderEditor(container);
      const rows = container.querySelectorAll(`.entry[data-i="${i}"] [data-f="r"]`);
      rows[rows.length - 1]?.focus();
    } else if (btn.hasAttribute('data-del-set')) {
      s.entries[i].sets.splice(Number(btn.dataset.j), 1);
      scheduleSave();
      renderEditor(container);
    } else if (btn.hasAttribute('data-menu')) {
      entryMenu(container, i);
    }
  });
}

function entryCard(en, i, sessionId) {
  const ex = state.exercises.get(en.exerciseId);
  const type = WEIGHT_TYPES[ex?.type] || WEIGHT_TYPES.maquina;
  const last = lastTime(en.exerciseId, sessionId);
  return `
    <section class="card entry" data-i="${i}">
      <div class="entry-head">
        <div class="grow">
          <h2>${esc(ex?.name || en.name)}</h2>
          ${en.target ? `<span class="badge">${esc(en.target)}</span>` : ''}
        </div>
        <button class="icon-btn" data-menu aria-label="Opciones">⋯</button>
      </div>
      <p class="last">${last
        ? `<span class="muted">Última vez (${fmtDate(last.date)}):</span> ${esc(fmtSets(last.sets, ex))}`
        : '<span class="muted">Primera vez que lo registrás</span>'}</p>
      <div class="sets">
        <div class="set-row set-header">
          <span>#</span><span>${esc(type.short)}</span><span>Reps</span><span></span>
        </div>
        ${en.sets.map((st, j) => `
          <div class="set-row">
            <span class="set-num">${j + 1}</span>
            <input class="input num" data-i="${i}" data-j="${j}" data-f="w" inputmode="decimal"
              value="${st.w ?? ''}" placeholder="${last?.sets[j]?.w ?? (type.bodyweight ? '0' : '')}" aria-label="Peso serie ${j + 1}">
            <input class="input num" data-i="${i}" data-j="${j}" data-f="r" inputmode="numeric"
              value="${st.r ?? ''}" placeholder="${last?.sets[j]?.r ?? ''}" aria-label="Reps serie ${j + 1}">
            <button class="icon-btn small" data-del-set data-j="${j}" aria-label="Borrar serie">✕</button>
          </div>`).join('')}
      </div>
      <button class="btn btn-small" data-add-set>+ Serie</button>
    </section>`;
}

function entryMenu(container, i) {
  const s = editing.session;
  const en = s.entries[i];
  openModal(en.name, (body, close) => {
    body.innerHTML = `
      <label>Objetivo (ej. 3x10)
        <input class="input" data-target value="${esc(en.target || '')}">
      </label>
      <div class="menu-list">
        <button class="btn btn-block" data-up ${i === 0 ? 'disabled' : ''}>↑ Mover arriba</button>
        <button class="btn btn-block" data-down ${i === s.entries.length - 1 ? 'disabled' : ''}>↓ Mover abajo</button>
        <button class="btn btn-block" data-swap>Cambiar por otro ejercicio</button>
        <button class="btn btn-ghost-danger btn-block" data-remove>Quitar ejercicio</button>
      </div>`;
    const done = () => { close(); scheduleSave(); renderEditor(container); };
    body.querySelector('[data-target]').onchange = (e) => { en.target = e.target.value.trim(); scheduleSave(); };
    body.querySelector('[data-up]').onclick = () => { s.entries.splice(i - 1, 0, s.entries.splice(i, 1)[0]); done(); };
    body.querySelector('[data-down]').onclick = () => { s.entries.splice(i + 1, 0, s.entries.splice(i, 1)[0]); done(); };
    body.querySelector('[data-swap]').onclick = () => {
      close();
      openExercisePicker((ex) => {
        en.exerciseId = ex.id;
        en.name = ex.name;
        scheduleSave();
        renderEditor(container);
      });
    };
    body.querySelector('[data-remove]').onclick = () => { s.entries.splice(i, 1); done(); };
  }, () => renderEditor(container));
}

// Saca series vacías y ejercicios sin series.
function cleanup(s) {
  s.entries.forEach((en) => { en.sets = validSets(en).map((x) => ({ w: x.w ?? null, r: x.r })); });
  s.entries = s.entries.filter((en) => en.sets.length);
}

async function finish(container) {
  const s = editing.session;
  const empty = s.entries.every((en) => !validSets(en).length);
  if (empty) {
    toast('No cargaste ninguna serie todavía.');
    return;
  }
  if (!(await confirmDialog('¿Terminar el entrenamiento? Las series vacías se descartan.', 'Terminar'))) return;
  cleanup(s);
  s.finished = true;
  saveTimer = 1;
  flush();
  editing = null;
  toast('¡Entrenamiento guardado! 💪');
  renderHome(container);
}
