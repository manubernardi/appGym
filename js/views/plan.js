// Pestaña "Plan": rutinas del mes (Día A, Día B…) con sus ejercicios y objetivo (ej. 3x10).

import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, openModal, confirmDialog, toast } from '../ui.js';
import { openExercisePicker } from './exercises.js';

export function render(container) {
  const active = state.routines.filter((r) => !r.archived);
  const archived = state.routines.filter((r) => r.archived);
  container.innerHTML = `
    <h1>Plan del mes</h1>
    ${active.length ? '' : '<p class="muted">Cargá las rutinas de tu plan actual (por ejemplo "Día A", "Día B").</p>'}
    ${active.map(routineCard).join('')}
    <button class="btn btn-primary btn-block" data-new>+ Nueva rutina</button>
    ${active.length ? '<button class="btn btn-block" data-archive-all>Empezar plan nuevo (archivar el actual)</button>' : ''}
    ${archived.length ? `
      <details class="archived">
        <summary>Rutinas archivadas (${archived.length})</summary>
        ${archived.map(routineCard).join('')}
      </details>` : ''}`;

  container.querySelector('[data-new]').onclick = () => openRoutineEditor({ name: suggestName(active), items: [] });
  container.querySelector('[data-archive-all]')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Se archivan las rutinas actuales (tus registros no se borran). ¿Continuar?', 'Archivar'))) return;
    active.forEach((r) => save('routines', { ...r, archived: true }));
  });
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const r = state.routines.find((x) => x.id === btn.closest('[data-id]').dataset.id);
    if (!r) return;
    const act = btn.dataset.act;
    if (act === 'edit') openRoutineEditor(structuredClone(r));
    else if (act === 'archive') save('routines', { ...r, archived: true });
    else if (act === 'restore') save('routines', { ...r, archived: false });
    else if (act === 'copy') {
      save('routines', { name: r.name + ' (copia)', items: structuredClone(r.items || []), archived: false });
      toast('Rutina copiada al plan actual.');
    } else if (act === 'delete' && await confirmDialog(`¿Borrar la rutina "${r.name}"? Tus registros no se borran.`, 'Borrar', true)) {
      remove('routines', r.id);
    }
  });
}

function suggestName(active) {
  const letter = String.fromCharCode(65 + active.length);
  return active.length < 26 ? `Día ${letter}` : '';
}

function routineCard(r) {
  const items = r.items || [];
  return `
    <section class="card routine" data-id="${r.id}">
      <div class="entry-head">
        <h2 class="grow">${esc(r.name)}</h2>
        ${r.archived
          ? `<button class="btn btn-small" data-act="copy">Copiar</button>
             <button class="btn btn-small" data-act="restore">Restaurar</button>
             <button class="icon-btn small" data-act="delete" aria-label="Borrar">🗑</button>`
          : `<button class="btn btn-small" data-act="edit">Editar</button>
             <button class="icon-btn small" data-act="archive" aria-label="Archivar" title="Archivar">📦</button>`}
      </div>
      ${items.length ? `<ol class="routine-items">
        ${items.map((it) => {
          const ex = state.exercises.get(it.exerciseId);
          return `<li><span>${esc(ex?.name || '(ejercicio borrado)')}</span><span class="muted">${esc(it.target || '')}</span></li>`;
        }).join('')}
      </ol>` : '<p class="muted">Sin ejercicios.</p>'}
    </section>`;
}

function openRoutineEditor(routine) {
  const isNew = !routine.id;
  openModal(isNew ? 'Nueva rutina' : 'Editar rutina', (body, close) => {
    const draw = () => {
      body.innerHTML = `
        <label>Nombre
          <input class="input" data-name value="${esc(routine.name || '')}" placeholder="Ej. Día A">
        </label>
        <h3 class="list-title">Ejercicios</h3>
        <div class="routine-edit-items">
          ${routine.items.map((it, i) => `
            <div class="routine-edit-row" data-i="${i}">
              <div class="grow">
                <div>${esc(state.exercises.get(it.exerciseId)?.name || '(ejercicio borrado)')}</div>
                <input class="input target" data-target value="${esc(it.target || '')}" placeholder="Series x reps (ej. 3x10)">
              </div>
              <div class="row-btns">
                <button class="icon-btn small" data-up ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
                <button class="icon-btn small" data-down ${i === routine.items.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
                <button class="icon-btn small" data-del aria-label="Quitar">✕</button>
              </div>
            </div>`).join('') || '<p class="muted">Agregá los ejercicios de esta rutina.</p>'}
        </div>
        <button class="btn btn-block" data-add>+ Agregar ejercicio</button>
        <div class="row-actions">
          <button class="btn" data-cancel>Cancelar</button>
          <button class="btn btn-primary" data-save>Guardar</button>
        </div>`;
    };
    draw();

    body.addEventListener('input', (e) => {
      if (e.target.matches('[data-name]')) routine.name = e.target.value;
      if (e.target.matches('[data-target]')) {
        routine.items[e.target.closest('[data-i]').dataset.i].target = e.target.value;
      }
    });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const row = btn.closest('[data-i]');
      const i = row ? Number(row.dataset.i) : -1;
      const items = routine.items;
      if (btn.hasAttribute('data-up')) { items.splice(i - 1, 0, items.splice(i, 1)[0]); draw(); }
      else if (btn.hasAttribute('data-down')) { items.splice(i + 1, 0, items.splice(i, 1)[0]); draw(); }
      else if (btn.hasAttribute('data-del')) { items.splice(i, 1); draw(); }
      else if (btn.hasAttribute('data-add')) {
        openExercisePicker((ex) => {
          items.push({ exerciseId: ex.id, target: '' });
          draw();
          const targets = body.querySelectorAll('[data-target]');
          targets[targets.length - 1]?.focus();
        });
      } else if (btn.hasAttribute('data-cancel')) close();
      else if (btn.hasAttribute('data-save')) {
        const name = routine.name.trim();
        if (!name) { toast('Poné un nombre a la rutina.'); return; }
        save('routines', {
          ...routine,
          name,
          archived: Boolean(routine.archived),
          items: routine.items.map((it) => ({ exerciseId: it.exerciseId, target: (it.target || '').trim() })),
        });
        close();
      }
    });
  });
}
