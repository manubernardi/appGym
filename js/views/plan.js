// Pestaña "Plan": rutinas del mes (Día A, Día B…) con sus ejercicios y objetivo (ej. 3x10),
// o con el número de progresión semanal de cada ejercicio (ver progression.js).

import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, openModal, confirmDialog, toast } from '../ui.js';
import { openExercisePicker, openExerciseForm, normalize } from './exercises.js';
import { WEIGHT_TYPES, CATEGORIES } from '../data.js';
import { FIXED, hasProgression, progCount, itemProg, weekStatus, itemTarget, itemCategory, categoryRuns, itemsLabel } from '../progression.js';

export function render(container) {
  const active = state.routines.filter((r) => !r.archived);
  const archived = state.routines.filter((r) => r.archived);
  const prog = active.find(hasProgression)?.progression;
  const summary = active.length
    ? `${active.length} rutina${active.length === 1 ? '' : 's'}${prog ? ` · progresión de ${prog.length} semana${prog.length === 1 ? '' : 's'}` : ''}`
    : '';
  container.innerHTML = `
    <div class="plan-head">
      <h1>Plan del mes</h1>
      ${summary ? `<p class="muted">${summary}</p>` : ''}
    </div>
    ${active.length ? '' : `
      <section class="card empty">
        <p>Cargá las rutinas de tu plan actual (por ejemplo "Día 1", "Día 2"), o sacale una foto a la hoja.</p>
      </section>`}
    <div class="plan-actions">
      <button class="btn" data-photo>📷 Desde foto</button>
      <button class="btn btn-primary" data-new>+ Nueva rutina</button>
    </div>
    <input type="file" accept="image/*" data-photo-input hidden>
    ${active.map(routineCard).join('')}
    ${progressionCard(prog)}
    ${active.length ? '<button class="btn btn-block btn-subtle" data-archive-all>Empezar plan nuevo (archivar el actual)</button>' : ''}
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
  return `Día ${active.length + 1}`;
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
    <details class="card prog-card">
      <summary>
        <span class="grow">
          <h2>Progresión semanal</h2>
          <small class="muted">${progression.length} semanas · ${Math.max(0, ...progression.map((w) => w.targets.length))} progresiones</small>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </summary>
      <p class="note">Cada ejercicio sigue una progresión (P1, P2…). La semana de cada día avanza con las veces que lo terminaste.</p>
      ${progressionTable(progression)}
    </details>`;
}

function progOptions(n, selected) {
  return Array.from({ length: n }, (_, j) =>
    `<option value="${j + 1}" ${selected === j + 1 ? 'selected' : ''}>Progresión ${j + 1}</option>`).join('')
    + `<option value="${FIXED}" ${selected === FIXED ? 'selected' : ''}>Fijo (sus propias reps)</option>`;
}

// Selector de progresión del ejercicio; si es fijo, también su objetivo (ej. zona media "3x10").
function progFields(n, it) {
  const p = itemProg(it);
  return `<select class="input target" data-prog>${progOptions(n, p)}</select>`
    + (p === FIXED ? `<input class="input target" data-target value="${esc(it.target || '')}" placeholder="Series x reps (ej. 3x10)">` : '');
}

