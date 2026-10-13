export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function apiErrorResponse(error: unknown) {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Cloud Firestore API') && (message.includes('disabled') || message.includes('has not been used'))) {
    return { status: 503, message: 'Cloud Firestore is not enabled for this Firebase project. Enable the Cloud Firestore API and create the default Firestore database in Firebase Console, then retry. If you just enabled it, allow a few minutes for activation.' };
  }
  return { status: 500, message: 'Server request failed. Check Firebase server configuration and logs.' };
}
export function text(value: unknown, label: string, max = 200, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return value.trim();
}
export function documentId(value: unknown): string {
  const id = text(value, 'document ID', 150);
  if (id.includes('/') || id === '.' || id === '..') throw new HttpError(400, 'Invalid document ID.');
  return id;
}
export function amountInKobo(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001) {
    throw new HttpError(400, 'Enter a valid amount with at most two decimal places.');
  }
  return Math.round(amount * 100);
}
export const profileFields = ['name', 'stageName', 'handle', 'bio', 'avatarUrl', 'coverUrl', 'phone', 'instagramHandle', 'twitterHandle', 'genres', 'defaultVenue', 'minTipAmount', 'qrTheme', 'customQrTagline', 'bankName', 'bankCode', 'accountNumber', 'accountName'];
export function profilePatch(input: Record<string, unknown>) {
  const patch: Record<string, any> = {};
  for (const key of profileFields) {
    if (input[key] === undefined) continue;
    if (key === 'genres') {
      if (!Array.isArray(input[key]) || input[key].length > 20 || input[key].some(v => typeof v !== 'string' || v.length > 40)) throw new HttpError(400, 'Invalid genres.');
      patch[key] = input[key];
    } else if (key === 'minTipAmount') {
      const amount = Number(input[key]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw new HttpError(400, 'Invalid minimum tip.');
      patch[key] = amount;
    } else {
      patch[key] = text(input[key], key, key.endsWith('Url') ? 3000 : 1000, ['name', 'stageName', 'handle'].includes(key));
      if (key.endsWith('Url') && patch[key] && !/^https:\/\//.test(patch[key])) throw new HttpError(400, 'Images must use HTTPS URLs.');
    }
  }
  if (patch.handle && !/^[a-z0-9_-]{3,40}$/.test(patch.handle)) throw new HttpError(400, 'Use 3–40 lowercase letters, numbers, underscores or hyphens for your handle.');
  return patch;
}
export function publicProfile(profile: Record<string, any>) {
  return Object.fromEntries(['id', 'name', 'stageName', 'handle', 'bio', 'avatarUrl', 'coverUrl', 'genres', 'defaultVenue', 'minTipAmount', 'qrTheme', 'customQrTagline', 'instagramHandle', 'twitterHandle', 'createdAt'].filter(k => profile[k] !== undefined).map(k => [k, profile[k]]));
}
export function validateVerifiedPayment(payment: any, verified: any) {
  if (verified.status !== 'success' || verified.currency !== 'NGN' || verified.reference !== payment.reference || verified.amount !== payment.amountKobo || verified.metadata?.requestId !== payment.requestId) {
    throw new HttpError(400, 'Payment details do not match this checkout.');
  }
}
