import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { reconcilePendingPayouts } from '../server/firebaseRoutes';
import app from '../server/app';

export const api = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: ['PAYSTACK_SECRET_KEY', 'ACR_ACCESS_KEY', 'ACR_ACCESS_SECRET'],
}, app);

export const reconcilePayouts = onSchedule({
  schedule: 'every 10 minutes', region: 'us-central1', timeoutSeconds: 540,
  secrets: ['PAYSTACK_SECRET_KEY'],
}, async () => { await reconcilePendingPayouts(); });
