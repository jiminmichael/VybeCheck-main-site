import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialDiagnostic, tokenVerificationError } from '../server/authErrors.js';

test('credential and network failures are not reported as expired sessions', () => {
  for (const code of ['app/invalid-credential', 'auth/invalid-credential', 'auth/insufficient-permission', 'app/network-error', undefined]) {
    const error = tokenVerificationError({ code });
    assert.equal(error.status, 503);
    assert.match(error.message, /Firebase Admin credentials/);
  }
});
test('expired and revoked sessions require sign-in; disabled accounts remain forbidden', () => {
  for (const code of ['auth/id-token-expired', 'auth/id-token-revoked']) {
    assert.equal(tokenVerificationError({ code }).status, 401);
    assert.match(tokenVerificationError({ code }).message, /session expired/);
  }
  assert.equal(tokenVerificationError({ code: 'auth/user-disabled' }).status, 403);
  assert.equal(tokenVerificationError({ code: 'auth/invalid-id-token' }).status, 401);
});

test('credential diagnostics identify common failures without exposing SDK messages', () => {
  const cases = [
    ['invalid_grant: Invalid JWT Signature', 'credential-rejected-or-key-revoked'],
    ['getaddrinfo ENOTFOUND oauth2.googleapis.com', 'google-connection-failed'],
    ['Could not load the default credentials', 'credentials-missing-or-file-unavailable'],
    ['Failed to parse private key', 'private-key-format-invalid'],
    ['PERMISSION_DENIED', 'credential-permission-denied'],
    ['sensitive credential content', 'unclassified'],
  ];
  for (const [message, diagnostic] of cases) assert.equal(credentialDiagnostic(new Error(message)), diagnostic);
  assert.equal(credentialDiagnostic(new SyntaxError('secret JSON')), 'credential-json-invalid');
});
