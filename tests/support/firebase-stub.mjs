// Reemplazo de los módulos de Firebase (www.gstatic.com) para correr la app en Node sin red.
// Exporta los mismos nombres que importan js/db.js y js/plan-import.js; no hacen nada.
// Las escrituras se anotan en `writes` para que los tests puedan revisarlas.

export const writes = [];

const noop = () => ({});
const resolved = () => Promise.resolve();
class Noop {}

export const doc = (...path) => ({ id: `doc${writes.length}`, path });
export const setDoc = (ref, data) => { writes.push({ op: 'set', ref, data }); return resolved(); };
export const deleteDoc = (ref) => { writes.push({ op: 'delete', ref }); return resolved(); };
export const getDoc = () => Promise.resolve({ exists: () => true, data: () => ({ seeded: true, cardioSeeded: true }) });
export const getDocs = () => Promise.resolve({ docs: [] });
export const writeBatch = () => ({ set: noop, commit: resolved });

export {
  noop as initializeApp, noop as initializeAppCheck, Noop as ReCaptchaEnterpriseProvider,
  noop as getAuth, Noop as GoogleAuthProvider, resolved as signInWithPopup, resolved as signInWithRedirect,
  noop as onAuthStateChanged, resolved as signOut,
  noop as initializeFirestore, noop as persistentLocalCache, noop as persistentMultipleTabManager,
  noop as collection, noop as onSnapshot,
  noop as getAI, noop as getGenerativeModel, Noop as GoogleAIBackend,
};

export const Schema = new Proxy({}, { get: () => noop });
