// Pestaña "Entrenar": elegir rutina, cargar series (kg y reps) y ver lo que hiciste la última vez.
// El entrenamiento se recorre por páginas: un ejercicio de fuerza por página (la zona media y el cardio seguidos van juntos)
// y al final el resumen. Mientras está en curso corre un cronómetro; al terminar se guarda la duración (segundos).
// #entrenar           -> entrenamiento en curso o inicio
// #entrenar/<id>      -> editar un entrenamiento guardado (desde el historial)

import { WEIGHT_TYPES, CATEGORIES, exerciseCategory } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, today, fmtDate, parseNum, openModal, confirmDialog, toast, fmtClock, fmtDuration } from '../ui.js';
import { lastTime, fmtSets, validSets } from '../stats.js';
import { openExercisePicker } from './exercises.js';
import { FIXED, hasProgression, itemProg, currentWeek, itemTarget, categoryRuns, itemsLabel } from '../progression.js';

let editing = null; // { session, fromHistory }
let saveTimer = null;
let page = 0;           // página visible del editor
let pageSession = null; // sesión a la que corresponde `page` (al cambiar de sesión vuelve a la primera)
let clockTimer = null;
const STALE_HOURS = 6; // un entrenamiento abierto más tiempo que esto se cierra solo
const closed = new Set(); // ids ya cerrados (hasta que llegue la actualización de Firestore)

// "3x10", "4 X 8-12" -> 3 / 4. Si no se entiende, null.
export function parseSeries(target) {
  const m = /^\s*(\d+)\s*[x×*]/i.exec(target || '');
  return m ? Math.min(Number(m[1]), 12) : null;
}

function activeSession() {
  closeStale();
  return state.sessions.find((s) => !s.finished && !closed.has(s.id));
}

// Un entrenamiento que quedó abierto (empezaste una rutina y no la terminaste ni la descartaste)
// hacía que la app abriera siempre en "En curso". Pasadas unas horas se cierra solo:
// si tiene series se guarda como terminado, y si está vacío se borra.
function closeStale() {
  const limit = Date.now() - STALE_HOURS * 3600e3;
  state.sessions
    .filter((s) => !s.finished && !closed.has(s.id) && Date.parse(s.createdAt || s.date) < limit)
    .forEach((old) => {
      closed.add(old.id);
      const mine = editing?.session.id === old.id;
      const s = structuredClone(mine ? editing.session : old);
      if (mine) { clearTimeout(saveTimer); saveTimer = null; editing = null; }
      cleanup(s);
      if (s.entries.length) {
        save('sessions', { ...s, finished: true });
        toast(`Se guardó el entrenamiento del ${fmtDate(s.date)} que había quedado abierto.`);
      } else {
        remove('sessions', s.id);
      }
    });
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
  stopClock();
  editing = null;
}

// --- Cronómetro ----------------------------------------------------------

