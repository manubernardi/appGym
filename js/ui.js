// Utilidades de interfaz: escape de HTML, fechas, números, modales y avisos.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Fecha local en formato YYYY-MM-DD.
export function today() {
  return toISODate(new Date());
}

export function toISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtDate(iso, withDay = false) {
  const d = parseDate(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return (withDay ? DAYS[d.getDay()] + ' ' : '') + base + year;
}

export function monthName(i) {
  return MONTHS[i];
}

// Acepta coma o punto decimal. Devuelve null si está vacío o no es número.
export function parseNum(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(n, decimals = 1) {
  if (n === null || n === undefined) return '';
  return Number(n.toFixed(decimals)).toLocaleString('es-AR');
}

export function fmtKg(n) {
  if (n >= 10000) return fmtNum(n / 1000, 1) + ' t';
  return fmtNum(n, 0) + ' kg';
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// Abre una hoja modal. `build(body, close)` arma el contenido. Devuelve close().
export function openModal(title, build, onClose) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body"></div>
    </div>`;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    onClose?.();
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  root.appendChild(wrap);
  build(wrap.querySelector('.modal-body'), close);
  return close;
}

export function confirmDialog(message, okLabel = 'Aceptar', danger = false) {
  return new Promise((resolve) => {
    openModal('Confirmar', (body, close) => {
      body.innerHTML = `
        <p>${esc(message)}</p>
        <div class="row-actions">
          <button class="btn" data-no>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okLabel)}</button>
        </div>`;
      body.querySelector('[data-no]').onclick = () => close();
      body.querySelector('[data-yes]').onclick = () => { resolve(true); close(); };
    }, () => resolve(false));
  });
}
