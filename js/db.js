// Acceso a Firebase: login con Google y datos en Firestore (con caché offline).
// Las escrituras no se esperan (no se usa await) para que funcionen sin internet:
// Firestore las aplica al instante en la caché local y las sube cuando hay conexión.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { firebaseConfig, appCheckSiteKey } from './firebase-config.js';
import { mergeExercises, isCatalogId } from './data.js';
import { state, emit } from './store.js';
import { toast } from './ui.js';

export const app = initializeApp(firebaseConfig);

// App Check va antes que Firestore y Gemini para que todos sus pedidos lleven el comprobante.
// En localhost usa un token de depuración: la consola del navegador lo muestra la primera vez
// y hay que registrarlo en Firebase → App Check → Apps → Administrar tokens de depuración.
if (appCheckSiteKey && typeof location !== 'undefined') {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}
const auth = getAuth(app);
const fs = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const COLLECTIONS = ['exercises', 'routines', 'sessions', 'bodyweight'];
let unsubscribers = [];

const col = (name) => collection(fs, 'users', state.user.uid, name);

export async function login() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      toast('No se pudo iniciar sesión: ' + err.message);
    }
  }
}

export function logout() {
  return signOut(auth);
}

export function watchAuth() {
  onAuthStateChanged(auth, async (user) => {
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    state.user = user;
    state.loaded = {};
    COLLECTIONS.forEach((c) => { state[c] = c === 'exercises' ? mergeExercises([]) : []; });
    state.authReady = true;
    emit();
    if (!user) return;
    COLLECTIONS.forEach(listen);
  });
}

function listen(name) {
  const unsub = onSnapshot(col(name), (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (name === 'exercises') {
      state.exercises = mergeExercises(docs); // catálogo + los del usuario
    } else if (name === 'sessions') {
      docs.sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
      state.sessions = docs;
    } else if (name === 'routines') {
      // Por nombre, con los números en orden (Día 1, Día 2… Día 10), sin importar cuál se cargó primero.
      docs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { numeric: true, sensitivity: 'base' })
        || (a.createdAt || '').localeCompare(b.createdAt || ''));
      state.routines = docs;
    } else {
      docs.sort((a, b) => a.date.localeCompare(b.date));
      state.bodyweight = docs;
    }
    state.loaded[name] = true;
    emit();
  }, (err) => toast('Error leyendo datos: ' + err.message));
  unsubscribers.push(unsub);
}

// Guarda un documento (crea uno nuevo si no tiene id). Devuelve el id.
export function save(name, data) {
  const { id, ...rest } = data;
  const ref = id ? doc(col(name), id) : doc(col(name));
  if (!rest.createdAt) rest.createdAt = new Date().toISOString();
  setDoc(ref, rest).catch((err) => toast('Error guardando: ' + err.message));
  return ref.id;
}

// Borrar un ejercicio del catálogo no borra nada (no es del usuario): se guarda que lo ocultó.
export function removeExercise(id) {
  if (isCatalogId(id)) save('exercises', { id, hidden: true });
  else remove('exercises', id);
}

export function remove(name, id) {
  deleteDoc(doc(col(name), id)).catch((err) => toast('Error borrando: ' + err.message));
}