// Barra con un segmento por semana: las hechas en verde, las que quedaron sin entrenar en rojo y la actual en azul.
function weekBar(r, st) {
  const cls = (w) => (st.done.has(w) ? 'done' : w < st.now ? 'missed' : w === st.now ? 'current' : '');
  const notes = [
    st.missed.length ? `sin entrenar: ${st.missed.join(', ')}` : '',
    st.week !== st.now ? `la próxima vez recupera la ${st.week}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="week-bar">
      <div class="week-bar-label">Semana <strong>${st.now}</strong> de ${r.progression.length}${notes ? ` · ${notes}` : ''}</div>
      <div class="week-steps">${r.progression.map((_, i) => `<span class="${cls(i + 1)}"></span>`).join('')}</div>
    </div>`;
}

// Etiqueta de zona media o cardio (fuerza es lo normal y no lleva).
function catTag(cat) {
  return cat === 'fuerza' ? '' : ` <span class="cat-tag cat-${cat}">${CATEGORIES[cat]}</span>`;
}

// Los ejercicios seguidos de la misma categoría (fuerza, zona media, cardio) van en un bloque,
// en el orden de la rutina (igual que al entrenar). Se numeran dentro de cada bloque.
function routineItems(r, items, week) {
  const row = (it, num, cat) => {
    const ex = state.exercises.get(it.exerciseId);
    const p = itemProg(it);
    const tag = hasProgression(r) && p !== FIXED ? `P${p}` : '';
    const target = hasProgression(r) && !week && p !== FIXED ? '' : itemTarget(r, it, week);
    return `<li>
      <span class="ex-num cat-${cat}">${num}</span>
      <span class="ex-name">${esc(ex?.name || '(ejercicio borrado)')}</span>
      ${tag ? `<span class="prog-tag">${tag}</span>` : ''}
      ${target ? `<span class="target-pill">${esc(target)}</span>` : ''}
    </li>`;
  };
  return categoryRuns(items, (it) => itemCategory(r, it)).map(({ cat, idx }) => `
    <li class="cat-block cat-${cat}">
      <div class="cat-head">${CATEGORIES[cat]} <small>· ${cat === 'core' ? 'circuito de ' : ''}${idx.length} ejercicio${idx.length === 1 ? '' : 's'}</small></div>
      <ul>${idx.map((i, k) => row(items[i], k + 1, cat)).join('')}</ul>
    </li>`).join('');
}

function routineCard(r) {
  const items = r.items || [];
  const st = r.archived ? null : weekStatus(r);
  const week = st?.week;
  return `
    <section class="card routine ${r.archived ? 'is-archived' : ''}" data-id="${r.id}">
      <div class="routine-head">
        <div class="grow">
          <h2>${esc(r.name)}</h2>
          <small class="muted">${itemsLabel(r)}</small>
        </div>
        ${r.archived
          ? `<button class="btn btn-small" data-act="copy">Copiar</button>
             <button class="btn btn-small" data-act="restore">Restaurar</button>
             <button class="icon-btn small" data-act="delete" aria-label="Borrar">🗑</button>`
          : `<button class="btn btn-small" data-act="edit">Editar</button>
             <button class="icon-btn small" data-act="archive" aria-label="Archivar" title="Archivar">📦</button>`}
      </div>
      ${st ? weekBar(r, st) : ''}
      ${items.length ? `<ol class="routine-items">${routineItems(r, items, week)}</ol>`
        : '<p class="empty-items muted">Sin ejercicios.</p>'}
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
            <div class="routine-edit-row cat-${itemCategory(routine, it)}" data-i="${i}">
              <div class="grow">
                <div>${esc(state.exercises.get(it.exerciseId)?.name || '(ejercicio borrado)')}${catTag(itemCategory(routine, it))}</div>
                ${hasProgression(routine)
                  ? progFields(progCount(routine), it)
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
      if (e.target.matches('[data-prog]')) {
        routine.items[e.target.closest('[data-i]').dataset.i].prog = Number(e.target.value);
        draw();
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
            ...(hasProgression(routine) ? { prog: itemProg(it) } : {}),
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
  const groups = n.primary
    ? esc([n.primary, ...n.secondary].join(', '))
    : '<span class="missing">sin grupo muscular</span>';
  return `${esc(n.name)} <span class="tag-new">nuevo</span>
    <small class="muted block">${esc(WEIGHT_TYPES[n.type].short)} · ${groups}</small>`;
}

// Editar el ejercicio nuevo antes de guardar (nombre, tipo, grupos). No se crea hasta guardar el plan.
function editNewExercise(it, onDone) {
  openExerciseForm(structuredClone(it.newExercise), (data) => {
    if (data.id) { it.exerciseId = data.id; it.newExercise = null; }
    else it.newExercise = data;
    onDone();
  }, { draft: true });
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
          Tocá un ejercicio para cambiarlo por otro. Los marcados como <span class="tag-new">nuevo</span> se crean al guardar:
          revisá su nombre y grupos con <em>Editar nombre y grupos</em>.
          ${plan.progression.length ? 'Los ejercicios en <em>Fijo</em> (ej. zona media) no siguen la tabla: usan sus propias series x reps.' : ''}</p>
        ${plan.routines.map((r, ri) => `
          <section class="card ${r.dest === 'skip' ? 'excluded' : ''}" data-ri="${ri}">
            <input class="input" data-rname value="${esc(r.name)}" placeholder="Nombre de la rutina">
            <label class="dest">Cargar como
              <select class="input" data-dest>${destOptions(r)}</select>
            </label>
            <div class="routine-edit-items">
              ${r.items.map((it, i) => `
                <div class="routine-edit-row cat-${itemCategory(plan, it)}" data-i="${i}">
                  <div class="grow">
                    <button class="link-btn" data-change>${itemLabel(it)}${catTag(itemCategory(plan, it))}</button>
                    ${it.written ? `<small class="muted block">En la hoja: ${esc(it.written)}</small>` : ''}
                    ${it.newExercise ? '<button class="btn btn-small btn-inline" data-edit-new>Editar nombre y grupos</button>' : ''}
                    ${plan.progression.length
                      ? progFields(progCount(plan), it)
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
        draw();
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
      if (btn.hasAttribute('data-save')) {
        const result = saveImported(plan, active);
        if (result === true) close();
        else if (result) editNewExercise(result, draw); // ejercicio nuevo sin grupo: se abre para completarlo
        return;
      }
      const { r, i } = locate(btn);
      if (btn.hasAttribute('data-del')) { r.items.splice(i, 1); draw(); }
      else if (btn.hasAttribute('data-edit-new')) editNewExercise(r.items[i], draw);
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

// Devuelve true si se guardó, false si no, o el ejercicio nuevo al que le falta el grupo muscular.
function saveImported(plan, active) {
  const routines = plan.routines.filter((r) => r.dest !== 'skip' && r.items.length);
  if (!routines.length) { toast('Elegí al menos un día con ejercicios.'); return false; }
  if (routines.some((r) => !r.name.trim())) { toast('Poné un nombre a cada rutina.'); return false; }
  const dests = routines.map((r) => r.dest).filter((d) => d !== 'new');
  if (new Set(dests).size !== dests.length) { toast('Dos días de la foto actualizan la misma rutina.'); return false; }
  const noGroup = routines.flatMap((r) => r.items).find((it) => it.newExercise && !it.newExercise.primary);
  if (noGroup) {
    toast(`Elegí el grupo muscular de "${noGroup.newExercise.name}".`);
    return noGroup;
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
      target: (it.target || '').trim(),
      ...(progression.length ? { prog: itemProg(it) } : {}),
    }));
    const existing = active.find((a) => a.id === r.dest);
    if (existing) {
      save('routines', withTable({ ...existing, name: r.name.trim(), items }));
      updated++;
    } else {
      save('routines', withTable({
        name: r.name.trim(),
        createdAt: new Date(now + k).toISOString(), // mismo orden que la hoja si los nombres no tienen número
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
