// Pestaña "Plan": rutinas del mes (Día A, Día B…) con sus ejercicios y objetivo (ej. 3x10),
// o con el número de progresión semanal de cada ejercicio (ver progression.js).

import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, openModal, confirmDialog, toast } from '../ui.js';
import { openExercisePicker, normalize } from './exercises.js';
import { WEIGHT_TYPES } from '../data.js';
import { hasProgression, progCount, currentWeek, itemTarget } from '../progression.js';

export function render(container) {
  const active = state.routines.filter((r) => !r.archived);
  const archived = state.routines.filter((r) => r.archived);
  container.innerHTML = `
    <h1>Plan del mes</h1>
    ${active.length ? '' : '<p class="muted">Cargá las rutinas de tu plan actual (por ejemplo "Día A", "Día B"), o sacale una foto a la hoja.</p>'}
    <button class="btn btn-block" data-photo>📷 Cargar plan desde foto</button>
    <input type="file" accept="image/*" data-photo-input hidden>
    ${progressionCard(active.find(hasProgression)?.progression)}
    ${active.map(routineCard).join('')}
    <button class="btn btn-primary btn-block" data-new>+ Nueva rutina</button>
    ${active.length ? '<button class="btn btn-block" data-archive-all>Empezar plan nuevo (archivar el actual)</button>' : ''}
    ${archived.length ? `
      <details class="archived">
        <summary>Rutinas archivadas (${archived.length})</summary>
        ${archived.map(routineCard).join('')}
      </details>` : ''}`;

  const photoInput = container.querySelector('[data-photo-input]');
  container.querySelector('[data-photo]').onclick = () => photoInput.click();
  photoInput.onchange = () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (file) importFromPhoto(file);
  };
  container.querySelector('[data-new]').onclick = () => {
    // Una rutina nueva usa la misma tabla de progresión que el plan actual.
    const progression = active.find(hasProgression)?.progression;
    openRoutineEditor({ name: suggestName(active), items: [], ...(progression ? { progression: structuredClone(progression) } : {}) });
  };
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
      save('routines', {
        name: r.name + ' (copia)',
        items: structuredClone(r.items || []),
        ...(hasProgression(r) ? { progression: structuredClone(r.progression) } : {}),
        archived: false,
      });
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

// Tabla de progresión: filas = semanas, columnas = progresiones.
// Con `editable`, cada celda es un input (data-cell="semana,progresión").
function progressionTable(progression, editable = false) {
  const n = Math.max(0, ...progression.map((w) => w.targets.length));
  const cols = Array.from({ length: n }, (_, j) => j);
  return `
    <div class="table-wrap">
      <table class="table prog-table">
        <thead><tr><th>Semana</th>${cols.map((j) => `<th>Prog. ${j + 1}</th>`).join('')}</tr></thead>
        <tbody>
          ${progression.map((w, i) => `<tr><th>${i + 1}</th>${cols.map((j) => `<td>${editable
            ? `<input class="input" data-cell="${i},${j}" value="${esc(w.targets[j] || '')}">`
            : esc(w.targets[j] || '–')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function progressionCard(progression) {
  if (!progression?.length) return '';
  return `
    <section class="card">
      <h2>Progresión semanal</h2>
      <p class="muted">Cada ejercicio sigue una progresión. La semana de cada día avanza con las veces que lo hiciste.</p>
      ${progressionTable(progression)}
    </section>`;
}

function progOptions(n, selected) {
  return Array.from({ length: n }, (_, j) =>
    `<option value="${j + 1}" ${selected === j + 1 ? 'selected' : ''}>Progresión ${j + 1}</option>`).join('');
}

function routineCard(r) {
  const items = r.items || [];
  const week = r.archived ? null : currentWeek(r);
  return `
    <section class="card routine" data-id="${r.id}">
      <div class="entry-head">
        <h2 class="grow">${esc(r.name)}${week ? ` <small class="muted">· semana ${week} de ${r.progression.length}</small>` : ''}</h2>
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
          const prog = hasProgression(r) ? `P${it.prog || 1}` + (week ? ' · ' : '') : '';
          const target = hasProgression(r) ? (week ? itemTarget(r, it, week) : '') : it.target || '';
          return `<li><span>${esc(ex?.name || '(ejercicio borrado)')}</span><span class="muted">${esc(prog + target)}</span></li>`;
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
                ${hasProgression(routine)
                  ? `<select class="input target" data-prog>${progOptions(progCount(routine), it.prog || 1)}</select>`
                  : `<input class="input target" data-target value="${esc(it.target || '')}" placeholder="Series x reps (ej. 3x10)">`}
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
    body.addEventListener('change', (e) => {
      if (e.target.matches('[data-prog]')) routine.items[e.target.closest('[data-i]').dataset.i].prog = Number(e.target.value);
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
          items.push({ exerciseId: ex.id, target: '', ...(hasProgression(routine) ? { prog: 1 } : {}) });
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
          items: routine.items.map((it) => ({
            exerciseId: it.exerciseId,
            target: (it.target || '').trim(),
            ...(hasProgression(routine) ? { prog: it.prog || 1 } : {}),
          })),
        });
        close();
      }
    });
  });
}

