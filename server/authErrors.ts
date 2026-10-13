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

// Return fixed diagnostic labels, never raw SDK messages that might contain secrets.
export function credentialDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/invalid_grant|invalid jwt signature/i.test(message)) return 'credential-rejected-or-key-revoked';
  if (/ENOTFOUND|EAI_AGAIN|ECONN|fetch failed|network/i.test(message)) return 'google-connection-failed';
  if (/metadata|default credentials|credential.*not.*found|ENOENT/i.test(message)) return 'credentials-missing-or-file-unavailable';
  if (/private key|PEM|DECODER|parse.*key/i.test(message)) return 'private-key-format-invalid';
  if (error instanceof SyntaxError) return 'credential-json-invalid';
  if (/permission|PERMISSION_DENIED/i.test(message)) return 'credential-permission-denied';
  return 'unclassified';
}
