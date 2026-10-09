// Lectura del plan desde una foto con Gemini (Firebase AI Logic, plan gratuito).
// Gemini recibe la foto y tu lista de ejercicios: asocia cada renglón a uno existente
// aunque esté escrito distinto, y si no existe propone crearlo con tipo y grupos.

import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

import { app } from './db.js';
import { GROUPS, WEIGHT_TYPES } from './data.js';
import { state } from './store.js';
import { FIXED } from './progression.js';

// Si el primero deja de estar disponible, se prueba el siguiente.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
const MAX_SIDE = 1600; // px: suficiente para leer la hoja y liviano para subir

const ai = getAI(app, { backend: new GoogleAIBackend() });

const schema = Schema.object({
  properties: {
    progression: Schema.array({
      description: 'Tabla de progresión semanal: un elemento por semana (fila), en orden. Vacío si la hoja no tiene tabla.',
      items: Schema.object({
        properties: {
          targets: Schema.array({
            description: 'Series x reps de esa semana para cada progresión (columna 1, 2, 3…), tal como están escritos',
            items: Schema.string(),
          }),
        },
      }),
    }),
    routines: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string({ description: 'Nombre de la rutina tal como está en la hoja, ej. "Día 1". Si la hoja no lo dice: Día 1, Día 2…' }),
          items: Schema.array({
            items: Schema.object({
              properties: {
                written: Schema.string({ description: 'El ejercicio tal como está escrito en la hoja' }),
                prog: Schema.integer({ description: 'Número de progresión entre paréntesis al lado del ejercicio, ej. "Press (2)" = 2. 0 si no tiene (ej. ejercicios de zona media).' }),
                target: Schema.string({ description: 'Series y reps escritas al lado del propio ejercicio, ej. "3*10" = "3x10", "3*12\"" = "3x12\"". Vacío si no tiene.' }),
                exerciseId: Schema.string({ description: 'id del ejercicio existente equivalente, o "" si no hay ninguno' }),
                newName: Schema.string({ description: 'Solo si exerciseId es "": nombre claro para el ejercicio nuevo' }),
                newType: Schema.enumString({ enum: Object.keys(WEIGHT_TYPES) }),
                newPrimary: Schema.enumString({ enum: GROUPS, description: 'Obligatorio si exerciseId es "": grupo muscular principal' }),
                newSecondary: Schema.array({ items: Schema.enumString({ enum: GROUPS }) }),
              },
              optionalProperties: ['newName', 'newType', 'newPrimary', 'newSecondary'],
            }),
          }),
        },
      }),
    }),
  },
});

