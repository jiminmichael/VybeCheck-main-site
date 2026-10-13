import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { firestore, adminAuth } from '../server/firebase';

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
test('emulator: private records and balances are protected by deployed rules', { skip: !enabled }, async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'vybecheck-6a8b7';
  const app = initializeApp({ apiKey: 'emulator-only', projectId }, `rules-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const client = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  connectFirestoreEmulator(client, host, Number(port));
  let uid = '';
  const other = `other-${Date.now()}`;
  try {
    const user = await createUserWithEmailAndPassword(auth, `test-${Date.now()}@example.com`, 'emulator-test-password');
    uid = user.user.uid;
    await firestore().collection('djs').doc(uid).set({ id: uid, availableBalance: 10 });
    await firestore().collection('djs').doc(other).set({ id: other, availableBalance: 100 });
    assert.equal((await getDoc(doc(client, 'djs', uid))).data()?.availableBalance, 10);
    await assert.rejects(getDoc(doc(client, 'djs', other)), /permission/i);
    await assert.rejects(setDoc(doc(client, 'djs', uid), { availableBalance: 100000 }), /permission/i);
    await assert.rejects(setDoc(doc(client, 'payments', 'forged'), { status: 'success', djId: uid }), /permission/i);
  } finally {
    if (uid) { await firestore().collection('djs').doc(uid).delete(); await adminAuth().deleteUser(uid); }
    await firestore().collection('djs').doc(other).delete();
    await terminate(client);
    await deleteApp(app);
  }
});
