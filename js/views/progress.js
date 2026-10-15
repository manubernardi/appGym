// Pestaña "Progreso": resumen del mes, cumplimiento y músculos de la semana, ejercicios, récords y peso corporal.

import { GROUPS, WEIGHT_TYPES } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, fmtDate, fmtNum, parseNum, parseDate, today, toast, confirmDialog, monthName, fmtDuration } from '../ui.js';
import {
  exerciseHistory, loggedExerciseIds, records, fmtSets,
  weekStart, addDays, monthSummary, weekPlan, planWeeks, musclesWorked,
} from '../stats.js';

// Lo elegido en pantalla se recuerda mientras la app está abierta.
const ui = { tab: 'mes', monthOffset: 0, weekOffset: 0, exerciseId: null, recGroup: null };
let charts = [];

const TABS = [['mes', 'Mes'], ['semana', 'Semana'], ['ejercicio', 'Ejercicios'], ['records', 'Récords'], ['peso', 'Peso']];

export function leave() {
  destroyCharts();
}

function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}

export function render(container) {
  destroyCharts();
  container.innerHTML = `
    <h1>Progreso</h1>
    <div class="tabs" role="tablist">
      ${TABS.map(([k, label]) => `<button role="tab" class="tab ${ui.tab === k ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}
    </div>
    <div class="tab-body"></div>`;
  container.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { ui.tab = b.dataset.tab; render(container); };
  });
  const body = container.querySelector('.tab-body');
  if (!state.sessions.length && ui.tab !== 'peso') {
    body.innerHTML = '<div class="card empty"><p>Todavía no hay entrenamientos registrados.</p></div>';
    return;
  }
  ({ mes: renderMonth, semana: renderWeek, ejercicio: renderExercise, records: renderRecords, peso: renderBodyweight })[ui.tab](body, container);
}

// --- Colores y gráficos -------------------------------------------------

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartTheme() {
  return {
      p: css('--series-1'), s: css('--series-2'), text: css('--text-secondary'),
      grid: css('--grid'), surface: css('--surface-1'),
  };
}

function makeChart(canvas, config) {
  const t = chartTheme();
  const Chart = window.Chart;
  if (!Chart) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No se pudo cargar el gráfico (sin conexión).' }));
    return;
  }
  Chart.defaults.color = t.text;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.borderColor = t.grid;
  const { plugins = {}, ...options } = config.options || {};
  const chart = new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      ...options,
      plugins: {
        legend: {
          display: config.data.datasets.length > 1, position: 'top', align: 'start',
          labels: { boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 },
        },
        ...plugins,
        tooltip: { padding: 10, boxPadding: 4, ...plugins.tooltip },
      },
    },
  });
  charts.push(chart);
}

function lineChart(canvas, labels, datasets, fmt) {
  const t = chartTheme();
  const colors = [t.p, t.s];
  makeChart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        ...d,
        borderColor: colors[i], backgroundColor: colors[i],
        borderWidth: 2, pointRadius: labels.length > 12 ? 0 : 4, pointHoverRadius: 6, pointHitRadius: 12,
        pointBorderColor: t.surface, pointBorderWidth: 2, tension: 0.2,
      })),
    },
    options: {
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        y: { grid: { color: t.grid }, border: { display: false }, ticks: { callback: (v) => fmt(v), maxTicksLimit: 5 } },
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } },
      },
    },
  });
}

// --- Cumplimiento y músculos (compartido por Mes y Semana) ---------------

function weekRange(from, to) {
  const f = parseDate(from);
  const t = parseDate(to);
  return f.getMonth() === t.getMonth()
    ? `${f.getDate()} al ${t.getDate()} ${monthName(t.getMonth())}`
    : `${f.getDate()} ${monthName(f.getMonth())} al ${t.getDate()} ${monthName(t.getMonth())}`;
}

function agoLabel(date, ref) {
  const n = Math.round((parseDate(ref) - parseDate(date)) / 86400000);
  return n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
}

// Una fila por semana: días del plan hechos de los que tocaban.
function weeksHtml(weeks) {
  const current = weekStart(today());
  return weeks.map((w) => {
    const full = w.days.length && w.done === w.days.length;
    const live = w.from === current;
    return `
      <div class="list-item week-row">
        <span>${weekRange(w.from, w.to)}${live ? ' <small class="muted">(en curso)</small>' : ''}</span>
        <span class="pct ${full ? 'up' : live ? '' : 'down'}">${w.done} de ${w.days.length}${full ? ' ✓' : ''}</span>
      </div>`;
  }).join('');
}

// --- Mes ----------------------------------------------------------------

const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function oldestDate() {
  return state.sessions.length ? state.sessions[state.sessions.length - 1].date : today();
}

function fmtSet(ex, s) {
  if (WEIGHT_TYPES[ex.type]?.bodyweight && !s.w) return `${s.r} reps`;
  return `${fmtNum(s.w || 0, 2)}${ex.type === 'mancuerna' ? ' c/u' : ''} × ${s.r}`;
}

// Diferencia entre la primera y la última vez: en kg si cambió el peso, si no en reps.
function diffBadge(ex, a, b) {
  const dw = (b.w || 0) - (a.w || 0);
  const [v, unit] = dw ? [dw, ' kg'] : [b.r - a.r, Math.abs(b.r - a.r) === 1 ? ' rep' : ' reps'];
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : '';
  return `<span class="pct ${cls}">${v > 0 ? '▲ +' : v < 0 ? '▼ −' : '= '}${v ? fmtNum(Math.abs(v), 2) + unit : 'igual'}</span>`;
}

function strengthRows(list) {
  return list.map((r) => `
    <div class="list-item prog-row">
      <div class="prog-top"><span>${esc(r.ex.name)}</span>${diffBadge(r.ex, r.first, r.last)}</div>
      <small class="muted">${fmtSet(r.ex, r.first)} (${fmtDate(r.firstDate)}) → ${fmtSet(r.ex, r.last)} (${fmtDate(r.lastDate)})</small>
    </div>`).join('');
}

function renderMonth(body, container) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - ui.monthOffset, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const canPrev = key > oldestDate().slice(0, 7);
  const m = monthSummary(key);
  const weeks = planWeeks(m.from, m.to);
  const compared = [...m.improved, ...m.same, ...m.worse];

  body.innerHTML = `
    <div class="period-nav">
      <button class="icon-btn" data-prev ${canPrev ? '' : 'disabled'} aria-label="Mes anterior">‹</button>
      <strong>${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}${m.inProgress ? ' <small class="muted">(en curso)</small>' : ''}</strong>
      <button class="icon-btn" data-next ${ui.monthOffset === 0 ? 'disabled' : ''} aria-label="Mes siguiente">›</button>
    </div>
    ${!m.sessionCount ? '<div class="card empty"><p>No hay entrenamientos este mes.</p></div>' : `
    <div class="stat-tiles">
      <div class="tile"><span class="tile-value">${m.sessionCount}</span><span class="tile-label">entrenamientos</span></div>
      <div class="tile"><span class="tile-value">${fmtNum(m.sessionCount / m.weeks, 1)}</span><span class="tile-label">por semana</span></div>
      <div class="tile"><span class="tile-value">${m.newRecords.length}</span><span class="tile-label">récords nuevos</span></div>
      ${m.trainedSec ? `<div class="tile"><span class="tile-value">${fmtDuration(m.trainedSec)}</span><span class="tile-label">entrenando</span></div>` : ''}
      ${m.cardioMin ? `<div class="tile"><span class="tile-value">${fmtNum(m.cardioMin, 0)} min</span><span class="tile-label">de cardio</span></div>` : ''}
    </div>

    ${m.newRecords.length ? `
    <section class="card list">
      <h2 class="card-title">🏆 Récords nuevos</h2>
      ${m.newRecords.map((r) => `
        <div class="list-item prog-row">
          <div class="prog-top"><span>${esc(r.ex.name)}</span><strong>${fmtSet(r.ex, r.set)}</strong></div>
          <small class="muted">${fmtDate(r.date)} · antes: ${fmtSet(r.ex, r.prev)}</small>
        </div>`).join('')}
    </section>` : ''}

    ${weeks.length ? `
    <section class="card list">
      <h2 class="card-title">📅 Días del plan por semana</h2>
      ${weeksHtml(weeks)}
      <p class="note pad">Semanas completas: ${weeks.filter((w) => w.days.length && w.done === w.days.length).length} de ${weeks.length}.</p>
    </section>` : ''}

    <section class="card list">
      <h2 class="card-title">💪 Fuerza por ejercicio</h2>
      ${compared.length ? strengthRows(compared) : '<p class="muted pad">Todavía no repetiste ningún ejercicio este mes.</p>'}
      <p class="note pad">Compara la serie más pesada de la primera y la última vez que hiciste cada ejercicio en el mes.${m.once.length ? ` ${m.once.length} ejercicio${m.once.length > 1 ? 's' : ''} hecho${m.once.length > 1 ? 's' : ''} una sola vez no se compara${m.once.length > 1 ? 'n' : ''}.` : ''}</p>
    </section>`}`;

  body.querySelector('[data-prev]').onclick = () => { ui.monthOffset++; render(container); };
  body.querySelector('[data-next]').onclick = () => { ui.monthOffset--; render(container); };
}

// --- Semana -------------------------------------------------------------

function renderWeek(body, container) {
  const from = addDays(weekStart(today()), -7 * ui.weekOffset);
  const to = addDays(from, 6);
  const live = ui.weekOffset === 0;
  const canPrev = from > oldestDate();
  const plan = weekPlan(from);
  const muscles = musclesWorked(from, to);
  const worked = GROUPS.filter((g) => muscles[g].days.size);
  // Los que hace más que no entrenás, primero.
  const rest = GROUPS.filter((g) => !muscles[g].days.size)
    .sort((a, b) => (muscles[a].last || '').localeCompare(muscles[b].last || ''));

  body.innerHTML = `
    <div class="period-nav">
      <button class="icon-btn" data-prev ${canPrev ? '' : 'disabled'} aria-label="Semana anterior">‹</button>
      <strong>${weekRange(from, to)}${live ? ' <small class="muted">(en curso)</small>' : ''}</strong>
      <button class="icon-btn" data-next ${live ? 'disabled' : ''} aria-label="Semana siguiente">›</button>
    </div>
    <section class="card list">
      <h2 class="card-title">📅 Días del plan <small class="muted">· ${plan.done} de ${plan.days.length}</small></h2>
      ${plan.days.map(({ routine, dates }) => `
        <div class="list-item week-row">
          <span>${esc(routine.name)}</span>
          ${dates.length
            ? `<span class="pct up">✓ ${dates.map((d) => fmtDate(d, true)).join(', ')}</span>`
            : `<span class="pct ${live ? '' : 'down'}">${live ? 'pendiente' : '✗ sin entrenar'}</span>`}
        </div>`).join('') || '<p class="muted pad">No tenés rutinas en el plan.</p>'}
      ${plan.extra.map((s) => `
        <div class="list-item week-row">
          <span>${esc(s.routineName || 'Entrenamiento')}</span>
          <span class="pct">${fmtDate(s.date, true)}</span>
        </div>`).join('')}
    </section>
    <section class="card list">
      <h2 class="card-title">💪 Músculos trabajados</h2>
      ${worked.map((g) => `
        <div class="list-item week-row">
          <span>${esc(g)}</span>
          <span class="pct up">${muscles[g].days.size} ${muscles[g].days.size === 1 ? 'día' : 'días'}</span>
        </div>`).join('') || '<p class="muted pad">Ninguno esta semana.</p>'}
      ${rest.length ? `<h3 class="sub-title">Sin trabajar esta semana</h3>
      ${rest.map((g) => `
        <div class="list-item week-row">
          <span class="muted">${esc(g)}</span>
          <small class="muted">${muscles[g].last ? `última: ${agoLabel(muscles[g].last, live ? today() : to)}` : 'nunca'}</small>
        </div>`).join('')}` : ''}
      <p class="note pad">Cuenta solo el grupo principal de cada ejercicio.</p>
    </section>`;

  body.querySelector('[data-prev]').onclick = () => { ui.weekOffset++; render(container); };
  body.querySelector('[data-next]').onclick = () => { ui.weekOffset--; render(container); };
}

// --- Ejercicio ----------------------------------------------------------

function renderExercise(body, container) {
  const ids = loggedExerciseIds();
  const exs = [...ids].map((id) => state.exercises.get(id)).filter(Boolean);
  if (!exs.length) {
    body.innerHTML = '<p class="muted center">Todavía no hay ejercicios registrados.</p>';
    return;
  }
  if (!ids.has(ui.exerciseId) || !state.exercises.has(ui.exerciseId)) {
    // Por defecto, el último ejercicio que hiciste.
    const last = state.sessions.flatMap((s) => s.entries || []).find((en) => state.exercises.has(en.exerciseId) && ids.has(en.exerciseId));
    ui.exerciseId = last?.exerciseId || exs[0].id;
  }
  const ex = state.exercises.get(ui.exerciseId);
  const bw = WEIGHT_TYPES[ex.type]?.bodyweight;
  const hist = exerciseHistory(ex.id);
  const unit = WEIGHT_TYPES[ex.type]?.short || 'kg';

  body.innerHTML = `
    <select class="input" data-ex aria-label="Ejercicio">
      ${GROUPS.map((g) => {
        const list = exs.filter((e) => e.primary === g);
        return list.length ? `<optgroup label="${esc(g)}">${list.map((e) =>
          `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>` : '';
      }).join('')}
    </select>
    <section class="card">
      <h2 class="card-title">${bw ? 'Máximo de repeticiones' : `Peso máximo y fuerza estimada (${esc(unit)})`}</h2>
      <div class="chart-box"><canvas></canvas></div>
      ${bw ? '' : '<p class="note">Fuerza estimada (1RM): cuánto podrías levantar a 1 repetición según tus series (fórmula de Epley).</p>'}
    </section>
    <section class="card list">
      <h2 class="card-title">Historial</h2>
      ${[...hist].reverse().map((h) => `
        <a class="list-item" href="#entrenar/${h.sessionId}">
          <span>${fmtDate(h.date, true)}</span>
          <small>${esc(fmtSets(h.sets, ex))}</small>
        </a>`).join('')}
    </section>`;
  body.querySelector('[data-ex]').onchange = (e) => { ui.exerciseId = e.target.value; render(container); };

  const labels = hist.map((h) => fmtDate(h.date));
  const canvas = body.querySelector('canvas');
  if (bw) {
    lineChart(canvas, labels, [{ label: 'Máx. reps', data: hist.map((h) => h.maxReps) }], (v) => `${fmtNum(v, 0)}`);
  } else {
    lineChart(canvas, labels, [
      { label: 'Peso máximo', data: hist.map((h) => h.maxW) },
      { label: 'Fuerza estimada (1RM)', data: hist.map((h) => Math.round(h.bestE1rm * 10) / 10) },
    ], (v) => `${fmtNum(v, 1)} kg`);
  }
}

// --- Récords ------------------------------------------------------------

// Marca de un récord: el número grande y las reps aparte.
function recordValue(ex, set) {
  if (WEIGHT_TYPES[ex.type]?.bodyweight && !set.w) return `<strong>${set.r}</strong> <small>reps</small>`;
  return `<strong>${fmtNum(set.w || 0, 2)}</strong> <small>${ex.type === 'mancuerna' ? 'kg c/u' : 'kg'} × ${set.r}</small>`;
}

function recordRow(r) {
  return `
    <button class="list-item rec-row" data-ex="${r.ex.id}">
      <span class="rec-info">
        <span class="rec-name">${esc(r.ex.name)}</span>
        <small class="muted">${agoLabel(r.date, today())}${r.prev ? ` · antes ${fmtSet(r.ex, r.prev)}` : ''}</small>
      </span>
      <span class="rec-val">${recordValue(r.ex, r.best)}</span>
    </button>`;
}

function renderRecords(body, container) {
  const recs = records().sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'es'));
  if (!recs.length) {
    body.innerHTML = '<p class="muted center">Todavía no hay récords.</p>';
    return;
  }
  const groups = GROUPS.filter((g) => recs.some((r) => r.ex.primary === g));
  if (!groups.includes(ui.recGroup)) ui.recGroup = null;
  // Récords que superaron a uno anterior en los últimos 30 días, el más nuevo primero.
  const since = addDays(today(), -30);
  const recent = recs.filter((r) => r.prev && r.date >= since).sort((a, b) => b.date.localeCompare(a.date));
  const shown = ui.recGroup ? [ui.recGroup] : groups;

  body.innerHTML = `
    <div class="chips-scroll" role="tablist">
      <button class="chip ${ui.recGroup ? '' : 'active'}" data-group="">Todos</button>
      ${groups.map((g) => `<button class="chip ${ui.recGroup === g ? 'active' : ''}" data-group="${esc(g)}">${esc(g)}</button>`).join('')}
    </div>
    ${!ui.recGroup && recent.length ? `
    <section class="card list rec-recent">
      <h2 class="card-title">🏆 Nuevos en los últimos 30 días</h2>
      ${recent.map((r) => `
        <button class="list-item rec-row" data-ex="${r.ex.id}">
          <span class="rec-info">
            <span class="rec-name">${esc(r.ex.name)}</span>
            <small class="muted">${fmtDate(r.date, true)} · ${diffBadge(r.ex, r.prev, r.best)}</small>
          </span>
          <span class="rec-val">${recordValue(r.ex, r.best)}</span>
        </button>`).join('')}
    </section>` : ''}
    ${shown.map((g) => `
      <h2 class="section-title">${esc(g)}</h2>
      <div class="card list">${recs.filter((r) => r.ex.primary === g).map(recordRow).join('')}</div>`).join('')}
    <p class="note">Récord: la serie con más peso (a igual peso, más reps; sin peso, más reps). Tocá un ejercicio para ver su evolución.</p>`;

  body.querySelectorAll('[data-group]').forEach((b) => {
    b.onclick = () => { ui.recGroup = b.dataset.group || null; render(container); };
  });
  body.querySelectorAll('[data-ex]').forEach((b) => {
    b.onclick = () => { ui.exerciseId = b.dataset.ex; ui.tab = 'ejercicio'; render(container); window.scrollTo(0, 0); };
  });
}

// --- Peso corporal ------------------------------------------------------

function renderBodyweight(body) {
  const list = state.bodyweight;
  const last = list[list.length - 1];
  const first = list[0];
  body.innerHTML = `
    <form class="card form inline-form">
      <label>Fecha <input class="input" type="date" name="date" value="${today()}" required></label>
      <label>Peso (kg) <input class="input" name="kg" inputmode="decimal" placeholder="${last ? fmtNum(last.kg) : '75'}" required></label>
      <button class="btn btn-primary">Guardar</button>
    </form>
    ${list.length ? `
      <div class="stat-tiles">
        <div class="tile"><span class="tile-value">${fmtNum(last.kg)} kg</span><span class="tile-label">actual (${fmtDate(last.date)})</span></div>
        <div class="tile"><span class="tile-value">${diff(last.kg - first.kg)}</span><span class="tile-label">desde ${fmtDate(first.date)}</span></div>
      </div>
      ${list.length > 1 ? `<section class="card">
        <h2 class="card-title">Peso corporal (kg)</h2>
        <div class="chart-box"><canvas></canvas></div>
      </section>` : ''}
      <section class="card list">
        ${[...list].reverse().map((b) => `
          <div class="list-item row">
            <span>${fmtDate(b.date, true)}</span>
            <strong>${fmtNum(b.kg)} kg</strong>
            <button class="icon-btn small" data-del="${b.id}" aria-label="Borrar">✕</button>
          </div>`).join('')}
      </section>` : '<p class="muted center">Todavía no registraste tu peso.</p>'}`;

  body.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const kg = parseNum(fd.get('kg'));
    if (!kg || kg <= 0) { toast('Peso inválido.'); return; }
    const date = fd.get('date');
    const existing = list.find((b) => b.date === date);
    save('bodyweight', { ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}), date, kg });
  };
  body.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (await confirmDialog('¿Borrar este registro de peso?', 'Borrar', true)) remove('bodyweight', b.dataset.del);
    };
  });
  const canvas = body.querySelector('canvas');
  if (canvas) {
    lineChart(canvas, list.map((b) => fmtDate(b.date)), [{ label: 'Peso', data: list.map((b) => b.kg) }], (v) => `${fmtNum(v, 1)} kg`);
  }
}

function diff(d) {
  const s = fmtNum(Math.abs(d)) + ' kg';
  return d > 0 ? '+' + s : d < 0 ? '−' + s : s;
}