// ---------- Plan desde foto ----------

async function importFromPhoto(file) {
  if (!navigator.onLine) { toast('Para leer la foto hace falta internet.'); return; }
  const closeLoading = openModal('Leyendo el plan', (body) => {
    body.innerHTML = '<p class="center muted">Leyendo la foto… puede tardar unos segundos.</p>';
  });
  let plan;
  try {
    // Se carga recién acá: el SDK de IA no hace falta para usar el resto de la app.
    const { readPlanPhoto } = await import('../plan-import.js');
    plan = await readPlanPhoto(file);
  } catch (err) {
    closeLoading();
    console.error(err);
    toast('No se pudo leer la foto: ' + err.message);
    return;
  }
  closeLoading();
  if (!plan.routines.length) { toast('No encontré ejercicios en la foto. Probá con otra más nítida.'); return; }
  openImportReview(plan);
}

function itemLabel(it) {
  if (it.exerciseId) return esc(state.exercises.get(it.exerciseId)?.name || '(ejercicio borrado)');
  const n = it.newExercise;
  const groups = [n.primary || 'sin grupo', ...n.secondary].join(', ');
  return `${esc(n.name)} <span class="tag-new">nuevo</span>
    <small class="muted block">${esc(WEIGHT_TYPES[n.type].short)} · ${esc(groups)}</small>`;
}

