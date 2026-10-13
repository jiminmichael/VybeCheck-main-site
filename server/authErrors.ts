import { HttpError } from './domain.js';

export function tokenVerificationError(error: unknown): HttpError {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked') {
    return new HttpError(401, 'Your session expired. Please sign in again.');
  }
  if (code === 'auth/user-disabled') {
    return new HttpError(403, 'Your account has been disabled. Contact support.');
  }
  if (code === 'auth/argument-error' || code === 'auth/invalid-id-token' || code === 'auth/user-not-found') {
    return new HttpError(401, 'Your sign-in could not be verified. Please sign in again.');
  }
  return new HttpError(503, 'The server could not verify your sign-in. Check Firebase Admin credentials and permissions, then try again.');
}