// Actualiza cada segundo los [data-clock] con el tiempo desde que empezó el entrenamiento.
// Se frena solo cuando ya no hay ninguno en pantalla.
function startClock(session) {
  stopClock();
  const from = Date.parse(session.startedAt || session.createdAt);
  const tick = () => {
    const els = document.querySelectorAll('[data-clock]');
    if (!els.length) { stopClock(); return; }
    const text = fmtClock(Date.now() - from);
    els.forEach((el) => { el.textContent = text; });
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
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
          <small>${weekLabel(r)}${itemsLabel(r)}${lastDoneLabel(r.id)}</small>
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
            <small class="muted">${fmtDate(s.date, true)}${s.duration ? ` · ⏱ ${fmtDuration(s.duration)}` : ''} · ${(s.entries || []).length} ej.</small>
          </a>`).join('')}
      </div>` : ''}`;

  container.querySelectorAll('[data-routine]').forEach((b) => {
    b.onclick = () => start(container, state.routines.find((r) => r.id === b.dataset.routine));
  });
  container.querySelector('[data-free]').onclick = () => start(container, null);
}

function weekLabel(routine) {
  const w = currentWeek(routine);
  return w ? `Semana ${w} de ${routine.progression.length} · ` : '';
}

function lastDoneLabel(routineId) {
  const s = state.sessions.find((x) => x.routineId === routineId);
  return s ? ` · última: ${fmtDate(s.date)}` : '';
}

function start(container, routine) {
  const week = currentWeek(routine);
  const entries = (routine?.items || [])
    .filter((it) => state.exercises.has(it.exerciseId))
    .map((it) => ({
      ...newEntry(state.exercises.get(it.exerciseId), itemTarget(routine, it, week)),
      // Con objetivo fijo dentro de un plan con progresión = zona media: va en la misma página que los otros.
      circuit: hasProgression(routine) && itemProg(it) === FIXED,
    }));
  const session = {
    date: today(),
    routineId: routine?.id || null,
    routineName: routine?.name || 'Entrenamiento libre',
    week,
    finished: false,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
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

// Categoría del ejercicio: cardio por su grupo; zona media si en el plan tiene objetivo Fijo (marca `circuit`)
// o si su grupo principal es Abdominales (así también se juntan los de rutinas cargadas antes de que existiera "Fijo").
function entryCategory(en) {
  const cat = exerciseCategory(state.exercises.get(en.exerciseId));
  return cat === 'fuerza' && en.circuit ? 'core' : cat;
}

// Fuerza: un ejercicio por página. Zona media y cardio: los seguidos, en una misma página.
function buildPages(entries) {
  return categoryRuns(entries, entryCategory)
    .flatMap((run) => (run.cat === 'fuerza' ? run.idx.map((i) => ({ cat: run.cat, idx: [i] })) : [run]));
}

const pageBanner = (p) => (p.cat === 'core'
  ? `<div class="cat-banner cat-core"><strong>Zona media</strong>
      <small>Circuito de ${p.idx.length} ejercicio${p.idx.length === 1 ? '' : 's'} · hacelos seguidos</small></div>`
  : p.cat === 'cardio'
    ? `<div class="cat-banner cat-cardio"><strong>Cardio</strong><small>Anotá los minutos y, si querés, los km</small></div>`
    : '<p class="cat-kicker">Fuerza</p>');

const entryDone = (en) => en.sets.length > 0 && validSets(en).length === en.sets.length;

// `opts.entry`: muestra la página de ese ejercicio (después de agregarlo, moverlo o cambiarlo).
function renderEditor(container, opts = {}) {
  const s = editing.session;
  const hist = editing.fromHistory;
  const pages = buildPages(s.entries);
  const pageOf = (i) => pages.findIndex((p) => p.idx.includes(i));
  if (pageSession !== s.id) { page = 0; pageSession = s.id; }
  if (opts.entry != null && pageOf(opts.entry) >= 0) page = pageOf(opts.entry);
  page = Math.min(Math.max(page, 0), pages.length); // pages.length = página del resumen

  container.innerHTML = `
    <div class="session-head">
      ${hist ? '<button class="icon-btn" data-back aria-label="Volver">←</button>' : ''}
      <div class="grow">
        <h1>${esc(s.routineName || 'Entrenamiento')}${s.week ? ` <small class="muted">· semana ${s.week}</small>` : ''}</h1>
        <input class="input date-input" type="date" value="${s.date}" data-date>
      </div>
      ${!hist ? '<span class="badge live">En curso</span>' : s.duration ? `<span class="badge">⏱ ${fmtDuration(s.duration)}</span>` : ''}
    </div>
    <div class="steps">
      ${pages.map((p, k) => `<button class="step cat-${p.cat} ${p.idx.every((i) => entryDone(s.entries[i])) ? 'done' : ''}" data-go="${k}"
        aria-label="${esc(p.cat === 'fuerza' ? s.entries[p.idx[0]].name : CATEGORIES[p.cat])}"></button>`).join('')}
      <button class="step step-end" data-go="${pages.length}" aria-label="Resumen"></button>
    </div>
    <div class="pager">
      ${pages.map((p, k) => `
        <div class="pager-page" data-page="${k}">
          ${pageBanner(p)}
          ${p.idx.map((i) => entryCard(s.entries[i], i, s.id)).join('')}
        </div>`).join('')}
      <div class="pager-page" data-page="${pages.length}">
        ${s.entries.length ? `
          <section class="card list">
            <h2 class="card-title">Resumen</h2>
            ${s.entries.map((en, i) => {
              const cat = entryCategory(en);
              return `
              <button class="list-item row cat-${cat}" data-go="${pageOf(i)}">
                <span>${esc(state.exercises.get(en.exerciseId)?.name || en.name)}${cat === 'fuerza' ? '' : ` <span class="cat-tag cat-${cat}">${CATEGORIES[cat]}</span>`}</span>
                <small class="${entryDone(en) ? 'good' : 'muted'}">${validSets(en).length}/${en.sets.length} series</small>
              </button>`;
            }).join('')}
          </section>` : '<p class="muted center">Agregá el primer ejercicio.</p>'}
        ${hist ? `
          <label class="duration-field">Duración (minutos)
            <input class="input" data-duration inputmode="numeric" value="${s.duration ? Math.round(s.duration / 60) : ''}" placeholder="Sin registrar">
          </label>` : ''}
        <button class="btn btn-block" data-add>+ Agregar ejercicio</button>
        <div class="session-actions">
          ${hist
            ? '<button class="btn btn-primary btn-block" data-done>Guardar</button>'
            : '<button class="btn btn-primary btn-block btn-lg" data-finish>Terminar entrenamiento</button>'}
          <button class="btn btn-ghost-danger btn-block" data-discard>${hist ? 'Borrar entrenamiento' : 'Descartar entrenamiento'}</button>
        </div>
      </div>
    </div>
    <div class="pager-nav">
      <button class="btn" data-prev>← Anterior</button>
      <span class="pager-count">
        ${hist ? '' : '<strong class="clock" data-clock aria-label="Tiempo de entrenamiento"></strong>'}
        <small data-count></small>
      </span>
      <button class="btn btn-primary" data-next></button>
    </div>`;

  const pager = container.querySelector('.pager');
  const pageEls = pager.querySelectorAll('.pager-page');
  const steps = container.querySelectorAll('.step');
  const prev = container.querySelector('[data-prev]');
  const next = container.querySelector('[data-next]');
  const count = container.querySelector('[data-count]');

  const updateNav = () => {
    steps.forEach((b, k) => b.classList.toggle('current', k === page));
    prev.disabled = page === 0;
    next.hidden = page === pages.length;
    next.textContent = page === pages.length - 1 ? 'Resumen →' : 'Siguiente →';
    count.textContent = page < pages.length ? `${page + 1} de ${pages.length}` : 'Resumen';
    // El alto sigue a la página visible, así no queda espacio vacío debajo de las páginas cortas.
    pager.style.height = pageEls[page].offsetHeight + 'px';
  };
  // Si bajaste en una página larga, al cambiar de página se vuelve al principio.
  const showTop = () => {
    const top = container.querySelector('.steps').getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 8, behavior: 'smooth' });
  };
  const goTo = (k) => {
    page = k;
    pager.scrollTo({ left: k * pager.clientWidth, behavior: 'smooth' });
    updateNav();
    showTop();
  };
  pager.scrollLeft = page * pager.clientWidth;
  updateNav();
  if (!hist) startClock(s);
  pager.addEventListener('scroll', () => {
    const k = Math.round(pager.scrollLeft / pager.clientWidth);
    if (k === page || k < 0 || k > pages.length) return;
    page = k;
    updateNav();
    showTop();
  }, { passive: true });
  prev.onclick = () => goTo(page - 1);
  next.onclick = () => goTo(page + 1);
  container.querySelector('.steps').onclick = (e) => {
    const b = e.target.closest('[data-go]');
    if (b) goTo(Number(b.dataset.go));
  };

  container.querySelector('[data-date]').onchange = (e) => {
    if (!e.target.value) return;
    s.date = e.target.value;
    scheduleSave();
  };
  container.querySelector('[data-back]')?.addEventListener('click', () => history.back());
  container.querySelector('[data-duration]')?.addEventListener('change', (e) => {
    const min = parseNum(e.target.value);
    if (min > 0) s.duration = Math.round(min * 60);
    else delete s.duration;
    scheduleSave();
  });
  container.querySelector('[data-add]').onclick = () => openExercisePicker((ex) => {
    s.entries.push(newEntry(ex));
    scheduleSave();
    renderEditor(container, { entry: s.entries.length - 1 });
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

  pager.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-f]');
    if (!inp) return;
    const { i, j, f } = inp.dataset;
    const val = parseNum(inp.value);
    s.entries[i].sets[j][f] = f === 'r' && val !== null ? Math.round(val) : val;
    scheduleSave();
    const k = pageOf(Number(i));
    steps[k].classList.toggle('done', pages[k].idx.every((x) => entryDone(s.entries[x])));
  });
  pager.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.go) { goTo(Number(btn.dataset.go)); return; }
    const card = btn.closest('.entry');
    const i = Number(card?.dataset.i);
    if (btn.hasAttribute('data-add-set')) {
      const sets = s.entries[i].sets;
      sets.push({ w: sets.length ? sets[sets.length - 1].w : null, r: null });
      scheduleSave();
      renderEditor(container);
      const rows = container.querySelectorAll(`.entry[data-i="${i}"] [data-f="r"]`);
      rows[rows.length - 1]?.focus({ preventScroll: true });
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
  const cat = entryCategory(en);
  const cardio = cat === 'cardio';
  const wInput = (st, j) => `<input class="input num" data-i="${i}" data-j="${j}" data-f="w" inputmode="decimal"
              value="${st.w ?? ''}" placeholder="${last?.sets[j]?.w ?? (type.bodyweight ? '0' : '')}" aria-label="${cardio ? 'Km' : 'Peso'} serie ${j + 1}">`;
  const rInput = (st, j) => `<input class="input num" data-i="${i}" data-j="${j}" data-f="r" inputmode="numeric"
              value="${st.r ?? ''}" placeholder="${last?.sets[j]?.r ?? ''}" aria-label="${cardio ? 'Minutos' : 'Reps'} serie ${j + 1}">`;
  return `
    <section class="card entry cat-${cat}" data-i="${i}">
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
          ${cardio ? '<span>#</span><span>Min</span><span>Km</span><span></span>'
            : `<span>#</span><span>${esc(type.short)}</span><span>Reps</span><span></span>`}
        </div>
        ${en.sets.map((st, j) => `
          <div class="set-row">
            <span class="set-num">${j + 1}</span>
            ${cardio ? rInput(st, j) + wInput(st, j) : wInput(st, j) + rInput(st, j)}
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
    const done = (entry = i) => { close(); scheduleSave(); renderEditor(container, { entry }); };
    body.querySelector('[data-target]').onchange = (e) => { en.target = e.target.value.trim(); scheduleSave(); };
    body.querySelector('[data-up]').onclick = () => { s.entries.splice(i - 1, 0, s.entries.splice(i, 1)[0]); done(i - 1); };
    body.querySelector('[data-down]').onclick = () => { s.entries.splice(i + 1, 0, s.entries.splice(i, 1)[0]); done(i + 1); };
    body.querySelector('[data-swap]').onclick = () => {
      close();
      openExercisePicker((ex) => {
        en.exerciseId = ex.id;
        en.name = ex.name;
        delete en.circuit; // la zona media pasa a depender del grupo del ejercicio nuevo
        scheduleSave();
        renderEditor(container, { entry: i });
      });
    };
    body.querySelector('[data-remove]').onclick = () => { s.entries.splice(i, 1); done(Math.min(i, s.entries.length - 1)); };
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
  s.duration = Math.round((Date.now() - Date.parse(s.startedAt || s.createdAt)) / 1000);
  stopClock();
  saveTimer = 1;
  flush();
  editing = null;
  toast(`¡Entrenamiento guardado! 💪 Duró ${fmtDuration(s.duration)}.`);
  renderHome(container);
}