// Cada día de la foto se carga como rutina nueva, actualiza una rutina del plan actual
// (conserva la semana en la que vas, porque la semana se cuenta por rutina) o no se carga.
// La tabla de progresión es una sola para todo el plan.
function openImportReview(plan) {
  const active = state.routines.filter((r) => !r.archived);
  plan.routines.forEach((r) => { r.dest = 'new'; });
  // Rutinas actuales que no se actualizan: se archivan (plan nuevo) o se dejan (se suman días).
  // Si todos los días van como rutina nueva, se archivan; si no, se dejan. Salvo que lo elijas a mano.
  let keepChosen = false;
  const targets = () => new Set(plan.routines.map((r) => r.dest));
  const others = () => active.filter((a) => !targets().has(a.id));
  const autoKeep = () => !plan.routines.every((r) => r.dest === 'new');
  plan.keepOthers = autoKeep();
  const destOptions = (r) => `
    <option value="new" ${r.dest === 'new' ? 'selected' : ''}>Nueva rutina</option>
    ${active.map((a) => `<option value="${a.id}" ${r.dest === a.id ? 'selected' : ''}>Actualizar ${esc(a.name)}</option>`).join('')}
    <option value="skip" ${r.dest === 'skip' ? 'selected' : ''}>No cargar</option>`;
  const othersOptions = () => {
    const list = others();
    if (!list.length) return '';
    const names = list.map((a) => esc(a.name)).join(', ');
    return `
      <section class="card">
        <p class="muted">Las demás rutinas del plan actual (${names}):</p>
        <label class="radio-row"><input type="radio" name="others" value="archive" ${plan.keepOthers ? '' : 'checked'}>
          <span>Archivarlas <small class="muted block">Plan nuevo. Tus registros no se borran.</small></span></label>
        <label class="radio-row"><input type="radio" name="others" value="keep" ${plan.keepOthers ? 'checked' : ''}>
          <span>Dejarlas en el plan <small class="muted block">Los días de la foto se suman a ellas.</small></span></label>
      </section>`;
  };
  openModal('Revisá el plan', (body, close) => {
    const draw = () => {
      body.innerHTML = `
        ${plan.progression.length ? `
          <section class="card">
            <h2>Progresión semanal</h2>
            <p class="muted">Filas = semanas, columnas = progresiones. Corregí lo que haya leído mal. Vale para todos los días del plan.</p>
            ${progressionTable(plan.progression, true)}
          </section>` : ''}
        <p class="muted">${active.length ? 'Elegí cómo cargar cada día: como rutina nueva o actualizando una que ya tenés (mantiene la semana en la que vas). ' : ''}
          Tocá un ejercicio para cambiarlo por otro. Los marcados como <span class="tag-new">nuevo</span> se crean al guardar.</p>
        ${plan.routines.map((r, ri) => `
          <section class="card ${r.dest === 'skip' ? 'excluded' : ''}" data-ri="${ri}">
            <input class="input" data-rname value="${esc(r.name)}" placeholder="Nombre de la rutina">
            <label class="dest">Cargar como
              <select class="input" data-dest>${destOptions(r)}</select>
            </label>
            <div class="routine-edit-items">
              ${r.items.map((it, i) => `
                <div class="routine-edit-row" data-i="${i}">
                  <div class="grow">
                    <button class="link-btn" data-change>${itemLabel(it)}</button>
                    ${it.written ? `<small class="muted block">En la hoja: ${esc(it.written)}</small>` : ''}
                    ${plan.progression.length
                      ? `<select class="input target" data-prog>${progOptions(progCount(plan), it.prog)}</select>`
                      : `<input class="input target" data-target value="${esc(it.target)}" placeholder="Series x reps (ej. 3x10)">`}
                  </div>
                  <div class="row-btns">
                    <button class="icon-btn small" data-del aria-label="Quitar">✕</button>
                  </div>
                </div>`).join('') || '<p class="muted">Sin ejercicios.</p>'}
            </div>
          </section>`).join('')}
        <div data-others>${othersOptions()}</div>
        <div class="row-actions">
          <button class="btn" data-cancel>Cancelar</button>
          <button class="btn btn-primary" data-save>Guardar</button>
        </div>`;
    };
    draw();

    const locate = (el) => {
      const r = plan.routines[el.closest('[data-ri]').dataset.ri];
      const row = el.closest('[data-i]');
      return { r, i: row ? Number(row.dataset.i) : -1 };
    };
    body.addEventListener('input', (e) => {
      if (e.target.matches('[data-cell]')) {
        const [w, j] = e.target.dataset.cell.split(',').map(Number);
        plan.progression[w].targets[j] = e.target.value;
        return;
      }
      if (e.target.matches('[data-rname]')) locate(e.target).r.name = e.target.value;
      if (e.target.matches('[data-target]')) {
        const { r, i } = locate(e.target);
        r.items[i].target = e.target.value;
      }
    });
    body.addEventListener('change', (e) => {
      if (e.target.matches('[data-prog]')) {
        const { r, i } = locate(e.target);
        r.items[i].prog = Number(e.target.value);
      }
      if (e.target.matches('[data-dest]')) {
        const { r } = locate(e.target);
        r.dest = e.target.value;
        const section = e.target.closest('[data-ri]');
        section.classList.toggle('excluded', r.dest === 'skip');
        // Al actualizar una rutina, se mantiene su nombre.
        const updated = active.find((a) => a.id === r.dest);
        if (updated) {
          r.name = updated.name;
          section.querySelector('[data-rname]').value = updated.name;
        }
        if (!keepChosen) plan.keepOthers = autoKeep();
        body.querySelector('[data-others]').innerHTML = othersOptions();
      }
      if (e.target.name === 'others') {
        plan.keepOthers = e.target.value === 'keep';
        keepChosen = true;
      }
    });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-cancel')) { close(); return; }
      if (btn.hasAttribute('data-save')) { if (saveImported(plan, active)) close(); return; }
      const { r, i } = locate(btn);
      if (btn.hasAttribute('data-del')) { r.items.splice(i, 1); draw(); }
      else if (btn.hasAttribute('data-change')) {
        openExercisePicker((ex) => {
          r.items[i].exerciseId = ex.id;
          r.items[i].newExercise = null;
          draw();
        });
      }
    });
  });
}

