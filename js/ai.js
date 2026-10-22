// Gemini (Firebase AI Logic, plan gratuito): lo usan la lectura del plan desde foto y el resumen del reporte del plan.

import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

import { app } from './db.js';
import { DEV } from './dev.js';

// Si el primero deja de estar disponible, se prueba el siguiente.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

const ai = getAI(app, { backend: new GoogleAIBackend() });

// Pide a Gemini y devuelve el texto de la respuesta. generationConfig: formato de la respuesta (JSON, esquema…).
export async function generate(parts, generationConfig) {
  // El proyecto de prueba es falso: Gemini no anda ahí.
  if (DEV) throw new Error('En el entorno de prueba no hay Gemini (es un proyecto falso)');
  let lastErr;
  for (const name of MODELS) {
    try {
      const model = getGenerativeModel(ai, { model: name, ...(generationConfig ? { generationConfig } : {}) });
      const res = await model.generateContent(parts);
      return res.response.text();
    } catch (err) {
      lastErr = err;
      // Modelo retirado o saturado: se prueba el siguiente. Otros errores (sin internet, permisos) cortan acá.
      if (!/not found|not supported|high demand|overloaded|unavailable|\[(404|429|500|503) /i.test(err.message)) break;
    }
  }
  throw lastErr;
}
