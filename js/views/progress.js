// Pestaña "Progreso": resumen del mes, análisis (reporte del plan, cumplimiento, estancados, balance y fuerza relativa),
// cumplimiento y músculos de la semana, ejercicios, récords y peso corporal.
// #progreso/<pestaña> abre directo en esa pestaña (ej. #progreso/analisis).

import { GROUPS, WEIGHT_TYPES } from '../data.js';
import { state } from '../store.js';
import { save, remove } from '../db.js';
import {
  esc, fmtDate, fmtNum, fmtKg, parseNum, parseDate, toISODate, today, toast, confirmDialog, monthName, fmtDuration,
} from '../ui.js';
import {
  exerciseHistory, loggedExerciseIds, records, fmtSets,
  weekStart, addDays, monthSummary, weekPlan, planWeeks, musclesWorked,
  trainingDays, weekStreak, weeklyVolume, movingAverage, e1rm, strengthScore,
} from '../stats.js';
import { fmtSet, diffParts, diffBadge, setHtml } from '../set-format.js';
import {
  planInfo, strengthChange, recordsBetween, targetCompliance, stalledExercises, muscleBalance, relativeStrength,
  LEVELS, PUSH, PULL,
} from '../analysis.js';

// Lo elegido en pantalla se recuerda mientras la app está abierta.
const ui = {
  tab: 'mes', monthOffset: 0, weekOffset: 0, exerciseId: null, recGroup: null,
  range: 'todo', volume: 'sets', strAll: false, recAll: false, planAll: false,
  sex: readSex(), // referencias de fuerza relativa: 'm' (hombres) o 'f' (mujeres)
};
let ai = { key: null, text: '', loading: false, error: '' }; // resumen con IA del reporte del plan
let appliedArg = null; // #progreso/<pestaña>: se aplica una vez al llegar, no en cada actualización de datos

function readSex() {
  try { return localStorage.getItem('fuerzaRef') === 'f' ? 'f' : 'm'; } catch { return 'm'; }
}
let charts = [];
let shown = null;    // contenedor de la pestaña, para redibujar si cambia el tema
let lastTab = null;  // los gráficos se animan solo al entrar a una pestaña
let animate = false;

const TABS = [['mes', 'Mes'], ['analisis', 'Análisis'], ['semana', 'Semana'], ['ejercicio', 'Ejercicios'], ['records', 'Récords'], ['peso', 'Peso']];

export function leave() {
  destroyCharts();
  shown = null;
  lastTab = null;
  appliedArg = null;
}

function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}

// Al pasar de claro a oscuro (o al revés) los colores salen de otras variables: se redibuja.
window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
  if (shown && charts.length) render(shown);
});

export function render(container, arg) {
  if (arg && arg !== appliedArg && TABS.some(([k]) => k === arg)) ui.tab = arg;
  appliedArg = arg ?? appliedArg;
  destroyCharts();
  shown = container;
  animate = ui.tab !== lastTab;
  lastTab = ui.tab;
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
  ({ mes: renderMonth, analisis: renderAnalysis, semana: renderWeek, ejercicio: renderExercise, records: renderRecords, peso: renderBodyweight })[ui.tab](body, container);
}

// --- Colores y gráficos -------------------------------------------------

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartTheme() {
  return {
    p: css('--series-1'), s: css('--series-2'), text: css('--text-secondary'), strong: css('--text-primary'),
    grid: css('--grid'), surface: css('--surface-1'), border: css('--border'),
  };
}

// '#2a78d6' -> 'rgba(42,120,214,a)'
function fade(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Degradé del color de la serie hacia transparente, de arriba hacia abajo del área del gráfico.
function gradient(color) {
  return ({ chart }) => {
    const area = chart.chartArea;
    if (!area) return 'transparent';
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, fade(color, 0.22));
    g.addColorStop(1, fade(color, 0));
    return g;
  };
}

// Los valores por defecto de Chart.js se ponen una vez por tema, no en cada gráfico.
let themed = null;

function makeChart(canvas, config) {
  const t = chartTheme();
  const Chart = window.Chart;
  if (!Chart) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No se pudo cargar el gráfico (sin conexión).' }));
    return;
  }
  if (themed !== t.text + t.grid) {
    Chart.defaults.color = t.text;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.borderColor = t.grid;
    themed = t.text + t.grid;
  }
  const { plugins = {}, ...options } = config.options || {};
  const chart = new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animate ? { duration: 300, easing: 'easeOutCubic' } : false,
      interaction: { mode: 'index', intersect: false },
      ...options,
      plugins: {
        legend: {
          display: config.data.datasets.length > 1, position: 'top', align: 'start',
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14 },
        },
        ...plugins,
        tooltip: {
          backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
          titleColor: t.strong, bodyColor: t.text, footerColor: t.strong,
          padding: 10, boxPadding: 4, cornerRadius: 8, usePointStyle: true,
          titleFont: { weight: '600' }, footerFont: { weight: '600' },
          ...plugins.tooltip,
        },
      },
    },
  });
  charts.push(chart);
}

const DAY = 86400000;
const ts = (iso) => parseDate(iso).getTime();

// Marcas del eje de tiempo: unas 4 fechas a días enteros, del primer al último registro.
function dateTicks(first, last) {
  const days = Math.round((last - first) / DAY);
  const step = Math.max(1, Math.ceil(days / 4));
  const start = toISODate(new Date(first));
  const out = [];
  for (let d = 0; d <= days; d += step) out.push({ value: ts(addDays(start, d)) });
  return out;
}

