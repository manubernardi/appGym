// Entorno de prueba (npm run dev): la app corre en tu PC contra los emuladores de Firebase, con usuarios de prueba.
// Se reconoce por el puerto: la app real nunca se sirve en el 5050.
// Lo usan la app (js/db.js, js/app.js) y el script que carga los datos de prueba (scripts/seed.mjs).

export const DEV_PORTS = { app: 5050, auth: 9099, firestore: 8080, ui: 4000 };

// Proyecto "demo-": Firebase garantiza que nunca usa nada real (ni base de datos, ni login, ni cuotas).
export const DEV_PROJECT = 'demo-appgym';

export const DEV = typeof location !== 'undefined' && location.port === String(DEV_PORTS.app);

export const DEV_PASSWORD = 'prueba123';

// Usuarios de prueba. Los datos de cada uno los arma scripts/seed-data.mjs según `profile`.
export const DEV_USERS = [
  { email: 'manu@prueba.com', name: 'Manu (prueba)', profile: 'full', about: 'Plan de 4 semanas en curso, 4 meses de historial y peso corporal' },
  { email: 'terminado@prueba.com', name: 'Plan terminado', profile: 'finished', about: 'Terminó el plan hace unos días: aviso y reporte del plan' },
  { email: 'nuevo@prueba.com', name: 'Usuario nuevo', profile: 'empty', about: 'Sin datos: como alguien que recién instala la app' },
];
