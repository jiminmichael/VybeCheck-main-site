import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || 'vybecheck-6a8b7';
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vybecheck-6a8b7.firebasestorage.app',
    ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : {
      credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
    }),
  });
}
export const adminAuth = () => getAuth(adminApp());
export const firestore = () => getFirestore(adminApp());