// Línea sobre el tiempo real: dos registros separados por 3 semanas quedan más lejos que dos separados por 2 días.
// datasets: [{ label, color, data: [{ x, y, date, pr? }], fill?, radius?, line? }]
function timeChart(canvas, datasets, fmt) {
  const t = chartTheme();
  const xs = datasets.flatMap((d) => d.data.map((p) => p.x));
  const first = Math.min(...xs);
  const last = Math.max(...xs);
  const pad = Math.max((last - first) * 0.03, DAY);
  const many = xs.length / datasets.length > 12;
  makeChart(canvas, {
    type: 'line',
    data: {
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        showLine: d.line !== false,
        borderColor: d.color, pointBackgroundColor: d.color,
        backgroundColor: d.fill ? gradient(d.color) : d.color,
        fill: d.fill ? 'start' : false,
        borderWidth: 2, tension: 0.25,
        pointRadius: (ctx) => (ctx.raw?.pr ? 6 : d.radius ?? (many ? 0 : 3.5)),
        pointStyle: (ctx) => (ctx.raw?.pr ? 'rectRot' : 'circle'),
        pointHoverRadius: 6, pointHitRadius: 12,
        pointBorderColor: t.surface, pointBorderWidth: (ctx) => (ctx.raw?.pr ? 2 : 1.5),
        order: d.line === false ? 1 : 0,
      })),
    },
    options: {
      scales: {
        x: {
          type: 'linear', min: first - pad, max: last + pad,
          grid: { display: false }, border: { display: false },
          afterBuildTicks: (axis) => { axis.ticks = dateTicks(first, last); },
          ticks: { callback: (v) => fmtDate(toISODate(new Date(v))), maxRotation: 0, autoSkipPadding: 16 },
        },
        y: { grace: '8%', grid: { color: t.grid }, border: { display: false }, ticks: { callback: (v) => fmt(v), maxTicksLimit: 5 } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => fmtDate(items[0].raw.date, true),
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw.y)}`,
            footer: (items) => (items.some((i) => i.raw.pr) ? '🏆 Récord nuevo' : ''),
          },
        },
      },
    },
  });
}

// Rango de tiempo de los gráficos de evolución. Solo se ofrecen los que recortan algo.
const RANGES = [['1m', '1M', 1], ['3m', '3M', 3], ['6m', '6M', 6], ['1a', '1A', 12], ['todo', 'Todo', 0]];

function rangeFrom(key) {
  const months = RANGES.find(([k]) => k === key)?.[2];
  if (!months) return '';
  const d = parseDate(today());
  d.setMonth(d.getMonth() - months);
  return toISODate(d);
}

// La lista recortada al rango elegido y los botones para cambiarlo ('' si no hay nada que recortar).
function withRange(list, getDate) {
  const oldest = list.length ? getDate(list[0]) : today();
  const options = RANGES.filter(([k]) => k === 'todo' || rangeFrom(k) > oldest);
  if (!options.some(([k]) => k === ui.range)) ui.range = 'todo';
  const from = rangeFrom(ui.range);
  return {
    list: list.filter((x) => getDate(x) >= from),
    html: options.length > 1 ? `
      <div class="segmented range" role="tablist" aria-label="Período">
        ${options.map(([k, label]) => `<button role="tab" class="${ui.range === k ? 'active' : ''}" data-range="${k}">${label}</button>`).join('')}
      </div>` : '',
  };
}

function bindRange(body, container) {
  body.querySelectorAll('[data-range]').forEach((b) => {
    b.onclick = () => { ui.range = b.dataset.range; render(container); };
  });
}

// Número grande de una tarjeta y cuánto cambió en el período. good: true si subir es bueno, null si da igual.
function heroHtml({ value, unit, label, delta, deltaFmt, since, good = true }) {
  let change = '';
  if (delta !== undefined) {
    const dir = Math.abs(delta) < 1e-9 ? 0 : Math.sign(delta);
    const cls = good === null || !dir ? '' : (dir > 0) === good ? 'up' : 'down';
    const text = dir ? `${dir > 0 ? '▲ +' : '▼ −'}${deltaFmt(Math.abs(delta))}` : '= igual';
    change = `<span class="hero-delta"><span class="pct ${cls}">${text}</span> <span class="muted">desde ${fmtDate(since)}</span></span>`;
  }
  return `
    <div class="hero">
      <span class="hero-value">${value}${unit ? ` <small>${unit}</small>` : ''}</span>
      ${change}
      <span class="hero-label">${label}</span>
    </div>`;
}

// Mini gráfico de tendencia para las listas (SVG, sin Chart.js).
function sparkline(values) {
  if (values.length < 2) return '<span class="spark"></span>';
  const W = 64;
  const H = 24;
  const P = 3;
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const pts = values.map((v, i) => [
    P + (i * (W - 2 * P)) / (values.length - 1),
    span ? H - P - ((v - min) / span) * (H - 2 * P) : H / 2,
  ].map((n) => n.toFixed(1)));
  const [lx, ly] = pts[pts.length - 1];
  return `
    <svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" />
      <circle cx="${lx}" cy="${ly}" r="2.5" />
    </svg>`;
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

// Cuántos mejoraron, quedaron igual o bajaron, como etiquetas (solo las que tienen algo).
function strengthSummary(m) {
  return [[m.improved, 'up', '▲', 'mejoraron', 'mejoró'], [m.same, '', '=', 'igual', 'igual'], [m.worse, 'down', '▼', 'bajaron', 'bajó']]
    .filter(([l]) => l.length)
    .map(([l, cls, icon, many, one]) => `<span class="delta-pill ${cls}">${icon} ${l.length} ${l.length === 1 ? one : many}</span>`)
    .join('');
}

// Cuánto cambió, en proporción: fuerza estimada (1RM) con peso, reps sin peso.
// Así +20 kg en prensa no le gana a +2,5 kg en press militar solo por ser más kilos.
function strengthGain(r) {
  const a = strengthScore(r.ex, r.first);
  return a ? (strengthScore(r.ex, r.last) - a) / a : 0;
}

const STR_TOP = 3;

// Los primeros STR_TOP de la lista y, al final, el botón para ver todos (o menos). flag: clave de ui.
// Devuelve los elementos a mostrar con el HTML del botón como último elemento.
function foldList(list, flag, noun) {
  if (list.length <= STR_TOP + 1) return list;
  return ui[flag]
    ? [...list, `<button class="list-item more-btn" data-fold="${flag}">Ver menos</button>`]
    : [...list.slice(0, STR_TOP), `<button class="list-item more-btn" data-fold="${flag}">Ver los ${list.length} ${noun}</button>`];
}

// Plegado: las mejoras más grandes y lo que bajó. Desplegado: todos (mejoras de mayor a menor, iguales, bajas).
// flag: clave de ui que recuerda si la lista está desplegada (cada tarjeta tiene la suya).
function strengthList(m, flag = 'strAll') {
  const byGain = (a, b) => strengthGain(b) - strengthGain(a);
  const improved = [...m.improved].sort(byGain);
  const worse = [...m.worse].sort(byGain);
  const total = improved.length + m.same.length + worse.length;
  const folded = Math.min(improved.length, STR_TOP) + Math.min(worse.length, STR_TOP);
  // Si plegar esconde 1 o ninguno, no vale la pena el botón.
  if (total - folded <= 1) return strengthRows([...improved, ...m.same, ...worse]);
  if (ui[flag]) {
    return `${strengthRows([...improved, ...m.same, ...worse])}
      <button class="list-item more-btn" data-fold="${flag}">Ver menos</button>`;
  }
  return `
    ${improved.length ? `<h3 class="sub-title">Lo que más subió</h3>${strengthRows(improved.slice(0, STR_TOP))}` : ''}
    ${worse.length ? `<h3 class="sub-title">Lo que más bajó</h3>${strengthRows(worse.slice(-STR_TOP).reverse())}` : ''}
    <button class="list-item more-btn" data-fold="${flag}">Ver los ${total} ejercicios</button>`;
}

// Color según el cambio de fuerza (1RM estimado), no según el peso: 42,5×7 → 40×11 es verde.
const dirClass = (dir) => (dir > 0 ? 'up' : dir < 0 ? 'down' : '');

function strengthRows(list) {
  return list.map((r) => {
    const d = diffParts(r.first, r.last);
    return `
    <div class="list-item str-row" title="${fmtDate(r.firstDate)} → ${fmtDate(r.lastDate)}">
      <span class="str-main">
        <span class="str-name">${esc(r.ex.name)}</span>
        <span class="str-sets"><span class="muted">${fmtSet(r.ex, r.first)}</span> → <span class="str-now">${setHtml(r.ex, r.last, r.first)}</span></span>
      </span>
      <span class="delta-pill ${dirClass(r.dir)}">${d.dir ? d.text : 'igual'}</span>
    </div>`;
  }).join('');
}

// Mapa de constancia: una columna por semana (lunes arriba), un cuadrito por día con el tono según las series.
const HEAT_LEVELS = [1, 10, 18, 25]; // series desde las que se pasa a cada tono
const HEAT_DAYS = ['lun', '', 'mié', '', 'vie', '', 'dom'];

function heatLevel(sets) {
  return Math.max(1, HEAT_LEVELS.filter((n) => sets >= n).length);
}

// Las semanas que terminan en la de `end`.
function heatmap(end) {
  const weeks = window.innerWidth >= 480 ? 26 : 17;
  const start = addDays(weekStart(end), -7 * (weeks - 1));
  const days = trainingDays(start, addDays(weekStart(end), 6));
  const now = today();
  const cells = [];
  const months = [];
  for (let w = 0; w < weeks; w++) {
    const from = addDays(start, 7 * w);
    for (let i = 0; i < 7; i++) {
      const date = addDays(from, i);
      if (date.endsWith('-01')) months.push({ col: w, label: monthName(parseDate(date).getMonth()) });
      if (date > now) { cells.push('<span class="heat-cell future"></span>'); continue; }
      const day = days.get(date);
      const tip = `${fmtDate(date, true)}: ${day ? `${day.sets} series` : 'sin entrenar'}`;
      cells.push(`<span class="heat-cell${day ? ` l${heatLevel(day.sets)}` : ''}" data-day="${date}" title="${tip}"></span>`);
    }
  }
  // El primer mes se nombra en la primera columna si el siguiente nombre no queda pegado.
  if (!months.length || months[0].col >= 3) months.unshift({ col: 0, label: monthName(parseDate(start).getMonth()) });
  const trained = [...days.keys()].filter((d) => d <= now).length;
  return {
    days,
    html: `
    <section class="card">
      <h2 class="card-title">🔥 Constancia</h2>
      <div class="heat-stats">
        <div><strong>${trained}</strong><small>días entrenados en ${weeks} semanas</small></div>
        <div><strong>${weekStreak(now)}</strong><small>semanas seguidas entrenando</small></div>
      </div>
      <div class="heat" style="--weeks: ${weeks}">
        <div class="heat-months">${months.map((m) => `<span style="grid-column: ${m.col + 1} / span 3">${m.label}</span>`).join('')}</div>
        <div class="heat-days">${HEAT_DAYS.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="heat-grid">${cells.join('')}</div>
      </div>
      <div class="heat-foot">
        <span class="heat-info muted">Tocá un día para ver el detalle.</span>
        <span class="heat-legend">Menos <span class="heat-cell"></span>${HEAT_LEVELS.map((_, i) => `<span class="heat-cell l${i + 1}"></span>`).join('')} Más</span>
      </div>
    </section>`,
  };
}

function bindHeatmap(body, days) {
  const info = body.querySelector('.heat-info');
  body.querySelector('.heat-grid').onclick = (e) => {
    const cell = e.target.closest?.('[data-day]');
    if (!cell) return;
    body.querySelectorAll('.heat-cell.sel').forEach((c) => c.classList.remove('sel'));
    cell.classList.add('sel');
    const date = cell.dataset.day;
    const day = days.get(date);
    info.textContent = day
      ? `${fmtDate(date, true)} · ${day.names.join(' + ')} · ${day.sets} series`
      : `${fmtDate(date, true)} · sin entrenar`;
  };
}

function renderMonth(body, container) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - ui.monthOffset, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const canPrev = key > oldestDate().slice(0, 7);
  const m = monthSummary(key);
  const weeks = planWeeks(m.from, m.to);
  const compared = [...m.improved, ...m.same, ...m.worse];
  const heat = heatmap(m.to);

  body.innerHTML = `
    <div class="period-nav">
      <button class="icon-btn" data-prev ${canPrev ? '' : 'disabled'} aria-label="Mes anterior">‹</button>
      <strong>${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}${m.inProgress ? ' <small class="muted">(en curso)</small>' : ''}</strong>
      <button class="icon-btn" data-next ${ui.monthOffset === 0 ? 'disabled' : ''} aria-label="Mes siguiente">›</button>
    </div>
    ${heat.html}
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
      <h2 class="card-title">🏆 Récords nuevos <small class="muted">· ${m.newRecords.length}</small></h2>
      ${foldList(m.newRecords.sort((a, b) => b.date.localeCompare(a.date)), 'recAll', 'récords').map((r) => typeof r === 'string' ? r : `
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
      ${compared.length ? `<div class="str-summary">${strengthSummary(m)}</div>${strengthList(m)}` : '<p class="muted pad">Todavía no repetiste ningún ejercicio este mes.</p>'}
      <p class="note pad">Compara la serie más pesada de la primera y la última vez que hiciste cada ejercicio en el mes, por fuerza estimada (1RM): menos peso con muchas más reps puede ser una mejora.${m.once.length ? ` ${m.once.length} ejercicio${m.once.length > 1 ? 's' : ''} hecho${m.once.length > 1 ? 's' : ''} una sola vez no se compara${m.once.length > 1 ? 'n' : ''}.` : ''}</p>
    </section>`}`;

  body.querySelector('[data-prev]').onclick = () => { ui.monthOffset++; render(container); };
  body.querySelector('[data-next]').onclick = () => { ui.monthOffset--; render(container); };
  bindHeatmap(body, heat.days);
  body.querySelectorAll('[data-fold]').forEach((b) => {
    b.onclick = () => { ui[b.dataset.fold] = !ui[b.dataset.fold]; render(container); };
  });
}

// --- Análisis -----------------------------------------------------------

const pctText = (p) => `${Math.round(p * 100)}%`;

function renderAnalysis(body, container) {
  const plan = planInfo();
  // El cumplimiento mira el plan actual; sin plan empezado, las últimas 4 semanas.
  const since = addDays(today(), -27);
  const scope = plan?.sessions.length
    ? { sessions: plan.sessions, label: 'en este plan' }
    : { sessions: state.sessions.filter((s) => s.finished && s.date >= since), label: 'en las últimas 4 semanas' };
  body.innerHTML = [
    planCard(plan),
    complianceCard(targetCompliance(scope.sessions), scope.label),
    stalledCard(stalledExercises()),
    balanceCard(muscleBalance()),
    relativeCard(relativeStrength(ui.sex)),
  ].join('');

  body.querySelectorAll('[data-fold]').forEach((b) => {
    b.onclick = () => { ui[b.dataset.fold] = !ui[b.dataset.fold]; render(container); };
  });
  body.querySelectorAll('[data-ex]').forEach((b) => {
    b.onclick = () => { ui.exerciseId = b.dataset.ex; ui.tab = 'ejercicio'; render(container); window.scrollTo(0, 0); };
  });
  body.querySelectorAll('[data-sex]').forEach((b) => {
    b.onclick = () => {
      ui.sex = b.dataset.sex;
      try { localStorage.setItem('fuerzaRef', ui.sex); } catch { /* sin almacenamiento: dura mientras la app está abierta */ }
      render(container);
    };
  });
  body.querySelectorAll('[data-go-tab]').forEach((b) => {
    b.onclick = () => { ui.tab = b.dataset.goTab; render(container); };
  });
  body.querySelector('[data-ai]')?.addEventListener('click', () => askSummary(plan, container));
}

// --- Reporte del plan ---

function planCard(plan) {
  if (!plan) {
    return `
      <section class="card">
        <h2 class="card-title">📋 Reporte del plan</h2>
        <p class="muted">Cuando cargues un plan con progresión semanal, acá vas a ver cómo te fue.</p>
        <a class="btn btn-small" href="#plan">Ir al plan</a>
      </section>`;
  }
  if (!plan.start) {
    return `
      <section class="card">
        <h2 class="card-title">📋 Reporte del plan</h2>
        <p class="muted">El plan de ${plan.weeks} semanas empieza con tu primer entrenamiento.</p>
      </section>`;
  }
  const to = plan.finished ? plan.end : today();
  const change = strengthChange(plan.sessions);
  const compared = change.improved.length + change.same.length + change.worse.length;
  const recs = recordsBetween(plan.start, to);
  const key = aiKey(plan);
  return `
    <section class="card list">
      <h2 class="card-title">📋 Reporte del plan
        <small class="muted">· ${plan.finished ? 'terminado' : `semana ${plan.week} de ${plan.weeks}`}</small></h2>
      <p class="muted pad plan-dates">${fmtDate(plan.start)} al ${fmtDate(plan.end)} · ${plan.routines.length} rutina${plan.routines.length === 1 ? '' : 's'}</p>
      <div class="stat-tiles pad">
        <div class="tile"><span class="tile-value">${plan.done} <small>de ${plan.planned}</small></span><span class="tile-label">días del plan hechos</span></div>
        <div class="tile"><span class="tile-value">${recs}</span><span class="tile-label">récord${recs === 1 ? '' : 's'} nuevo${recs === 1 ? '' : 's'}</span></div>
        <div class="tile"><span class="tile-value">${plan.missed}</span><span class="tile-label">sin entrenar</span></div>
      </div>
      ${compared ? `
        <h3 class="sub-title">Fuerza: primera contra última vez en el plan</h3>
        <div class="str-summary">${strengthSummary(change)}</div>
        ${strengthList(change, 'planAll')}` : '<p class="muted pad">Todavía no repetiste ejercicios dentro del plan.</p>'}
      ${plan.sessions.length >= 2 ? `
        <div class="ai-box pad">
          ${ai.key === key && ai.text ? `<div class="ai-text">${aiHtml(ai.text)}</div>` : ''}
          ${ai.key === key && ai.error ? `<p class="note">${esc(ai.error)}</p>` : ''}
          ${ai.key === key && ai.text ? '' : `
            <button class="btn btn-block" data-ai ${ai.loading ? 'disabled' : ''}>${ai.loading ? 'Pensando…' : '✨ Resumen y consejos con IA'}</button>`}
        </div>` : ''}
    </section>`;
}

// El resumen de la IA vale mientras no cambien los entrenamientos del plan.
function aiKey(plan) {
  return `${plan.start}:${plan.sessions.length}:${plan.sessions.at(-1)?.id || ''}`;
}

// Texto simple de Gemini: párrafos y viñetas con "- ".
function aiHtml(text) {
  return text.trim().split(/\n+/).map((line) => (/^\s*[-•*]\s+/.test(line)
    ? `<p class="ai-bullet">${esc(line.replace(/^\s*[-•*]\s+/, ''))}</p>`
    : `<p>${esc(line)}</p>`)).join('');
}

async function askSummary(plan, container) {
  ai = { key: aiKey(plan), text: '', loading: true, error: '' };
  render(container);
  try {
    const { generate } = await import('../ai.js');
    const text = await generate([reportPrompt(plan)]);
    ai = { ...ai, text: text.replace(/\*\*/g, ''), loading: false };
  } catch (err) {
    ai = { ...ai, loading: false, error: `No se pudo generar el resumen (${err.message}). Probá de nuevo con conexión.` };
  }
  if (shown === container && ui.tab === 'analisis') render(container);
}

// Los datos del reporte en texto, para que Gemini los resuma.
function reportPrompt(plan) {
  const change = strengthChange(plan.sessions);
  // Con el 1RM estimado, para que no lea como baja "42,5×7 → 40×11" (menos peso, pero más fuerza).
  const rm = (r, s) => (r.ex.type === 'corporal' && !s.w ? '' : ` (1RM est. ${fmtNum(e1rm(s.w, s.r), 0)} kg)`);
  const line = (r) => `${r.ex.name}: ${fmtSet(r.ex, r.first)}${rm(r, r.first)} → ${fmtSet(r.ex, r.last)}${rm(r, r.last)}`;
  const comp = targetCompliance(plan.sessions);
  const stalled = stalledExercises();
  const bal = muscleBalance(plan.weeks * 7, plan.finished ? plan.end : today());
  return `Sos un entrenador personal. Escribí en español rioplatense (vos), tono cercano y concreto, sin markdown ni negritas.
Primero un párrafo corto (2 o 3 oraciones) con cómo le fue en el plan. Después exactamente 3 consejos para el próximo plan,
cada uno en su línea empezando con "- ". Máximo 120 palabras en total. Basate solo en estos datos:

Plan de ${plan.weeks} semanas (${plan.start} al ${plan.end}), ${plan.finished ? 'terminado' : `va por la semana ${plan.week}`}.
Días del plan hechos: ${plan.done} de ${plan.planned}. Semanas sin entrenar alguna rutina: ${plan.missed}.
Récords nuevos: ${recordsBetween(plan.start, plan.finished ? plan.end : today())}.
Series que llegaron al objetivo de reps: ${comp.pct == null ? 'sin datos' : pctText(comp.pct)}; series que pasaron el tope por 2 o más reps: ${pctText(comp.easyPct)}.
Mejoraron (serie más pesada, primera → última vez; "bajaron" es por peso, mirá el 1RM estimado): ${change.improved.map(line).join('; ') || 'ninguno'}.
Igual: ${change.same.map((r) => r.ex.name).join(', ') || 'ninguno'}.
Bajaron: ${change.worse.map(line).join('; ') || 'ninguno'}.
Estancados (3+ entrenamientos sin récord): ${stalled.map((s) => `${s.ex.name} (${s.sessions})`).join(', ') || 'ninguno'}.
Series por semana por músculo (secundarios cuentan media): ${bal.groups.map((g) => `${g.group} ${fmtNum(g.sets, 1)}`).join(', ')}.`;
}

// --- Cumplimiento del objetivo ---

function complianceCard(c, label) {
  if (c.pct == null) return '';
  // Es normal que la última serie quede una rep corta: por eso 80% ya es ir bien.
  const msg = c.pct >= 0.85 && c.easyPct >= 0.3
    ? ['up', 'El plan te queda corto: muchas series pasan el tope de reps. Subí el peso.']
    : c.pct >= 0.8 ? ['up', 'Vas cumpliendo el plan. 👌']
      : c.pct >= 0.6 ? ['', 'Cumplís la mayoría. Mirá los ejercicios que te cuestan.']
        : ['down', 'El plan te queda grande: bajá un poco el peso para completar las series.'];
  const hard = c.byExercise.filter((r) => r.pct < 0.6).sort((a, b) => a.pct - b.pct).slice(0, 3);
  const easy = c.byExercise.filter((r) => r.easyPct >= 0.5 && r.pct >= 0.8).sort((a, b) => b.easyPct - a.easyPct).slice(0, 3);
  const row = (r, pill) => `
    <button class="list-item str-row" data-ex="${r.ex.id}">
      <span class="str-main">
        <span class="str-name">${esc(r.ex.name)}</span>
        <span class="str-sets">${r.hit} de ${r.planned} series al objetivo</span>
      </span>
      ${pill}
    </button>`;
  return `
    <section class="card list">
      <h2 class="card-title">🎯 Cumplimiento del objetivo</h2>
      <div class="hero pad">
        <span class="hero-value">${pctText(c.pct)}</span>
        <span class="hero-label">de las series llegaron a las reps del objetivo ${label} (${c.hit} de ${c.planned})</span>
        <span class="hero-delta"><span class="pct ${msg[0]}">${msg[1]}</span></span>
      </div>
      ${hard.length ? `<h3 class="sub-title">Te cuestan</h3>${hard.map((r) => row(r, `<span class="delta-pill down">${pctText(r.pct)}</span>`)).join('')}` : ''}
      ${easy.length ? `<h3 class="sub-title">Te quedan fáciles: subí el peso</h3>${easy.map((r) => row(r, '<span class="delta-pill up">fácil</span>')).join('')}` : ''}
      <p class="note pad">Una serie cumple si llega al mínimo de reps (en "3x8-10", 8). Las series que no hiciste cuentan como no cumplidas. Fácil: la mitad o más de las series pasaron el tope por 2 reps.</p>
    </section>`;
}

// --- Estancados ---

function stalledCard(list) {
  return `
    <section class="card list">
      <h2 class="card-title">⏸️ Estancados</h2>
      ${list.length ? list.map((s) => `
        <button class="list-item str-row" data-ex="${s.ex.id}">
          <span class="str-main">
            <span class="str-name">${esc(s.ex.name)}</span>
            <span class="str-sets">${s.sessions} entrenamientos sin récord · el último, ${fmtDate(s.since)} (${fmtSet(s.ex, s.best)})</span>
          </span>
          <span class="delta-pill ${s.sessions >= 5 ? 'down' : ''}">${s.sessions >= 5 ? 'cambiá algo' : 'descarga'}</span>
        </button>`).join('')
        : '<p class="muted pad">Ningún ejercicio trabado. 👌</p>'}
      <p class="note pad">Cuenta 3 entrenamientos seguidos o más sin superar el récord. Descarga: bajá un 10% el peso una semana y volvé a subir.
        Si lleva 5 o más, cambiá la variante o el rango de reps.</p>
    </section>`;
}

// --- Balance muscular ---

const BAL_MIN = 10;
const BAL_MAX = 20;

function balanceCard(b) {
  const scale = Math.max(25, ...b.groups.map((g) => g.sets));
  const pos = (v) => `${(v / scale) * 100}%`;
  const ratio = b.pull ? b.push / b.pull : null;
  const ratioMsg = ratio == null ? (b.push ? 'No hiciste tirón (espalda, bíceps).' : '')
    : ratio > 1.5 ? 'Mucho más empuje que tirón: sumá espalda o bíceps.'
      : ratio < 0.67 ? 'Mucho más tirón que empuje: sumá pecho, hombros o tríceps.'
        : 'Empuje y tirón equilibrados. 👌';
  const legsMsg = b.upper && b.legs < b.upper * 0.4 ? 'Las piernas reciben bastante menos que el tren superior.' : '';
  const status = (v) => (v < BAL_MIN ? ['low', 'poco'] : v > BAL_MAX ? ['high', 'mucho'] : ['ok', 'bien']);
  return `
    <section class="card">
      <h2 class="card-title">⚖️ Balance muscular <small class="muted">· series por semana</small></h2>
      <div class="bal">
        ${b.groups.map((g) => {
          const [cls, label] = status(g.sets);
          return `
          <div class="bal-row">
            <span class="bal-name">${esc(g.group)}</span>
            <span class="bal-track">
              <span class="bal-band" style="left: ${pos(BAL_MIN)}; width: ${pos(BAL_MAX - BAL_MIN)}"></span>
              <span class="bal-bar" style="width: ${pos(g.sets)}"></span>
            </span>
            <span class="bal-val">${fmtNum(g.sets, 1)} <small class="bal-${cls}">${label}</small></span>
          </div>`;
        }).join('')}
      </div>
      <div class="bal-ratios">
        <span>Empuje <strong>${fmtNum(b.push, 1)}</strong> · Tirón <strong>${fmtNum(b.pull, 1)}</strong> · Piernas <strong>${fmtNum(b.legs, 1)}</strong></span>
        ${ratioMsg ? `<span>${ratioMsg}</span>` : ''}
        ${legsMsg ? `<span>${legsMsg}</span>` : ''}
      </div>
      <p class="note">Promedio de las últimas ${b.weeks >= 4 ? '4 semanas' : 'semanas desde que empezaste'}. El músculo principal de cada ejercicio cuenta la serie entera y los secundarios, media.
        La franja marca ${BAL_MIN} a ${BAL_MAX} series por semana, la referencia habitual para ganar masa.
        Empuje: ${PUSH.join(', ').toLowerCase()}. Tirón: ${PULL.join(', ').toLowerCase()}.</p>
    </section>`;
}

// --- Fuerza relativa ---

function relativeCard(r) {
  if (!r.bw) {
    return `
      <section class="card">
        <h2 class="card-title">💪 Fuerza relativa</h2>
        <p class="muted">Cargá tu peso corporal para ver cuánto levantás en relación a tu peso.</p>
        <button class="btn btn-small" data-go-tab="peso">Cargar mi peso</button>
      </section>`;
  }
  if (!r.rows.length) return '';
  const lifts = r.rows.filter((x) => x.lift);
  const others = r.rows.filter((x) => !x.lift).slice(0, 5);
  const ratio = (x) => `${fmtNum(x.ratio, 2)}×`;
  return `
    <section class="card list">
      <h2 class="card-title">💪 Fuerza relativa <small class="muted">· 1RM ÷ tu peso</small></h2>
      ${lifts.length ? `
        <div class="segmented range pad-x" role="tablist" aria-label="Referencias">
          <button role="tab" class="${ui.sex === 'm' ? 'active' : ''}" data-sex="m">Referencias hombres</button>
          <button role="tab" class="${ui.sex === 'f' ? 'active' : ''}" data-sex="f">Referencias mujeres</button>
        </div>
        ${lifts.map((x) => `
          <button class="list-item rel-row" data-ex="${x.ex.id}">
            <span class="rel-top">
              <span class="str-name">${esc(x.ex.name)}</span>
              <strong>${ratio(x)}</strong>
            </span>
            <span class="rel-levels" aria-label="Nivel ${LEVELS[x.level]}">
              ${LEVELS.map((name, i) => `<span class="${!x.below && i <= x.level ? 'on' : ''}"></span>`).join('')}
            </span>
            <small class="muted">${x.below ? 'Camino a principiante' : `Nivel <strong>${LEVELS[x.level].toLowerCase()}</strong>`} · 1RM estimado ${fmtNum(x.e1rm, 1)} kg${x.next ? ` · te faltan ${fmtNum(x.next.kg, 1)} kg para ${x.next.name.toLowerCase()}` : ''}</small>
          </button>`).join('')}` : ''}
      ${others.length ? `
        ${lifts.length ? '<h3 class="sub-title">Otros con barra</h3>' : ''}
        ${others.map((x) => `
          <button class="list-item week-row" data-ex="${x.ex.id}">
            <span>${esc(x.ex.name)}</span>
            <span class="pct">${ratio(x)} <small class="muted">· ${fmtNum(x.e1rm, 1)} kg</small></span>
          </button>`).join('')}` : ''}
      <p class="note pad">Con tu mejor serie de los últimos 4 meses y tu último peso (${fmtNum(r.bw, 1)} kg). Los niveles son referencias aproximadas de levantadores; sirven para orientarte, no como meta.</p>
    </section>`;
}

// --- Semana -------------------------------------------------------------

// Volumen de las últimas 12 semanas hasta la elegida (o hasta la actual si la elegida entra).
const VOL_WEEKS = 12;
const VOLUME = [['sets', 'Series'], ['kg', 'Kg levantados']];

function volumeCard() {
  return `
    <section class="card">
      <h2 class="card-title">📊 Volumen por semana</h2>
      <div class="segmented range" role="tablist" aria-label="Medida">
        ${VOLUME.map(([k, label]) => `<button role="tab" class="${ui.volume === k ? 'active' : ''}" data-vol="${k}">${label}</button>`).join('')}
      </div>
      <div class="chart-box short"><canvas></canvas></div>
      <p class="note">${ui.volume === 'kg' ? 'Peso × reps de cada serie (las mancuernas cuentan las dos). ' : ''}Solo fuerza, sin cardio. Tocá una barra para ver esa semana.</p>
    </section>`;
}

function volumeChart(body, container, from) {
  body.querySelectorAll('[data-vol]').forEach((b) => {
    b.onclick = () => { ui.volume = b.dataset.vol; render(container); };
  });
  const canvas = body.querySelector('canvas');
  if (!canvas) return;
  const lastOffset = ui.weekOffset < VOL_WEEKS ? 0 : ui.weekOffset;
  const vol = weeklyVolume(addDays(weekStart(today()), -7 * lastOffset), VOL_WEEKS);
  // Sin las semanas vacías de antes de empezar, pero con al menos 4 barras.
  const firstWeek = weekStart(oldestDate());
  while (vol.length > 4 && vol[0].from < firstWeek) vol.shift();
  const sel = vol.findIndex((w) => w.from === from);
  const kg = ui.volume === 'kg';
  const fmt = (v) => (kg ? fmtKg(v) : `${v} ${v === 1 ? 'serie' : 'series'}`);
  // El eje en toneladas o en kg, todo igual (no "10 t" y "5.000 kg" juntos).
  const tons = kg && Math.max(...vol.map((w) => w.kg)) >= 10000;
  const tick = (v) => (!kg ? v : tons ? `${fmtNum(v / 1000, 1)} t` : `${fmtNum(v, 0)} kg`);
  const t = chartTheme();
  const go = (i) => {
    if (i === undefined || i === sel) return;
    ui.weekOffset = lastOffset + (vol.length - 1 - i);
    render(container);
  };
  makeChart(canvas, {
    type: 'bar',
    data: {
      labels: vol.map((w) => w.from),
      datasets: [{
        label: kg ? 'Kg levantados' : 'Series',
        data: vol.map((w) => (kg ? Math.round(w.kg) : w.sets)),
        backgroundColor: vol.map((_, i) => (i === sel ? t.p : fade(t.p, 0.35))),
        hoverBackgroundColor: t.p,
        borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false }, border: { display: false },
          ticks: { callback: (v, i) => fmtDate(vol[i].from), maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true, grid: { color: t.grid }, border: { display: false },
          ticks: { maxTicksLimit: 4, precision: 0, callback: tick },
        },
      },
      onClick: (e, els) => go(els[0]?.index),
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : ''; },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => `Semana del ${weekRange(vol[items[0].dataIndex].from, addDays(vol[items[0].dataIndex].from, 6))}`,
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
        },
      },
    },
  });
}

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
    ${volumeCard()}
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
  volumeChart(body, container, from);
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
  const range = withRange(hist, (h) => h.date);
  const shownHist = range.list;
  const first = shownHist[0];
  const last = shownHist[shownHist.length - 1];
  const prs = shownHist.filter((h) => h.pr).length;
  // Lo que se sigue: reps sin peso, o la fuerza estimada (1RM) con peso.
  const metric = bw ? (h) => h.maxReps : (h) => Math.round(h.bestE1rm * 10) / 10;
  const kg = (v) => `${fmtNum(v, 1)} kg`;

  body.innerHTML = `
    <select class="input" data-ex aria-label="Ejercicio">
      ${GROUPS.map((g) => {
        const list = exs.filter((e) => e.primary === g);
        return list.length ? `<optgroup label="${esc(g)}">${list.map((e) =>
          `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>` : '';
      }).join('')}
    </select>
    <section class="card">
      ${last ? heroHtml({
        value: bw ? last.maxReps : fmtNum(metric(last), 1),
        unit: bw ? 'reps' : 'kg',
        label: `${bw ? 'Máximo de repeticiones' : 'Fuerza estimada (1RM)'} · última vez, ${fmtDate(last.date)}`,
        ...(shownHist.length > 1 ? {
          delta: metric(last) - metric(first), since: first.date,
          deltaFmt: bw ? (v) => `${fmtNum(v, 0)} ${v === 1 ? 'rep' : 'reps'}` : kg,
        } : {}),
      }) : ''}
      ${range.html}
      ${shownHist.length ? '<div class="chart-box"><canvas></canvas></div>' : '<p class="muted center">No lo hiciste en este período.</p>'}
      <p class="note">${prs ? `◆ Récord nuevo (${prs} en el período). ` : ''}${bw ? '' : `Peso en ${esc(unit)}. Fuerza estimada (1RM): cuánto podrías levantar a 1 repetición según tus series (fórmula de Epley).`}</p>
    </section>
    <section class="card list">
      <h2 class="card-title">Historial</h2>
      ${[...hist].reverse().map((h) => `
        <a class="list-item" href="#entrenar/${h.sessionId}">
          <span>${fmtDate(h.date, true)}${h.pr ? ' <span class="pct up">🏆 récord</span>' : ''}</span>
          <small>${esc(fmtSets(h.sets, ex))}</small>
        </a>`).join('')}
    </section>`;
  body.querySelector('[data-ex]').onchange = (e) => { ui.exerciseId = e.target.value; render(container); };
  bindRange(body, container);

  const canvas = body.querySelector('canvas');
  if (!canvas || !shownHist.length) return;
  const t = chartTheme();
  const point = (h, y, pr) => ({ x: ts(h.date), y, date: h.date, pr });
  if (bw) {
    timeChart(canvas, [
      { label: 'Máx. reps', color: t.p, fill: true, data: shownHist.map((h) => point(h, h.maxReps, h.pr)) },
    ], (v) => fmtNum(v, 0));
  } else {
    // El récord se marca sobre el peso máximo, que es lo que define un récord.
    timeChart(canvas, [
      { label: 'Peso máximo', color: t.p, data: shownHist.map((h) => point(h, h.maxW, h.pr)) },
      { label: 'Fuerza estimada (1RM)', color: t.s, data: shownHist.map((h) => point(h, metric(h), false)) },
    ], kg);
  }
}

// --- Récords ------------------------------------------------------------

// Marca de un récord: el número grande y las reps aparte.
function recordValue(ex, set) {
  if (WEIGHT_TYPES[ex.type]?.bodyweight && !set.w) return `<strong>${set.r}</strong> <small>reps</small>`;
  return `<strong>${fmtNum(set.w || 0, 2)}</strong> <small>${ex.type === 'mancuerna' ? 'kg c/u' : 'kg'} × ${set.r}</small>`;
}

// Tendencia de las últimas 12 veces: fuerza estimada (1RM), o reps si es sin peso.
function trend(ex) {
  const bw = WEIGHT_TYPES[ex.type]?.bodyweight;
  return sparkline(exerciseHistory(ex.id).slice(-12).map((h) => (bw ? h.maxReps : h.bestE1rm)));
}

function recordRow(r) {
  return `
    <button class="list-item rec-row" data-ex="${r.ex.id}">
      <span class="rec-info">
        <span class="rec-name">${esc(r.ex.name)}</span>
        <small class="muted">${agoLabel(r.date, today())}${r.prev ? ` · antes ${fmtSet(r.ex, r.prev)}` : ''}</small>
      </span>
      ${trend(r.ex)}
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
          ${trend(r.ex)}
          <span class="rec-val">${recordValue(r.ex, r.best)}</span>
        </button>`).join('')}
    </section>` : ''}
    ${shown.map((g) => `
      <h2 class="section-title">${esc(g)}</h2>
      <div class="card list">${recs.filter((r) => r.ex.primary === g).map(recordRow).join('')}</div>`).join('')}
    <p class="note">Récord: la serie con más peso (a igual peso, más reps; sin peso, más reps). La línea muestra la tendencia de las últimas 12 veces. Tocá un ejercicio para ver su evolución.</p>`;

  body.querySelectorAll('[data-group]').forEach((b) => {
    b.onclick = () => { ui.recGroup = b.dataset.group || null; render(container); };
  });
  body.querySelectorAll('[data-ex]').forEach((b) => {
    b.onclick = () => { ui.exerciseId = b.dataset.ex; ui.tab = 'ejercicio'; render(container); window.scrollTo(0, 0); };
  });
}

// --- Peso corporal ------------------------------------------------------

function renderBodyweight(body, container) {
  const list = state.bodyweight;
  const last = list[list.length - 1];
  // La media de 7 días saca el ruido del día a día (agua, comida, sal): es la que conviene mirar.
  const avg = movingAverage(list);
  const points = list.map((b, i) => ({ ...b, avg: avg[i] }));
  const range = withRange(points, (b) => b.date);
  const shownList = range.list;
  const first = shownList[0];
  const end = shownList[shownList.length - 1];
  const kg = (v) => `${fmtNum(v, 1)} kg`;

  body.innerHTML = `
    <form class="card form inline-form">
      <label>Fecha <input class="input" type="date" name="date" value="${today()}" required></label>
      <label>Peso (kg) <input class="input" name="kg" inputmode="decimal" placeholder="${last ? fmtNum(last.kg) : '75'}" required></label>
      <button class="btn btn-primary">Guardar</button>
    </form>
    ${list.length ? `
      <section class="card">
        ${end ? heroHtml({
          value: fmtNum(end.avg, 1), unit: 'kg',
          label: `Media de 7 días · último registro ${fmtNum(end.kg)} kg, ${fmtDate(end.date)}`,
          ...(shownList.length > 1 ? { delta: end.avg - first.avg, since: first.date, deltaFmt: kg, good: null } : {}),
        }) : ''}
        ${range.html}
        ${shownList.length > 1 ? '<div class="chart-box"><canvas></canvas></div>' : ''}
        ${!shownList.length ? '<p class="muted center">No hay registros en este período.</p>' : ''}
      </section>
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
    const kgVal = parseNum(fd.get('kg'));
    if (!kgVal || kgVal <= 0) { toast('Peso inválido.'); return; }
    const date = fd.get('date');
    const existing = list.find((b) => b.date === date);
    save('bodyweight', { ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}), date, kg: kgVal });
  };
  body.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (await confirmDialog('¿Borrar este registro de peso?', 'Borrar', true)) remove('bodyweight', b.dataset.del);
    };
  });
  bindRange(body, container);

  const canvas = body.querySelector('canvas');
  if (canvas) {
    const t = chartTheme();
    timeChart(canvas, [
      { label: 'Media 7 días', color: t.p, fill: true, radius: 0, data: shownList.map((b) => ({ x: ts(b.date), y: b.avg, date: b.date })) },
      { label: 'Registro', color: fade(t.p, 0.45), line: false, radius: 3, data: shownList.map((b) => ({ x: ts(b.date), y: b.kg, date: b.date })) },
    ], kg);
  }
}
