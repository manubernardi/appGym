// Pestaña "Progreso": por grupo muscular, por ejercicio, récords y peso corporal.

import { GROUPS, WEIGHT_TYPES } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, fmtDate, fmtKg, fmtNum, parseNum, today, toast, confirmDialog } from '../ui.js';
import {
  groupStatsByPeriod, lastPeriods, emptyPeriod, exerciseHistory,
  loggedExerciseIds, records, fmtSets,
} from '../stats.js';

// Lo elegido en pantalla se recuerda mientras la app está abierta.
const ui = { tab: 'grupos', kind: 'week', group: 'Resumen', offset: 0, exerciseId: null };
let charts = [];

const TABS = [['grupos', 'Grupos'], ['ejercicio', 'Ejercicios'], ['records', 'Récords'], ['peso', 'Peso']];

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
  ({ grupos: renderGroups, ejercicio: renderExercise, records: renderRecords, peso: renderBodyweight })[ui.tab](body, container);
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

function stackedBar(canvas, labels, pData, sData, fmt, horizontal = false) {
  const t = chartTheme();
  const valueAxis = {
    stacked: true, beginAtZero: true, grid: { color: t.grid },
    ticks: { callback: (v) => fmt(v), maxTicksLimit: 5 }, border: { display: false },
  };
  const catAxis = {
    stacked: true, grid: { display: false }, border: { display: false },
    ticks: horizontal ? { autoSkip: false } : { maxRotation: 0, autoSkipPadding: 6 },
  };
  makeChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Principal', data: pData, backgroundColor: t.p, borderRadius: 4, borderSkipped: false, borderColor: t.surface, borderWidth: 1 },
        { label: 'Secundario', data: sData, backgroundColor: t.s, borderRadius: 4, borderSkipped: false, borderColor: t.surface, borderWidth: 1 },
      ],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
            footer: (items) => `Total: ${fmt(items.reduce((a, i) => a + i.raw, 0))}`,
          },
        },
      },
    },
  });
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

const fmtSetsN = (v) => fmtNum(v, 0);
const fmtKgAxis = (v) => fmtKg(v);

// --- Grupos -------------------------------------------------------------

function renderGroups(body, container) {
  const kind = ui.kind;
  const stats = groupStatsByPeriod(kind);
  body.innerHTML = `
    <div class="segmented">
      <button class="${kind === 'week' ? 'active' : ''}" data-kind="week">Semanas</button>
      <button class="${kind === 'month' ? 'active' : ''}" data-kind="month">Meses</button>
    </div>
    <div class="chips-scroll">
      ${['Resumen', ...GROUPS].map((g) => `<button class="chip ${ui.group === g ? 'active' : ''}" data-group="${esc(g)}">${esc(g)}</button>`).join('')}
    </div>
    <div class="group-body"></div>`;
  body.querySelectorAll('[data-kind]').forEach((b) => {
    b.onclick = () => { ui.kind = b.dataset.kind; ui.offset = 0; render(container); };
  });
  body.querySelectorAll('[data-group]').forEach((b) => {
    b.onclick = () => { ui.group = b.dataset.group; render(container); };
  });
  const gb = body.querySelector('.group-body');
  if (ui.group === 'Resumen') renderSummary(gb, stats, container);
  else renderGroupDetail(gb, stats);
}

function renderSummary(el, stats, container) {
  const kind = ui.kind;
  const periods = lastPeriods(kind, 52);
  const idx = periods.length - 1 - ui.offset;
  const period = periods[idx];
  const prev = periods[idx - 1];
  const cur = stats[period.key] || emptyPeriod();
  const before = prev ? stats[prev.key] || emptyPeriod() : null;
  const title = kind === 'week'
    ? (ui.offset === 0 ? 'Esta semana' : ui.offset === 1 ? 'Semana pasada' : `Semana del ${period.label}`)
    : (ui.offset === 0 ? 'Este mes' : period.label);

  const rows = GROUPS.map((g) => ({ g, ...cur[g], prevVol: before ? before[g].volP + before[g].volS : null }));
  const totalDays = new Set(rows.flatMap((r) => [...r.daysAny])).size;

  el.innerHTML = `
    <div class="period-nav">
      <button class="icon-btn" data-prev ${idx === 0 ? 'disabled' : ''} aria-label="Anterior">‹</button>
      <strong>${esc(title)}</strong>
      <button class="icon-btn" data-next ${ui.offset === 0 ? 'disabled' : ''} aria-label="Siguiente">›</button>
    </div>
    <div class="stat-tiles">
      <div class="tile"><span class="tile-value">${totalDays}</span><span class="tile-label">días entrenados</span></div>
      <div class="tile"><span class="tile-value">${rows.reduce((a, r) => a + r.setsP, 0)}</span><span class="tile-label">series</span></div>
      <div class="tile"><span class="tile-value">${fmtKg(rows.reduce((a, r) => a + r.volP, 0))}</span><span class="tile-label">volumen</span></div>
    </div>
    <section class="card">
      <h2 class="card-title">Series por grupo</h2>
      <div class="chart-box tall"><canvas></canvas></div>
    </section>
    <section class="card">
      <h2 class="card-title">Detalle</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Grupo</th><th>Series<br><small>princ. / sec.</small></th><th>Volumen<br><small>princ. / sec.</small></th><th>Días</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="${r.setsP + r.setsS ? '' : 'dim'}">
                <td>${esc(r.g)}</td>
                <td><span class="dot p"></span>${r.setsP} / <span class="dot s"></span>${r.setsS}</td>
                <td>${fmtKg(r.volP)} / ${fmtKg(r.volS)}${trend(r.volP + r.volS, r.prevVol)}</td>
                <td>${r.daysP.size}${r.daysAny.size > r.daysP.size ? ` <small class="muted">(${r.daysAny.size})</small>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="note">Volumen = kg × reps (mancuernas × 2; sin peso no suma). Días: como principal (entre paréntesis, incluyendo secundario). La flecha compara el volumen total con el período anterior.</p>
    </section>`;
  el.querySelector('[data-prev]').onclick = () => { ui.offset++; render(container); };
  el.querySelector('[data-next]').onclick = () => { ui.offset--; render(container); };
  stackedBar(el.querySelector('canvas'), GROUPS, rows.map((r) => r.setsP), rows.map((r) => r.setsS), fmtSetsN, true);
}

function trend(now, prev) {
  if (prev === null || (!now && !prev)) return '';
  if (!prev) return ' <small class="trend up">nuevo</small>';
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return ' <small class="trend">=</small>';
  return ` <small class="trend ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'}${Math.abs(pct)}%</small>`;
}