function saveImported(plan, active) {
  const routines = plan.routines.filter((r) => r.dest !== 'skip' && r.items.length);
  if (!routines.length) { toast('Elegí al menos un día con ejercicios.'); return false; }
  if (routines.some((r) => !r.name.trim())) { toast('Poné un nombre a cada rutina.'); return false; }
  const dests = routines.map((r) => r.dest).filter((d) => d !== 'new');
  if (new Set(dests).size !== dests.length) { toast('Dos días de la foto actualizan la misma rutina.'); return false; }
  if (routines.some((r) => r.items.some((it) => it.newExercise && !it.newExercise.primary))) {
    toast('Hay un ejercicio nuevo sin grupo: tocalo y elegí uno de la lista.');
    return false;
  }
  // Ejercicios nuevos: si ya existe uno con el mismo nombre se usa ese; si se repite en varias rutinas, se crea una vez.
  const byName = new Map([...state.exercises.values()].map((e) => [normalize(e.name), e.id]));
  const idFor = (it) => {
    if (it.exerciseId) return it.exerciseId;
    const key = normalize(it.newExercise.name);
    if (!byName.has(key)) byName.set(key, save('exercises', { ...it.newExercise }));
    return byName.get(key);
  };
  const progression = plan.progression
    .map((w) => ({ targets: w.targets.map((t) => t.trim()) }))
    .filter((w) => w.targets.some(Boolean));
  const withTable = (r) => {
    const { progression: _old, ...rest } = r;
    return progression.length ? { ...rest, progression } : rest;
  };
  const now = Date.now();
  let added = 0;
  let updated = 0;
  routines.forEach((r, k) => {
    const items = r.items.map((it) => ({
      exerciseId: idFor(it),
      target: it.target.trim(),
      ...(progression.length ? { prog: it.prog || 1 } : {}),
    }));
    const existing = active.find((a) => a.id === r.dest);
    if (existing) {
      save('routines', withTable({ ...existing, name: r.name.trim(), items }));
      updated++;
    } else {
      save('routines', withTable({
        name: r.name.trim(),
        createdAt: new Date(now + k).toISOString(), // mantiene el orden Día A, Día B…
        archived: false,
        items,
      }));
      added++;
    }
  });
  const dested = new Set(dests);
  active.filter((a) => !dested.has(a.id)).forEach((a) => {
    if (!plan.keepOthers) save('routines', { ...a, archived: true });
    // La tabla es del plan: las rutinas que ya seguían una progresión toman la nueva.
    else if (progression.length && hasProgression(a)) save('routines', withTable(a));
  });
  const parts = [];
  if (added) parts.push(`${added} rutina${added === 1 ? '' : 's'} nueva${added === 1 ? '' : 's'}`);
  if (updated) parts.push(`${updated} actualizada${updated === 1 ? '' : 's'}`);
  toast(`Plan guardado: ${parts.join(', ')}.`);
  return true;
}
