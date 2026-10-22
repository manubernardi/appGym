// Datos de prueba para el entorno local (npm run dev). Las fechas son relativas a hoy, así el plan siempre está en curso
// (o recién terminado) sin importar cuándo lo pruebes. Los números salen de un generador fijo: cada arranque da lo mismo.
// Devuelve los documentos tal como los guarda la app: { exercises, routines, sessions, bodyweight }, cada uno [{ id, ...datos }].

const DAY = 86400000;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));

// Generador pseudoaleatorio con semilla (siempre la misma secuencia).
function random(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const NAMES = {
  'base-press-banca-plano': 'Press banca plano',
  'base-press-inclinado-con-mancuernas': 'Press inclinado con mancuernas',
  'base-press-militar-con-barra': 'Press militar con barra',
  'base-elevaciones-laterales': 'Elevaciones laterales',
  'base-extension-de-triceps-en-polea': 'Extensión de tríceps en polea',
  'base-plancha': 'Plancha',
  'base-crunch-en-polea': 'Crunch en polea',
  'base-sentadilla-con-barra': 'Sentadilla con barra',
  'ej-sentadilla-sumo': 'Sentadilla sumo',
  'base-peso-muerto-rumano': 'Peso muerto rumano',
  'base-prensa-de-piernas': 'Prensa de piernas',
  'base-camilla-de-isquiotibiales': 'Camilla de isquiotibiales',
  'base-gemelos-de-pie': 'Gemelos de pie',
  'base-dominadas': 'Dominadas',
  'base-remo-con-barra': 'Remo con barra',
  'base-jalon-al-pecho': 'Jalón al pecho',
  'base-face-pull': 'Face pull',
  'base-curl-con-barra': 'Curl con barra',
  'base-curl-martillo': 'Curl martillo',
  'base-cinta': 'Cinta',
};

// Tipo de peso (para el escalón) y peso de partida hace ~4 meses. `gain`: cuánto sube por semana (0 = estancado).
const LIFTS = {
  'base-press-banca-plano': { type: 'barra', base: 55, gain: 0.012 },
  'base-press-inclinado-con-mancuernas': { type: 'mancuerna', base: 16, gain: 0.01 },
  'base-press-militar-con-barra': { type: 'barra', base: 32.5, gain: 0.008 },
  'base-elevaciones-laterales': { type: 'mancuerna', base: 7, gain: 0.006 },
  'base-extension-de-triceps-en-polea': { type: 'maquina', base: 20, gain: 0.01 },
  'base-plancha': { type: 'corporal', base: 0, gain: 0 },
  'base-crunch-en-polea': { type: 'maquina', base: 25, gain: 0 },
  'base-sentadilla-con-barra': { type: 'barra', base: 70, gain: 0.014 },
  'ej-sentadilla-sumo': { type: 'barra', base: 60, gain: 0.01 },
  'base-peso-muerto-rumano': { type: 'barra', base: 60, gain: 0.012 },
  'base-prensa-de-piernas': { type: 'maquina', base: 120, gain: 0.015 },
  'base-camilla-de-isquiotibiales': { type: 'maquina', base: 30, gain: 0.008 },
  'base-gemelos-de-pie': { type: 'maquina', base: 50, gain: 0.006 },
  'base-dominadas': { type: 'corporal', base: 0, gain: 0 },
  'base-remo-con-barra': { type: 'barra', base: 50, gain: 0.01 },
  'base-jalon-al-pecho': { type: 'maquina', base: 45, gain: 0.01 },
  'base-face-pull': { type: 'maquina', base: 15, gain: 0.006 },
  'base-curl-con-barra': { type: 'barra', base: 27.5, gain: 0 }, // estancado a propósito
  'base-curl-martillo': { type: 'mancuerna', base: 10, gain: 0.008 },
};

const PROGRESSION = [
  { targets: ['3x10', '3x12'] },
  { targets: ['4x8', '3x10'] },
  { targets: ['4x6', '4x8'] },
  { targets: ['3x10', '3x12'] },
];

const item = (exerciseId, prog, target) => (prog === 0 ? { exerciseId, prog: 0, target } : { exerciseId, prog });
const PLAN = [
  { id: 'dia-1', name: 'Día 1', items: [
    item('base-press-banca-plano', 1), item('base-press-inclinado-con-mancuernas', 2), item('base-press-militar-con-barra', 1),
    item('base-elevaciones-laterales', 2), item('base-extension-de-triceps-en-polea', 2),
    item('base-plancha', 0, '3x45'), item('base-crunch-en-polea', 0, '3x15'),
  ] },
  { id: 'dia-2', name: 'Día 2', items: [
    item('base-sentadilla-con-barra', 1), item('ej-sentadilla-sumo', 2), item('base-peso-muerto-rumano', 1),
    item('base-prensa-de-piernas', 2), item('base-camilla-de-isquiotibiales', 2), item('base-gemelos-de-pie', 2),
  ] },
  { id: 'dia-3', name: 'Día 3', items: [
    item('base-dominadas', 1), item('base-remo-con-barra', 1), item('base-jalon-al-pecho', 2),
    item('base-face-pull', 2), item('base-curl-con-barra', 2), item('base-curl-martillo', 2),
  ] },
];

// El plan anterior: rutinas archivadas con objetivo fijo.
const OLD_PLAN = [
  { id: 'anterior-a', name: 'Plan anterior · A', items: ['base-press-banca-plano', 'base-press-militar-con-barra', 'base-extension-de-triceps-en-polea', 'base-remo-con-barra', 'base-curl-con-barra'].map((id) => item(id, 0, '3x10')) },
  { id: 'anterior-b', name: 'Plan anterior · B', items: ['base-sentadilla-con-barra', 'base-peso-muerto-rumano', 'base-prensa-de-piernas', 'base-jalon-al-pecho', 'base-curl-martillo'].map((id) => item(id, 0, '3x10')) },
];

function step(type, w) {
  if (type === 'mancuerna') return w >= 10 ? 2 : 1;
  return 2.5;
}

// Una serie: el peso sube con las semanas y es más alto cuando el objetivo pide menos reps.
function makeEntry(rnd, exerciseId, target, weeksFromStart, withRir, circuit) {
  const lift = LIFTS[exerciseId];
  const [n, reps] = target.split('x').map(Number);
  const stalled = lift.gain === 0 && lift.base > 0;
  let w = null;
  if (stalled) {
    w = lift.base; // siempre el mismo peso y las mismas reps: nunca supera su récord
  } else if (lift.base) {
    const raw = lift.base * (1 + lift.gain * weeksFromStart) * (1 + Math.max(0, 10 - reps) * 0.03) * (1 + (rnd() - 0.5) * 0.03);
    const st = step(lift.type, raw);
    w = Math.max(st, Math.round(raw / st) * st);
  }
  const sets = Array.from({ length: n }, (_, k) => {
    let r = stalled ? 8 - (k === n - 1 ? 1 : 0) : reps + Math.round((rnd() - 0.4) * 3) - (k === n - 1 ? 1 : 0);
    if (exerciseId === 'base-dominadas') r = Math.round(6 + weeksFromStart * 0.25 + rnd() * 2) - k;
    r = Math.max(1, r);
    const set = { w, r };
    if (withRir && !circuit && rnd() < 0.7) set.rir = Math.max(0, Math.min(4, Math.round(rnd() * 3 - (k === n - 1 ? 1 : 0))));
    return set;
  });
  return { exerciseId, name: NAMES[exerciseId], target, sets, ...(circuit ? { circuit: true } : {}) };
}

function makeSession(rnd, { id, date, routine, week, entries }) {
  const start = new Date(`${date}T19:${String(Math.floor(rnd() * 50)).padStart(2, '0')}:00`);
  return {
    id, date, routineId: routine?.id || null, routineName: routine?.name || 'Entrenamiento libre',
    ...(week ? { week } : {}), finished: true,
    createdAt: start.toISOString(), startedAt: start.toISOString(),
    duration: 3300 + Math.round(rnd() * 2400),
    entries,
  };
}

// profile: 'full' (plan en la semana 3 de 4), 'finished' (terminó hace unos días) o 'empty'.
export function seedData(profile, today = new Date()) {
  const out = { exercises: [], routines: [], sessions: [], bodyweight: [] };
  if (profile === 'empty') return out;
  const rnd = random(profile === 'full' ? 11 : 23);
  const thisMonday = monday(today);
  // full: el plan empezó hace 2 semanas (va por la 3). finished: empezó hace 5 (terminó el domingo de hace una semana).
  const planStart = addDays(thisMonday, -7 * (profile === 'full' ? 2 : 5));
  const oldStart = addDays(planStart, -7 * 12);
  const todayIso = iso(today);

  out.exercises.push({ id: 'ej-sentadilla-sumo', name: 'Sentadilla sumo', type: 'barra', primary: 'Cuádriceps', secondary: ['Glúteos', 'Isquiotibiales'], createdAt: `${iso(oldStart)}T12:00:00.000Z` });
  out.routines.push(...PLAN.map((r) => ({ ...r, progression: PROGRESSION, archived: false, createdAt: `${iso(addDays(planStart, -2))}T12:00:00.000Z` })));
  out.routines.push(...OLD_PLAN.map((r) => ({ ...r, archived: true, createdAt: `${iso(oldStart)}T12:00:00.000Z` })));

  let n = 0;
  // Plan anterior: 12 semanas, lunes y jueves, a veces falta uno.
  for (let wk = 0; wk < 12; wk++) {
    [[0, OLD_PLAN[0]], [3, OLD_PLAN[1]]].forEach(([dow, routine]) => {
      if (rnd() < 0.12) return;
      const date = iso(addDays(oldStart, wk * 7 + dow));
      out.sessions.push(makeSession(rnd, {
        id: `s${++n}`, date, routine,
        entries: routine.items.map((it) => makeEntry(rnd, it.exerciseId, '3x10', wk, false, false)),
      }));
    });
  }
  // Plan actual: lunes Día 1, miércoles Día 2, viernes Día 3; hasta hoy.
  for (let wk = 0; wk < 4; wk++) {
    [[0, PLAN[0]], [2, PLAN[1]], [4, PLAN[2]]].forEach(([dow, routine]) => {
      const d = addDays(planStart, wk * 7 + dow);
      const date = iso(d);
      if (date > todayIso || (wk === 1 && dow === 2)) return; // falta un día en la semana 2 (para ver "sin entrenar")
      const entries = routine.items.map((it) => {
        const target = it.prog === 0 ? it.target : PROGRESSION[wk].targets[it.prog - 1];
        return makeEntry(rnd, it.exerciseId, target, 12 + wk, true, it.prog === 0);
      });
      if (routine.id === 'dia-2' && rnd() < 0.6) {
        entries.push({ exerciseId: 'base-cinta', name: 'Cinta', target: '', sets: [{ w: Math.round((2 + rnd() * 2) * 10) / 10, r: 15 + Math.round(rnd() * 10) }] });
      }
      out.sessions.push(makeSession(rnd, { id: `s${++n}`, date, routine, week: wk + 1, entries }));
    });
  }

  // Peso corporal: cada 2 o 3 días durante 4 meses, bajando de a poco.
  const days = Math.round((today - oldStart) / DAY);
  for (let i = days; i >= 0; i -= 2 + Math.round(rnd())) {
    const kg = Math.round((79.5 + i * 0.022 + (rnd() - 0.5) * 1.4) * 10) / 10;
    out.bodyweight.push({ id: `p${i}`, date: iso(addDays(today, -i)), kg, createdAt: `${iso(addDays(today, -i))}T08:00:00.000Z` });
  }
  return out;
}
