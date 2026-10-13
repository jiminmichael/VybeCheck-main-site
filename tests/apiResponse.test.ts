import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../src/services/apiResponse';

test('empty missing profile route gives an actionable error', async () => {
  await assert.rejects(readApiResponse(new Response(null, { status: 404 }), '/api/auth/profile'), /endpoint.*unavailable.*Restart/);
});
test('SPA HTML fallback cannot be mistaken for a successful API response', async () => {
  await assert.rejects(readApiResponse(new Response('<html>App</html>', { headers: { 'Content-Type': 'text/html' } }), '/api/auth/profile'), /endpoint.*unavailable/);
});
test('JSON API errors preserve the server message', async () => {
  await assert.rejects(readApiResponse(Response.json({ success: false, error: 'Sign in to continue.' }, { status: 401 }), '/api/auth/profile'), /Sign in to continue/);
});
test('valid JSON profile response is returned intact', async () => {
  const result = { success: true, dj: { id: 'test' } };
  assert.deepEqual(await readApiResponse(Response.json(result), '/api/auth/profile'), result);
});
