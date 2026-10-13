import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenVerificationError } from '../server/authErrors.js';

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