function renderGroupDetail(el, stats) {
  const g = ui.group;
  const periods = lastPeriods(ui.kind, 12);
  const rows = periods.map((p) => ({ ...p, ...(stats[p.key]?.[g] || emptyPeriod()[g]) }));
  const unit = ui.kind === 'week' ? 'semana' : 'mes';
  el.innerHTML = `
    <section class="card">
      <h2 class="card-title">Volumen por ${unit} · ${esc(g)}</h2>
      <div class="chart-box"><canvas data-c="vol"></canvas></div>
    </section>
    <section class="card">
      <h2 class="card-title">Series por ${unit} · ${esc(g)}</h2>
      <div class="chart-box"><canvas data-c="sets"></canvas></div>
    </section>
    <section class="card">
      <h2 class="card-title">Tabla</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>${ui.kind === 'week' ? 'Semana' : 'Mes'}</th><th>Series<br><small>princ. / sec.</small></th><th>Volumen<br><small>princ. / sec.</small></th><th>Días</th></tr></thead>
          <tbody>
            ${[...rows].reverse().map((r) => `
              <tr class="${r.setsP + r.setsS ? '' : 'dim'}">
                <td>${esc(r.label)}</td>
                <td>${r.setsP} / ${r.setsS}</td>
                <td>${fmtKg(r.volP)} / ${fmtKg(r.volS)}</td>
                <td>${r.daysP.size}${r.daysAny.size > r.daysP.size ? ` <small class="muted">(${r.daysAny.size})</small>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
  const labels = rows.map((r) => r.label);
  stackedBar(el.querySelector('[data-c="vol"]'), labels, rows.map((r) => Math.round(r.volP)), rows.map((r) => Math.round(r.volS)), fmtKgAxis);
  stackedBar(el.querySelector('[data-c="sets"]'), labels, rows.map((r) => r.setsP), rows.map((r) => r.setsS), fmtSetsN);
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

function renderRecords(body) {
  const recs = records();
  body.innerHTML = GROUPS.map((g) => {
    const list = recs.filter((r) => r.ex.primary === g).sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'es'));
    if (!list.length) return '';
    return `
      <h2 class="section-title">${esc(g)}</h2>
      <div class="card list">
        ${list.map((r) => {
          const bw = WEIGHT_TYPES[r.ex.type]?.bodyweight;
          const unit = r.ex.type === 'mancuerna' ? 'kg c/u' : 'kg';
          const main = bw && !r.maxW
            ? `<strong>${r.maxReps.r} reps</strong> <small class="muted">${fmtDate(r.maxReps.date)}</small>`
            : `<strong>${fmtNum(r.maxW.w, 2)} ${unit} × ${r.maxW.r}</strong> <small class="muted">${fmtDate(r.maxW.date)}</small>`;
          const extra = !bw && r.bestE1rm
            ? `<small class="muted">1RM est.: ${fmtNum(r.bestE1rm.value)} ${unit} (${fmtNum(r.bestE1rm.w, 2)}×${r.bestE1rm.r}, ${fmtDate(r.bestE1rm.date)})</small>`
            : '';
          return `<div class="list-item record">
            <span>${esc(r.ex.name)}</span>
            <span class="record-val">${main}</span>
            ${extra}
          </div>`;
        }).join('')}
      </div>`;
  }).join('') || '<p class="muted center">Todavía no hay récords.</p>';
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
