// Configuración del proyecto de Firebase.
// Estos datos no son secretos: la seguridad la dan las reglas de Firestore.

export const firebaseConfig = {
  apiKey: 'AIzaSyCKDwElHZScb-BfJ5rzNm0xG4OB_ZnCYmA',
  authDomain: 'appgym-a1d91.firebaseapp.com',
  projectId: 'appgym-a1d91',
  storageBucket: 'appgym-a1d91.firebasestorage.app',
  messagingSenderId: '931985524020',
  appId: '1:931985524020:web:0ae51a0e958e848bb45161',
};

// App Check: clave del sitio de reCAPTCHA v3 (https://www.google.com/recaptcha/admin, dominio manubernardi.github.io).
// Hace que solo esta app pueda usar Firestore y Gemini del proyecto. Vacía = App Check apagado.
// Tampoco es secreta. Pasos para activarlo en el README ("App Check").
export const appCheckSiteKey = '';
