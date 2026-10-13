import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { readApiResponse } from './apiResponse';

const env = (import.meta as any).env || {};
// Firebase web configuration is public. Access is enforced by Auth and rules.
export const firebaseApp = getApps().length ? getApp() : initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyA60N6tpLTMlaaX9sYm9wGfpj0h5LQVcBs',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'vybecheck-6a8b7.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'vybecheck-6a8b7',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'vybecheck-6a8b7.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '175960831558',
  appId: env.VITE_FIREBASE_APP_ID || '1:175960831558:web:fa6c7e266184f4996fbc47',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BWX9MBN2W3',
});

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
if (env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

export async function api<T = any>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return readApiResponse<T>(response, path);
}

export async function saveProfileImage(value: string | undefined, type: 'avatar' | 'cover') {
  if (!value?.startsWith('data:')) return value;
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before uploading an image.');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(value)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (value.length > 7_000_000) throw new Error('Choose an image smaller than 5 MB.');
  const image = ref(storage, `profiles/${user.uid}/${type}-${crypto.randomUUID()}`);
  await uploadString(image, value, 'data_url');
  return getDownloadURL(image);
}
