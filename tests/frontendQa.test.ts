import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSuggestionIndex } from '../src/services/suggestionNavigation';
import { requestPageUrl, trackingPageUrl, decodeLinkIdentifier } from '../src/services/requestLinks';
import { DJBoothSoundEngine } from '../src/services/soundEffects';
import { musicService } from '../src/services/musicService';
import { ApiResponseError, readApiResponse } from '../src/services/apiResponse';

test('suggestion navigation wraps in both directions and handles an empty list', () => {
  assert.equal(nextSuggestionIndex('ArrowUp', -1, 3), 2);
  assert.equal(nextSuggestionIndex('ArrowDown', -1, 3), 0);
  assert.equal(nextSuggestionIndex('ArrowUp', 0, 3), 2);
  assert.equal(nextSuggestionIndex('ArrowDown', 2, 3), 0);
  assert.equal(nextSuggestionIndex('ArrowDown', 0, 0), -1);
});
test('request and tracking links round-trip identifiers and omit unselected sessions', () => {
  assert.equal(requestPageUrl('https://example.com', undefined), '');
  assert.equal(requestPageUrl('https://example.com', 'live session'), 'https://example.com/#request/live%20session');
  const code = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(trackingPageUrl('https://example.com', code), `https://example.com/#track/${code}`);
  assert.equal(decodeLinkIdentifier('live%20session'), 'live session');
  assert.equal(decodeLinkIdentifier('%invalid'), '%invalid');
});
test('sound preferences survive new engine instances and tolerate unavailable storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const engine = new DJBoothSoundEngine(storage);
  let notifications = 0;
  const unsubscribe = engine.subscribePreference(() => notifications++);
  engine.setSoundEnabled(false);
  assert.equal(new DJBoothSoundEngine(storage).isEnabled(), false);
  assert.equal(notifications, 1);
  unsubscribe();
  const blocked = new DJBoothSoundEngine({ getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } });
  blocked.setSoundEnabled(false);
  assert.equal(blocked.isEnabled(), false);
});
test('catalog failure is distinct from a successful empty search', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
    assert.deepEqual(await musicService.searchTracks('qa-empty-unique'), []);
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(musicService.searchTracks('qa-failure-unique'), /manually/);
  } finally { globalThis.fetch = original; }
});
test('tracking can distinguish confirmed 404 from backend failures', async () => {
  await assert.rejects(readApiResponse(new Response('{"success":false,"error":"Request not found."}', { status: 404 }), '/track'), (error: unknown) => error instanceof ApiResponseError && error.status === 404);
  await assert.rejects(readApiResponse(new Response('{"success":false,"error":"Unavailable"}', { status: 503 }), '/track'), (error: unknown) => error instanceof ApiResponseError && error.status === 503);
});
