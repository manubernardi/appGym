// Cómo se muestran las series: "62,5 c/u × 10", la diferencia entre dos ("+2,5 kg y +1 rep")
// y antes → ahora con lo que cambió resaltado. Lo usan Progreso y el resumen al terminar de entrenar.

import { WEIGHT_TYPES } from './data.js';
import { fmtNum } from './ui.js';

export function fmtSet(ex, s) {
  if (WEIGHT_TYPES[ex.type]?.bodyweight && !s.w) return `${s.r} reps`;
  return `${fmtNum(s.w || 0, 2)}${ex.type === 'mancuerna' ? ' c/u' : ''} × ${s.r}`;
}

// Diferencia entre dos series: kg y reps, lo que haya cambiado ("▲ +2,5 kg y +2 reps", "▲ +2,5 kg · −1 rep").
// Sube o baja según el peso; a igual peso, según las reps.
export function diffParts(a, b) {
  const dw = (b.w || 0) - (a.w || 0);
  const dr = b.r - a.r;
  const sign = (v) => (v > 0 ? '+' : '−');
  const parts = [
    dw ? `${sign(dw)}${fmtNum(Math.abs(dw), 2)} kg` : '',
    dr ? `${sign(dr)}${Math.abs(dr)} ${Math.abs(dr) === 1 ? 'rep' : 'reps'}` : '',
  ].filter(Boolean);
  const dir = dw || dr;
  return { dw, dr, dir, cls: dir > 0 ? 'up' : dir < 0 ? 'down' : '', text: parts.join(dw * dr < 0 ? ' · ' : ' y ') };
}

export function diffBadge(ex, a, b) {
  const d = diffParts(a, b);
  return `<span class="pct ${d.cls}">${d.dir ? `${d.dir > 0 ? '▲' : '▼'} ${d.text}` : '= igual'}</span>`;
}

// Serie con el peso o las reps resaltados si cambiaron respecto de `prev`, cada uno con el color de su cambio.
export function setHtml(ex, s, prev) {
  const mark = (txt, now, before) => (now === before ? txt : `<b class="${now > before ? 'up' : 'down'}">${txt}</b>`);
  if (WEIGHT_TYPES[ex.type]?.bodyweight && !s.w) return `${mark(s.r, s.r, prev.r)} reps`;
  const w = `${fmtNum(s.w || 0, 2)}${ex.type === 'mancuerna' ? ' c/u' : ''}`;
  return `${mark(w, s.w || 0, prev.w || 0)} × ${mark(s.r, s.r, prev.r)}`;
}
