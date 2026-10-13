import test from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorResponse, HttpError } from '../server/domain';

test('disabled Firestore gives an actionable service-unavailable response', () => {
  const result = apiErrorResponse(new Error('7 PERMISSION_DENIED: Cloud Firestore API has not been used in project example before or it is disabled.'));
  assert.equal(result.status, 503);
  assert.match(result.message, /Enable the Cloud Firestore API/);
});
test('unrecognized backend errors do not expose internal details', () => {
  assert.equal(apiErrorResponse(new Error('private credential contents')).message, 'Server request failed. Check Firebase server configuration and logs.');
  assert.deepEqual(apiErrorResponse(new HttpError(401, 'Sign in to continue.')), { status: 401, message: 'Sign in to continue.' });
});