function prompt() {
  const list = [...state.exercises.values()]
    .map((e) => `${e.id} | ${e.name} | ${e.type} | ${e.primary}`)
    .join('\n');
  return `Esta foto es el plan de gimnasio de un mes, en español (puede ser a mano).
Extraé cada rutina (día) con sus ejercicios en el orden en que aparecen.

La foto puede estar girada: leela en la orientación en que el texto se lee derecho.

Formato habitual del plan:
- Arriba hay datos generales (nombre, profesor, fechas, objetivo, MOVILIDAD ARTICULAR, PREVENTIVOS HOMBROS): no son ejercicios de un día, ignoralos.
- Columnas DIA 1, DIA 2, DIA 3… con la lista de ejercicios de cada día. Usá ese nombre para la rutina ("Día 1", "Día 2"…).
- Cada día puede tener dos bloques, y van los dos, en el orden en que aparecen:
  - "CIRCUITO ZONA MEDIA" (abdominales/core): cada ejercicio tiene escritas SUS PROPIAS series x reps,
    ej. "PUENTE FRONTAL C/ CAMBIO DE APOYO 3*10" o "PUENTE FRONTAL EN FITBALL 3*12\"" (12 segundos).
    Estos NO siguen la tabla de progresión: prog = 0 y en "target" va lo escrito ("3x10", "3x12\"").
    Cada ejercicio tiene sus propias reps: no copies las de otro.
  - "FUERZA": al lado de cada ejercicio hay un número entre paréntesis, ej. "Sentadilla (2)": es el número de progresión
    que sigue ese ejercicio (va en "prog", con "target" vacío).
- Abajo hay una tabla de progresión semanal: el encabezado tiene las progresiones (PROGRESION 1, 2, 3…) como COLUMNAS,
  y cada FILA es una semana (SEMANAS 1, 2, 3, 4…), con series x reps en cada celda (ej. "3*8 (3)": copiala tal cual).
  Copiala en "progression": un elemento por fila/semana en orden, con las celdas de esa fila en orden de columna.
  Ej. encabezado "1 2 3" y primera fila "A B C" → semana 1: progresión 1 = A, progresión 2 = B, progresión 3 = C.
  La columna PAUSAS (P. MICRO, P. MACRO) no es una progresión: no la copies.
  La cantidad de semanas, la de progresiones y los valores de cada celda cambian de un plan a otro:
  copiá exactamente lo que dice la hoja, sin inventar ni completar celdas.
- Si la hoja no tiene tabla, dejá "progression" vacío y poné en "target" las series x reps escritas al lado de cada ejercicio.

Para cada ejercicio buscá el equivalente en esta lista (id | nombre | tipo | grupo principal).
Asociálo aunque esté escrito distinto, abreviado o con sinónimos
(ej. "press banco barra" = "Press banca plano", "polea al pecho" = "Jalón al pecho", "vuelos laterales" = "Elevaciones laterales").
Fijate que coincida el implemento (barra, mancuerna, máquina, polea) cuando la hoja lo indica.
Si la hoja no dice el implemento y el ejercicio existe con barra y con otro implemento, es con barra
(ej. "Press plano" = "Press banca plano", "Curl de bíceps" = "Curl con barra", "Press militar" = "Press militar con barra").
Palabras que cambian el ejercicio aunque la hoja no nombre el implemento:
- "alternado" / "alternada": se hace con mancuernas. Asociálo al ejercicio equivalente con mancuernas
  (ej. "Press militar alternado" = "Press de hombros con mancuernas", "Curl alternado" = "Curl con mancuernas").
- "unilateral", "unipodal", "a una mano", "a un brazo", "a una pierna": se hace de un lado por vez.
  Si en la lista hay una versión que ya es de un lado (ej. "Remo unilateral" = "Remo con mancuerna"), usala.
  Si no, NO lo asocies a la versión de dos lados: creá uno nuevo con el nombre de la versión normal + " unilateral",
  con el mismo tipo y grupos (ej. "Tríceps polea unilateral" → nuevo "Extensión de tríceps en polea unilateral").
Solo si no hay ninguno equivalente dejá exerciseId vacío y completá SIEMPRE newName, newType, newPrimary y newSecondary
(newPrimary nunca vacío; los de zona media / core van a "Abdominales").

Tipos: barra = peso total de la barra; mancuerna = peso de una mancuerna; maquina = máquina o polea; corporal = sin peso.

${list}`;
}

// Devuelve { progression: [{ targets }], routines: [{ name, items: [{ written, prog, target, exerciseId, newExercise }] }] }
export async function readPlanPhoto(file) {
  const image = await toJpegBase64(file);
  const parts = [prompt(), { inlineData: { mimeType: 'image/jpeg', data: image } }];
  let lastErr;
  for (const name of MODELS) {
    try {
      const model = getGenerativeModel(ai, {
        model: name,
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
      });
      const res = await model.generateContent(parts);
      return clean(JSON.parse(res.response.text()));
    } catch (err) {
      lastErr = err;
      // Modelo retirado o saturado: se prueba el siguiente. Otros errores (sin internet, permisos) cortan acá.
      if (!/not found|not supported|high demand|overloaded|unavailable|\[(404|429|500|503) /i.test(err.message)) break;
    }
  }
  throw lastErr;
}

// Valida lo que devuelve Gemini: ids inexistentes pasan a ejercicio nuevo.
function clean(data) {
  const progression = (data.progression || [])
    .map((w) => ({ targets: (w.targets || []).map((t) => String(t).trim()) }))
    .filter((w) => w.targets.some(Boolean));
  const progs = Math.max(0, ...progression.map((w) => w.targets.length));
  return {
    progression,
    routines: (data.routines || []).map((r, i) => ({
      name: (r.name || '').trim() || `Día ${i + 1}`,
      items: (r.items || []).map((it) => {
        const known = state.exercises.has(it.exerciseId);
        const primary = GROUPS.includes(it.newPrimary) ? it.newPrimary : '';
        const own = (it.target || '').trim();
        const n = Math.round(Number(it.prog) || 0);
        // Con número sigue esa progresión; sin número pero con reps propias (zona media) es fijo; si no, la 1.
        const prog = !progs ? null : n >= 1 ? Math.min(n, progs) : own ? FIXED : 1;
        return {
          written: (it.written || '').trim(),
          prog,
          target: prog === null || prog === FIXED ? own : '',
          exerciseId: known ? it.exerciseId : null,
          newExercise: known ? null : {
            name: (it.newName || it.written || '').trim(),
            type: WEIGHT_TYPES[it.newType] ? it.newType : 'maquina',
            primary,
            secondary: [...new Set(it.newSecondary || [])].filter((g) => GROUPS.includes(g) && g !== primary),
          },
        };
      }),
    })).filter((r) => r.items.length),
  };
}

async function toJpegBase64(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}
