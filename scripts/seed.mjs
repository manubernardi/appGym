// Carga los usuarios de prueba (js/dev.js) y sus datos (scripts/seed-data.mjs) en los emuladores de Firebase.
// Escribe como cada usuario, con las reglas de seguridad activas: si un documento de prueba no cumple las reglas, falla acá.

import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, writeBatch } from 'firebase/firestore';

import { DEV_USERS, DEV_PASSWORD, DEV_PROJECT, DEV_PORTS } from '../js/dev.js';
import { seedData } from './seed-data.mjs';

const app = initializeApp({ apiKey: 'demo-key', projectId: DEV_PROJECT });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://127.0.0.1:${DEV_PORTS.auth}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', DEV_PORTS.firestore);

async function signIn(user) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, user.email, DEV_PASSWORD);
    await updateProfile(cred.user, { displayName: user.name });
    return cred.user;
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') throw err;
    return (await signInWithEmailAndPassword(auth, user.email, DEV_PASSWORD)).user;
  }
}

export async function seedAll() {
  for (const user of DEV_USERS) {
    const { uid } = await signIn(user);
    const data = seedData(user.profile);
    const writes = Object.entries(data).flatMap(([col, docs]) => docs.map(({ id, ...rest }) => [`users/${uid}/${col}/${id}`, rest]));
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      writes.slice(i, i + 400).forEach(([path, rest]) => batch.set(doc(db, path), rest));
      await batch.commit();
    }
    console.log(`  ${user.name.padEnd(16)} ${user.email.padEnd(22)} ${data.sessions.length} entrenamientos, ${data.bodyweight.length} pesos`);
    await signOut(auth);
  }
}
