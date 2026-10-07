// Pestaña "Más": ejercicios, historial completo, backup y cerrar sesión.
// #mas, #mas/ejercicios, #mas/historial

import { state } from '../store.js';
import { logout } from '../db.js';
import { esc, fmtDate, parseDate, monthName, today } from '../ui.js';
import { renderExerciseList, openExerciseForm } from './exercises.js';

let redrawList = null;

export function render(container, arg) {
  if (arg === 'ejercicios') return renderExercises(container);
  if (arg === 'historial') return renderHistory(container);
  container.innerHTML = `
    <h1>Más</h1>
    <div class="card list">
      <a class="list-item" href="#mas/historial"><span>Historial de entrenamientos</span><small class="muted">${state.sessions.length} registrados</small></a>
      <a class="list-item" href="#mas/ejercicios"><span>Mis ejercicios</span><small class="muted">${state.exercises.size} ejercicios · editar grupos musculares</small></a>
      <button class="list-item" data-export><span>Descargar copia de seguridad</span><small class="muted">Archivo con todos tus datos</small></button>
    </div>
    <div class="card">
      <p class="muted">Sesión iniciada como<br><strong>${esc(state.user.email || state.user.displayName || '')}</strong></p>
      <button class="btn btn-block" data-logout>Cerrar sesión</button>
    </div>`;
  container.querySelector('[data-logout]').onclick = logout;
  container.querySelector('[data-export]').onclick = exportData;
}

// Mientras se ve la lista de ejercicios, se actualiza sin perder la búsqueda.
export function onData(container, arg) {
  if (arg === 'ejercicios' && redrawList) redrawList();
  else render(container, arg);
}

export function leave() {
  redrawList = null;
}

function renderExercises(container) {
  container.innerHTML = `
    <div class="session-head">
      <a class="icon-btn" href="#mas" aria-label="Volver">←</a>
      <h1 class="grow">Mis ejercicios</h1>
    </div>
    <p class="muted">Tocá un ejercicio para cambiar su nombre, tipo de peso o grupos musculares.</p>
    <div class="ex-manage"></div>`;
  redrawList = renderExerciseList(container.querySelector('.ex-manage'), (ex) => openExerciseForm(ex));
}

function renderHistory(container) {
  redrawList = null;
  const byMonth = new Map();
  for (const s of state.sessions) {
    const k = s.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(s);
  }
  container.innerHTML = `
    <div class="session-head">
      <a class="icon-btn" href="#mas" aria-label="Volver">←</a>
      <h1 class="grow">Historial</h1>
    </div>
    ${[...byMonth].map(([k, list]) => {
      const d = parseDate(k + '-01');
      return `
        <h2 class="section-title">${monthName(d.getMonth())} ${d.getFullYear()} · ${list.length} entrenamientos</h2>
        <div class="card list">
          ${list.map((s) => `
            <a class="list-item" href="#entrenar/${s.id}">
              <span>${esc(s.routineName || 'Entrenamiento')}${s.finished ? '' : ' <span class="badge live">En curso</span>'}</span>
              <small class="muted">${fmtDate(s.date, true)} · ${(s.entries || []).map((e) => esc(state.exercises.get(e.exerciseId)?.name || e.name)).join(', ')}</small>
            </a>`).join('')}
        </div>`;
    }).join('') || '<p class="muted center">Todavía no hay entrenamientos.</p>'}`;
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    exercises: [...state.exercises.values()],
    routines: state.routines,
    sessions: state.sessions,
    bodyweight: state.bodyweight,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gimnasio-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
