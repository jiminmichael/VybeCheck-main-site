import { onRequest } from 'firebase-functions/v2/https';
import app from '../server/app';

export const api = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: ['PAYSTACK_SECRET_KEY', 'GEMINI_API_KEY'],
}, app);
