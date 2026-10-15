// Selector de ejercicios y formulario para crear/editar ejercicios.

import { GROUPS, EXERCISE_GROUPS, WEIGHT_TYPES, CARDIO } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, openModal, confirmDialog, toast } from '../ui.js';

export function groupsLabel(ex) {
  const sec = (ex.secondary || []).length ? ` + ${ex.secondary.join(', ')}` : '';
  return ex.primary + sec;
}

export function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Lista de ejercicios agrupada por grupo principal, con buscador.
// onPick(ejercicio) se llama al tocar uno.
export function renderExerciseList(container, onPick, { showCreate = true } = {}) {
  container.innerHTML = `
    <input class="input search" type="search" placeholder="Buscar ejercicio…" autocomplete="off">
    ${showCreate ? '<button class="btn btn-block" data-create>+ Crear ejercicio nuevo</button>' : ''}
    <div class="ex-list"></div>`;
  const search = container.querySelector('.search');
  const list = container.querySelector('.ex-list');

  const draw = () => {
    const q = normalize(search.value.trim());
    const all = [...state.exercises.values()].filter((e) => !q || normalize(e.name).includes(q));
    if (!all.length) {
      list.innerHTML = '<p class="muted center">No hay ejercicios que coincidan.</p>';
      return;
    }
    list.innerHTML = EXERCISE_GROUPS.map((g) => {
      const items = all.filter((e) => e.primary === g);
      if (!items.length) return '';
      return `<h3 class="list-title">${esc(g)}</h3>` + items.map((e) => `
        <button class="list-item" data-id="${e.id}">
          <span>${esc(e.name)}</span>
          <small class="muted">${e.primary === CARDIO ? 'minutos y km' : esc(WEIGHT_TYPES[e.type]?.short || '')}${e.secondary?.length ? ' · ' + esc(e.secondary.join(', ')) : ''}</small>
        </button>`).join('');
    }).join('');
  };
  search.addEventListener('input', draw);
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) onPick(state.exercises.get(btn.dataset.id));
  });
  container.querySelector('[data-create]')?.addEventListener('click', () => {
    openExerciseForm({ name: search.value.trim() }, onPick);
  });
  draw();
  return draw;
}

export function openExercisePicker(onPick) {
  openModal('Elegí un ejercicio', (body, close) => {
    renderExerciseList(body, (ex) => {
      close();
      onPick(ex);
    });
  });
}

// Crear (ex sin id) o editar (ex con id). onSaved(ejercicio) al guardar.
// Con `draft`, no guarda nada: devuelve los datos sin id (o el ejercicio existente si ya hay uno con ese nombre).
export function openExerciseForm(ex = {}, onSaved, { draft = false } = {}) {
  const editing = Boolean(ex.id);
  openModal(editing ? 'Editar ejercicio' : 'Nuevo ejercicio', (body, close) => {
    body.innerHTML = `
      <form class="form">
        <label>Nombre
          <input class="input" name="name" required value="${esc(ex.name || '')}" autocomplete="off">
        </label>
        <label data-type-field>Tipo de peso
          <select class="input" name="type">
            ${Object.entries(WEIGHT_TYPES).filter(([, t]) => !t.cardio).map(([k, t]) =>
              `<option value="${k}" ${ex.type === k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
          </select>
        </label>
        <label>Grupo principal
          <select class="input" name="primary" required>
            <option value="">Elegir…</option>
            ${EXERCISE_GROUPS.map((g) => `<option ${ex.primary === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
          </select>
        </label>
        <p class="note" data-cardio-note hidden>Cardio: se anotan minutos y, si querés, km. No suma a los grupos musculares.</p>
        <fieldset data-secondary-field>
          <legend>Grupos secundarios</legend>
          <div class="chips">
            ${GROUPS.map((g) => `
              <label class="chip-check">
                <input type="checkbox" name="secondary" value="${esc(g)}" ${(ex.secondary || []).includes(g) ? 'checked' : ''}>
                <span>${esc(g)}</span>
              </label>`).join('')}
          </div>
        </fieldset>
        <div class="row-actions">
          ${editing ? '<button type="button" class="btn btn-danger" data-delete>Borrar</button>' : ''}
          <button class="btn btn-primary">Guardar</button>
        </div>
      </form>`;
    const form = body.querySelector('form');
    // Con grupo Cardio no hay tipo de peso ni grupos secundarios.
    const syncCardio = () => {
      const cardio = form.elements.primary.value === CARDIO;
      body.querySelector('[data-type-field]').hidden = cardio;
      body.querySelector('[data-secondary-field]').hidden = cardio;
      body.querySelector('[data-cardio-note]').hidden = !cardio;
    };
    form.elements.primary.addEventListener('change', syncCardio);
    syncCardio();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name').trim();
      const primary = fd.get('primary');
      if (!name || !primary) return;
      const dup = [...state.exercises.values()].find((x) =>
        x.id !== ex.id && normalize(x.name) === normalize(name));
      if (dup && draft) {
        toast(`Ya tenés "${dup.name}": se usa ese.`);
        close();
        onSaved?.(dup);
        return;
      }
      if (dup) {
        toast('Ya existe un ejercicio con ese nombre.');
        return;
      }
      const data = {
        ...(editing ? { id: ex.id, createdAt: ex.createdAt } : {}),
        name,
        type: primary === CARDIO ? 'cardio' : fd.get('type'),
        primary,
        secondary: primary === CARDIO ? [] : fd.getAll('secondary').filter((g) => g !== primary),
      };
      if (draft) {
        close();
        onSaved?.(data);
        return;
      }
      const id = save('exercises', data);
      close();
      onSaved?.({ ...data, id });
    });
    body.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const used = state.sessions.some((s) => (s.entries || []).some((en) => en.exerciseId === ex.id))
        || state.routines.some((r) => (r.items || []).some((it) => it.exerciseId === ex.id));
      if (used) {
        toast('Este ejercicio tiene registros o está en una rutina. No se puede borrar.');
        return;
      }
      if (await confirmDialog(`¿Borrar "${ex.name}"?`, 'Borrar', true)) {
        remove('exercises', ex.id);
        close();
      }
    });
  });
}
