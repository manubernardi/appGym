// Lectura del plan desde una foto con Gemini (Firebase AI Logic, plan gratuito).
// Gemini recibe la foto y tu lista de ejercicios: asocia cada renglón a uno existente
// aunque esté escrito distinto, y si no existe propone crearlo con tipo y grupos.

import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

import { app } from './db.js';
import { GROUPS, WEIGHT_TYPES } from './data.js';
import { state } from './store.js';

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
          name: Schema.string({ description: 'Nombre de la rutina, ej. "Día A". Si la hoja no lo dice: Día A, Día B…' }),
          items: Schema.array({
            items: Schema.object({
              properties: {
                written: Schema.string({ description: 'El ejercicio tal como está escrito en la hoja' }),
                prog: Schema.integer({ description: 'Número de progresión entre paréntesis al lado del ejercicio, ej. "Press (2)" = 2. 0 si no tiene.' }),
                target: Schema.string({ description: 'Solo si la hoja no tiene tabla de progresión: series y reps escritas al lado, ej. "3X10". Si no, vacío.' }),
                exerciseId: Schema.string({ description: 'id del ejercicio existente equivalente, o "" si no hay ninguno' }),
                newName: Schema.string({ description: 'Solo si exerciseId es "": nombre claro para el ejercicio nuevo' }),
                newType: Schema.enumString({ enum: Object.keys(WEIGHT_TYPES) }),
                newPrimary: Schema.enumString({ enum: GROUPS }),
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

Formato habitual del plan:
- Columnas DIA 1, DIA 2, DIA 3… con la lista de ejercicios de cada día.
- Al lado de algunos ejercicios hay un número entre paréntesis, ej. "Sentadilla (2)": es el número de progresión que sigue ese ejercicio (va en "prog"). Si no tiene número, prog = 0.
- Abajo hay una tabla "Progresión semanal": el encabezado tiene los números de progresión (1, 2, 3…) como COLUMNAS,
  y cada FILA es una semana (semana 1, 2, 3, 4…), con series x reps en cada celda.
  Copiala en "progression": un elemento por fila/semana en orden, con las celdas de esa fila en orden de columna.
  Ej. encabezado "1 2 3" y primera fila "A B C" → semana 1: progresión 1 = A, progresión 2 = B, progresión 3 = C.
  La cantidad de semanas, la de progresiones y los valores de cada celda cambian de un plan a otro:
  copiá exactamente lo que dice la hoja, sin inventar ni completar celdas.
- Si la hoja no tiene tabla, dejá "progression" vacío y poné en "target" las series x reps escritas al lado de cada ejercicio.

Para cada ejercicio buscá el equivalente en esta lista (id | nombre | tipo | grupo principal).
Asociálo aunque esté escrito distinto, abreviado o con sinónimos
(ej. "press banco barra" = "Press banca plano", "polea al pecho" = "Jalón al pecho", "vuelos laterales" = "Elevaciones laterales").
Fijate que coincida el implemento (barra, mancuerna, máquina, polea) cuando la hoja lo indica.
Solo si no hay ninguno equivalente dejá exerciseId vacío y completá newName, newType, newPrimary y newSecondary.

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
      if (!/not found|404|not supported/i.test(err.message)) break;
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
      name: (r.name || '').trim() || `Día ${String.fromCharCode(65 + i)}`,
      items: (r.items || []).map((it) => {
        const known = state.exercises.has(it.exerciseId);
        const primary = GROUPS.includes(it.newPrimary) ? it.newPrimary : '';
        return {
          written: (it.written || '').trim(),
          // Sin número de progresión se asume la 1.
          prog: progs ? Math.min(Math.max(Number(it.prog) || 1, 1), progs) : null,
          target: progs ? '' : (it.target || '').trim(),
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
