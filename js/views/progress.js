// Pestaña "Progreso": resumen del mes, balance semanal, ejercicios, récords y peso corporal.

import { GROUPS, WEIGHT_TYPES } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import { esc, fmtDate, fmtNum, parseNum, parseDate, today, toast, confirmDialog, monthName } from '../ui.js';
import {
  exerciseHistory, loggedExerciseIds, records, fmtSets,
  weekStart, addDays, groupSets, monthSummary, TARGET_MIN, TARGET_MAX,
} from '../stats.js';

// Lo elegido en pantalla se recuerda mientras la app está abierta.
const ui = { tab: 'mes', monthOffset: 0, weekOffset: 0, exerciseId: null };
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

// --- Balance de series por grupo (compartido por Mes y Semana) ------------

function status(v) {
  if (v === 0) return { cls: 'zero', label: '—' };
  if (v < TARGET_MIN) return { cls: 'low', label: '↓ bajo' };
  if (v > TARGET_MAX) return { cls: 'high', label: '↑ alto' };
  return { cls: 'ok', label: '✓ bien' };
}

// field: 'total' (series de la semana) o 'perWeek' (promedio semanal del mes).
function balanceHtml(groups, field) {
  const max = Math.max(TARGET_MAX + 5, ...GROUPS.map((g) => groups[g][field]));
  const pct = (v) => Math.min(100, (v / max) * 100);
  return `
    <div class="bal">
      <div class="bal-grid bal-scale" aria-hidden="true">
        <span></span>
        <span class="bal-axis">
          ${[0, TARGET_MIN, TARGET_MAX].map((t) => `<span style="left:${pct(t)}%">${t}</span>`).join('')}
        </span>
        <span></span><span></span>
      </div>
      ${GROUPS.map((g) => {
        const row = groups[g];
        const v = row[field];
        const st = status(v);
        const items = [...row.items.values()].sort((a, b) => b.sets - a.sets);
        return `
          <details class="bal-row">
            <summary class="bal-grid">
              <span class="bal-name">${esc(g)}</span>
              <span class="bal-track">
                <span class="bal-band" style="left:${pct(TARGET_MIN)}%;width:${pct(TARGET_MAX) - pct(TARGET_MIN)}%"></span>
                <span class="bal-fill" style="width:${pct(v)}%"></span>
              </span>
              <span class="bal-val">${fmtNum(v, 1)}</span>
              <span class="bal-status ${st.cls}">${st.label}</span>
            </summary>
            <div class="bal-items">
              ${items.length ? items.map((it) => `
                <div><span>${esc(it.name)}${it.secondary ? ' <small class="muted">(secundario)</small>' : ''}</span>
                <span>${fmtNum(it.sets, 1)} series${field === 'perWeek' ? ' en el mes' : ''}</span></div>`).join('')
                : '<p class="muted">Sin series.</p>'}
            </div>
          </details>`;
      }).join('')}
    </div>
    <p class="note">Series: el grupo principal cuenta 1 y el secundario ½. Franja gris: objetivo de ${TARGET_MIN} a ${TARGET_MAX} series por semana. Tocá un grupo para ver los ejercicios.</p>`;
}

function balanceCount(groups, field) {
  const vals = GROUPS.map((g) => groups[g][field]);
  return {
    ok: vals.filter((v) => v >= TARGET_MIN && v <= TARGET_MAX).length,
    low: vals.filter((v) => v < TARGET_MIN).length,
    high: vals.filter((v) => v > TARGET_MAX).length,
  };
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

function pctBadge(p) {
  const r = Math.round(p);
  return `<span class="pct ${r > 0 ? 'up' : r < 0 ? 'down' : ''}">${r > 0 ? '▲ +' : r < 0 ? '▼ ' : ''}${r}%</span>`;
}

function progressRows(list) {
  return list.map((r) => `
    <div class="list-item prog-row">
      <div class="prog-top"><span>${esc(r.ex.name)}</span>${pctBadge(r.pct)}</div>
      <small class="muted">${fmtSet(r.ex, r.first)} (${fmtDate(r.firstDate)}) → ${fmtSet(r.ex, r.last)} (${fmtDate(r.lastDate)})</small>
    </div>`).join('');
}

function renderMonth(body, container) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - ui.monthOffset, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const canPrev = key > oldestDate().slice(0, 7);
  const m = monthSummary(key);

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

    <section class="card list">
      <h2 class="card-title">📈 Cómo te fue en el mes</h2>
      ${m.improved.length ? `<h3 class="sub-title">Mejoraron (${m.improved.length})</h3>${progressRows(m.improved)}` : ''}
      ${m.same.length ? `<h3 class="sub-title">Se mantuvieron (${m.same.length})</h3>${progressRows(m.same)}` : ''}
      ${m.worse.length ? `<h3 class="sub-title">Bajaron (${m.worse.length})</h3>${progressRows(m.worse)}` : ''}
      ${!m.improved.length && !m.same.length && !m.worse.length
        ? '<p class="muted pad">Todavía no repetiste ningún ejercicio este mes.</p>' : ''}
      <p class="note pad">Compara la mejor serie de la primera y la última vez que hiciste cada ejercicio en el mes (más peso o más reps suben el %).${m.once.length ? ` ${m.once.length} ejercicio${m.once.length > 1 ? 's' : ''} hecho${m.once.length > 1 ? 's' : ''} una sola vez no se compara${m.once.length > 1 ? 'n' : ''}.` : ''}</p>
    </section>

    <section class="card">
      <h2 class="card-title">Series por grupo <small class="muted">(promedio por semana)</small></h2>
      ${balanceHtml(m.groups, 'perWeek')}
    </section>`}`;

  body.querySelector('[data-prev]').onclick = () => { ui.monthOffset++; render(container); };
  body.querySelector('[data-next]').onclick = () => { ui.monthOffset--; render(container); };
}

// --- Semana -------------------------------------------------------------

function renderWeek(body, container) {
  const from = addDays(weekStart(today()), -7 * ui.weekOffset);
  const to = addDays(from, 6);
  const canPrev = from > oldestDate();
  const groups = groupSets(from, to);
  const c = balanceCount(groups, 'total');
  const f = parseDate(from);
  const t = parseDate(to);
  const range = f.getMonth() === t.getMonth()
    ? `${f.getDate()} al ${t.getDate()} ${monthName(t.getMonth())}`
    : `${f.getDate()} ${monthName(f.getMonth())} al ${t.getDate()} ${monthName(t.getMonth())}`;
  const sessions = state.sessions.filter((s) => s.date >= from && s.date <= to).length;

  body.innerHTML = `
    <div class="period-nav">
      <button class="icon-btn" data-prev ${canPrev ? '' : 'disabled'} aria-label="Semana anterior">‹</button>
      <strong>${range}${ui.weekOffset === 0 ? ' <small class="muted">(en curso)</small>' : ''}</strong>
      <button class="icon-btn" data-next ${ui.weekOffset === 0 ? 'disabled' : ''} aria-label="Semana siguiente">›</button>
    </div>
    <div class="stat-tiles">
      <div class="tile"><span class="tile-value">${sessions}</span><span class="tile-label">entrenamientos</span></div>
      <div class="tile"><span class="tile-value">${c.ok}</span><span class="tile-label">grupos en rango</span></div>
      <div class="tile"><span class="tile-value">${c.low}</span><span class="tile-label">grupos bajos</span></div>
    </div>
    <section class="card">
      <h2 class="card-title">Series por grupo</h2>
      ${balanceHtml(groups, 'total')}
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
